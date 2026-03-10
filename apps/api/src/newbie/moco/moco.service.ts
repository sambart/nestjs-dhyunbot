import { InjectDiscordClient } from '@discord-nestjs/core';
import { Injectable, Logger } from '@nestjs/common';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  EmbedBuilder,
  TextChannel,
} from 'discord.js';

import { NewbieConfig } from '../domain/newbie-config.entity';
import { NewbieConfigRepository } from '../infrastructure/newbie-config.repository';
import { NEWBIE_CUSTOM_ID } from '../infrastructure/newbie-custom-id.constants';
import { NewbieMocoTemplateRepository } from '../infrastructure/newbie-moco-template.repository';
import { NewbieRedisRepository } from '../infrastructure/newbie-redis.repository';
import {
  DEFAULT_MOCO_BODY_TEMPLATE,
  DEFAULT_MOCO_FOOTER_TEMPLATE,
  DEFAULT_MOCO_FOOTER_TEMPLATE_NO_INTERVAL,
  DEFAULT_MOCO_ITEM_TEMPLATE,
  DEFAULT_MOCO_SCORING_TEMPLATE,
  DEFAULT_MOCO_TITLE_TEMPLATE,
} from '../infrastructure/newbie-template.constants';
import { applyTemplate } from '../util/newbie-template.util';
import { getMocoPeriodBounds } from '../util/moco-period.util';

/** 페이지당 사냥꾼 수 */
const PAGE_SIZE = 1;

@Injectable()
export class MocoService {
  private readonly logger = new Logger(MocoService.name);

  constructor(
    private readonly configRepo: NewbieConfigRepository,
    private readonly newbieRedis: NewbieRedisRepository,
    private readonly mocoTmplRepo: NewbieMocoTemplateRepository,
    @InjectDiscordClient() private readonly discordClient: Client,
  ) {}

  /**
   * 순위 Embed + 페이지네이션 버튼을 구성하여 반환한다.
   * 인터랙션 핸들러(NewbieInteractionHandler)에서 호출하여 interaction.update()에 사용.
   *
   * @param guildId 서버 ID
   * @param page 표시할 페이지 (1-indexed)
   * @returns { embeds, components } — interaction.update() 페이로드
   */
  async buildRankPayload(
    guildId: string,
    page: number,
  ): Promise<{
    embeds: EmbedBuilder[];
    components: ActionRowBuilder<ButtonBuilder>[];
  }> {
    const totalCount = await this.newbieRedis.getMocoRankCount(guildId);
    // 페이지당 1명이므로 totalPages = totalCount (최소 1)
    const totalPages = Math.max(1, totalCount);

    // page 범위 클램핑
    const safePage = Math.min(Math.max(1, page), totalPages);

    // ZREVRANGE WITH SCORES — 0-indexed offset으로 1명 조회
    const rankEntries = await this.newbieRedis.getMocoRankPage(guildId, safePage, PAGE_SIZE);

    const config = await this.configRepo.findByGuildId(guildId);

    if (rankEntries.length === 0) {
      const emptyEmbed = new EmbedBuilder()
        .setTitle('모코코 사냥 순위')
        .setDescription('아직 기록된 사냥꾼이 없습니다.')
        .setColor(config?.mocoEmbedColor ? (config.mocoEmbedColor as `#${string}`) : 0x5865f2);
      return {
        embeds: [emptyEmbed],
        components: [],
      };
    }

    const { hunterId, totalMinutes } = rankEntries[0];

    // 사냥꾼 메타 정보 조회 (점수, 세션 수, 유니크 모코코 수)
    const meta = await this.newbieRedis.getMocoHunterMeta(guildId, hunterId);
    const score = meta?.score ?? Math.round(totalMinutes);
    const sessionCount = meta?.sessionCount ?? 0;
    const uniqueNewbieCount = meta?.uniqueNewbieCount ?? 0;
    const channelMinutes = meta?.totalMinutes ?? Math.round(totalMinutes);

    // 모코코별 세션 횟수 조회
    const newbieSessions = await this.newbieRedis.getMocoNewbieSessions(guildId, hunterId);

    // 사냥꾼별 신규사용자 상세 조회 (HGETALL)
    const details = await this.newbieRedis.getMocoHunterDetail(guildId, hunterId);

    // Discord displayName 조회
    let hunterName = hunterId;
    const newbieNames: Record<string, string> = {};

    try {
      const guild = this.discordClient.guilds.cache.get(guildId);
      if (!guild) throw new Error(`Guild ${guildId} not found in cache`);
      const hunterMember = await guild.members.fetch(hunterId).catch(() => null);
      hunterName = hunterMember?.displayName ?? hunterId;

      for (const newbieId of Object.keys(details)) {
        const m = await guild.members.fetch(newbieId).catch(() => null);
        newbieNames[newbieId] = m?.displayName ?? newbieId;
      }
    } catch (err) {
      this.logger.warn(
        `[MOCO] Failed to fetch guild ${guildId}, using fallback IDs`,
        (err as Error).stack,
      );
      for (const newbieId of Object.keys(details)) {
        newbieNames[newbieId] = newbieId;
      }
    }

    const embed = await this.buildHunterEmbed(
      safePage, // rank = 페이지 번호 = 순위
      hunterName,
      hunterId,
      channelMinutes,
      details,
      newbieNames,
      safePage,
      totalPages,
      config,
      guildId,
      score,
      sessionCount,
      uniqueNewbieCount,
      newbieSessions,
    );

    const components = this.buildButtons(guildId, safePage, totalPages);

    return { embeds: [embed], components: [components] };
  }

