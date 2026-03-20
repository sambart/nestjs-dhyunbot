import type { TestingModule } from '@nestjs/testing';
import type Redis from 'ioredis';
import { DataSource } from 'typeorm';

import { REDIS_CLIENT } from '../../redis/redis.constants';
import { RedisService } from '../../redis/redis.service';
import { createIntegrationModuleBuilder } from '../../test-utils/create-integration-module';
import { cleanDatabase } from '../../test-utils/db-cleaner';
import { cleanRedis } from '../../test-utils/redis-cleaner';
import { BotStatus } from '../domain/bot-metric.types';
import { BotMetricOrm } from '../infrastructure/bot-metric.orm-entity';
import { BotMetricRepository } from '../infrastructure/bot-metric.repository';
import { type BotStatusResponse, MonitoringService } from './monitoring.service';

const GUILD = 'guild-1';

/** 테스트용 Bot 상태 데이터 */
const MOCK_BOT_STATUS: BotStatusResponse = {
  online: true,
  uptimeMs: 12345,
  startedAt: '2026-03-18T00:00:00.000Z',
  pingMs: 42,
  guildCount: 3,
  memoryUsage: { heapUsedMb: 128.5, heapTotalMb: 256.0 },
  voiceUserCount: 5,
};

const STATUS_CACHE_KEY = 'monitoring:status';
const BOT_STATUS_CACHE_KEY = 'monitoring:bot-status';

