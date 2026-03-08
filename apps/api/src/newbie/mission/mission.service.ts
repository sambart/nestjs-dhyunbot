import { InjectDiscordClient } from '@discord-nestjs/core';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  EmbedBuilder,
  GuildMember,
  TextChannel,
} from 'discord.js';
import { Repository } from 'typeorm';

import { VoiceDailyFlushService } from '../../channel/voice/application/voice-daily-flush-service';
import { VoiceChannelHistory } from '../../channel/voice/domain/voice-channel-history.entity';
import { VoiceDailyEntity } from '../../channel/voice/domain/voice-daily.entity';
import { NewbieConfig } from '../domain/newbie-config.entity';
import { NewbieMission } from '../domain/newbie-mission.entity';
import { NewbieConfigRepository } from '../infrastructure/newbie-config.repository';
import { NewbieMissionRepository } from '../infrastructure/newbie-mission.repository';
import { NewbieMissionTemplateRepository } from '../infrastructure/newbie-mission-template.repository';
import { NewbieRedisRepository } from '../infrastructure/newbie-redis.repository';
import {
  DEFAULT_MISSION_FOOTER_TEMPLATE,
  DEFAULT_MISSION_HEADER_TEMPLATE,
  DEFAULT_MISSION_ITEM_TEMPLATE,
  DEFAULT_MISSION_TITLE_TEMPLATE,
  DEFAULT_STATUS_MAPPING,
} from '../infrastructure/newbie-template.constants';
import { applyTemplate } from '../util/newbie-template.util';

@Injectable()
export class MissionService {
  private readonly logger = new Logger(MissionService.name);

  constructor(
    private readonly missionRepo: NewbieMissionRepository,
    private readonly configRepo: NewbieConfigRepository,
    private readonly newbieRedis: NewbieRedisRepository,
    private readonly voiceDailyFlushService: VoiceDailyFlushService,
    private readonly missionTmplRepo: NewbieMissionTemplateRepository,
    @InjectRepository(VoiceDailyEntity)
    private readonly voiceDailyRepo: Repository<VoiceDailyEntity>,
    @InjectRepository(VoiceChannelHistory)
    private readonly voiceHistoryRepo: Repository<VoiceChannelHistory>,
    @InjectDiscordClient()
    private readonly discord: Client,
  ) {}

  /**
   * 신규 멤버 가입 시 미션 레코드 생성.
   * NewbieGateway.handleMemberJoin에서 호출된다.
   */
  async createMission(member: GuildMember, config: NewbieConfig): Promise<void> {
    if (!config.missionEnabled) return;
    if (!config.missionDurationDays || !config.missionTargetPlaytimeHours) {
      this.logger.warn(
        `[MISSION] Mission config incomplete: guild=${member.guild.id}`,
      );
      return;
    }

    const today = this.toDateString(new Date());
    const endDate = this.toDateString(
      new Date(Date.now() + config.missionDurationDays * 24 * 60 * 60 * 1000),
    );
    const targetPlaytimeSec = config.missionTargetPlaytimeHours * 3600;

    await this.missionRepo.create(
      member.guild.id,
      member.id,
      today,
      endDate,
      targetPlaytimeSec,
    );

    // 미션 목록 캐시 무효화
    await this.newbieRedis.deleteMissionActive(member.guild.id);

    this.logger.log(
      `[MISSION] Created: guild=${member.guild.id} member=${member.id} end=${endDate}`,
    );

    // 미션 현황 Embed 갱신 (알림 채널이 설정된 경우)
    if (config.missionNotifyChannelId) {
      await this.refreshMissionEmbed(member.guild.id, config).catch((err) => {
        this.logger.error(
          `[MISSION] Failed to refresh embed after create: guild=${member.guild.id}`,
          (err as Error).stack,
        );
      });
    }
  }

  /**
   * 기간 내 플레이타임 합산 (초 단위).
   * VoiceDailyEntity에서 channelId != 'GLOBAL' 레코드의 channelDurationSec 합산.
   * startDate/endDate는 YYYYMMDD 형식.
   */
  async getPlaytimeSec(
    guildId: string,
    memberId: string,
    startDate: string,
    endDate: string,
  ): Promise<number> {
    const result = await this.voiceDailyRepo
      .createQueryBuilder('vd')
      .select('COALESCE(SUM(vd.channelDurationSec), 0)', 'total')
      .where('vd.guildId = :guildId', { guildId })
      .andWhere('vd.userId = :memberId', { memberId })
      .andWhere('vd.date BETWEEN :startDate AND :endDate', { startDate, endDate })
      .andWhere("vd.channelId != 'GLOBAL'")
      .getRawOne<{ total: string }>();

    return parseInt(result?.total ?? '0', 10);
  }

