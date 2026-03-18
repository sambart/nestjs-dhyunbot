import { type Mocked, vi } from 'vitest';

import { type RedisService } from '../../redis/redis.service';
import { BotStatus } from '../domain/bot-metric.types';
import {
  type AggregatedMetric,
  type BotMetricRepository,
} from '../infrastructure/bot-metric.repository';
import { type BotStatusResponse, MonitoringService } from './monitoring.service';

function makeBotStatus(overrides: Partial<BotStatusResponse> = {}): BotStatusResponse {
  return {
    online: true,
    uptimeMs: 60000,
    startedAt: '2026-03-18T00:00:00Z',
    pingMs: 50,
    guildCount: 3,
    memoryUsage: { heapUsedMb: 100, heapTotalMb: 200 },
    voiceUserCount: 5,
    ...overrides,
  };
}

describe('MonitoringService', () => {
  let service: MonitoringService;
  let redis: Mocked<RedisService>;
  let metricRepo: Mocked<BotMetricRepository>;

  beforeEach(() => {
    redis = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
    } as unknown as Mocked<RedisService>;

    metricRepo = {
      findByGuildAndRange: vi.fn().mockResolvedValue([]),
      findAggregated: vi.fn().mockResolvedValue([]),
      calculateAvailability: vi.fn().mockResolvedValue(100),
    } as unknown as Mocked<BotMetricRepository>;

    service = new MonitoringService(redis, metricRepo);
  });

  describe('getStatus', () => {
    it('캐시가 있으면 캐시에서 반환한다', async () => {
      const cached = makeBotStatus();
      redis.get.mockResolvedValueOnce(cached);

      const result = await service.getStatus('guild-1');

      expect(result).toBe(cached);
      expect(redis.get).toHaveBeenCalledTimes(1);
    });

    it('캐시 미스 + Bot 상태가 있으면 Bot 상태를 반환하고 캐시한다', async () => {
      const botStatus = makeBotStatus();
      redis.get
        .mockResolvedValueOnce(null) // STATUS_CACHE 미스
        .mockResolvedValueOnce(botStatus); // BOT_STATUS_CACHE_KEY 히트

      const result = await service.getStatus('guild-1');

      expect(result).toBe(botStatus);
      expect(redis.set).toHaveBeenCalledWith(expect.stringContaining('guild-1'), botStatus, 10);
    });

    it('캐시 미스 + Bot 상태도 없으면 collectStatus fallback을 반환한다', async () => {
      redis.get.mockResolvedValue(null);

      const result = await service.getStatus('guild-1');

      expect(result.online).toBe(true);
      expect(result.pingMs).toBe(0);
      expect(result.guildCount).toBe(0);
      expect(result.memoryUsage.heapUsedMb).toBeGreaterThan(0);
      expect(redis.set).toHaveBeenCalled();
    });
  });

  describe('getMetrics', () => {
    const from = new Date('2026-03-17T00:00:00Z');
    const to = new Date('2026-03-18T00:00:00Z');

    it('1m 간격은 findByGuildAndRange를 호출한다', async () => {
      metricRepo.findByGuildAndRange.mockResolvedValue([
        {
          recordedAt: new Date('2026-03-17T12:00:00Z'),
          status: BotStatus.ONLINE,
          pingMs: 50,
          heapUsedMb: 100,
          heapTotalMb: 200,
          voiceUserCount: 5,
          guildCount: 3,
        },
      ] as never);

      const result = await service.getMetrics('guild-1', from, to, '1m');

      expect(metricRepo.findByGuildAndRange).toHaveBeenCalledWith('guild-1', from, to);
      expect(result.interval).toBe('1m');
      expect(result.availabilityPercent).toBe(100);
    });

    it('5m/1h/1d 간격은 findAggregated를 호출한다', async () => {
      const metric: AggregatedMetric = {
        timestamp: '2026-03-17T12:00:00Z',
        online: true,
        pingMs: 50,
        heapUsedMb: 100,
        heapTotalMb: 200,
        voiceUserCount: 5,
        guildCount: 3,
      };
      metricRepo.findAggregated.mockResolvedValue([metric]);

      const result = await service.getMetrics('guild-1', from, to, '5m');

      expect(metricRepo.findAggregated).toHaveBeenCalledWith('guild-1', from, to, '5m');
      expect(result.interval).toBe('5m');
    });

    it('데이터 없는 구간을 OFFLINE으로 채운다', async () => {
      const shortFrom = new Date('2026-03-18T00:00:00Z');
      const shortTo = new Date('2026-03-18T00:10:00Z');
      metricRepo.findAggregated.mockResolvedValue([]);

      const result = await service.getMetrics('guild-1', shortFrom, shortTo, '5m');

      // 0분, 5분, 10분 = 3개 포인트
      expect(result.data.length).toBeGreaterThanOrEqual(2);
      expect(result.data.every((d) => !d.online)).toBe(true);
    });
  });
});
