import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';

import { getErrorStack } from '../../../common/util/error.util';
import { RedisService } from '../../../redis/redis.service';
import { VoiceRedisRepository } from '../infrastructure/voice-redis.repository';
import { VoiceChannelHistoryService } from './voice-channel-history.service';
import { VoiceDailyFlushService } from './voice-daily-flush-service';

// TODO(claude 2026-03-17): 현재 음성 채널 유저 동기화(syncCurrentVoiceStates)는
// Bot API 엔드포인트 GET /bot-api/discord/voice-states 에서 받아오도록 전환 필요.
// 현재는 orphan 세션 flush와 고아 history 레코드 종료만 수행한다.

@Injectable()
export class VoiceRecoveryService implements OnApplicationShutdown {
  private readonly logger = new Logger(VoiceRecoveryService.name);

  constructor(
    private readonly redis: RedisService,
    private readonly voiceRedisRepository: VoiceRedisRepository,
    private readonly flushService: VoiceDailyFlushService,
    private readonly historyService: VoiceChannelHistoryService,
  ) {}

  async onApplicationShutdown() {
    this.logger.log('Shutting down -- flushing all active voice sessions...');

    // 1. Redis 세션 flush (기존 로직)
    await this.flushAllActiveSessions();

    // 2. 고아 history 레코드 일괄 종료 (F-VOICE-023 1단계)
    await this.historyService.closeOrphanRecords();

    this.logger.log('All voice sessions flushed.');
  }

  /**
   * 앱 시작 시 복구 처리.
   * Gateway 연결 없이 orphan 세션 처리와 고아 레코드 종료만 수행.
   */
  async onAppReady() {
    this.logger.log('App ready -- recovering sessions...');

    // 1. 고아 history 레코드 일괄 종료 (크래시 복구)
    await this.historyService.closeOrphanRecords();

    // 2. Redis orphan 세션 flush
    await this.recoverOrphanSessions();

    this.logger.log('Session recovery complete.');
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
        this.logger.error(`Failed to recover session from key=${key}`, getErrorStack(error));
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
        this.logger.error(`Failed to flush session from key=${key}`, getErrorStack(error));
      }
    }
  }
}
