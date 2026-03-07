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
import { NewbieMissionRepository } from '../infrastructure/newbie-mission.repository';
import { NewbiePeriodRepository } from '../infrastructure/newbie-period.repository';
import { NewbieRedisRepository } from '../infrastructure/newbie-redis.repository';

/** 페이지당 사냥꾼 수 */
const PAGE_SIZE = 1;

/** 모코코 사냥 버튼 customId 접두사 */
const CUSTOM_ID = {
  PREV: 'newbie_moco:prev:',
  NEXT: 'newbie_moco:next:',
  REFRESH: 'newbie_moco:refresh:',
} as const;

@Injectable()
export class MocoService {
  private readonly logger = new Logger(MocoService.name);

  constructor(
    private readonly configRepo: NewbieConfigRepository,
    private readonly missionRepo: NewbieMissionRepository,
    private readonly periodRepo: NewbiePeriodRepository,
    private readonly newbieRedis: NewbieRedisRepository,
    @InjectDiscordClient() private readonly discordClient: Client,
  ) {}

  /**
   * voiceStateUpdate 이벤트 수신 시 모코코 사냥 시간 1분 누적.
   *
   * 처리 흐름:
   * 1. channelId가 없거나(퇴장) 채널 멤버가 2명 미만이면 Early Return
   * 2. NewbieConfig 조회 — mocoEnabled 확인
   * 3. 신입기간 활성 멤버 Set 조회 (Redis 캐시 우선, 미스 시 DB → 캐시 초기화)
   * 4. 채널 내 신규사용자 식별 (channelMemberIds ∩ activePeriodMembers)
   *    — 각 신규사용자의 미션 상태가 IN_PROGRESS인지 확인
   * 5. 채널 내 기존 멤버(사냥꾼) 식별 (channelMemberIds - newbieMemberIds)
   * 6. 각 기존 멤버(hunterId)에 대해:
   *    - HINCRBY newbie:moco:total:{guildId}:{hunterId} {newbieMemberId} 1
   *    - ZINCRBY newbie:moco:rank:{guildId} {confirmedNewbies.length} {hunterId}
   */
  async handleVoiceStateChanged(
    guildId: string,
    channelId: string | null,
    channelMemberIds: string[],
  ): Promise<void> {
    // 1. 퇴장이거나 채널에 멤버가 2명 미만이면 처리 불필요
    if (!channelId || channelMemberIds.length < 2) return;

    // 2. NewbieConfig 조회 — mocoEnabled 확인
    const config = await this.configRepo.findByGuildId(guildId);
    if (!config?.mocoEnabled) return;

    // 3. 신입기간 활성 멤버 Set 조회 (Redis Set)
    let activePeriodMembers = await this.newbieRedis.getPeriodActiveMembers(guildId);

    if (activePeriodMembers.length === 0) {
      // 캐시 미스 또는 실제로 활성 멤버 없음 — DB 조회 후 캐시 초기화
      const periods = await this.periodRepo.findActiveByGuild(guildId);
      const memberIds = periods.map((p) => p.memberId);
      if (memberIds.length > 0) {
        await this.newbieRedis.initPeriodActiveMembers(guildId, memberIds);
        activePeriodMembers = memberIds;
      }
    }

    // 4. 채널 내 신규사용자 후보 식별 (신입기간 활성 멤버 ∩ 현재 채널 멤버)
    const activePeriodSet = new Set(activePeriodMembers);
    const newbieCandidates = channelMemberIds.filter((id) => activePeriodSet.has(id));
    if (newbieCandidates.length === 0) return;

    // 5. 각 신규사용자 후보의 미션 상태 IN_PROGRESS 확인 (병렬)
    const missionChecks = await Promise.all(
      newbieCandidates.map((id) => this.missionRepo.findActiveByMember(guildId, id)),
    );
    const confirmedNewbies = newbieCandidates.filter((_, i) => missionChecks[i] !== null);
    if (confirmedNewbies.length === 0) return;

    // 6. 기존 멤버(사냥꾼) 식별 — 확인된 신규사용자를 제외한 채널 멤버
    const newbieSet = new Set(confirmedNewbies);
    const hunters = channelMemberIds.filter((id) => !newbieSet.has(id));
    if (hunters.length === 0) return;

    // 7. Redis 누적 (HINCRBY + ZINCRBY)
    for (const hunterId of hunters) {
      for (const newbieId of confirmedNewbies) {
        await this.newbieRedis.incrMocoMinutes(guildId, hunterId, newbieId, 1);
      }
      // score 증분 = confirmedNewbies.length (동시에 여러 신규사용자와 함께 있으면 그만큼 누적)
      await this.newbieRedis.incrMocoRank(guildId, hunterId, confirmedNewbies.length);
    }
  }

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

