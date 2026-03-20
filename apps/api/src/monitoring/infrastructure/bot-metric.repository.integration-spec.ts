import type { TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';

import { createIntegrationModuleBuilder } from '../../test-utils/create-integration-module';
import { cleanDatabase } from '../../test-utils/db-cleaner';
import { BotStatus } from '../domain/bot-metric.types';
import { BotMetricOrm } from './bot-metric.orm-entity';
import { BotMetricRepository } from './bot-metric.repository';

function makeMetric(overrides: Partial<BotMetricOrm> = {}): Partial<BotMetricOrm> {
  return {
    guildId: 'guild-1',
    status: BotStatus.ONLINE,
    pingMs: 50,
    heapUsedMb: 100.5,
    heapTotalMb: 200.0,
    voiceUserCount: 5,
    guildCount: 3,
    recordedAt: new Date('2026-03-18T12:00:00Z'),
    ...overrides,
  };
}

describe('BotMetricRepository (Integration)', () => {
  let module: TestingModule;
  let repository: BotMetricRepository;
  let dataSource: DataSource;

  beforeAll(async () => {
    module = await createIntegrationModuleBuilder({
      entities: [BotMetricOrm],
      providers: [BotMetricRepository],
      withRedis: false,
    }).compile();

    repository = module.get(BotMetricRepository);
    dataSource = module.get(DataSource);
  }, 60_000);

  afterEach(async () => {
    await cleanDatabase(dataSource);
  });

  describe('save', () => {
    it('메트릭을 저장하고 ID가 할당된다', async () => {
      const metric = await repository.save(makeMetric());

      expect(metric.id).toBeGreaterThan(0);
      expect(metric.guildId).toBe('guild-1');
      expect(metric.status).toBe(BotStatus.ONLINE);
      expect(metric.pingMs).toBe(50);
    });

    it('OFFLINE 상태 메트릭도 저장된다', async () => {
      const metric = await repository.save(makeMetric({ status: BotStatus.OFFLINE }));

      expect(metric.status).toBe(BotStatus.OFFLINE);
    });

    it('DB에 실제로 저장되어 조회 가능하다', async () => {
      const saved = await repository.save(makeMetric());

      const fromDb = await dataSource.getRepository(BotMetricOrm).findOneBy({ id: saved.id });

      expect(fromDb).not.toBeNull();
      expect(fromDb!.pingMs).toBe(50);
      expect(fromDb!.heapUsedMb).toBe(100.5);
    });

    it('float 값(heapUsedMb, heapTotalMb)이 정확하게 저장된다', async () => {
      const saved = await repository.save(
        makeMetric({ heapUsedMb: 123.456, heapTotalMb: 456.789 }),
      );

      const fromDb = await dataSource.getRepository(BotMetricOrm).findOneBy({ id: saved.id });

      expect(fromDb!.heapUsedMb).toBeCloseTo(123.456, 2);
      expect(fromDb!.heapTotalMb).toBeCloseTo(456.789, 2);
    });
  });

  describe('saveBatch', () => {
    it('여러 메트릭을 일괄 저장한다', async () => {
      const metrics = [
        makeMetric({ recordedAt: new Date('2026-03-18T12:00:00Z') }),
        makeMetric({ recordedAt: new Date('2026-03-18T12:01:00Z') }),
        makeMetric({ recordedAt: new Date('2026-03-18T12:02:00Z') }),
      ];

      await repository.saveBatch(metrics);

      const all = await dataSource.getRepository(BotMetricOrm).find();
      expect(all).toHaveLength(3);
    });

    it('빈 배열을 전달해도 에러가 발생하지 않는다', async () => {
      await expect(repository.saveBatch([])).resolves.not.toThrow();
    });

    it('배치 저장된 메트릭들이 모두 DB에 존재한다', async () => {
      const metrics = [
        makeMetric({
          guildId: 'guild-1',
          pingMs: 10,
          recordedAt: new Date('2026-03-18T10:00:00Z'),
        }),
        makeMetric({
          guildId: 'guild-2',
          pingMs: 20,
          recordedAt: new Date('2026-03-18T10:01:00Z'),
        }),
      ];

      await repository.saveBatch(metrics);

      const g1 = await dataSource.getRepository(BotMetricOrm).findBy({ guildId: 'guild-1' });
      const g2 = await dataSource.getRepository(BotMetricOrm).findBy({ guildId: 'guild-2' });

      expect(g1).toHaveLength(1);
      expect(g1[0].pingMs).toBe(10);
      expect(g2).toHaveLength(1);
      expect(g2[0].pingMs).toBe(20);
    });
  });

  describe('findByGuildAndRange', () => {
    it('지정 날짜 범위 내 메트릭을 recordedAt 오름차순으로 반환한다', async () => {
      await repository.saveBatch([
        makeMetric({ recordedAt: new Date('2026-03-18T11:00:00Z'), pingMs: 10 }),
        makeMetric({ recordedAt: new Date('2026-03-18T12:00:00Z'), pingMs: 20 }),
        makeMetric({ recordedAt: new Date('2026-03-18T13:00:00Z'), pingMs: 30 }),
      ]);

      const results = await repository.findByGuildAndRange(
        'guild-1',
        new Date('2026-03-18T11:00:00Z'),
        new Date('2026-03-18T13:00:00Z'),
      );

      expect(results).toHaveLength(3);
      expect(results[0].pingMs).toBe(10);
      expect(results[1].pingMs).toBe(20);
      expect(results[2].pingMs).toBe(30);
    });

    it('범위 밖의 메트릭은 포함되지 않는다', async () => {
      await repository.saveBatch([
        makeMetric({ recordedAt: new Date('2026-03-18T09:00:00Z'), pingMs: 5 }),
        makeMetric({ recordedAt: new Date('2026-03-18T12:00:00Z'), pingMs: 25 }),
        makeMetric({ recordedAt: new Date('2026-03-18T23:00:00Z'), pingMs: 99 }),
      ]);

      const results = await repository.findByGuildAndRange(
        'guild-1',
        new Date('2026-03-18T10:00:00Z'),
        new Date('2026-03-18T20:00:00Z'),
      );

      expect(results).toHaveLength(1);
      expect(results[0].pingMs).toBe(25);
    });

    it('다른 guildId의 메트릭은 포함되지 않는다', async () => {
      await repository.saveBatch([
        makeMetric({ guildId: 'guild-1', recordedAt: new Date('2026-03-18T12:00:00Z') }),
        makeMetric({ guildId: 'guild-2', recordedAt: new Date('2026-03-18T12:00:00Z') }),
      ]);

      const results = await repository.findByGuildAndRange(
        'guild-1',
        new Date('2026-03-18T00:00:00Z'),
        new Date('2026-03-18T23:59:59Z'),
      );

      expect(results).toHaveLength(1);
      expect(results[0].guildId).toBe('guild-1');
    });

    it('범위 내 메트릭이 없으면 빈 배열을 반환한다', async () => {
      const results = await repository.findByGuildAndRange(
        'guild-empty',
        new Date('2026-03-18T00:00:00Z'),
        new Date('2026-03-18T23:59:59Z'),
      );

      expect(results).toEqual([]);
    });

    it('from, to 경계값 레코드도 포함된다', async () => {
      const from = new Date('2026-03-18T10:00:00Z');
      const to = new Date('2026-03-18T20:00:00Z');

      await repository.saveBatch([
        makeMetric({ recordedAt: from, pingMs: 11 }),
        makeMetric({ recordedAt: to, pingMs: 22 }),
      ]);

      const results = await repository.findByGuildAndRange('guild-1', from, to);

      expect(results).toHaveLength(2);
    });
  });

  describe('deleteOlderThan', () => {
    it('지정 날짜 이전의 레코드를 삭제하고 삭제 건수를 반환한다', async () => {
      await repository.saveBatch([
        makeMetric({ recordedAt: new Date('2026-03-10T00:00:00Z') }),
        makeMetric({ recordedAt: new Date('2026-03-15T00:00:00Z') }),
        makeMetric({ recordedAt: new Date('2026-03-18T00:00:00Z') }),
      ]);

      const deleted = await repository.deleteOlderThan(new Date('2026-03-16T00:00:00Z'));

      expect(deleted).toBe(2);
    });

    it('삭제 후 지정 날짜 이후의 레코드는 남아있다', async () => {
      await repository.saveBatch([
        makeMetric({ recordedAt: new Date('2026-03-10T00:00:00Z'), pingMs: 10 }),
        makeMetric({ recordedAt: new Date('2026-03-18T00:00:00Z'), pingMs: 99 }),
      ]);

      await repository.deleteOlderThan(new Date('2026-03-15T00:00:00Z'));

      const remaining = await dataSource.getRepository(BotMetricOrm).find();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].pingMs).toBe(99);
    });

    it('삭제 대상이 없으면 0을 반환한다', async () => {
      await repository.save(makeMetric({ recordedAt: new Date('2026-03-18T12:00:00Z') }));

      const deleted = await repository.deleteOlderThan(new Date('2026-03-01T00:00:00Z'));

      expect(deleted).toBe(0);
    });

    it('모든 레코드가 대상이면 전체 삭제된다', async () => {
      await repository.saveBatch([
        makeMetric({ recordedAt: new Date('2026-03-01T00:00:00Z') }),
        makeMetric({ recordedAt: new Date('2026-03-05T00:00:00Z') }),
      ]);

      const deleted = await repository.deleteOlderThan(new Date('2026-04-01T00:00:00Z'));

      expect(deleted).toBe(2);
      const remaining = await dataSource.getRepository(BotMetricOrm).find();
      expect(remaining).toHaveLength(0);
    });
  });

  describe('findAggregated — 시간 버킷 집계', () => {
    it('1분 버킷으로 집계할 때 같은 분 내 레코드가 합산된다', async () => {
      await repository.saveBatch([
        makeMetric({
          status: BotStatus.ONLINE,
          pingMs: 40,
          recordedAt: new Date('2026-03-18T12:00:10Z'),
        }),
        makeMetric({
          status: BotStatus.ONLINE,
          pingMs: 60,
          recordedAt: new Date('2026-03-18T12:00:50Z'),
        }),
      ]);

      const results = await repository.findAggregated(
        'guild-1',
        new Date('2026-03-18T12:00:00Z'),
        new Date('2026-03-18T12:00:59Z'),
        '1m',
      );

      expect(results).toHaveLength(1);
      expect(results[0].pingMs).toBe(50); // (40+60)/2 = 50
      expect(results[0].online).toBe(true);
    });

    it('5분 버킷으로 집계할 때 같은 5분 구간 내 레코드가 합산된다', async () => {
      await repository.saveBatch([
        makeMetric({
          status: BotStatus.ONLINE,
          pingMs: 20,
          recordedAt: new Date('2026-03-18T12:00:00Z'),
        }),
        makeMetric({
          status: BotStatus.OFFLINE,
          pingMs: 0,
          recordedAt: new Date('2026-03-18T12:04:00Z'),
        }),
      ]);

      const results = await repository.findAggregated(
        'guild-1',
        new Date('2026-03-18T12:00:00Z'),
        new Date('2026-03-18T12:04:59Z'),
        '5m',
      );

      expect(results).toHaveLength(1);
      // online_ratio = 0.5 → online = false (0.5 기준은 >= 0.5 → true)
      expect(results[0].online).toBe(true);
    });

    it('1시간 버킷으로 집계할 때 다른 시간대 레코드는 별도 버킷으로 분리된다', async () => {
      await repository.saveBatch([
        makeMetric({ recordedAt: new Date('2026-03-18T10:30:00Z'), pingMs: 10 }),
        makeMetric({ recordedAt: new Date('2026-03-18T11:30:00Z'), pingMs: 20 }),
      ]);

      const results = await repository.findAggregated(
        'guild-1',
        new Date('2026-03-18T10:00:00Z'),
        new Date('2026-03-18T12:00:00Z'),
        '1h',
      );

      expect(results).toHaveLength(2);
      expect(results[0].pingMs).toBe(10);
      expect(results[1].pingMs).toBe(20);
    });

    it('데이터가 없으면 빈 배열을 반환한다', async () => {
      const results = await repository.findAggregated(
        'guild-empty',
        new Date('2026-03-18T00:00:00Z'),
        new Date('2026-03-18T23:59:59Z'),
        '1h',
      );

      expect(results).toEqual([]);
    });
  });
});
