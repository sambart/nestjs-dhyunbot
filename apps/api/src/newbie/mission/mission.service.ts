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

import { VoiceChannelHistory } from '../../channel/voice/domain/voice-channel-history.entity';
import { VoiceDailyEntity } from '../../channel/voice/domain/voice-daily.entity';
import { NewbieConfig } from '../domain/newbie-config.entity';
import { MissionStatus, NewbieMission } from '../domain/newbie-mission.entity';
import { NewbieConfigRepository } from '../infrastructure/newbie-config.repository';
import { MISSION_STATUS_EMOJI, MISSION_STATUS_TEXT } from '../infrastructure/newbie-mission.constants';
import { NewbieMissionRepository } from '../infrastructure/newbie-mission.repository';
import { NewbieRedisRepository } from '../infrastructure/newbie-redis.repository';

@Injectable()
export class MissionService {
  private readonly logger = new Logger(MissionService.name);

  constructor(
    private readonly missionRepo: NewbieMissionRepository,
    private readonly configRepo: NewbieConfigRepository,
    private readonly newbieRedis: NewbieRedisRepository,
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
   * 갱신 버튼 클릭 시 호출. 미션 캐시 무효화 후 Embed 갱신.
   */
  async invalidateAndRefresh(guildId: string): Promise<void> {
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
   * PRD F-NEWBIE-002 Embed 형식에 따라 미션 현황 EmbedBuilder 생성.
   * 각 미션마다 플레이타임/횟수를 병렬 조회한다.
   */
  private async buildMissionEmbed(
    guildId: string,
    missions: NewbieMission[],
    config: NewbieConfig,
  ): Promise<EmbedBuilder> {
    const lines: string[] = [
      `🧑‍🌾 뉴비 멤버 (총 인원: ${missions.length}명)`,
      '',
    ];

    for (const mission of missions) {
      const [playtimeSec, playCount] = await Promise.all([
        this.getPlaytimeSec(guildId, mission.memberId, mission.startDate, mission.endDate),
        this.getPlayCount(guildId, mission.memberId, mission.startDate, mission.endDate),
      ]);

      const userName = await this.fetchMemberDisplayName(guildId, mission.memberId);
      const statusEmoji = MISSION_STATUS_EMOJI[mission.status];
      const statusText = MISSION_STATUS_TEXT[mission.status];
      const playtimeStr = this.formatSeconds(playtimeSec);

      lines.push(`@${userName} 🌱`);
      lines.push(`${this.formatDate(mission.startDate)} ~ ${this.formatDate(mission.endDate)}`);
      lines.push(
        `${statusEmoji} ${statusText} | 플레이타임: ${playtimeStr} | 플레이횟수: ${playCount}회`,
      );
      lines.push('');
    }

    const templateVars: Record<string, string> = {
      count: String(missions.length),
      missionList: lines.join('\n'),
    };

    const titleTemplate = config.missionEmbedTitle ?? '🧑‍🌾 신입 미션 체크';
    const resolvedTitle = this.applyTemplate(titleTemplate, templateVars);

    const descTemplate =
      config.missionEmbedDescription ?? '{missionList}';
    const resolvedDesc = this.applyTemplate(descTemplate, templateVars);

    const embed = new EmbedBuilder()
      .setTitle(resolvedTitle)
      .setDescription(resolvedDesc)
      .setColor(config.missionEmbedColor ? (config.missionEmbedColor as `#${string}`) : 0x57f287)
      .setTimestamp();

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
   * 초 단위를 'H시간 M분 S초' 형식으로 변환.
   */
  private formatSeconds(totalSec: number): string {
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return `${h}시간 ${m}분 ${s}초`;
  }

  /**
   * YYYYMMDD 문자열을 'M월 D일' 형식으로 변환.
   * PRD 명세에 따라 날짜를 M월 D일 형식으로 표시한다.
   */
  private formatDate(yyyymmdd: string): string {
    const month = parseInt(yyyymmdd.slice(4, 6), 10);
    const day = parseInt(yyyymmdd.slice(6, 8), 10);
    return `${month}월 ${day}일`;
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
  private applyTemplate(template: string, vars: Record<string, string>): string {
    return Object.entries(vars).reduce(
      (result, [key, value]) => result.replace(new RegExp(`\\{${key}\\}`, 'g'), value),
      template,
    );
  }

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
