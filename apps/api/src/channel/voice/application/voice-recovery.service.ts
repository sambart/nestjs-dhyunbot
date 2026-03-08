import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';

import { RedisService } from '../../../redis/redis.service';
import { VoiceRedisRepository } from '../infrastructure/voice-redis.repository';
import { VoiceDailyFlushService } from './voice-daily-flush-service';

@Injectable()
export class VoiceRecoveryService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(VoiceRecoveryService.name);

  constructor(
    private readonly redis: RedisService,
    private readonly voiceRedisRepository: VoiceRedisRepository,
    private readonly flushService: VoiceDailyFlushService,
  ) {}

  async onApplicationBootstrap() {
    await this.recoverOrphanSessions();
  }

  async onApplicationShutdown() {
    this.logger.log('Shutting down — flushing all active voice sessions...');
    await this.flushAllActiveSessions();
    this.logger.log('All voice sessions flushed.');
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