  /**
   * 기간 내 플레이횟수 (VoiceChannelHistory 세션 수).
   * startDate/endDate는 YYYYMMDD 형식; KST 기준으로 Date 범위 변환.
   */
  async getPlayCount(
    guildId: string,
    memberId: string,
    startDate: string,
    endDate: string,
  ): Promise<number> {
    // startDate/endDate (YYYYMMDD)를 KST 기준 날짜 범위로 변환
    const startDatetime = this.yyyymmddToKSTDate(startDate, 'start');
    const endDatetime = this.yyyymmddToKSTDate(endDate, 'end');

    const result = await this.voiceHistoryRepo
      .createQueryBuilder('vch')
      .select('COUNT(*)', 'count')
      .innerJoin('vch.member', 'm')
      .where('m.discordMemberId = :memberId', { memberId })
      .andWhere('vch.joinedAt BETWEEN :startDatetime AND :endDatetime', {
        startDatetime,
        endDatetime,
      })
      .getRawOne<{ count: string }>();

    return parseInt(result?.count ?? '0', 10);
  }

  /**
   * 미션 현황 Embed를 알림 채널에 전송하거나 기존 메시지를 수정한다.
   * 갱신 버튼 인터랙션과 스케줄러 모두 이 메서드를 호출한다.
   */
  async refreshMissionEmbed(guildId: string, config?: NewbieConfig): Promise<void> {
    // config가 없으면 DB에서 조회
    const resolvedConfig = config ?? (await this.configRepo.findByGuildId(guildId));
    if (!resolvedConfig?.missionEnabled || !resolvedConfig.missionNotifyChannelId) {
      return;
    }

    // 진행중 미션 목록 조회 (Redis 캐시 우선)
    const missions = await this.getActiveMissions(guildId);

    const embed = await this.buildMissionEmbed(guildId, missions, resolvedConfig);
    const row = this.buildRefreshButton(guildId);

    const channel = await this.discord.channels
      .fetch(resolvedConfig.missionNotifyChannelId)
      .catch(() => null);

    if (!channel || !channel.isTextBased()) {
      this.logger.warn(
        `[MISSION] Notify channel not found or not text-based: guild=${guildId} channel=${resolvedConfig.missionNotifyChannelId}`,
      );
      return;
    }

    const textChannel = channel as TextChannel;

    if (resolvedConfig.missionNotifyMessageId) {
      // 기존 메시지 수정 시도
      const message = await textChannel.messages
        .fetch(resolvedConfig.missionNotifyMessageId)
        .catch(() => null);

      if (message) {
        await message.edit({ embeds: [embed], components: [row] });
        return;
      }
      // 메시지가 삭제된 경우 신규 전송으로 진행
    }

    // 신규 메시지 전송 후 messageId 저장
    const sent = await textChannel.send({ embeds: [embed], components: [row] });
    await this.configRepo.updateMissionNotifyMessageId(guildId, sent.id);
  }

  /**
   * 기존 미션 Embed 메시지를 삭제하고 DB에서 messageId를 초기화한다.
   * 설정 저장 시 Embed를 새로 작성하기 위해 컨트롤러에서 호출한다.
   */
  async deleteEmbed(channelId: string, messageId: string): Promise<void> {
    try {
      const channel = await this.discord.channels.fetch(channelId).catch(() => null);
      if (channel && channel.isTextBased()) {
        const message = await (channel as TextChannel).messages.fetch(messageId).catch(() => null);
        if (message) {
          await message.delete();
        }
      }
    } catch (err) {
      this.logger.warn(
        `[MISSION] Failed to delete old embed: channel=${channelId} message=${messageId}`,
        (err as Error).stack,
      );
    }
  }

  /**
   * 갱신 버튼 클릭 시 호출. 미션 캐시 무효화 후 Embed 갱신.
   */
  async invalidateAndRefresh(guildId: string): Promise<void> {
    await this.voiceDailyFlushService.safeFlushAll();
    await this.newbieRedis.deleteMissionActive(guildId);
    await this.refreshMissionEmbed(guildId);
  }

  /**
   * Redis 캐시 우선으로 활성(IN_PROGRESS) 미션 목록 조회.
   * 캐시 미스 시 DB 조회 후 Redis에 저장(TTL 30분).
   */
  private async getActiveMissions(guildId: string): Promise<NewbieMission[]> {
    const cached = await this.newbieRedis.getMissionActive(guildId);
    if (cached) return cached;

    const missions = await this.missionRepo.findActiveByGuild(guildId);
    await this.newbieRedis.setMissionActive(guildId, missions);
    return missions;
  }