  /**
   * 기존 모코코 순위 Embed 메시지를 삭제한다.
   * 설정 저장 시 Embed를 새로 작성하기 위해 컨트롤러에서 호출한다.
   */
  async deleteEmbed(channelId: string, messageId: string): Promise<void> {
    try {
      const channel = (await this.discordClient.channels
        .fetch(channelId)
        .catch(() => null)) as TextChannel | null;
      if (channel) {
        const message = await channel.messages.fetch(messageId).catch(() => null);
        if (message) {
          await message.delete();
        }
      }
    } catch (err) {
      this.logger.warn(
        `[MOCO] Failed to delete old embed: channel=${channelId} message=${messageId}`,
        (err as Error).stack,
      );
    }
  }

  /**
   * 순위 Embed를 생성하고 설정된 채널에 전송(최초) 또는 수정(이후)한다.
   *
   * - 최초 전송: mocoRankMessageId가 없을 때 새 메시지 전송 후 DB에 messageId 저장
   * - 이후 호출: 기존 메시지를 editMessage로 수정
   */
  async sendOrUpdateRankEmbed(guildId: string, page: number): Promise<void> {
    const config = await this.configRepo.findByGuildId(guildId);
    if (!config?.mocoRankChannelId) {
      this.logger.warn(`[MOCO] mocoRankChannelId not set: guild=${guildId}`);
      return;
    }

    const payload = await this.buildRankPayload(guildId, page);
    const channel = (await this.discordClient.channels
      .fetch(config.mocoRankChannelId)
      .catch(() => null)) as TextChannel | null;

    if (!channel) {
      this.logger.warn(`[MOCO] Channel not found: ${config.mocoRankChannelId}`);
      return;
    }

    if (config.mocoRankMessageId) {
      try {
        const message = await channel.messages.fetch(config.mocoRankMessageId);
        await message.edit(payload);
        return;
      } catch {
        // 메시지가 삭제된 경우 — 기존 ID 초기화 후 새로 전송
        this.logger.warn(
          `[MOCO] Failed to edit message ${config.mocoRankMessageId}, sending new message`,
        );
        await this.configRepo.updateMocoRankMessageId(guildId, null);
      }
    }

    // 최초 전송 — send 성공 후 즉시 messageId 저장
    try {
      const sent = await channel.send(payload);
      await this.configRepo.updateMocoRankMessageId(guildId, sent.id);
    } catch (err) {
      this.logger.error(
        `[MOCO] Failed to send rank embed: guild=${guildId}`,
        (err as Error).stack,
      );
    }
  }

