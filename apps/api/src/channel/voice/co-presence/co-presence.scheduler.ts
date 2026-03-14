import { InjectDiscordClient } from '@discord-nestjs/core';
import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Client, VoiceBasedChannel } from 'discord.js';

import { VoiceExcludedChannelService } from '../application/voice-excluded-channel.service';
import {
  CO_PRESENCE_TICK,
  CoPresenceTickEvent,
  CoPresenceTickSnapshot,
} from './co-presence.events';
import { CoPresenceService } from './co-presence.service';

/** 폴링 주기 (밀리초) */
const INTERVAL_MS = 60_000;

@Injectable()
export class CoPresenceScheduler implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(CoPresenceScheduler.name);
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private isShuttingDown = false;

  constructor(
    private readonly coPresenceService: CoPresenceService,
    private readonly excludedChannelService: VoiceExcludedChannelService,
    private readonly eventEmitter: EventEmitter2,
    @InjectDiscordClient() private readonly discord: Client,
  ) {}

  onApplicationBootstrap(): void {
    this.intervalId = setInterval(() => void this.tick(), INTERVAL_MS);
    this.logger.log('[CO-PRESENCE SCHEDULER] Started (interval=60s)');
  }

  async onApplicationShutdown(): Promise<void> {
    this.isShuttingDown = true;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    await this.coPresenceService.endAllSessions();
    this.logger.log('[CO-PRESENCE SCHEDULER] Stopped (all sessions ended)');
  }

  /**
   * 특정 길드의 모든 활성 세션을 강제 종료한다.
   * MocoResetScheduler가 Redis 키 삭제 전에 호출하여 데이터 정합성을 보장한다.
   */
  async flushGuildSessions(guildId: string): Promise<void> {
    await this.coPresenceService.endAllGuildSessions(guildId);
  }

  private async tick(): Promise<void> {
    if (this.isShuttingDown) return;

    const allSnapshots: CoPresenceTickSnapshot[] = [];

    for (const [guildId, guild] of this.discord.guilds.cache) {
      try {
        const snapshots = await this.processGuild(guildId, guild);
        allSnapshots.push(...snapshots);
      } catch (err) {
        this.logger.error(
          `[CO-PRESENCE SCHEDULER] Failed to process guild=${guildId}`,
          (err as Error).stack,
        );
      }
    }

    // 세션 조정
    await this.coPresenceService.reconcile(allSnapshots);

    // tick 이벤트 발행 (fire-and-forget)
    if (allSnapshots.length > 0) {
      const tickEvent: CoPresenceTickEvent = { snapshots: allSnapshots };
      this.eventEmitter.emit(CO_PRESENCE_TICK, tickEvent);
    }
  }

  private async processGuild(
    guildId: string,
    guild: { channels: { cache: Map<string, unknown> } },
  ): Promise<CoPresenceTickSnapshot[]> {
    const snapshots: CoPresenceTickSnapshot[] = [];

    for (const [, channel] of guild.channels.cache) {
      if (typeof (channel as Record<string, unknown>).isVoiceBased !== 'function') continue;
      if (!(channel as VoiceBasedChannel).isVoiceBased()) continue;

      const voiceChannel = channel as VoiceBasedChannel;
      const members = [...voiceChannel.members.values()];

      // 봇 제외
      const humanMembers = members.filter((m) => !m.user.bot);

      this.logger.debug(
        `[CO-PRESENCE TICK] guild=${guildId} channel=${voiceChannel.id} members=${members.length} humans=${humanMembers.length}`,
      );

      if (humanMembers.length < 2) continue;

      // 제외 채널 확인
      const isExcluded = await this.excludedChannelService.isExcludedChannel(
        guildId,
        voiceChannel.id,
        voiceChannel.parentId ?? null,
      );
      if (isExcluded) continue;

      snapshots.push({
        guildId,
        channelId: voiceChannel.id,
        userIds: humanMembers.map((m) => m.id),
      });
    }

    return snapshots;
  }
}
