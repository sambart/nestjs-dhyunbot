import { InjectDiscordClient } from '@discord-nestjs/core';
import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { Client, Guild, VoiceBasedChannel } from 'discord.js';

import { VoiceExcludedChannelService } from '../../channel/voice/application/voice-excluded-channel.service';
import { NewbieConfigRepository } from '../infrastructure/newbie-config.repository';
import { NewbieRedisRepository } from '../infrastructure/newbie-redis.repository';

/** 모코코 사냥 시간 누적 주기 (밀리초) */
const INTERVAL_MS = 60_000; // 1분

@Injectable()
export class MocoScheduler implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(MocoScheduler.name);
  private intervalId: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly configRepo: NewbieConfigRepository,
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

    const newbieDays = config.mocoNewbieDays ?? 30;
    const cutoff = Date.now() - newbieDays * 86_400_000;

    // 2. 음성 채널 순회
    for (const [, channel] of guild.channels.cache) {
      if (!channel.isVoiceBased()) continue;

      const voiceChannel = channel as VoiceBasedChannel;
      const members = [...voiceChannel.members.values()];
      if (members.length < 2) continue;

      // 제외 채널 확인
      const excluded = await this.excludedChannelService.isExcludedChannel(
        guildId,
        voiceChannel.id,
        voiceChannel.parentId ?? null,
      );
      if (excluded) continue;

      // 3. 신규사용자(모코코) 식별 — 서버 가입일이 cutoff 이후인 멤버
      const confirmedNewbies = members
        .filter((m) => m.joinedAt && m.joinedAt.getTime() >= cutoff)
        .map((m) => m.id);
      if (confirmedNewbies.length === 0) continue;

      // 4. 사냥꾼 식별
      const memberIds = members.map((m) => m.id);
      const newbieSet = new Set(confirmedNewbies);
      const hunters = config.mocoAllowNewbieHunter
        ? memberIds
        : memberIds.filter((id) => !newbieSet.has(id));
      if (hunters.length === 0) continue;

      // 5. Redis 누적 (HINCRBY + ZINCRBY)
      for (const hunterId of hunters) {
        for (const newbieId of confirmedNewbies) {
          if (hunterId === newbieId) continue;
          await this.newbieRedis.incrMocoMinutes(guildId, hunterId, newbieId, 1);
        }
        const targetCount = config.mocoAllowNewbieHunter && newbieSet.has(hunterId)
          ? confirmedNewbies.length - 1
          : confirmedNewbies.length;
        if (targetCount > 0) {
          await this.newbieRedis.incrMocoRank(guildId, hunterId, targetCount);
        }
      }
    }
  }
}
