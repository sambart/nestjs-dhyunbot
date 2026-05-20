import { Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';

import { REDIS_CLIENT } from '../../redis/redis.constants';

export const USER_PRIVACY_CACHE_PREFIX = 'friend:privacy';
export const USER_PRIVACY_CACHE_TTL_SEC = 30 * 60;

/** Redis 캐시 키를 생성한다. 포맷: `friend:privacy:{guildId}:{userId}` */
export const buildPrivacyCacheKey = (guildId: string, userId: string): string =>
  `${USER_PRIVACY_CACHE_PREFIX}:${guildId}:${userId}`;

/**
 * UserPrivacyConfig Redis 캐시 캡슐화.
 *
 * 직렬화 규약: `"0"` = 공개(false), `"1"` = 비공개(true)
 * RedisService.mget()은 JSON.parse를 수행해 원시값과 호환되지 않으므로
 * REDIS_CLIENT(ioredis)를 직접 주입받아 raw MGET/SET/DEL을 사용한다.
 */
@Injectable()
export class UserPrivacyConfigCache {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  /**
   * 여러 userId의 프라이버시 설정을 배치 조회한다.
   * @returns 캐시 히트 시 boolean, 미스 시 null
   */
  async getMany(guildId: string, userIds: string[]): Promise<Map<string, boolean | null>> {
    const result = new Map<string, boolean | null>();

    if (userIds.length === 0) {
      return result;
    }

    const keys = userIds.map((userId) => buildPrivacyCacheKey(guildId, userId));
    const values = await this.redis.mget(...keys);

    for (let i = 0; i < userIds.length; i++) {
      const raw = values[i];
      if (raw === null || raw === undefined) {
        result.set(userIds[i], null);
      } else {
        result.set(userIds[i], raw === '1');
      }
    }

    return result;
  }

  /**
   * 여러 userId의 프라이버시 설정을 Redis에 일괄 저장한다.
   * TTL은 USER_PRIVACY_CACHE_TTL_SEC(1800초) 고정.
   */
  async setMany(guildId: string, entries: Map<string, boolean>): Promise<void> {
    if (entries.size === 0) {
      return;
    }

    const pipeline = this.redis.pipeline();

    for (const [userId, isPrivate] of entries) {
      const key = buildPrivacyCacheKey(guildId, userId);
      const value = isPrivate ? '1' : '0';
      pipeline.set(key, value, 'EX', USER_PRIVACY_CACHE_TTL_SEC);
    }

    await pipeline.exec();
  }

  /**
   * 특정 userId의 프라이버시 캐시를 무효화한다.
   * upsert 후 호출하여 stale 데이터를 제거한다.
   */
  async invalidate(guildId: string, userId: string): Promise<void> {
    const key = buildPrivacyCacheKey(guildId, userId);
    await this.redis.del(key);
  }
}
