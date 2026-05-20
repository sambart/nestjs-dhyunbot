import { Injectable } from '@nestjs/common';
import { LRUCache } from 'lru-cache';

// ── LRU 캐시 상수 ──
const FRIEND_CARD_LRU_MAX = 500;
const FRIEND_CARD_LRU_TTL_MS = 5 * 60 * 1000; // 5분

/**
 * 베스트 프렌드 카드 PNG base64 인메모리 LRU 캐시.
 *
 * PNG base64 30~80KB를 Redis에 저장하면 메모리 압박이 크므로 인메모리 LRU를 사용한다.
 * 멀티 인스턴스 배포 시 캐시 일관성은 보장되지 않으나 비즈니스 영향이 미미하다.
 *
 * 캐시 키 형식: `friend:card:{guildId}:{userId}:{period}:{limit}:{commentFlag}`
 */
@Injectable()
export class BestFriendCardCacheService {
  private readonly cache = new LRUCache<string, string>({
    max: FRIEND_CARD_LRU_MAX,
    ttl: FRIEND_CARD_LRU_TTL_MS,
  });

  get(key: string): string | undefined {
    return this.cache.get(key);
  }

  set(key: string, value: string): void {
    this.cache.set(key, value);
  }
}
