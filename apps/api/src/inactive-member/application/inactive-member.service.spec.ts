import {
  type InactiveMemberClassifyParams,
  InactiveMemberGrade,
} from '../domain/inactive-member.types';
import { InactiveMemberRecord } from '../domain/inactive-member-record.entity';
import { InactiveMemberService } from './inactive-member.service';

/**
 * InactiveMemberRecord 도메인 Entity + InactiveMemberService 단위 테스트.
 * classify 로직이 핵심 비즈니스 규칙이므로 집중 테스트한다.
 */
describe('InactiveMemberRecord.classify (도메인 로직)', () => {
  const defaultConfig: InactiveMemberClassifyParams = {
    lowActiveThresholdMin: 30,
    decliningPercent: 50,
  };

  function createAndClassify(
    totalMinutes: number,
    prevTotalMinutes: number,
    config: InactiveMemberClassifyParams = defaultConfig,
  ): InactiveMemberRecord {
    const record = InactiveMemberRecord.create('guild-1', 'user-1');
    record.classify(totalMinutes, prevTotalMinutes, null, config);
    return record;
  }

  it('음성 활동이 0분이면 FULLY_INACTIVE', () => {
    const record = createAndClassify(0, 100);
    expect(record.grade).toBe(InactiveMemberGrade.FULLY_INACTIVE);
  });

  it('음성 활동이 0분이고 이전 기간도 0이면 FULLY_INACTIVE', () => {
    const record = createAndClassify(0, 0);
    expect(record.grade).toBe(InactiveMemberGrade.FULLY_INACTIVE);
  });

  it('활동 시간이 lowActiveThresholdMin 미만이면 LOW_ACTIVE', () => {
    const record = createAndClassify(29, 100);
    expect(record.grade).toBe(InactiveMemberGrade.LOW_ACTIVE);
  });

  it('활동 시간이 lowActiveThresholdMin과 정확히 같으면 LOW_ACTIVE가 아님', () => {
    const record = createAndClassify(30, 0);
    expect(record.grade).not.toBe(InactiveMemberGrade.LOW_ACTIVE);
  });

  it('이전 대비 50% 이상 감소하면 DECLINING', () => {
    const record = createAndClassify(50, 100);
    expect(record.grade).toBe(InactiveMemberGrade.DECLINING);
  });

  it('이전 대비 50% 미만 감소하면 활동 회원 (null)', () => {
    const record = createAndClassify(51, 100);
    expect(record.grade).toBeNull();
  });

  it('이전 기간 활동이 0이면 DECLINING 판정하지 않는다', () => {
    const record = createAndClassify(30, 0);
    expect(record.grade).toBeNull();
  });

  it('활동이 증가한 경우 활동 회원 (null)', () => {
    const record = createAndClassify(100, 50);
    expect(record.grade).toBeNull();
  });

  it('커스텀 lowActiveThresholdMin=60 적용', () => {
    const config: InactiveMemberClassifyParams = {
      lowActiveThresholdMin: 60,
      decliningPercent: 50,
    };
    expect(createAndClassify(59, 0, config).grade).toBe(InactiveMemberGrade.LOW_ACTIVE);
    expect(createAndClassify(60, 0, config).grade).toBeNull();
  });

  it('커스텀 decliningPercent=30 적용', () => {
    const config: InactiveMemberClassifyParams = {
      lowActiveThresholdMin: 30,
      decliningPercent: 30,
    };
    expect(createAndClassify(70, 100, config).grade).toBe(InactiveMemberGrade.DECLINING);
    expect(createAndClassify(71, 100, config).grade).toBeNull();
  });

  it('lowActiveThresholdMin보다 낮으면 DECLINING보다 LOW_ACTIVE가 우선', () => {
    const record = createAndClassify(10, 100);
    expect(record.grade).toBe(InactiveMemberGrade.LOW_ACTIVE);
  });

  it('등급이 변경되면 gradeChangedAt이 갱신된다', () => {
    const record = InactiveMemberRecord.create('guild-1', 'user-1');
    expect(record.gradeChangedAt).toBeNull();

    record.classify(0, 0, null, defaultConfig);
    expect(record.gradeChangedAt).toBeInstanceOf(Date);
  });

  it('isInactive getter 동작', () => {
    expect(createAndClassify(0, 0).isInactive).toBe(true);
    expect(createAndClassify(100, 50).isInactive).toBe(false);
  });
});

describe('InactiveMemberService', () => {
  let service: InactiveMemberService;

  const mockRepo = {
    findConfigByGuildId: vi.fn(),
    createDefaultConfig: vi.fn(),
    batchUpsertRecords: vi.fn(),
  };

  const mockQueryRepo = {
    sumVoiceDurationByUser: vi.fn(),
    findLastVoiceDateByUser: vi.fn(),
    countByGrade: vi.fn(),
    findReturnedCount: vi.fn(),
    findTrend: vi.fn(),
  };

  const mockFlushService = { safeFlushAll: vi.fn() };
  const mockDiscordClient = { guilds: { cache: { get: vi.fn() } } };

  beforeEach(() => {
    service = new (InactiveMemberService as unknown as new (
      ...args: unknown[]
    ) => InactiveMemberService)(mockRepo, mockQueryRepo, mockFlushService, mockDiscordClient);
    vi.clearAllMocks();
  });

  // private 메서드 접근
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const callPrivate = (method: string, ...args: unknown[]) => (service as any)[method](...args);

  describe('buildDateRanges', () => {
    it('30일 기간에 대해 올바른 날짜 범위를 생성한다', () => {
      const ranges = callPrivate('buildDateRanges', 30);

      expect(ranges.fromDate).toBeDefined();
      expect(ranges.toDate).toBeDefined();
      expect(ranges.prevFromDate).toBeDefined();
      expect(ranges.prevToDate).toBeDefined();

      // toDate >= fromDate
      expect(ranges.toDate >= ranges.fromDate).toBe(true);
      // prevToDate < fromDate (이전 기간은 현재 기간 전)
      expect(ranges.prevToDate < ranges.fromDate).toBe(true);
      // prevToDate >= prevFromDate
      expect(ranges.prevToDate >= ranges.prevFromDate).toBe(true);
    });
  });

  describe('formatYyyymmdd / parseYyyymmdd', () => {
    it('Date를 YYYYMMDD 형식으로 변환한다', () => {
      const date = new Date(2026, 2, 15); // 2026-03-15 (month는 0-based)
      expect(callPrivate('formatYyyymmdd', date)).toBe('20260315');
    });

    it('YYYYMMDD 문자열을 Date로 파싱한다', () => {
      const date = callPrivate('parseYyyymmdd', '20260315') as Date;
      expect(date.getFullYear()).toBe(2026);
      expect(date.getMonth()).toBe(2); // 0-based
      expect(date.getDate()).toBe(15);
    });
  });

  describe('getStats', () => {
    it('통계를 올바르게 집계한다', async () => {
      mockQueryRepo.countByGrade.mockResolvedValue({
        totalClassified: 100,
        fullyInactiveCount: 20,
        lowActiveCount: 15,
        decliningCount: 5,
      });
      mockQueryRepo.findReturnedCount.mockResolvedValue(3);
      mockQueryRepo.findTrend.mockResolvedValue([]);

      const stats = await service.getStats('guild-1');

      expect(stats.totalMembers).toBe(100);
      expect(stats.activeCount).toBe(60);
      expect(stats.fullyInactiveCount).toBe(20);
      expect(stats.returnedCount).toBe(3);
    });
  });
});
