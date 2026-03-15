import { InactiveMemberConfig } from '../domain/inactive-member-config.entity';
import { InactiveMemberGrade } from '../domain/inactive-member-record.entity';
import { InactiveMemberService } from './inactive-member.service';

/**
 * InactiveMemberService 단위 테스트.
 * determineGrade 로직이 핵심 비즈니스 규칙이므로 집중 테스트한다.
 * NestJS DI를 우회하여 직접 인스턴스를 생성한다.
 */
describe('InactiveMemberService', () => {
  let service: InactiveMemberService;

  const mockRepo = {
    findConfigByGuildId: jest.fn(),
    createDefaultConfig: jest.fn(),
    batchUpsertRecords: jest.fn(),
  };

  const mockQueryRepo = {
    sumVoiceDurationByUser: jest.fn(),
    findLastVoiceDateByUser: jest.fn(),
    countByGrade: jest.fn(),
    findReturnedCount: jest.fn(),
    findTrend: jest.fn(),
  };

  const mockFlushService = { safeFlushAll: jest.fn() };
  const mockDiscordClient = { guilds: { cache: { get: jest.fn() } } };

  beforeEach(() => {
    // DI 없이 직접 의존성 주입
    service = new (InactiveMemberService as unknown as new (
      ...args: unknown[]
    ) => InactiveMemberService)(mockRepo, mockQueryRepo, mockFlushService, mockDiscordClient);
    jest.clearAllMocks();
  });

  function createConfig(overrides: Partial<InactiveMemberConfig> = {}): InactiveMemberConfig {
    const config = new InactiveMemberConfig();
    config.periodDays = 30;
    config.lowActiveThresholdMin = 30;
    config.decliningPercent = 50;
    config.excludedRoleIds = [];
    return Object.assign(config, overrides);
  }

  // private 메서드 접근
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const callPrivate = (method: string, ...args: unknown[]) => (service as any)[method](...args);

  describe('determineGrade', () => {
    const config = createConfig();

    it('음성 활동이 0분이면 FULLY_INACTIVE', () => {
      expect(callPrivate('determineGrade', 0, 100, config)).toBe(
        InactiveMemberGrade.FULLY_INACTIVE,
      );
    });

    it('음성 활동이 0분이고 이전 기간도 0이면 FULLY_INACTIVE', () => {
      expect(callPrivate('determineGrade', 0, 0, config)).toBe(InactiveMemberGrade.FULLY_INACTIVE);
    });

    it('활동 시간이 lowActiveThresholdMin 미만이면 LOW_ACTIVE', () => {
      expect(callPrivate('determineGrade', 29, 100, config)).toBe(InactiveMemberGrade.LOW_ACTIVE);
    });

    it('활동 시간이 lowActiveThresholdMin과 정확히 같으면 LOW_ACTIVE가 아님', () => {
      expect(callPrivate('determineGrade', 30, 0, config)).not.toBe(InactiveMemberGrade.LOW_ACTIVE);
    });

    it('이전 대비 50% 이상 감소하면 DECLINING', () => {
      expect(callPrivate('determineGrade', 50, 100, config)).toBe(InactiveMemberGrade.DECLINING);
    });

    it('이전 대비 50% 미만 감소하면 활동 회원 (null)', () => {
      expect(callPrivate('determineGrade', 51, 100, config)).toBeNull();
    });

    it('이전 기간 활동이 0이면 DECLINING 판정하지 않는다', () => {
      expect(callPrivate('determineGrade', 30, 0, config)).toBeNull();
    });

    it('활동이 증가한 경우 활동 회원 (null)', () => {
      expect(callPrivate('determineGrade', 100, 50, config)).toBeNull();
    });

    it('커스텀 lowActiveThresholdMin=60 적용', () => {
      const customConfig = createConfig({ lowActiveThresholdMin: 60 });
      expect(callPrivate('determineGrade', 59, 0, customConfig)).toBe(
        InactiveMemberGrade.LOW_ACTIVE,
      );
      expect(callPrivate('determineGrade', 60, 0, customConfig)).toBeNull();
    });

    it('커스텀 decliningPercent=30 적용', () => {
      const customConfig = createConfig({ decliningPercent: 30 });
      expect(callPrivate('determineGrade', 70, 100, customConfig)).toBe(
        InactiveMemberGrade.DECLINING,
      );
      expect(callPrivate('determineGrade', 71, 100, customConfig)).toBeNull();
    });

    it('lowActiveThresholdMin보다 낮으면 DECLINING보다 LOW_ACTIVE가 우선', () => {
      expect(callPrivate('determineGrade', 10, 100, config)).toBe(InactiveMemberGrade.LOW_ACTIVE);
    });
  });

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