describe('MonitoringService (Integration)', () => {
  let module: TestingModule;
  let service: MonitoringService;
  let dataSource: DataSource;
  let redisClient: Redis;

  beforeAll(async () => {
    module = await createIntegrationModuleBuilder({
      entities: [BotMetricOrm],
      providers: [MonitoringService, BotMetricRepository, RedisService],
    }).compile();

    service = module.get(MonitoringService);
    dataSource = module.get(DataSource);
    redisClient = module.get<Redis>(REDIS_CLIENT);
  }, 60_000);

  afterEach(async () => {
    await cleanDatabase(dataSource);
    await cleanRedis(redisClient);
  });

  afterAll(async () => {
    await module?.close();
  });

  describe('getStatus', () => {
    it('캐시 없고 Bot 상태도 없을 때 collectStatus fallback을 반환하며 online=true이다', async () => {
      const result = await service.getStatus(GUILD);

      expect(result.online).toBe(true);
      expect(result.uptimeMs).toBeGreaterThan(0);
      expect(result.pingMs).toBe(0);
      expect(result.guildCount).toBe(0);
      expect(result.voiceUserCount).toBe(0);
    });

    it('Bot 상태가 Redis에 있으면 Bot 상태를 반환한다', async () => {
      await redisClient.set(BOT_STATUS_CACHE_KEY, JSON.stringify(MOCK_BOT_STATUS));

      const result = await service.getStatus(GUILD);

      expect(result.online).toBe(MOCK_BOT_STATUS.online);
      expect(result.pingMs).toBe(MOCK_BOT_STATUS.pingMs);
      expect(result.guildCount).toBe(MOCK_BOT_STATUS.guildCount);
      expect(result.voiceUserCount).toBe(MOCK_BOT_STATUS.voiceUserCount);
      expect(result.uptimeMs).toBe(MOCK_BOT_STATUS.uptimeMs);
      expect(result.startedAt).toBe(MOCK_BOT_STATUS.startedAt);
    });

    it('두 번째 호출 시 캐시 히트로 반환한다', async () => {
      await redisClient.set(BOT_STATUS_CACHE_KEY, JSON.stringify(MOCK_BOT_STATUS));

      // 첫 번째 호출로 STATUS_CACHE_KEY에 캐싱
      await service.getStatus(GUILD);

      // Bot 상태를 Redis에서 제거한 후에도 캐시에서 반환해야 함
      await redisClient.del(BOT_STATUS_CACHE_KEY);

      const result = await service.getStatus(GUILD);

      expect(result.pingMs).toBe(MOCK_BOT_STATUS.pingMs);
      expect(result.guildCount).toBe(MOCK_BOT_STATUS.guildCount);

      // STATUS_CACHE_KEY에 캐시가 존재하는지 확인
      const cached = await redisClient.get(`${STATUS_CACHE_KEY}:${GUILD}`);
      expect(cached).not.toBeNull();
    });
  });

  describe('getMetrics', () => {
    it('DB에 메트릭이 있으면 해당 데이터를 반환하고, 없는 구간은 OFFLINE gap으로 채운다', async () => {
      const from = new Date('2026-03-18T00:00:00.000Z');
      const to = new Date('2026-03-18T00:05:00.000Z');

      // 00:01, 00:03 분에만 ONLINE 레코드 삽입 (00:00, 00:02, 00:04, 00:05는 누락)
      await dataSource.getRepository(BotMetricOrm).save([
        {
          guildId: GUILD,
          status: BotStatus.ONLINE,
          pingMs: 30,
          heapUsedMb: 100,
          heapTotalMb: 200,
          voiceUserCount: 2,
          guildCount: 1,
          recordedAt: new Date('2026-03-18T00:01:00.000Z'),
        },
        {
          guildId: GUILD,
          status: BotStatus.ONLINE,
          pingMs: 35,
          heapUsedMb: 105,
          heapTotalMb: 200,
          voiceUserCount: 3,
          guildCount: 1,
          recordedAt: new Date('2026-03-18T00:03:00.000Z'),
        },
      ]);

      const result = await service.getMetrics(GUILD, from, to, '1m');

      // from ~ to 구간의 모든 분 슬롯이 채워져야 함 (0, 1, 2, 3, 4, 5분 = 6개)
      expect(result.data.length).toBeGreaterThanOrEqual(2);

      // ONLINE 레코드가 포함돼 있는지 확인
      const onlinePoints = result.data.filter((d) => d.online);
      expect(onlinePoints.length).toBeGreaterThanOrEqual(2);

      // 누락 구간은 OFFLINE으로 채워져야 함
      const offlinePoints = result.data.filter((d) => !d.online);
      expect(offlinePoints.length).toBeGreaterThan(0);

      // OFFLINE gap의 pingMs는 0이어야 함
      for (const point of offlinePoints) {
        expect(point.pingMs).toBe(0);
        expect(point.heapUsedMb).toBe(0);
        expect(point.voiceUserCount).toBe(0);
      }
    });

    it('DB에 메트릭이 없으면 전 구간이 OFFLINE gap으로 채워진다', async () => {
      const from = new Date('2026-03-18T01:00:00.000Z');
      const to = new Date('2026-03-18T01:02:00.000Z');

      const result = await service.getMetrics(GUILD, from, to, '1m');

      // 모든 포인트가 OFFLINE이어야 함
      expect(result.data.length).toBeGreaterThan(0);
      for (const point of result.data) {
        expect(point.online).toBe(false);
        expect(point.pingMs).toBe(0);
      }

      // 가용률도 0이어야 함
      expect(result.availabilityPercent).toBe(0);
    });

    it('1m 간격으로 조회하면 raw 데이터를 분 단위로 반환한다', async () => {
      const from = new Date('2026-03-18T02:00:00.000Z');
      const to = new Date('2026-03-18T02:02:00.000Z');

      await dataSource.getRepository(BotMetricOrm).save([
        {
          guildId: GUILD,
          status: BotStatus.ONLINE,
          pingMs: 20,
          heapUsedMb: 90,
          heapTotalMb: 180,
          voiceUserCount: 1,
          guildCount: 1,
          recordedAt: new Date('2026-03-18T02:00:30.000Z'),
        },
        {
          guildId: GUILD,
          status: BotStatus.ONLINE,
          pingMs: 25,
          heapUsedMb: 95,
          heapTotalMb: 180,
          voiceUserCount: 1,
          guildCount: 1,
          recordedAt: new Date('2026-03-18T02:01:30.000Z'),
        },
      ]);

      const result = await service.getMetrics(GUILD, from, to, '1m');

      expect(result.interval).toBe('1m');

      // 1m interval은 raw 데이터이므로 각 레코드가 그대로 포함돼야 함
      const onlinePoints = result.data.filter((d) => d.online);
      expect(onlinePoints.length).toBeGreaterThanOrEqual(2);

      // pingMs가 실제 저장된 값과 일치하는지 확인
      const pings = onlinePoints.map((d) => d.pingMs).sort((a, b) => a - b);
      expect(pings).toContain(20);
      expect(pings).toContain(25);
    });
  });
});