    // 사냥꾼별 신규사용자 상세 조회 (HGETALL)
    const details = await this.newbieRedis.getMocoHunterDetail(guildId, hunterId);

    // Discord displayName 조회
    const guild = await this.discordClient.guilds.fetch(guildId);
    const hunterMember = await guild.members.fetch(hunterId).catch(() => null);
    const hunterName = hunterMember?.displayName ?? hunterId;

    const newbieNames: Record<string, string> = {};
    for (const newbieId of Object.keys(details)) {
      const m = await guild.members.fetch(newbieId).catch(() => null);
      newbieNames[newbieId] = m?.displayName ?? newbieId;
    }

    const embed = this.buildHunterEmbed(
      safePage, // rank = 페이지 번호 = 순위
      hunterName,
      Math.round(totalMinutes),
      details,
      newbieNames,
      safePage,
      totalPages,
      config,
    );

    const components = this.buildButtons(guildId, safePage, totalPages);

    return { embeds: [embed], components: [components] };
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
        // 메시지가 삭제된 경우 — 새로 전송
        this.logger.warn(
          `[MOCO] Failed to edit message ${config.mocoRankMessageId}, sending new message`,
        );
      }
    }

    // 최초 전송
    const sent = await channel.send(payload);
    await this.configRepo.updateMocoRankMessageId(guildId, sent.id);
  }

  /** 내부: 사냥꾼 1명에 대한 순위 Embed 구성 */
  private buildHunterEmbed(
    rank: number,
    hunterName: string,
    totalMinutes: number,
    details: Record<string, number>,
    newbieNames: Record<string, string>,
    currentPage: number,
    totalPages: number,
    config: NewbieConfig | null,
  ): EmbedBuilder {
    const detailLines = Object.entries(details)
      .sort(([, a], [, b]) => b - a) // 많이 함께한 순 정렬
      .map(([newbieId, minutes]) => {
        const name = newbieNames[newbieId] ?? newbieId;
        return `– ${name} 🌱: ${minutes}분`;
      })
      .join('\n');

    const autoRefreshMinutes = config?.mocoAutoRefreshMinutes ?? null;
    const footer = autoRefreshMinutes
      ? `페이지 ${currentPage}/${totalPages} | 자동 갱신 ${autoRefreshMinutes}분`
      : `페이지 ${currentPage}/${totalPages}`;

    const titleTemplate = config?.mocoEmbedTitle ?? '모코코 사냥 TOP {rank} — {hunterName} 🌱';
    const titleVars: Record<string, string> = { rank: String(rank), hunterName };
    const resolvedTitle = this.applyTemplate(titleTemplate, titleVars);

    const embed = new EmbedBuilder()
      .setTitle(resolvedTitle)
      .setDescription(
        `총 모코코 사냥 시간: ${totalMinutes}분\n\n도움을 받은 모코코들:\n${detailLines || '없음'}`,
      )
      .setFooter({ text: footer })
      .setColor(config?.mocoEmbedColor ? (config.mocoEmbedColor as `#${string}`) : 0x5865f2);

    if (config?.mocoEmbedThumbnailUrl) {
      embed.setThumbnail(config.mocoEmbedThumbnailUrl);
    }

    return embed;
  }

  private applyTemplate(template: string, vars: Record<string, string>): string {
    return Object.entries(vars).reduce(
      (result, [key, value]) => result.replace(new RegExp(`\\{${key}\\}`, 'g'), value),
      template,
    );
  }

  /** 내부: 페이지네이션 + 갱신 버튼 ActionRow 구성 */
  private buildButtons(
    guildId: string,
    currentPage: number,
    totalPages: number,
  ): ActionRowBuilder<ButtonBuilder> {
    const prevButton = new ButtonBuilder()
      .setCustomId(`${CUSTOM_ID.PREV}${guildId}:${currentPage}`)
      .setLabel('◀ 이전')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(currentPage <= 1);

    const nextButton = new ButtonBuilder()
      .setCustomId(`${CUSTOM_ID.NEXT}${guildId}:${currentPage}`)
      .setLabel('다음 ▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(currentPage >= totalPages);

    const refreshButton = new ButtonBuilder()
      .setCustomId(`${CUSTOM_ID.REFRESH}${guildId}`)
      .setLabel('갱신')
      .setStyle(ButtonStyle.Primary);

    return new ActionRowBuilder<ButtonBuilder>().addComponents(
      prevButton,
      nextButton,
      refreshButton,
    );
  }
}
