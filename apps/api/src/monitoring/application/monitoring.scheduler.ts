import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { getErrorStack } from '../../common/util/error.util';
import { BotMetricRepository } from '../infrastructure/bot-metric.repository';

/**
 * 모니터링 스케줄러.
 * 메트릭 수집은 Bot 프로세스로 이관됨 (BotMonitoringScheduler).
 * API에서는 오래된 메트릭 정리만 담당한다.
 */
@Injectable()
export class MonitoringScheduler {
  private readonly logger = new Logger(MonitoringScheduler.name);

  constructor(private readonly metricRepo: BotMetricRepository) {}

  /**
   * F-MONITORING-004: 30일 초과 메트릭 삭제 (매일 03:00)
   */
  @Cron('0 3 * * *')
  async cleanup(): Promise<void> {
    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 30);

      const deleted = await this.metricRepo.deleteOlderThan(cutoff);
      if (deleted > 0) {
        this.logger.log(`[MONITORING] Cleanup: deleted ${deleted} metrics older than 30 days`);
      }
    } catch (error) {
      this.logger.error('[MONITORING] Cleanup failed', getErrorStack(error));
    }
  }
}