  /**
   * 내부: 사냥꾼 1명에 대한 순위 Embed 구성.
   * NewbieMocoTemplate 테이블의 템플릿 필드를 사용하며, null이면 DEFAULT_* 상수로 fallback.
   * async로 변환: DB 조회가 필요하기 때문.
   */
  private async buildHunterEmbed(
    rank: number,
    hunterName: string,
    hunterId: string,
    totalMinutes: number,
    details: Record<string, number>,
    newbieNames: Record<string, string>,
    currentPage: number,
    totalPages: number,
    config: NewbieConfig | null,
    guildId: string,
    score: number,
    sessionCount: number,
    uniqueNewbieCount: number,
    newbieSessions: Record<string, number>,
  ): Promise<EmbedBuilder> {
    // 1. 템플릿 조회 및 fallback
    const tmpl = await this.mocoTmplRepo.findByGuildId(guildId);
    const titleTemplate = tmpl?.titleTemplate ?? DEFAULT_MOCO_TITLE_TEMPLATE;
    const bodyTemplate = tmpl?.bodyTemplate ?? DEFAULT_MOCO_BODY_TEMPLATE;
    const itemTemplate = tmpl?.itemTemplate ?? DEFAULT_MOCO_ITEM_TEMPLATE;

    // 2. footerTemplate: DB 값 없을 때 interval 유무에 따라 기본값 분기
    const autoRefreshMinutes = config?.mocoAutoRefreshMinutes ?? null;
    const resolvedFooterTemplate =
      tmpl?.footerTemplate ??
      (autoRefreshMinutes !== null
        ? DEFAULT_MOCO_FOOTER_TEMPLATE
        : DEFAULT_MOCO_FOOTER_TEMPLATE_NO_INTERVAL);

    // 3. 항목 렌더링 (details 각 항목, 많이 함께한 순 정렬)
    const renderedItems = Object.entries(details)
      .sort(([, a], [, b]) => b - a)
      .map(([newbieId, minutes]) => {
        const newbieName = newbieNames[newbieId] ?? newbieId;
        return applyTemplate(itemTemplate, {
          newbieName,
          newbieMention: `<@${newbieId}>`,
          minutes: String(minutes),
          sessions: String(newbieSessions[newbieId] ?? 0),
        });
      });

    const mocoList = renderedItems.join('\n') || '없음';

    // 4. 본문 렌더링
    let resolvedBody = applyTemplate(bodyTemplate, {
      totalMinutes: String(totalMinutes),
      mocoList,
      score: String(score),
      sessionCount: String(sessionCount),
      uniqueNewbieCount: String(uniqueNewbieCount),
    });

    // 4-1. 점수 산정 템플릿 렌더링
    const scoringTmpl = tmpl?.scoringTemplate ?? undefined;
    if (scoringTmpl !== '') { // empty string = 관리자가 점수 안내를 숨김 처리; null/undefined = 기본 템플릿 사용
      const resolvedScoringTemplate = scoringTmpl ?? DEFAULT_MOCO_SCORING_TEMPLATE;
      const renderedScoring = applyTemplate(resolvedScoringTemplate, {
        scorePerSession: String(config?.mocoScorePerSession ?? 10),
        scorePerMinute: String(config?.mocoScorePerMinute ?? 1),
        scorePerUnique: String(config?.mocoScorePerUnique ?? 5),
        minCoPresence: String(config?.mocoMinCoPresenceMin ?? 10),
      });
      resolvedBody = resolvedBody + '\n\n' + renderedScoring;
    }

    // 5. 제목 렌더링
    const resolvedTitle = applyTemplate(titleTemplate, {
      rank: String(rank),
      hunterName,
      hunterMention: `<@${hunterId}>`,
    });

    // 6. 푸터 렌더링
    const periodBounds = getMocoPeriodBounds(config ?? {});
    const resolvedFooter = applyTemplate(resolvedFooterTemplate, {
      currentPage: String(currentPage),
      totalPages: String(totalPages),
      interval: autoRefreshMinutes !== null ? String(autoRefreshMinutes) : '',
      periodStart: periodBounds?.periodStart ?? '',
      periodEnd: periodBounds?.periodEnd ?? '',
    });

    // 7. EmbedBuilder 구성
    const embed = new EmbedBuilder()
      .setTitle(resolvedTitle)
      .setDescription(resolvedBody)
      .setFooter({ text: resolvedFooter })
      .setColor(config?.mocoEmbedColor ? (config.mocoEmbedColor as `#${string}`) : 0x5865f2);

    if (config?.mocoEmbedThumbnailUrl) {
      embed.setThumbnail(config.mocoEmbedThumbnailUrl);
    }

    return embed;
  }

