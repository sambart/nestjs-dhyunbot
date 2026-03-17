import { Injectable, Logger } from '@nestjs/common';

import { getErrorStack } from '../../common/util/error.util';
import { RedisService } from '../../redis/redis.service';
import { BotStatus } from '../domain/bot-metric.types';
import { AggregatedMetric, BotMetricRepository } from '../infrastructure/bot-metric.repository';

export interface BotStatusResponse {
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

export interface MetricsResponse {
  interval: string;
  availabilityPercent: number;
  data: AggregatedMetric[];
}

// TODO(claude 2026-03-17): Bot API 엔드포인트 GET /bot-api/discord/status 에서
// ws.status, ws.ping, uptime, guilds.cache 등 Gateway 정보를 받아오도록 전환 필요.
// 현재는 API 프로세스 자체 메모리만 반환하며 Gateway 상태는 DB 메트릭 기반.

@Injectable()
export class MonitoringService {
  private readonly logger = new Logger(MonitoringService.name);
  private static readonly STATUS_CACHE_KEY = 'monitoring:status';
  private static readonly STATUS_CACHE_TTL = 10; // seconds

  constructor(
    private readonly redis: RedisService,
    private readonly metricRepo: BotMetricRepository,
  ) {}

  async getStatus(guildId: string): Promise<BotStatusResponse> {
    const cached = await this.redis.get<BotStatusResponse>(
      `${MonitoringService.STATUS_CACHE_KEY}:${guildId}`,
    );
    if (cached) return cached;

    const status = this.collectStatus();

    await this.redis.set(
      `${MonitoringService.STATUS_CACHE_KEY}:${guildId}`,
      status,
      MonitoringService.STATUS_CACHE_TTL,
    );

    return status;
  }

  async getMetrics(
    guildId: string,
    from: Date,
    to: Date,
    interval: string,
  ): Promise<MetricsResponse> {
    const [data, availabilityPercent] = await Promise.all([
      interval === '1m'
        ? this.metricRepo.findByGuildAndRange(guildId, from, to).then((rows) =>
            rows.map((r) => ({
              timestamp: r.recordedAt.toISOString(),
              online: r.status === BotStatus.ONLINE,
              pingMs: r.pingMs,
              heapUsedMb: r.heapUsedMb,
              heapTotalMb: r.heapTotalMb,
              voiceUserCount: r.voiceUserCount,
              guildCount: r.guildCount,
            })),
          )
        : this.metricRepo.findAggregated(guildId, from, to, interval),
      this.metricRepo.calculateAvailability(guildId, from, to),
    ]);

    const filledData = this.fillGaps(data, from, to, interval);

    return { interval, availabilityPercent, data: filledData };
  }

  /**
   * 데이터가 없는 시간 구간을 OFFLINE 데이터 포인트로 채움.
   * 봇이 꺼져있으면 메트릭이 수집되지 않으므로, 누락 구간 = 다운타임.
   */
  private fillGaps(
    data: AggregatedMetric[],
    from: Date,
    to: Date,
    interval: string,
  ): AggregatedMetric[] {
    const stepMs = this.intervalToMs(interval);
    const alignedFrom = this.alignToInterval(from, stepMs);

    const dataMap = new Map<number, AggregatedMetric>();
    for (const point of data) {
      const key = this.alignToInterval(new Date(point.timestamp), stepMs);
      dataMap.set(key, point);
    }

    const offlinePoint: Omit<AggregatedMetric, 'timestamp'> = {
      online: false,
      pingMs: 0,
      heapUsedMb: 0,
      heapTotalMb: 0,
      voiceUserCount: 0,
      guildCount: 0,
    };

    const filled: AggregatedMetric[] = [];
    for (let ts = alignedFrom; ts <= to.getTime(); ts += stepMs) {
      const existing = dataMap.get(ts);
      if (existing) {
        filled.push(existing);
      } else {
        filled.push({
          ...offlinePoint,
          timestamp: new Date(ts).toISOString(),
        });
      }
    }

    return filled;
  }

  private intervalToMs(interval: string): number {
    switch (interval) {
      case '5m':
        return 5 * 60_000;
      case '1h':
        return 60 * 60_000;
      case '1d':
        return 24 * 60 * 60_000;
      default:
        return 60_000;
    }
  }

  private alignToInterval(date: Date, stepMs: number): number {
    const epoch = date.getTime();
    return Math.floor(epoch / stepMs) * stepMs;
  }

  /**
   * API 프로세스 기준 상태 수집.
   * Gateway 연결이 없으므로 ws.status, ping 등은 Bot API 엔드포인트로 전환 필요.
   */
  collectStatus(): BotStatusResponse {
    try {
      const mem = process.memoryUsage();

      return {
        online: true, // API 프로세스가 살아있으면 true
        uptimeMs: process.uptime() * 1000,
        startedAt: null,
        pingMs: 0,
        guildCount: 0,
        memoryUsage: {
          heapUsedMb: parseFloat((mem.heapUsed / 1024 / 1024).toFixed(1)),
          heapTotalMb: parseFloat((mem.heapTotal / 1024 / 1024).toFixed(1)),
        },
        voiceUserCount: 0,
      };
    } catch (error) {
      this.logger.error('[MONITORING] Failed to collect status', getErrorStack(error));
      return {
        online: false,
        uptimeMs: 0,
        startedAt: null,
        pingMs: 0,
        guildCount: 0,
        memoryUsage: { heapUsedMb: 0, heapTotalMb: 0 },
        voiceUserCount: 0,
      };
    }
  }

  // TODO(claude 2026-03-17): collectAllGuildMetrics는 Bot에서 수행해야 함.
  // Bot API 엔드포인트로 이동 필요.
  collectAllGuildMetrics(): Array<{
    guildId: string;
    status: BotStatus;
    pingMs: number;
    heapUsedMb: number;
    heapTotalMb: number;
    voiceUserCount: number;
    guildCount: number;
  }> {
    // Gateway 없이는 길드 목록을 알 수 없으므로 빈 배열 반환
    return [];
  }
}
