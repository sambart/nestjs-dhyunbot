import { Body, Controller, HttpCode, HttpStatus, Logger, Post, UseGuards } from '@nestjs/common';

import { BotStatus } from '../../monitoring/domain/bot-metric.types';
import { BotMetricRepository } from '../../monitoring/infrastructure/bot-metric.repository';
import { RedisService } from '../../redis/redis.service';
import { BotApiAuthGuard } from '../bot-api-auth.guard';

/** Bot이 전송하는 길드별 메트릭 */
interface BotGuildMetricDto {
  guildId: string;
  status: 'ONLINE' | 'OFFLINE';
  pingMs: number;
  heapUsedMb: number;
  heapTotalMb: number;
  voiceUserCount: number;
  guildCount: number;
}

/** Bot이 전송하는 봇 전체 상태 */
interface BotStatusPayloadDto {
  online: boolean;
  uptimeMs: number;
  startedAt: string | null;
  pingMs: number;
  guildCount: number;
  memoryUsage: {
    heapUsedMb: number;
    heapTotalMb: number;
  };
  voiceUserCount: number;
}

/** Redis에 캐시할 봇 상태 키 */
const BOT_STATUS_CACHE_KEY = 'monitoring:bot-status';

/** 봇 상태 캐시 TTL (초) */
const BOT_STATUS_TTL = 120;

/**
 * Bot → API 모니터링 메트릭 수신 엔드포인트.
 * Bot이 60초마다 수집한 Gateway 메트릭과 봇 상태를 수신한다.
 */
@Controller('bot-api/monitoring')
@UseGuards(BotApiAuthGuard)
export class BotMonitoringController {
  private readonly logger = new Logger(BotMonitoringController.name);

  constructor(
    private readonly metricRepo: BotMetricRepository,
    private readonly redis: RedisService,
  ) {}

  @Post('metrics')
  @HttpCode(HttpStatus.OK)
  async receiveMetrics(
    @Body() body: { metrics: BotGuildMetricDto[] },
  ): Promise<{ ok: boolean }> {
    if (body.metrics.length > 0) {
      const mapped = body.metrics.map((m) => ({
        ...m,
        status: m.status === 'ONLINE' ? BotStatus.ONLINE : BotStatus.OFFLINE,
      }));
      await this.metricRepo.saveBatch(mapped);
      this.logger.debug(
        `[BOT-API] monitoring metrics received: ${body.metrics.length} guild(s)`,
      );
    }

    return { ok: true };
  }

  @Post('status')
  @HttpCode(HttpStatus.OK)
  async receiveStatus(
    @Body() body: BotStatusPayloadDto,
  ): Promise<{ ok: boolean }> {
    // Redis에 봇 상태 캐시 (MonitoringService.getStatus에서 조회)
    await this.redis.set(BOT_STATUS_CACHE_KEY, body, BOT_STATUS_TTL);

    this.logger.debug(
      `[BOT-API] bot status received: online=${body.online} ping=${body.pingMs}ms guilds=${body.guildCount}`,
    );

    return { ok: true };
  }
}
