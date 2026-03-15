import { InjectDiscordClient } from '@discord-nestjs/core';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  DiscordAPIError,
  EmbedBuilder,
  GuildMember,
  TextChannel,
} from 'discord.js';
import { Repository } from 'typeorm';

import { VoiceDailyFlushService } from '../../channel/voice/application/voice-daily-flush-service';
import { VoiceChannelHistoryOrm } from '../../channel/voice/infrastructure/voice-channel-history.orm-entity';
import { VoiceDailyOrm } from '../../channel/voice/infrastructure/voice-daily.orm-entity';
import { getErrorMessage, getErrorStack } from '../../common/util/error.util';
import { MissionStatus } from '../domain/newbie-mission.types';
import { NewbieConfigOrmEntity as NewbieConfig } from '../infrastructure/newbie-config.orm-entity';
import { NewbieConfigRepository } from '../infrastructure/newbie-config.repository';
import { NewbieMissionOrmEntity as NewbieMission } from '../infrastructure/newbie-mission.orm-entity';
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
    @InjectRepository(VoiceDailyOrm)
    private readonly voiceDailyRepo: Repository<VoiceDailyOrm>,
    @InjectRepository(VoiceChannelHistoryOrm)
    private readonly voiceHistoryRepo: Repository<VoiceChannelHistoryOrm>,
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
      this.logger.warn(`[MISSION] Mission config incomplete: guild=${member.guild.id}`);
      return;
    }

    // 상태 무관하게 이미 미션이 존재하면 중복 생성 방지
    const hasMission = await this.missionRepo.hasMission(member.guild.id, member.id);
    if (hasMission) {
      this.logger.log(`[MISSION] Skipped duplicate: guild=${member.guild.id} member=${member.id}`);
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
      member.displayName,
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
          getErrorStack(err),
        );
      });
    }
  }

  /**
   * 미션 목록에 memberName, currentPlaytimeSec을 추가하여 반환.
   * 웹 대시보드 미션 관리 탭에서 사용.
   */
  async enrichMissions(
    guildId: string,
    missions: NewbieMission[],
  ): Promise<(NewbieMission & { memberName: string; currentPlaytimeSec: number })[]> {
    return Promise.all(
      missions.map(async (mission) => {
        const [memberName, currentPlaytimeSec] = await Promise.all([
          this.fetchMemberDisplayName(guildId, mission.memberId),
          this.getPlaytimeSec(guildId, mission.memberId, mission.startDate, mission.endDate),
        ]);
        return { ...mission, memberName, currentPlaytimeSec };
      }),
    );
  }

  /**
   * 이력 미션에 memberName(누락 시 Discord 조회)과 currentPlaytimeSec을 추가한다.
   * memberName을 DB에도 갱신하여 다음 조회 시 재조회를 방지한다.
   */
  async enrichHistoryMissions(
    guildId: string,
    missions: NewbieMission[],
  ): Promise<(NewbieMission & { memberName: string; currentPlaytimeSec: number })[]> {
    return Promise.all(
      missions.map(async (mission) => {
        const [memberName, currentPlaytimeSec] = await Promise.all([
          mission.memberName
            ? Promise.resolve(mission.memberName)
            : this.fetchMemberDisplayName(guildId, mission.memberId).then(async (name) => {
                await this.missionRepo.updateMemberName(mission.id, name);
                return name;
              }),
          this.getPlaytimeSec(guildId, mission.memberId, mission.startDate, mission.endDate),
        ]);
        return { ...mission, memberName, currentPlaytimeSec };
      }),
    );
  }

  /**
   * 기간 내 플레이타임 합산 (초 단위).
   * VoiceDailyOrm에서 channelId != 'GLOBAL' 레코드의 channelDurationSec 합산.
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
   * 기간 내 플레이횟수 (VoiceChannelHistoryOrm 세션 수).
   * startDate/endDate는 YYYYMMDD 형식; KST 기준으로 Date 범위 변환.
   * guildId 필터: VoiceDailyOrm를 통해 해당 길드에 속한 채널만 조회.
   */
  async getPlayCount(
    guildId: string,
    memberId: string,
    startDate: string,
    endDate: string,
    config: NewbieConfig,
  ): Promise<number> {
    const startDatetime = this.yyyymmddToKSTDate(startDate, 'start');
    const endDatetime = this.yyyymmddToKSTDate(endDate, 'end');

    // 해당 길드+멤버+기간에 해당하는 채널 ID 목록 조회 (guildId 필터용)
    const guildChannelRows = await this.voiceDailyRepo
      .createQueryBuilder('vd')
      .select('DISTINCT vd.channelId', 'channelId')
      .where('vd.guildId = :guildId', { guildId })
      .andWhere('vd.userId = :memberId', { memberId })
      .andWhere('vd.date BETWEEN :startDate AND :endDate', { startDate, endDate })
      .andWhere("vd.channelId != 'GLOBAL'")
      .getRawMany<{ channelId: string }>();

    const guildChannelIds = guildChannelRows.map((r) => r.channelId);
    if (guildChannelIds.length === 0) return 0;

    // 후보 세션 조회 (joinedAt, leftAt) — guildId에 속한 채널만 필터
    const rows = await this.voiceHistoryRepo
      .createQueryBuilder('vch')
      .select(['vch.joinedAt', 'vch.leftAt'])
      .innerJoin('vch.member', 'm')
      .innerJoin('vch.channel', 'c')
      .where('m.discordMemberId = :memberId', { memberId })
      .andWhere('c.discordChannelId IN (:...guildChannelIds)', { guildChannelIds })
      .andWhere('vch.joinedAt BETWEEN :startDatetime AND :endDatetime', {
        startDatetime,
        endDatetime,
      })
      .orderBy('vch.joinedAt', 'ASC')
      .getMany();

    // 두 옵션 모두 null이면 단순 COUNT 반환
    if (config.playCountMinDurationMin === null && config.playCountIntervalMin === null) {
      return rows.length;
    }

    // Step 1: 최소 참여시간 필터 (playCountMinDurationMin NOT NULL)
    let sessions = rows;
    if (config.playCountMinDurationMin !== null) {
      const minMs = config.playCountMinDurationMin * 60 * 1000;
      sessions = sessions.filter((row) => {
        if (!row.leftAt) return false; // 퇴장 기록 없는 세션은 제외
        return row.leftAt.getTime() - row.joinedAt.getTime() >= minMs;
      });
    }

    if (sessions.length === 0) return 0;

    // Step 2: 시간 간격 병합 (playCountIntervalMin NOT NULL)
    if (config.playCountIntervalMin === null) {
      return sessions.length;
    }

    const intervalMs = config.playCountIntervalMin * 60 * 1000;
    let count = 1;
    let baseJoinedAt = sessions[0].joinedAt.getTime();

    for (let i = 1; i < sessions.length; i++) {
      const currentJoinedAt = sessions[i].joinedAt.getTime();
      if (currentJoinedAt - baseJoinedAt >= intervalMs) {
        // 간격 초과 → 새로운 1회로 카운트
        count++;
        baseJoinedAt = currentJoinedAt;
      }
      // 간격 이내 → 동일 1회로 병합 (baseJoinedAt 갱신 없음)
    }

    return count;
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

    // Embed 표시 대상 미션 조회 (모든 상태, hiddenFromEmbed=false)
    let missions = await this.missionRepo.findVisibleByGuild(guildId);

    // 봇·나간 멤버 미션 제거
    missions = await this.removeInvalidMissions(guildId, missions);

    const embed = await this.buildMissionEmbed(guildId, missions, resolvedConfig);
    const row = this.buildRefreshButton(guildId);

    const channel = await this.discord.channels
      .fetch(resolvedConfig.missionNotifyChannelId)
      .catch(() => null);

    if (!channel?.isTextBased()) {
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
      if (channel?.isTextBased()) {
        const message = await (channel as TextChannel).messages.fetch(messageId).catch(() => null);
        if (message) {
          await message.delete();
        }
      }
    } catch (err) {
      this.logger.warn(
        `[MISSION] Failed to delete old embed: channel=${channelId} message=${messageId}`,
        getErrorStack(err),
      );
    }
  }

  /**
   * 갱신 버튼 클릭 시 호출.
   * 1. 음성 데이터 flush
   * 2. 목표 달성 미션을 COMPLETED로 즉시 갱신
   * 3. 미션 캐시 무효화 후 Embed 갱신
   */
  async invalidateAndRefresh(guildId: string): Promise<void> {
    await this.voiceDailyFlushService.safeFlushAll();

    // 진행중 미션 중 목표 달성한 미션을 COMPLETED로 즉시 갱신
    const activeMissions = await this.missionRepo.findActiveByGuild(guildId);
    for (const mission of activeMissions) {
      const playtimeSec = await this.getPlaytimeSec(
        guildId,
        mission.memberId,
        mission.startDate,
        mission.endDate,
      );
      if (playtimeSec >= mission.targetPlaytimeSec) {
        await this.missionRepo.updateStatus(mission.id, MissionStatus.COMPLETED);
        this.logger.log(
          `[MISSION] Completed on refresh: id=${mission.id} member=${mission.memberId} ` +
            `playtime=${playtimeSec}s target=${mission.targetPlaytimeSec}s`,
        );
      }
    }

    await this.newbieRedis.deleteMissionActive(guildId);
    await this.refreshMissionEmbed(guildId);
  }

  /**
   * 미션 수동 성공 처리 (F-NEWBIE-005).
   * 상태를 COMPLETED로 갱신하고, 옵션으로 Discord 역할을 부여한다.
   */
  async completeMission(
    guildId: string,
    missionId: number,
    roleId?: string | null,
  ): Promise<{ ok: true; warning?: string }> {
    const mission = await this.missionRepo.findById(missionId);
    if (!mission) throw new NotFoundException('미션을 찾을 수 없습니다.');
    if (mission.guildId !== guildId) throw new NotFoundException('미션을 찾을 수 없습니다.');
    if (mission.status !== MissionStatus.IN_PROGRESS) {
      throw new BadRequestException('진행 중인 미션만 성공 처리할 수 있습니다.');
    }

    await this.missionRepo.updateStatus(missionId, MissionStatus.COMPLETED);
    this.logger.log(`[MISSION] Manual complete: id=${missionId} member=${mission.memberId}`);

    let warning: string | undefined;

    // memberName 갱신
    {
      const guild = this.discord.guilds.cache.get(guildId);
      const mem = guild ? await guild.members.fetch(mission.memberId).catch(() => null) : null;
      if (mem) await this.missionRepo.updateMemberName(missionId, mem.displayName);
    }

    if (roleId) {
      try {
        const guild = this.discord.guilds.cache.get(guildId);
        if (!guild) throw new Error('Guild not found');
        const member = await guild.members.fetch(mission.memberId).catch(() => null);
        if (!member) throw new Error('Member not found');
        await member.roles.add(roleId);
        this.logger.log(`[MISSION] Role granted: member=${mission.memberId} role=${roleId}`);
      } catch (err) {
        warning = `역할 부여에 실패했습니다: ${getErrorMessage(err)}`;
        this.logger.warn(`[MISSION] Role grant failed: ${warning}`);
      }
    }

    await this.newbieRedis.deleteMissionActive(guildId);
    await this.refreshMissionEmbed(guildId).catch((err) => {
      this.logger.error(`[MISSION] Embed refresh failed after complete`, getErrorStack(err));
    });

    return warning ? { ok: true, warning } : { ok: true };
  }

  /**
   * 미션 수동 실패 처리 (F-NEWBIE-005).
   * 상태를 FAILED로 갱신하고, 옵션으로 DM 전송 후 강퇴한다.
   */
  async failMission(
    guildId: string,
    missionId: number,
    kick?: boolean,
    dmReason?: string | null,
  ): Promise<{ ok: true; warning?: string }> {
    const mission = await this.missionRepo.findById(missionId);
    if (!mission) throw new NotFoundException('미션을 찾을 수 없습니다.');
    if (mission.guildId !== guildId) throw new NotFoundException('미션을 찾을 수 없습니다.');
    if (mission.status !== MissionStatus.IN_PROGRESS) {
      throw new BadRequestException('진행 중인 미션만 실패 처리할 수 있습니다.');
    }

    await this.missionRepo.updateStatus(missionId, MissionStatus.FAILED);
    this.logger.log(`[MISSION] Manual fail: id=${missionId} member=${mission.memberId}`);

    // memberName 갱신
    {
      const guild = this.discord.guilds.cache.get(guildId);
      const mem = guild ? await guild.members.fetch(mission.memberId).catch(() => null) : null;
      if (mem) await this.missionRepo.updateMemberName(missionId, mem.displayName);
    }

    let warning: string | undefined;

    if (kick) {
      try {
        const guild = this.discord.guilds.cache.get(guildId);
        if (!guild) throw new Error('Guild not found');
        const member = await guild.members.fetch(mission.memberId).catch(() => null);
        if (!member) throw new Error('Member not found');

        // DM 사유 전송 (실패해도 무시)
        if (dmReason) {
          await member.send(dmReason).catch(() => {
            this.logger.warn(
              `[MISSION] DM failed (blocked or unavailable): member=${mission.memberId}`,
            );
          });
        }

        await member.kick('미션 실패 처리');
        this.logger.log(`[MISSION] Kicked: member=${mission.memberId}`);
      } catch (err) {
        warning = `강퇴에 실패했습니다: ${getErrorMessage(err)}`;
        this.logger.warn(`[MISSION] Kick failed: ${warning}`);
      }
    }

    await this.newbieRedis.deleteMissionActive(guildId);
    await this.refreshMissionEmbed(guildId).catch((err) => {
      this.logger.error(`[MISSION] Embed refresh failed after fail`, getErrorStack(err));
    });

    return warning ? { ok: true, warning } : { ok: true };
  }

  /**
   * 미션 Embed 숨김 처리 (F-NEWBIE-005).
   * hiddenFromEmbed = true로 갱신하여 Embed에서 제외한다.
   */
  async hideMission(guildId: string, missionId: number): Promise<void> {
    const mission = await this.missionRepo.findById(missionId);
    if (!mission) throw new NotFoundException('미션을 찾을 수 없습니다.');
    if (mission.guildId !== guildId) throw new NotFoundException('미션을 찾을 수 없습니다.');

    await this.missionRepo.updateHidden(missionId, true);
    this.logger.log(`[MISSION] Hidden from embed: id=${missionId} member=${mission.memberId}`);

    await this.newbieRedis.deleteMissionActive(guildId);
    await this.refreshMissionEmbed(guildId).catch((err) => {
      this.logger.error(`[MISSION] Embed refresh failed after hide`, getErrorStack(err));
    });
  }

  /**
   * hiddenFromEmbed = false로 갱신하여 Embed에 다시 표시한다.
   */
  async unhideMission(guildId: string, missionId: number): Promise<void> {
    const mission = await this.missionRepo.findById(missionId);
    if (!mission) throw new NotFoundException('미션을 찾을 수 없습니다.');
    if (mission.guildId !== guildId) throw new NotFoundException('미션을 찾을 수 없습니다.');

    await this.missionRepo.updateHidden(missionId, false);
    this.logger.log(`[MISSION] Unhidden from embed: id=${missionId} member=${mission.memberId}`);

    await this.newbieRedis.deleteMissionActive(guildId);
    await this.refreshMissionEmbed(guildId).catch((err) => {
      this.logger.error(`[MISSION] Embed refresh failed after unhide`, getErrorStack(err));
    });
  }

  /**
   * 가입일 기준 missionDurationDays 이내인데 미션이 없는 멤버를 자동 등록한다.
   * 봇이 오프라인이었거나 기능 활성화 전에 가입한 멤버를 보완한다.
   */
  async registerMissingMembers(guildId: string, config: NewbieConfig): Promise<void> {
    if (!config.missionDurationDays || !config.missionTargetPlaytimeHours) return;

    const guild = this.discord.guilds.cache.get(guildId);
    if (!guild) return;

    const cutoff = Date.now() - config.missionDurationDays * 86_400_000;

    // 길드 전체 멤버 조회
    const members = await guild.members.fetch().catch(() => null);
    if (!members) return;

    // 미션이 존재하는 멤버 Set (상태 무관 — 중복 미션 방지)
    const memberIds = await this.missionRepo.findMemberIdsWithMission(guildId);
    const hasMission = new Set(memberIds);

    let created = 0;
    for (const [, member] of members) {
      if (member.user.bot) continue;
      if (!member.joinedAt || member.joinedAt.getTime() < cutoff) continue;
      if (hasMission.has(member.id)) continue;

      const joinDate = this.toDateString(member.joinedAt);
      const endDate = this.toDateString(
        new Date(member.joinedAt.getTime() + config.missionDurationDays * 86_400_000),
      );
      const targetPlaytimeSec = config.missionTargetPlaytimeHours * 3600;

      await this.missionRepo.create(guildId, member.id, joinDate, endDate, targetPlaytimeSec);
      this.logger.log(
        `[MISSION] Auto-registered missing member: guild=${guildId} member=${member.id} joined=${joinDate}`,
      );
      created++;
    }

    if (created > 0) {
      await this.newbieRedis.deleteMissionActive(guildId);
    }
  }

  /**
   * 봇 멤버의 미션은 DB에서 삭제하고, 서버를 떠난 멤버의 미션은
   * IN_PROGRESS → LEFT 상태로 변경 + hiddenFromEmbed = true 처리한다.
   * 변경사항이 있으면 캐시를 무효화한다.
   *
   * Discord API 오류(rate limit, 네트워크 등)와 실제 탈퇴(10007 Unknown Member)를
   * 구분하여, 일시적 오류 시에는 미션 데이터를 변경하지 않는다.
   */
  private async removeInvalidMissions(
    guildId: string,
    missions: NewbieMission[],
  ): Promise<NewbieMission[]> {
    if (missions.length === 0) return missions;

    const guild = this.discord.guilds.cache.get(guildId);
    if (!guild) return missions; // 길드 조회 실패 시 필터 생략

    const valid: NewbieMission[] = [];
    let changed = 0;

    for (const mission of missions) {
      let member: GuildMember | null = null;
      let isConfirmedAbsent = false;

      try {
        member = await guild.members.fetch(mission.memberId);
      } catch (err) {
        if (err instanceof DiscordAPIError && err.code === 10007) {
          // 10007 = Unknown Member → 서버에 실제로 없는 멤버
          isConfirmedAbsent = true;
        } else {
          // Rate limit, 네트워크 오류 등 → 판단 불가, 기존 상태 유지
          this.logger.warn(
            `[MISSION] Member fetch failed (keeping mission): id=${mission.id} member=${mission.memberId} error=${getErrorMessage(err)}`,
          );
          valid.push(mission);
          continue;
        }
      }

      if (member?.user.bot) {
        // 봇 멤버: DB에서 삭제
        await this.missionRepo.delete(mission.id);
        this.logger.log(
          `[MISSION] Deleted bot mission: id=${mission.id} member=${mission.memberId}`,
        );
        changed++;
        continue;
      }

      if (isConfirmedAbsent) {
        // 나간 멤버: DB 보존, embed에서만 제거
        if (mission.status === MissionStatus.IN_PROGRESS) {
          await this.missionRepo.updateStatus(mission.id, MissionStatus.LEFT);
          this.logger.log(
            `[MISSION] Member left (IN_PROGRESS → LEFT): id=${mission.id} member=${mission.memberId}`,
          );
        }
        if (!mission.hiddenFromEmbed) {
          await this.missionRepo.updateHidden(mission.id, true);
        }
        changed++;
        continue;
      }

      valid.push(mission);
    }

    if (changed > 0) {
      await this.newbieRedis.deleteMissionActive(guildId);
    }

    return valid;
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
    //    totalCount는 Embed에 실제 표시되는 미션 수(= missions 배열 길이)를 사용한다.
    const statusCounts = await this.missionRepo.countByStatusForGuild(guildId);
    const totalCount = missions.length;
    const inProgressCount = statusCounts.IN_PROGRESS;
    const completedCount = statusCounts.COMPLETED;
    const failedCount = statusCounts.FAILED;
    const leftCount = statusCounts.LEFT;

    // 3. 헤더 렌더링
    const resolvedHeader = applyTemplate(headerTemplate, {
      totalCount: String(totalCount),
      inProgressCount: String(inProgressCount),
      completedCount: String(completedCount),
      failedCount: String(failedCount),
      leftCount: String(leftCount),
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
        this.getPlayCount(guildId, mission.memberId, mission.startDate, mission.endDate, config),
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
    //    Discord Embed description 최대 4096자 제한 준수
    const MAX_DESCRIPTION_LENGTH = 4096;
    let description: string;
    if (missions.length > 0) {
      const parts: string[] = [resolvedHeader];
      for (const line of itemLines) {
        const candidate = parts.join('\n\n') + '\n\n' + line;
        if (candidate.length > MAX_DESCRIPTION_LENGTH) {
          parts.push('…외 추가 멤버 생략');
          break;
        }
        parts.push(line);
      }
      description = parts.join('\n\n');
    } else {
      description = resolvedHeader;
    }

    // 7. 푸터 렌더링
    const updatedAt = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
    const resolvedFooter = applyTemplate(footerTemplate, { updatedAt });

    // 8. EmbedBuilder 구성
    const embed = new EmbedBuilder()
      .setTitle(resolvedTitle)
      .setDescription(description)
      .setColor(this.resolveEmbedColor(config.missionEmbedColor))
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
  private async fetchMemberDisplayName(guildId: string, memberId: string): Promise<string> {
    try {
      const guild = this.discord.guilds.cache.get(guildId);
      if (!guild) return `User-${memberId.slice(0, 6)}`;
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
    return Math.max(0, days);
  }

  /**
   * Embed 색상 문자열을 안전하게 파싱.
   * '#RRGGBB' 형식이 아니거나 파싱 실패 시 기본 색상(0x57f287)을 반환한다.
   */
  private resolveEmbedColor(color: string | null | undefined): number {
    const DEFAULT_COLOR = 0x57f287;
    if (!color) return DEFAULT_COLOR;
    const hex = color.startsWith('#') ? color : `#${color}`;
    const parsed = parseInt(hex.slice(1), 16);
    if (isNaN(parsed) || hex.slice(1).length !== 6) return DEFAULT_COLOR;
    return parsed;
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
