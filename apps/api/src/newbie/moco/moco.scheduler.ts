import { InjectDiscordClient } from '@discord-nestjs/core';
import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { Client, Guild, VoiceBasedChannel } from 'discord.js';

import { VoiceExcludedChannelService } from '../../channel/voice/application/voice-excluded-channel.service';
import { NewbieConfigRepository } from '../infrastructure/newbie-config.repository';
import { NewbieMissionRepository } from '../infrastructure/newbie-mission.repository';
import { NewbiePeriodRepository } from '../infrastructure/newbie-period.repository';
import { NewbieRedisRepository } from '../infrastructure/newbie-redis.repository';

/** 모코코 사냥 시간 누적 주기 (밀리초) */
const INTERVAL_MS = 60_000; // 1분

@Injectable()
export class MocoScheduler implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(MocoScheduler.name);
  private intervalId: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly configRepo: NewbieConfigRepository,
    private readonly missionRepo: NewbieMissionRepository,
    private readonly periodRepo: NewbiePeriodRepository,
    private readonly newbieRedis: NewbieRedisRepository,
    private readonly excludedChannelService: VoiceExcludedChannelService,
    @InjectDiscordClient() private readonly discord: Client,
  ) {}

  onApplicationBootstrap(): void {
    this.intervalId = setInterval(() => void this.tick(), INTERVAL_MS);
    this.logger.log('[MOCO SCHEDULER] Started (interval=60s)');
  }

  onApplicationShutdown(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.logger.log('[MOCO SCHEDULER] Stopped');
  }

  /**
   * 매 1분마다 실행. 봇이 참여 중인 모든 길드의 음성 채널을 순회하며
   * 신규사용자(모코코)와 기존 멤버(사냥꾼)가 함께 있는 채널에 대해 시간을 1분 누적한다.
   */
  private async tick(): Promise<void> {
    for (const [guildId, guild] of this.discord.guilds.cache) {
      try {
        await this.processGuild(guildId, guild);
      } catch (err) {
        this.logger.error(
          `[MOCO SCHEDULER] Failed to process guild=${guildId}`,
          (err as Error).stack,
        );
      }
    }
  }

  private async processGuild(guildId: string, guild: Guild): Promise<void> {
    // 1. mocoEnabled 확인
    const config = await this.configRepo.findByGuildId(guildId);
    if (!config?.mocoEnabled) return;

    // 2. 신입기간 활성 멤버 조회 (Redis 캐시 우선)
    let activePeriodMembers = await this.newbieRedis.getPeriodActiveMembers(guildId);

    if (activePeriodMembers === null) {
      // 캐시 미스 — DB 조회 후 캐시 초기화
      const periods = await this.periodRepo.findActiveByGuild(guildId);
      const memberIds = periods.map((p) => p.memberId);
      await this.newbieRedis.initPeriodActiveMembers(guildId, memberIds);
      activePeriodMembers = memberIds;
    }

    if (activePeriodMembers.length === 0) return;

    const activePeriodSet = new Set(activePeriodMembers);

    // 3. 활성 미션 멤버 Set 구축 (길드 전체 한 번만 조회)
    const activeMissions = await this.missionRepo.findActiveByGuild(guildId);
    const activeMissionMemberSet = new Set(activeMissions.map((m) => m.memberId));

    // 4. 음성 채널 순회
    for (const [, channel] of guild.channels.cache) {
      if (!channel.isVoiceBased()) continue;

      const voiceChannel = channel as VoiceBasedChannel;
      const memberIds = [...voiceChannel.members.keys()];
      if (memberIds.length < 2) continue;

      // 제외 채널 확인
      const excluded = await this.excludedChannelService.isExcludedChannel(
        guildId,
        voiceChannel.id,
        voiceChannel.parentId ?? null,
      );
      if (excluded) continue;

      // 5. 신규사용자 식별 (신입기간 활성 ∩ 미션 IN_PROGRESS)
      const confirmedNewbies = memberIds.filter(
        (id) => activePeriodSet.has(id) && activeMissionMemberSet.has(id),
      );
      if (confirmedNewbies.length === 0) continue;

      // 6. 사냥꾼 식별 (채널 멤버 - 신규사용자)
      const newbieSet = new Set(confirmedNewbies);
      const hunters = memberIds.filter((id) => !newbieSet.has(id));
      if (hunters.length === 0) continue;

      // 7. Redis 누적 (HINCRBY + ZINCRBY)
      for (const hunterId of hunters) {
        for (const newbieId of confirmedNewbies) {
          await this.newbieRedis.incrMocoMinutes(guildId, hunterId, newbieId, 1);
        }
        await this.newbieRedis.incrMocoRank(guildId, hunterId, confirmedNewbies.length);
      }
    }
  }
}
