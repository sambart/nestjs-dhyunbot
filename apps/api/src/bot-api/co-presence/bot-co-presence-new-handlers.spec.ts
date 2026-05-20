/**
 * BotCoPresenceController 신규 핸들러 단위 테스트
 * 대상: getBestFriends (T-CTL-01~04)
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

import { BotCoPresenceController } from './bot-co-presence.controller';

// ─── mock 헬퍼 ────────────────────────────────────────────────────────────────

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
  };
  const bestFriendCardRenderer = {
    render: vi.fn().mockResolvedValue(Buffer.from('fake-png')),
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
    bestFriendCardRenderer,
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
    mocks.bestFriendCardRenderer as never,
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
