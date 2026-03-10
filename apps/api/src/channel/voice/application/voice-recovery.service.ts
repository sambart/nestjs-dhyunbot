import { InjectDiscordClient, Once } from '@discord-nestjs/core';
import {
  Injectable,
  Logger,
  OnApplicationShutdown,
} from '@nestjs/common';
import { Client } from 'discord.js';

import { RedisService } from '../../../redis/redis.service';
import { VoiceRedisRepository } from '../infrastructure/voice-redis.repository';
import { VoiceStateDto } from '../infrastructure/voice-state.dto';
import { VoiceChannelService } from './voice-channel.service';
import { VoiceChannelHistoryService } from './voice-channel-history.service';
import { VoiceDailyFlushService } from './voice-daily-flush-service';
import { VoiceExcludedChannelService } from './voice-excluded-channel.service';

@Injectable()
export class VoiceRecoveryService implements OnApplicationShutdown {
  private readonly logger = new Logger(VoiceRecoveryService.name);

  constructor(
    @InjectDiscordClient() private readonly client: Client,
    private readonly redis: RedisService,
    private readonly voiceRedisRepository: VoiceRedisRepository,
    private readonly flushService: VoiceDailyFlushService,
    private readonly historyService: VoiceChannelHistoryService,
    private readonly voiceChannelService: VoiceChannelService,
    private readonly excludedChannelService: VoiceExcludedChannelService,
  ) {}

  async onApplicationShutdown() {
    this.logger.log('Shutting down — flushing all active voice sessions...');

    // 1. Redis 세션 flush (기존 로직)
    await this.flushAllActiveSessions();

    // 2. 고아 history 레코드 일괄 종료 (F-VOICE-023 1단계)
    await this.historyService.closeOrphanRecords();

    this.logger.log('All voice sessions flushed.');
  }

  /**
   * Discord ready 후 복구 + 현재 음성 채널 유저 동기화 (F-VOICE-023)
   *
   * 3단계를 모두 ready 핸들러에서 순차 실행하여
   * onApplicationBootstrap과의 race condition을 방지한다.
   */
  @Once('ready')
  async onDiscordReady() {
    this.logger.log('Discord ready — recovering sessions and syncing voice states...');

    // 1. 고아 history 레코드 일괄 종료 (F-VOICE-023 2단계 — 크래시 복구)
    await this.historyService.closeOrphanRecords();

    // 2. Redis orphan 세션 flush (기존 로직)
    await this.recoverOrphanSessions();

    // 3. 현재 음성 채널 유저 동기화 (F-VOICE-023 3단계)
    await this.syncCurrentVoiceStates();
  }

  /** 현재 음성 채널에 있는 유저들의 세션을 복원한다 */
  private async syncCurrentVoiceStates(): Promise<void> {
    let synced = 0;

    for (const guild of this.client.guilds.cache.values()) {
      for (const voiceState of guild.voiceStates.cache.values()) {
        if (!voiceState.channelId || !voiceState.channel || !voiceState.member) continue;

        try {
          const excluded = await this.excludedChannelService.isExcludedChannel(
            guild.id,
            voiceState.channelId,
            voiceState.channel.parentId ?? null,
          );
          if (excluded) continue;

          const dto = VoiceStateDto.fromVoiceState(voiceState);
          await this.voiceChannelService.onUserJoined(dto);
          synced++;
        } catch (error) {
          this.logger.error(
            `Failed to sync voice state: guild=${guild.id} user=${voiceState.member?.id}`,
            (error as Error).stack,
          );
        }
      }
    }

    this.logger.log(`Voice state sync complete. ${synced} session(s) restored.`);
  }

  /** 서버 재시작 시 Redis에 남아있는 orphan 세션을 flush 처리 */
  private async recoverOrphanSessions(): Promise<void> {
    const sessionKeys = await this.redis.scanKeys('voice:session:*');

    if (sessionKeys.length === 0) {
      this.logger.log('No orphan voice sessions found.');
      return;
    }

    this.logger.warn(`Found ${sessionKeys.length} orphan voice session(s). Recovering...`);

    const now = Date.now();

    for (const key of sessionKeys) {
      try {
        const parts = key.split(':');
        const guildId = parts[2];
        const userId = parts[3];

        const session = await this.voiceRedisRepository.getSession(guildId, userId);
        if (!session) continue;

        // 남은 시간 누적
        await this.voiceRedisRepository.accumulateDuration(guildId, userId, session, now);

        // DB로 flush
        await this.flushService.flushDate(guildId, userId, session.date);

        // 세션 제거
        await this.voiceRedisRepository.deleteSession(guildId, userId);

        this.logger.log(`Recovered orphan session: guild=${guildId} user=${userId}`);
      } catch (error) {
        this.logger.error(`Failed to recover session from key=${key}`, (error as Error).stack);
      }
    }
  }

  /** 정상 종료 시 모든 활성 세션의 현재까지 누적분 flush */
  private async flushAllActiveSessions(): Promise<void> {
    const sessionKeys = await this.redis.scanKeys('voice:session:*');
    const now = Date.now();

    for (const key of sessionKeys) {
      try {
        const parts = key.split(':');
        const guildId = parts[2];
        const userId = parts[3];

        const session = await this.voiceRedisRepository.getSession(guildId, userId);
        if (!session) continue;

        await this.voiceRedisRepository.accumulateDuration(guildId, userId, session, now);
        await this.flushService.flushDate(guildId, userId, session.date);
      } catch (error) {
        this.logger.error(`Failed to flush session from key=${key}`, (error as Error).stack);
      }
    }
  }
}
