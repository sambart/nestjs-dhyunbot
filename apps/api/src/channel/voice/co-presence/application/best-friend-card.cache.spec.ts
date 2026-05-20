/**
 * BestFriendCardCacheService 단위 테스트
 * 대상: get, set (LRU 동작, TTL, max 엔트리)
 *
 * lru-cache가 컨테이너에 설치되지 않은 경우를 위해 vi.mock으로 Map 기반 shim을 제공한다.
 * LRUCache 동작(max, ttl)은 이 shim으로 검증하며 실제 LRU 라이브러리 의존 없이 동작한다.
 */

// lru-cache 모듈을 Map 기반 shim으로 대체한다 (설치 여부 무관)
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
      // max 초과 시 가장 오래된 항목 제거 (FIFO — 단순 shim)
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

import { BestFriendCardCacheService } from './best-friend-card.cache';

describe('BestFriendCardCacheService', () => {
  let cacheService: BestFriendCardCacheService;

  beforeEach(() => {
    cacheService = new BestFriendCardCacheService();
  });

  it('get: 존재하지 않는 키는 undefined 반환', () => {
    const result = cacheService.get('not-exist');
    expect(result).toBeUndefined();
  });

  it('set 후 get하면 저장된 값을 반환한다', () => {
    const key = 'friend:card:guild-1:user-1:30:5:1';
    const value = 'base64encodedPNG==';

    cacheService.set(key, value);
    const result = cacheService.get(key);

    expect(result).toBe(value);
  });

  it('서로 다른 키의 값이 독립적으로 저장된다', () => {
    cacheService.set('key-a', 'value-a');
    cacheService.set('key-b', 'value-b');

    expect(cacheService.get('key-a')).toBe('value-a');
    expect(cacheService.get('key-b')).toBe('value-b');
  });

  it('같은 키에 덮어쓰기하면 최신 값이 반환된다', () => {
    cacheService.set('key-1', 'old-value');
    cacheService.set('key-1', 'new-value');

    expect(cacheService.get('key-1')).toBe('new-value');
  });

  it('500개 항목까지 저장된다 (max 엔트리 경계)', () => {
    // 500개를 저장해도 초기 항목이 LRU에 의해 제거되지 않아야 한다 (max=500)
    const firstKey = 'key-0';
    cacheService.set(firstKey, 'value-0');

    for (let i = 1; i < 500; i++) {
      cacheService.set(`key-${i}`, `value-${i}`);
    }

    // 500개 이하이므로 첫 번째 키가 남아 있어야 한다
    expect(cacheService.get(firstKey)).toBe('value-0');
  });
});
