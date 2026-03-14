import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { BadgeService } from './badge.service';
import { VoiceHealthConfigRepository } from './voice-health-config.repository';

@Injectable()
export class BadgeScheduler implements OnApplicationBootstrap {
  private readonly logger = new Logger(BadgeScheduler.name);

  constructor(
    private readonly configRepo: VoiceHealthConfigRepository,
    private readonly badgeService: BadgeService,
  ) {}

  /** 앱 기동 시 즉시 1회 실행 */
  async onApplicationBootstrap(): Promise<void> {
    // 비동기로 실행하여 앱 기동을 블로킹하지 않음
    void this.runDailyBadgeCalc().catch((err) =>
      this.logger.error('[BADGE] Bootstrap calc failed', (err as Error).stack),
    );
  }

  /**
   * 매시간 30분에 실행 (매 정각 대신 30분으로 Co-Presence 정리와 겹치지 않도록).
   */
  @Cron('30 * * * *', { name: 'badge-hourly-calc', timeZone: 'Asia/Seoul' })
  async runDailyBadgeCalc(): Promise<void> {
    this.logger.log('[BADGE] Starting daily badge calculation...');
    try {
      const configs = await this.configRepo.findAllEnabled();
      let totalProcessed = 0;

      for (const config of configs) {
        try {
          const count = await this.badgeService.judgeAll(config);
          totalProcessed += count;
          this.logger.log(`[BADGE] guild=${config.guildId} processed=${count}`);
        } catch (err) {
          this.logger.error(`[BADGE] Failed guild=${config.guildId}`, (err as Error).stack);
        }
      }

      this.logger.log(`[BADGE] Completed. Total processed=${totalProcessed}`);
    } catch (err) {
      this.logger.error('[BADGE] Unhandled error', (err as Error).stack);
    }
  }
}
