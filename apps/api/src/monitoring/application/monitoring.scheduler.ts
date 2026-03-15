import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { getErrorStack } from '../../common/util/error.util';
import { BotMetricRepository } from '../infrastructure/bot-metric.repository';
import { MonitoringService } from './monitoring.service';

@Injectable()
export class MonitoringScheduler {
  private readonly logger = new Logger(MonitoringScheduler.name);

  constructor(
    private readonly monitoringService: MonitoringService,
    private readonly metricRepo: BotMetricRepository,
  ) {}

  /**
   * F-MONITORING-002: 1분 간격 메트릭 수집
   */
  @Cron('*/1 * * * *')
  async collectMetrics(): Promise<void> {
    try {
      const metrics = this.monitoringService.collectAllGuildMetrics();
      if (metrics.length === 0) return;

      await this.metricRepo.saveBatch(metrics);
    } catch (error) {
      this.logger.error('[MONITORING] Failed to collect metrics', getErrorStack(error));
    }
  }

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
