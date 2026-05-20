/**
 * BotCoPresenceController 신규 핸들러 단위 테스트
 * 대상: getBestFriends (T-CTL-01~04), getAffinity (T-CTL-05~11)
 *
 * 외부 의존성은 모두 vi.fn()으로 대체한다.
 * BotApiAuthGuard는 컨트롤러 생성 후 직접 메서드를 호출하므로 우회된다.
 *
 * lru-cache가 컨테이너에 설치되지 않은 경우를 위해 vi.mock으로 Map 기반 shim을 제공한다.
 */

// BotCoPresenceController → BestFriendCardCacheService → lru-cache 의존을 차단한다
vi.mock('lru-cache', () => {
  class LRUCache<K, V> {
    private readonly maxSize: number;
    private readonly store = new Map<K, V>();

    constructor(options: { max?: number; ttl?: number }) {
      this.maxSize = options.max ?? Infinity;
    }

    get(key: K): V | undefined {
      return this.store.get(key);
    }

    set(key: K, value: V): void {
      if (!this.store.has(key) && this.store.size >= this.maxSize) {
        const firstKey = this.store.keys().next().value;
        if (firstKey !== undefined) {
          this.store.delete(firstKey);
        }
      }
      this.store.set(key, value);
    }
  }

  return { LRUCache };
});

import type { Mock } from 'vitest';

import { GuildCoPresenceConfigOrm } from '../../channel/voice/co-presence/infrastructure/guild-co-presence-config.orm-entity';
import { BotCoPresenceController } from './bot-co-presence.controller';

// ─── mock 헬퍼 ────────────────────────────────────────────────────────────────

function makeGuildConfig(allowPublicAffinityQuery: boolean): GuildCoPresenceConfigOrm {
  const entity = new GuildCoPresenceConfigOrm();
  entity.guildId = 'guild-1';
  entity.allowPublicAffinityQuery = allowPublicAffinityQuery;
  entity.updatedAt = new Date();
  return entity;
}

function makeMocks() {
  const coPresenceService = {
    reconcile: vi.fn().mockResolvedValue(undefined),
    endAllSessions: vi.fn().mockResolvedValue(undefined),
  };
  const excludedChannelService = {
    isExcludedChannel: vi.fn().mockResolvedValue(false),
  };
  const eventEmitter = {
    emit: vi.fn(),
  };
  const voiceGameService = {
    reconcileForChannel: vi.fn().mockResolvedValue(undefined),
  };
  const analyticsService = {
    getMyTopPeers: vi.fn().mockResolvedValue([]),
    getAffinity: vi.fn().mockResolvedValue({
      userA: { userId: 'userA', displayName: '동현', avatarUrl: null },
      userB: { userId: 'userB', displayName: '민수', avatarUrl: null },
      totalMinutes: 0,
      sessionCount: 0,
      lastDate: null,
      dailyData: [],
    }),
  };
  const guildConfigService = {
    getConfig: vi.fn().mockResolvedValue(makeGuildConfig(false)),
  };
  const userPrivacyService = {
    isPrivate: vi.fn().mockResolvedValue(false),
  };
  const bestFriendCardRenderer = {
    render: vi.fn().mockResolvedValue(Buffer.from('fake-png')),
  };
  const affinityCardRenderer = {
    render: vi.fn().mockResolvedValue(Buffer.from('fake-affinity-png')),
  };
  const bestFriendCardCacheService = {
    get: vi.fn().mockReturnValue(undefined),
    set: vi.fn(),
  };
  const voiceAiAnalysisService = {
    generateBestFriendComment: vi.fn().mockResolvedValue(null),
  };

  return {
    coPresenceService,
    excludedChannelService,
    eventEmitter,
    voiceGameService,
    analyticsService,
    guildConfigService,
    userPrivacyService,
    bestFriendCardRenderer,
    affinityCardRenderer,
    bestFriendCardCacheService,
    voiceAiAnalysisService,
  };
}

function buildController(mocks: ReturnType<typeof makeMocks>): BotCoPresenceController {
  return new BotCoPresenceController(
    mocks.coPresenceService as never,
    mocks.excludedChannelService as never,
    mocks.eventEmitter as never,
    mocks.voiceGameService as never,
    mocks.analyticsService as never,
    mocks.guildConfigService as never,
    mocks.userPrivacyService as never,
    mocks.bestFriendCardRenderer as never,
    mocks.affinityCardRenderer as never,
    mocks.bestFriendCardCacheService as never,
    mocks.voiceAiAnalysisService as never,
  );
}

// ─── getBestFriends ────────────────────────────────────────────────────────────

