import { Injectable, Logger } from '@nestjs/common';

import { RedisService } from '../../../../redis/redis.service';

// ── LLM 쿼터 상수 ──
/** Redis INCR 기반 길드별 일일 LLM 호출 한도 */
const FRIEND_LLM_DAILY_QUOTA = 50;
/** 일일 쿼터 키의 TTL (24시간 = 86400초) */
const FRIEND_LLM_QUOTA_TTL_SEC = 24 * 60 * 60;

/**
 * 길드별 LLM 일일 호출 한도 카운터 헬퍼.
 *
 * Redis INCR `friend:llm:quota:{guildId}:{YYYYMMDD}` 로 카운트하고,
 * 첫 호출 시 EXPIRE 24h를 설정한다.
 */
@Injectable()
export class BestFriendLlmQuotaService {
  private readonly logger = new Logger(BestFriendLlmQuotaService.name);

  constructor(private readonly redisService: RedisService) {}

  /**
   * 쿼터를 1 증가시키고 현재 카운트를 반환한다.
   * 첫 호출이면 TTL(24시간)을 설정한다.
   *
   * @returns 증가 후 카운트. 한도 초과 여부는 호출자가 판단한다.
   */
  async increment(guildId: string): Promise<number> {
    const key = this.buildKey(guildId);
    const count = await this.redisService.incrBy(key, 1);

    if (count === 1) {
      // 첫 호출: TTL 24시간 설정
      const expireAt = Math.floor(Date.now() / 1000) + FRIEND_LLM_QUOTA_TTL_SEC;
      await this.redisService.expireAt(key, expireAt);
    }

    return count;
  }

  /**
   * 해당 길드의 오늘 LLM 호출 횟수가 한도를 초과했는지 확인한다.
   * increment()를 먼저 호출한 결과를 전달하는 용도로 사용한다.
   */
  isExceeded(count: number): boolean {
    return count > FRIEND_LLM_DAILY_QUOTA;
  }

  private buildKey(guildId: string): string {
    const today = this.getTodayKstString();
    return `friend:llm:quota:${guildId}:${today}`;
  }

  private getTodayKstString(): string {
    const KST_OFFSET_MS = 9 * 60 * 60 * 1000; // UTC+9 (KST)
    const kst = new Date(Date.now() + KST_OFFSET_MS);
    return kst.toISOString().slice(0, 10).replace(/-/g, '');
  }
}