  /**
   * PRD F-NEWBIE-002-TMPL 명세에 따라 미션 현황 EmbedBuilder 생성.
   * NewbieMissionTemplate 테이블의 템플릿 필드를 사용하며, null이면 DEFAULT_* 상수로 fallback.
   */
  private async buildMissionEmbed(
    guildId: string,
    missions: NewbieMission[],
    config: NewbieConfig,
  ): Promise<EmbedBuilder> {
    // 1. 템플릿 조회 및 fallback
    const tmpl = await this.missionTmplRepo.findByGuildId(guildId);
    const titleTemplate = tmpl?.titleTemplate ?? DEFAULT_MISSION_TITLE_TEMPLATE;
    const headerTemplate = tmpl?.headerTemplate ?? DEFAULT_MISSION_HEADER_TEMPLATE;
    const itemTemplate = tmpl?.itemTemplate ?? DEFAULT_MISSION_ITEM_TEMPLATE;
    const footerTemplate = tmpl?.footerTemplate ?? DEFAULT_MISSION_FOOTER_TEMPLATE;
    const statusMapping = tmpl?.statusMapping ?? DEFAULT_STATUS_MAPPING;

    // 2. 상태별 카운트 집계
    const statusCounts = await this.missionRepo.countByStatusForGuild(guildId);
    const totalCount = statusCounts.IN_PROGRESS + statusCounts.COMPLETED + statusCounts.FAILED;
    const inProgressCount = statusCounts.IN_PROGRESS;
    const completedCount = statusCounts.COMPLETED;
    const failedCount = statusCounts.FAILED;

    // 3. 헤더 렌더링
    const resolvedHeader = applyTemplate(headerTemplate, {
      totalCount: String(totalCount),
      inProgressCount: String(inProgressCount),
      completedCount: String(completedCount),
      failedCount: String(failedCount),
    });

    // 4. 제목 렌더링
    const resolvedTitle = applyTemplate(titleTemplate, {
      totalCount: String(totalCount),
    });

    // 5. 각 미션 항목 렌더링 (병렬 조회)
    const itemLines: string[] = [];
    for (const mission of missions) {
      const [playtimeSec, playCount] = await Promise.all([
        this.getPlaytimeSec(guildId, mission.memberId, mission.startDate, mission.endDate),
        this.getPlayCount(guildId, mission.memberId, mission.startDate, mission.endDate),
      ]);

      const username = await this.fetchMemberDisplayName(guildId, mission.memberId);
      const mention = `<@${mission.memberId}>`;
      const statusEntry = statusMapping[mission.status];
      const statusEmoji = statusEntry.emoji;
      const statusText = statusEntry.text;

      // playtime 분해
      const playtimeHour = Math.floor(playtimeSec / 3600);
      const playtimeMin = Math.floor((playtimeSec % 3600) / 60);
      const playtimeSecs = playtimeSec % 60;
      const playtime = `${playtimeHour}시간 ${playtimeMin}분 ${playtimeSecs}초`;

      // targetPlaytime 포맷
      const targetPlaytime = this.formatTargetPlaytime(mission.targetPlaytimeSec);

      // daysLeft
      const daysLeft = this.calcDaysLeft(mission.endDate);

      // startDate / endDate YYYY-MM-DD 포맷
      const startDate = this.formatDateYYYYMMDD(mission.startDate);
      const endDate = this.formatDateYYYYMMDD(mission.endDate);

      const renderedItem = applyTemplate(itemTemplate, {
        username,
        mention,
        startDate,
        endDate,
        statusEmoji,
        statusText,
        playtimeHour: String(playtimeHour),
        playtimeMin: String(playtimeMin),
        playtimeSec: String(playtimeSecs),
        playtime,
        playCount: String(playCount),
        targetPlaytime,
        daysLeft: String(daysLeft),
      });

      itemLines.push(renderedItem);
    }

    // 6. description 조합: 헤더 + '\n\n' + 항목들 (항목 간 '\n\n' 구분)
    const description = missions.length > 0
      ? `${resolvedHeader}\n\n${itemLines.join('\n\n')}`
      : resolvedHeader;

    // 7. 푸터 렌더링
    const updatedAt = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
    const resolvedFooter = applyTemplate(footerTemplate, { updatedAt });

    // 8. EmbedBuilder 구성
    const embed = new EmbedBuilder()
      .setTitle(resolvedTitle)
      .setDescription(description)
      .setColor(config.missionEmbedColor ? (config.missionEmbedColor as `#${string}`) : 0x57f287)
      .setFooter({ text: resolvedFooter });

    if (config.missionEmbedThumbnailUrl) {
      embed.setThumbnail(config.missionEmbedThumbnailUrl);
    }

    return embed;
  }