  /**
   * 특정 사용자의 모코코 사냥 시간 Ephemeral 메시지 내용을 구성한다.
   * 총 사냥 시간, 순위, 모코코별 상세 시간을 포함한다.
   */
  async buildMyHuntingMessage(guildId: string, userId: string): Promise<string> {
    const [totalMinutes, rank, totalCount, details, meta, newbieSessions] = await Promise.all([
      this.newbieRedis.getMocoHunterScore(guildId, userId),
      this.newbieRedis.getMocoHunterRank(guildId, userId),
      this.newbieRedis.getMocoRankCount(guildId),
      this.newbieRedis.getMocoHunterDetail(guildId, userId),
      this.newbieRedis.getMocoHunterMeta(guildId, userId),
      this.newbieRedis.getMocoNewbieSessions(guildId, userId),
    ]);

    if (totalMinutes === null || rank === null) {
      return '아직 모코코 사냥 기록이 없습니다.';
    }

    const score = meta?.score ?? Math.round(totalMinutes);
    const sessionCount = meta?.sessionCount ?? 0;
    const uniqueNewbieCount = meta?.uniqueNewbieCount ?? 0;
    const channelMinutes = meta?.totalMinutes ?? Math.round(totalMinutes);

    const lines: string[] = [];
    lines.push(`🏆 **순위**: ${rank}위 / ${totalCount}명`);
    lines.push(`🏆 **총 점수**: ${score}점`);
    lines.push(`⏱️ **총 사냥 시간**: ${channelMinutes}분 | 🎮 **게임 횟수**: ${sessionCount}회 | 🌱 **모코코**: ${uniqueNewbieCount}명`);

    const entries = Object.entries(details).sort(([, a], [, b]) => b - a);
    if (entries.length > 0) {
      lines.push('');
      lines.push('🌱 **도움을 받은 모코코들:**');

      try {
        const guild = this.discordClient.guilds.cache.get(guildId);
        if (!guild) throw new Error(`Guild ${guildId} not found in cache`);
        for (const [newbieId, minutes] of entries) {
          const member = await guild.members.fetch(newbieId).catch(() => null);
          const name = member?.displayName ?? newbieId;
          const sessions = newbieSessions[newbieId] ?? 0;
          lines.push(`– ${name}: ${minutes}분 (${sessions}회)`);
        }
      } catch {
        for (const [newbieId, minutes] of entries) {
          const sessions = newbieSessions[newbieId] ?? 0;
          lines.push(`– ${newbieId}: ${minutes}분 (${sessions}회)`);
        }
      }
    }

    return lines.join('\n');
  }

  /** 내부: 페이지네이션 + 갱신 버튼 ActionRow 구성 */
  private buildButtons(
    guildId: string,
    currentPage: number,
    totalPages: number,
  ): ActionRowBuilder<ButtonBuilder> {
    const prevButton = new ButtonBuilder()
      .setCustomId(`${NEWBIE_CUSTOM_ID.MOCO_PREV}${guildId}:${currentPage}`)
      .setLabel('◀ 이전')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(currentPage <= 1);

    const nextButton = new ButtonBuilder()
      .setCustomId(`${NEWBIE_CUSTOM_ID.MOCO_NEXT}${guildId}:${currentPage}`)
      .setLabel('다음 ▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(currentPage >= totalPages);

    const refreshButton = new ButtonBuilder()
      .setCustomId(`${NEWBIE_CUSTOM_ID.MOCO_REFRESH}${guildId}`)
      .setLabel('갱신')
      .setStyle(ButtonStyle.Primary);

    const myButton = new ButtonBuilder()
      .setCustomId(`${NEWBIE_CUSTOM_ID.MOCO_MY}${guildId}`)
      .setLabel('내 사냥 시간')
      .setStyle(ButtonStyle.Success);

    return new ActionRowBuilder<ButtonBuilder>().addComponents(
      prevButton,
      nextButton,
      refreshButton,
      myButton,
    );
  }
}