describe('BotCoPresenceController.getBestFriends', () => {
  let mocks: ReturnType<typeof makeMocks>;
  let controller: BotCoPresenceController;

  beforeEach(() => {
    mocks = makeMocks();
    controller = buildController(mocks);
    vi.clearAllMocks();
  });

  it('T-CTL-01: 정상 응답 — data.imageBase64 존재, days 일치', async () => {
    const peers = [
      {
        userId: 'p1',
        displayName: '민수',
        avatarUrl: null,
        totalMinutes: 100,
        sessionCount: 10,
        isAnonymous: false,
      },
    ];
    (mocks.analyticsService.getMyTopPeers as Mock).mockResolvedValue(peers);
    (mocks.bestFriendCardRenderer.render as Mock).mockResolvedValue(Buffer.from('png-data'));

    const result = await controller.getBestFriends(
      'guild-1',
      'user-1',
      '동현',
      'https://avatar.png',
      '30',
      '5',
    );

    expect(result.ok).toBe(true);
    expect(result.data).not.toBeNull();
    expect(result.data?.imageBase64).toBeDefined();
    expect(result.days).toBe(30);
  });

  it('T-CTL-02: peers 0건 시 빈 데이터도 렌더 후 base64 반환 (비활성 변형)', async () => {
    (mocks.analyticsService.getMyTopPeers as Mock).mockResolvedValue([]);
    (mocks.bestFriendCardRenderer.render as Mock).mockResolvedValue(Buffer.from('empty-card'));

    const result = await controller.getBestFriends(
      'guild-1',
      'user-1',
      '동현',
      'https://avatar.png',
      '30',
      '5',
    );

    expect(result.ok).toBe(true);
    // 비활성 변형도 imageBase64를 포함해야 한다
    expect(result.data?.imageBase64).toBeDefined();
  });

  it('T-CTL-03: LRU 캐시 히트 시 analyticsService 호출 없이 즉시 반환', async () => {
    const cachedBase64 = 'cached-base64-data';
    (mocks.bestFriendCardCacheService.get as Mock).mockReturnValue(cachedBase64);

    const result = await controller.getBestFriends(
      'guild-1',
      'user-1',
      '동현',
      'https://avatar.png',
      '30',
      '5',
    );

    expect(result.data?.imageBase64).toBe(cachedBase64);
    // DB 쿼리가 호출되지 않아야 한다
    expect(mocks.analyticsService.getMyTopPeers).not.toHaveBeenCalled();
  });

  it('T-CTL-04: period="5" (잘못된 값) 시 30으로 폴백', async () => {
    (mocks.analyticsService.getMyTopPeers as Mock).mockResolvedValue([]);
    (mocks.bestFriendCardRenderer.render as Mock).mockResolvedValue(Buffer.from('card'));

    const result = await controller.getBestFriends(
      'guild-1',
      'user-1',
      '동현',
      'https://avatar.png',
      '5', // 잘못된 period
      '5',
    );

    expect(result.days).toBe(30); // 폴백
  });

  it('렌더 실패 시 data=null 반환 (Embed 폴백 분기)', async () => {
    (mocks.analyticsService.getMyTopPeers as Mock).mockResolvedValue([
      {
        userId: 'p1',
        displayName: '민수',
        avatarUrl: null,
        totalMinutes: 100,
        sessionCount: 10,
        isAnonymous: false,
      },
    ]);
    (mocks.bestFriendCardRenderer.render as Mock).mockRejectedValue(new Error('Canvas 렌더 실패'));

    const result = await controller.getBestFriends(
      'guild-1',
      'user-1',
      '동현',
      'https://avatar.png',
      '30',
      '5',
    );

    expect(result.ok).toBe(true);
    expect(result.data).toBeNull();
  });
});

// ─── getAffinity ────────────────────────────────────────────────────────────

