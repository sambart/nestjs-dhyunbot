/**
 * CoPresenceAnalyticsService 신규 메서드 단위 테스트
 * 대상: getMyTopPeers (T-MYP)
 *
 * 외부 의존성(Repository, GuildMemberService, UserPrivacyConfigService)은 vi.fn()으로 대체한다.
 */

import type { Repository } from 'typeorm';
import type { Mock, Mocked } from 'vitest';

import type { GuildMemberService } from '../../../guild-member/application/guild-member.service';
import type { UserPrivacyConfigService } from '../../../user-privacy/application/user-privacy-config.service';
import { CoPresenceAnalyticsService } from './co-presence-analytics.service';
import type { VoiceCoPresenceDailyOrm } from './infrastructure/voice-co-presence-daily.orm-entity';
import type { VoiceCoPresencePairDailyOrm } from './infrastructure/voice-co-presence-pair-daily.orm-entity';

// ─── mock 헬퍼 ────────────────────────────────────────────────────────────────

interface PairDailyRepoMock {
  createQueryBuilder: Mock;
}

interface DailyRepoMock {
  createQueryBuilder: Mock;
}

/** QueryBuilder 체이닝 mock 생성 */
function makeQbChain(finalValue: unknown, method: 'getRawMany' | 'getRawOne' = 'getRawMany') {
  const qb: Record<string, Mock> = {
    select: vi.fn().mockReturnThis(),
    addSelect: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    addGroupBy: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    having: vi.fn().mockReturnThis(),
    subQuery: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    getQuery: vi.fn().mockReturnValue('subquery'),
    getRawMany: vi.fn().mockResolvedValue([]),
    getRawOne: vi.fn().mockResolvedValue(null),
  };

  if (method === 'getRawMany') {
    qb.getRawMany = vi.fn().mockResolvedValue(finalValue);
  } else {
    qb.getRawOne = vi.fn().mockResolvedValue(finalValue);
  }

  return qb;
}

function makePairDailyRepo(): PairDailyRepoMock {
  return {
    createQueryBuilder: vi.fn().mockReturnValue(makeQbChain([])),
  };
}

function makeDailyRepo(): DailyRepoMock {
  return {
    createQueryBuilder: vi.fn().mockReturnValue(makeQbChain([])),
  };
}

function makeGuildMemberService(): Mocked<GuildMemberService> {
  return {
    findByUserIds: vi.fn().mockResolvedValue(new Map()),
  } as unknown as Mocked<GuildMemberService>;
}

function makeUserPrivacyService(): Mocked<UserPrivacyConfigService> {
  return {
    filterPeers: vi.fn().mockResolvedValue(new Map()),
    isPrivate: vi.fn().mockResolvedValue(false),
  } as unknown as Mocked<UserPrivacyConfigService>;
}

function buildService(
  pairRepo: PairDailyRepoMock,
  dailyRepo: DailyRepoMock,
  memberSvc: Mocked<GuildMemberService>,
  privacySvc: Mocked<UserPrivacyConfigService>,
): CoPresenceAnalyticsService {
  return new CoPresenceAnalyticsService(
    pairRepo as unknown as Repository<VoiceCoPresencePairDailyOrm>,
    dailyRepo as unknown as Repository<VoiceCoPresenceDailyOrm>,
    memberSvc,
    privacySvc,
  );
}

// ─── T-MYP: getMyTopPeers ─────────────────────────────────────────────────────