  /**
   * customId 패턴 `newbie_mission:refresh:{guildId}` 를 가진 갱신 버튼 생성.
   */
  private buildRefreshButton(guildId: string): ActionRowBuilder<ButtonBuilder> {
    const button = new ButtonBuilder()
      .setCustomId(`newbie_mission:refresh:${guildId}`)
      .setLabel('갱신')
      .setEmoji('🔄')
      .setStyle(ButtonStyle.Secondary);

    return new ActionRowBuilder<ButtonBuilder>().addComponents(button);
  }

  /**
   * Discord API로 멤버 표시 이름 조회.
   * 조회 실패 시 `User-{memberId 앞 6자리}` 반환.
   */
  private async fetchMemberDisplayName(
    guildId: string,
    memberId: string,
  ): Promise<string> {
    try {
      const guild = await this.discord.guilds.fetch(guildId);
      const member = await guild.members.fetch(memberId).catch(() => null);
      return member?.displayName ?? `User-${memberId.slice(0, 6)}`;
    } catch {
      return `User-${memberId.slice(0, 6)}`;
    }
  }

  /**
   * YYYYMMDD 문자열을 'YYYY-MM-DD' 형식으로 변환.
   * PRD 명세: 날짜 포맷 고정 YYYY-MM-DD
   */
  private formatDateYYYYMMDD(yyyymmdd: string): string {
    const year = yyyymmdd.slice(0, 4);
    const month = yyyymmdd.slice(4, 6);
    const day = yyyymmdd.slice(6, 8);
    return `${year}-${month}-${day}`;
  }

  /**
   * 목표 플레이타임 초를 'H시간' 또는 'H시간 M분' 형태로 변환.
   */
  private formatTargetPlaytime(totalSec: number): string {
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    if (m === 0) return `${h}시간`;
    return `${h}시간 ${m}분`;
  }

  /**
   * 오늘 ~ endDate(YYYYMMDD) 남은 일수를 반환.
   * 마감 당일 = 0, 이미 지난 경우 = 0.
   */
  private calcDaysLeft(endDate: string): number {
    const todayStr = this.toDateString(new Date());
    const todayNum = parseInt(todayStr, 10);
    const endNum = parseInt(endDate, 10);
    const diff = endNum - todayNum;
    // YYYYMMDD 단순 숫자 차이는 일수와 다를 수 있으므로 Date 객체로 계산
    const todayDate = new Date(
      parseInt(todayStr.slice(0, 4), 10),
      parseInt(todayStr.slice(4, 6), 10) - 1,
      parseInt(todayStr.slice(6, 8), 10),
    );
    const endDateObj = new Date(
      parseInt(endDate.slice(0, 4), 10),
      parseInt(endDate.slice(4, 6), 10) - 1,
      parseInt(endDate.slice(6, 8), 10),
    );
    const msPerDay = 24 * 60 * 60 * 1000;
    const days = Math.floor((endDateObj.getTime() - todayDate.getTime()) / msPerDay);
    // diff 변수는 위에서 계산했지만 아래 days를 사용
    void diff;
    return Math.max(0, days);
  }

  /**
   * Date 객체를 KST 기준 YYYYMMDD 형식 문자열로 변환.
   */
  private toDateString(date: Date): string {
    const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
    return kst.toISOString().slice(0, 10).replace(/-/g, '');
  }

  /**
   * YYYYMMDD 문자열을 KST 기준 Date 객체로 변환.
   * bound='start': 해당일 00:00:00.000 KST (UTC 기준으로 저장)
   * bound='end':   해당일 23:59:59.999 KST (UTC 기준으로 저장)
   */
  private yyyymmddToKSTDate(yyyymmdd: string, bound: 'start' | 'end'): Date {
    const year = parseInt(yyyymmdd.slice(0, 4), 10);
    const month = parseInt(yyyymmdd.slice(4, 6), 10) - 1; // 0-indexed
    const day = parseInt(yyyymmdd.slice(6, 8), 10);
    const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
    const utcBase = Date.UTC(year, month, day);
    if (bound === 'start') {
      // KST 00:00:00 = UTC 전날 15:00:00
      return new Date(utcBase - KST_OFFSET_MS);
    }
    // KST 23:59:59.999 = UTC 당일 14:59:59.999
    return new Date(utcBase - KST_OFFSET_MS + 24 * 60 * 60 * 1000 - 1);
  }
}