describe('BotCoPresenceController.getAffinity', () => {
  let mocks: ReturnType<typeof makeMocks>;
  let controller: BotCoPresenceController;

  beforeEach(() => {
    mocks = makeMocks();
    controller = buildController(mocks);
    vi.clearAllMocks();
  });

  it('T-CTL-05: 본인 포함 페어 (requestUserId=userAId) 시 권한 통과, 정상 응답', async () => {
    (mocks.analyticsService.getAffinity as Mock).mockResolvedValue({
      userA: { userId: 'userA', displayName: '동현', avatarUrl: null },
      userB: { userId: 'userB', displayName: '민수', avatarUrl: null },
      totalMinutes: 100,
      sessionCount: 5,
      lastDate: '2026-05-01',
      dailyData: [],
    });
    (mocks.affinityCardRenderer.render as Mock).mockResolvedValue(Buffer.from('affinity-png'));

    const result = await controller.getAffinity(
      'guild-1',
      'userA',
      'userB',
      '30',
      'userA', // requestUserId === userAId → 자기 자신 포함
      '0',
    );

    expect(result.ok).toBe(true);
    expect(result.data).not.toBeNull();
    expect(result.errorCode).toBeUndefined();
  });

  it('T-CTL-06: 타인↔타인 + ManageGuild=1 시 권한 통과', async () => {
    (mocks.analyticsService.getAffinity as Mock).mockResolvedValue({
      userA: { userId: 'userA', displayName: '동현', avatarUrl: null },
      userB: { userId: 'userB', displayName: '민수', avatarUrl: null },
      totalMinutes: 50,
      sessionCount: 3,
      lastDate: null,
      dailyData: [],
    });
    (mocks.affinityCardRenderer.render as Mock).mockResolvedValue(Buffer.from('affinity-png'));

    const result = await controller.getAffinity(
      'guild-1',
      'userA',
      'userB',
      '30',
      'requestUser', // 타인
      '1', // hasManageGuild=1
    );

    expect(result.ok).toBe(true);
    expect(result.errorCode).toBeUndefined();
  });

  it('T-CTL-07: 타인↔타인 + ManageGuild=0 + allowPublicAffinityQuery=false → FORBIDDEN', async () => {
    (mocks.guildConfigService.getConfig as Mock).mockResolvedValue(makeGuildConfig(false));

    const result = await controller.getAffinity(
      'guild-1',
      'userA',
      'userB',
      '30',
      'requestUser', // 타인
      '0', // 권한 없음
    );

    expect(result.ok).toBe(true);
    expect(result.data).toBeNull();
    expect(result.errorCode).toBe('FORBIDDEN');
  });

  it('T-CTL-08: 타인↔타인 + allowPublicAffinityQuery=true 시 정상 응답', async () => {
    (mocks.guildConfigService.getConfig as Mock).mockResolvedValue(makeGuildConfig(true));
    (mocks.analyticsService.getAffinity as Mock).mockResolvedValue({
      userA: { userId: 'userA', displayName: '동현', avatarUrl: null },
      userB: { userId: 'userB', displayName: '민수', avatarUrl: null },
      totalMinutes: 30,
      sessionCount: 2,
      lastDate: null,
      dailyData: [],
    });
    (mocks.affinityCardRenderer.render as Mock).mockResolvedValue(Buffer.from('affinity-png'));

    const result = await controller.getAffinity(
      'guild-1',
      'userA',
      'userB',
      '30',
      'requestUser', // 타인
      '0',
    );

    expect(result.ok).toBe(true);
    expect(result.errorCode).toBeUndefined();
    expect(result.data).not.toBeNull();
  });

  it('T-CTL-09: 상대 비공개 설정 시 PRIVATE (요청자가 비공개 사용자 본인이 아닌 경우)', async () => {
    // 요청자: requestUser, userA=requestUser(본인), userB=priv-user(비공개)
    // 요청자가 userB의 본인이 아니므로 PRIVATE
    (mocks.userPrivacyService.isPrivate as Mock)
      .mockResolvedValueOnce(false) // userA(=requestUser)는 공개
      .mockResolvedValueOnce(true); // userB는 비공개

    const result = await controller.getAffinity(
      'guild-1',
      'requestUser', // userAId = requestUser(본인)
      'priv-user', // userBId = 비공개 사용자
      '30',
      'requestUser', // requestUserId = userAId → 자기 자신 포함 → 권한 통과
      '0',
    );

    // 자기 자신 포함 → 권한 통과. 하지만 userB가 비공개 + 요청자≠userB → PRIVATE
    expect(result.ok).toBe(true);
    expect(result.data).toBeNull();
    expect(result.errorCode).toBe('PRIVATE');
  });

  it('T-CTL-10: 비공개 사용자 본인이 자기 데이터 조회 시 정상 응답', async () => {
    // userA=priv-user(비공개), requestUserId=priv-user → 자기 자신이므로 PRIVATE 미발동
    (mocks.userPrivacyService.isPrivate as Mock)
      .mockResolvedValueOnce(true) // userA(=priv-user)는 비공개
      .mockResolvedValueOnce(false); // userB는 공개

    (mocks.analyticsService.getAffinity as Mock).mockResolvedValue({
      userA: { userId: 'priv-user', displayName: '비공개', avatarUrl: null },
      userB: { userId: 'userB', displayName: '민수', avatarUrl: null },
      totalMinutes: 60,
      sessionCount: 3,
      lastDate: null,
      dailyData: [],
    });
    (mocks.affinityCardRenderer.render as Mock).mockResolvedValue(Buffer.from('png'));

    const result = await controller.getAffinity(
      'guild-1',
      'priv-user', // userAId = 비공개 사용자
      'userB',
      '30',
      'priv-user', // requestUserId = priv-user(자기 자신) → 자기 포함 → 권한 통과 + PRIVATE 미발동
      '0',
    );

    expect(result.ok).toBe(true);
    expect(result.errorCode).toBeUndefined();
    expect(result.data).not.toBeNull();
  });

  it('data가 null이고 errorCode 없으면 데이터 0건 (렌더 실패 fallback)', async () => {
    (mocks.userPrivacyService.isPrivate as Mock).mockResolvedValue(false);
    (mocks.analyticsService.getAffinity as Mock).mockResolvedValue({
      userA: { userId: 'userA', displayName: '동현', avatarUrl: null },
      userB: { userId: 'userB', displayName: '민수', avatarUrl: null },
      totalMinutes: 0,
      sessionCount: 0,
      lastDate: null,
      dailyData: [],
    });
    // 렌더 실패 → data=null 반환
    (mocks.affinityCardRenderer.render as Mock).mockRejectedValue(new Error('렌더 실패'));

    const result = await controller.getAffinity('guild-1', 'userA', 'userB', '30', 'userA', '0');

    expect(result.ok).toBe(true);
    expect(result.data).toBeNull();
    // 렌더 실패 시 errorCode 없음
    expect(result.errorCode).toBeUndefined();
  });
});