describe('CoPresenceAnalyticsService.getMyTopPeers', () => {
  let pairRepo: PairDailyRepoMock;
  let dailyRepo: DailyRepoMock;
  let memberSvc: Mocked<GuildMemberService>;
  let privacySvc: Mocked<UserPrivacyConfigService>;
  let service: CoPresenceAnalyticsService;

  beforeEach(() => {
    pairRepo = makePairDailyRepo();
    dailyRepo = makeDailyRepo();
    memberSvc = makeGuildMemberService();
    privacySvc = makeUserPrivacyService();
    service = buildService(pairRepo, dailyRepo, memberSvc, privacySvc);
    vi.clearAllMocks();
  });

  it('T-MYP-01: 정상 — peer 5명 반환, totalMinutes 내림차순', async () => {
    const rawRows = [
      { peerId: 'p1', totalMinutes: '100', sessionCount: '10' },
      { peerId: 'p2', totalMinutes: '80', sessionCount: '8' },
      { peerId: 'p3', totalMinutes: '60', sessionCount: '6' },
      { peerId: 'p4', totalMinutes: '40', sessionCount: '4' },
      { peerId: 'p5', totalMinutes: '20', sessionCount: '2' },
    ];
    const qb = makeQbChain(rawRows);
    pairRepo.createQueryBuilder = vi.fn().mockReturnValue(qb);

    const memberMap = new Map([
      ['p1', { displayName: '민수', avatarUrl: 'https://avatar/p1.png' }],
      ['p2', { displayName: '지수', avatarUrl: null }],
      ['p3', { displayName: '영희', avatarUrl: null }],
      ['p4', { displayName: '철수', avatarUrl: null }],
      ['p5', { displayName: '혜진', avatarUrl: null }],
    ]);
    memberSvc.findByUserIds = vi.fn().mockResolvedValue(memberMap);

    const privacyMap = new Map([
      ['p1', { isAnonymous: false }],
      ['p2', { isAnonymous: false }],
      ['p3', { isAnonymous: false }],
      ['p4', { isAnonymous: false }],
      ['p5', { isAnonymous: false }],
    ]);
    privacySvc.filterPeers = vi.fn().mockResolvedValue(privacyMap);

    const result = await service.getMyTopPeers('guild-1', 'me', 30, 5);

    expect(result).toHaveLength(5);
    expect(result[0].userId).toBe('p1');
    expect(result[0].totalMinutes).toBe(100);
    expect(result[0].displayName).toBe('민수');
    expect(result[0].isAnonymous).toBe(false);
  });

  it('T-MYP-02: peer 0명 시 빈 배열 반환', async () => {
    const qb = makeQbChain([]);
    pairRepo.createQueryBuilder = vi.fn().mockReturnValue(qb);

    const result = await service.getMyTopPeers('guild-1', 'me', 30, 5);

    expect(result).toHaveLength(0);
    // DB 결과가 0건이면 memberSvc/privacySvc 호출하지 않아야 한다
    expect(privacySvc.filterPeers).not.toHaveBeenCalled();
    expect(memberSvc.findByUserIds).not.toHaveBeenCalled();
  });

  it('T-MYP-03: limit=3 시 DB 쿼리에 limit(3) 적용', async () => {
    const rawRows = [
      { peerId: 'p1', totalMinutes: '100', sessionCount: '10' },
      { peerId: 'p2', totalMinutes: '80', sessionCount: '8' },
      { peerId: 'p3', totalMinutes: '60', sessionCount: '6' },
    ];
    const qb = makeQbChain(rawRows);
    pairRepo.createQueryBuilder = vi.fn().mockReturnValue(qb);
    privacySvc.filterPeers = vi.fn().mockResolvedValue(
      new Map([
        ['p1', { isAnonymous: false }],
        ['p2', { isAnonymous: false }],
        ['p3', { isAnonymous: false }],
      ]),
    );
    memberSvc.findByUserIds = vi.fn().mockResolvedValue(new Map());

    const result = await service.getMyTopPeers('guild-1', 'me', 30, 3);

    expect(result).toHaveLength(3);
    // QueryBuilder에 limit(3)이 적용되어야 한다
    expect(qb.limit).toHaveBeenCalledWith(3);
  });

  it('T-MYP-05: 익명화 — disableRelationshipShare=true 인 peer는 displayName=???, avatarUrl=null, isAnonymous=true', async () => {
    const rawRows = [{ peerId: 'p-anon', totalMinutes: '50', sessionCount: '5' }];
    const qb = makeQbChain(rawRows);
    pairRepo.createQueryBuilder = vi.fn().mockReturnValue(qb);

    privacySvc.filterPeers = vi
      .fn()
      .mockResolvedValue(new Map([['p-anon', { isAnonymous: true }]]));
    memberSvc.findByUserIds = vi
      .fn()
      .mockResolvedValue(
        new Map([['p-anon', { displayName: '실명', avatarUrl: 'https://avatar.png' }]]),
      );

    const result = await service.getMyTopPeers('guild-1', 'me', 30, 5);

    expect(result[0].displayName).toBe('???');
    expect(result[0].avatarUrl).toBeNull();
    expect(result[0].isAnonymous).toBe(true);
  });

  it('T-MYP-06: GuildMember 조회 실패(누락) 시 Member-XXXXXX 폴백 적용', async () => {
    const rawRows = [{ peerId: 'abc123xyz', totalMinutes: '30', sessionCount: '3' }];
    const qb = makeQbChain(rawRows);
    pairRepo.createQueryBuilder = vi.fn().mockReturnValue(qb);

    privacySvc.filterPeers = vi
      .fn()
      .mockResolvedValue(new Map([['abc123xyz', { isAnonymous: false }]]));
    // memberMap에 해당 peerId 없음 → 폴백 적용
    memberSvc.findByUserIds = vi.fn().mockResolvedValue(new Map());

    const result = await service.getMyTopPeers('guild-1', 'me', 30, 5);

    // 폴백: 'Member-' + peerId.slice(0, 6) = 'Member-abc123'
    expect(result[0].displayName).toBe('Member-abc123');
  });
});
