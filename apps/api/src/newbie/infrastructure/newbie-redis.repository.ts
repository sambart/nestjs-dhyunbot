import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';

import { REDIS_CLIENT } from '../../redis/redis.constants';
import { RedisService } from '../../redis/redis.service';
import { NewbieConfig } from '../domain/newbie-config.entity';
import { NewbieMission } from '../domain/newbie-mission.entity';
import { NewbieKeys } from './newbie-cache.keys';

/** Redis TTL 상수 (초 단위) */
const TTL = {
  CONFIG: 60 * 60,         // 1시간
  MISSION_ACTIVE: 60 * 30, // 30분
  PERIOD_ACTIVE: 60 * 60,  // 1시간
} as const;

@Injectable()
export class NewbieRedisRepository {
  constructor(
    private readonly redis: RedisService,
    @Inject(REDIS_CLIENT) private readonly client: Redis,
  ) {}

  // --- 설정 캐시 ---

  /** NewbieConfig 캐시 조회 */
  async getConfig(guildId: string): Promise<NewbieConfig | null> {
    return this.redis.get<NewbieConfig>(NewbieKeys.config(guildId));
  }

  /** NewbieConfig 캐시 저장 (TTL 1시간) */
  async setConfig(guildId: string, config: NewbieConfig): Promise<void> {
    await this.redis.set(NewbieKeys.config(guildId), config, TTL.CONFIG);
  }

  /** NewbieConfig 캐시 삭제 */
  async deleteConfig(guildId: string): Promise<void> {
    await this.redis.del(NewbieKeys.config(guildId));
  }

  // --- 미션 목록 캐시 ---

  /** 진행중 미션 목록 캐시 조회 */
  async getMissionActive(guildId: string): Promise<NewbieMission[] | null> {
    return this.redis.get<NewbieMission[]>(NewbieKeys.missionActive(guildId));
  }

  /** 진행중 미션 목록 캐시 저장 (TTL 30분) */
  async setMissionActive(guildId: string, missions: NewbieMission[]): Promise<void> {
    await this.redis.set(NewbieKeys.missionActive(guildId), missions, TTL.MISSION_ACTIVE);
  }

  /** 진행중 미션 목록 캐시 삭제 */
  async deleteMissionActive(guildId: string): Promise<void> {
    await this.redis.del(NewbieKeys.missionActive(guildId));
  }

  // --- 신입기간 활성 멤버 집합 ---

  /** 신입기간 활성 멤버 Set 전체 조회 (SMEMBERS) */
  async getPeriodActiveMembers(guildId: string): Promise<string[]> {
    return this.client.smembers(NewbieKeys.periodActive(guildId));
  }

  /** 신입기간 활성 멤버 추가 (SADD) */
  async addPeriodActiveMember(guildId: string, memberId: string): Promise<void> {
    await this.redis.sadd(NewbieKeys.periodActive(guildId), memberId);
  }

  /** 신입기간 활성 멤버 여부 확인 (SISMEMBER) */
  async isPeriodActiveMember(guildId: string, memberId: string): Promise<boolean> {
    return this.redis.sismember(NewbieKeys.periodActive(guildId), memberId);
  }

  /**
   * 활성 멤버 집합 초기화 (DEL + SADD, TTL 1시간)
   * 봇 기동 초기화 또는 스케줄러 실행 후 캐시 재구성 시 사용
   */
  async initPeriodActiveMembers(guildId: string, memberIds: string[]): Promise<void> {
    const key = NewbieKeys.periodActive(guildId);
    await this.redis.del(key);
    if (memberIds.length > 0) {
      await this.redis.sadd(key, memberIds);
    }
    await this.client.expire(key, TTL.PERIOD_ACTIVE);
  }

  /** 신입기간 활성 멤버 캐시 삭제 */
  async deletePeriodActive(guildId: string): Promise<void> {
    await this.redis.del(NewbieKeys.periodActive(guildId));
  }

  // --- 모코코 사냥 ---

  /**
   * 사냥꾼의 신규사용자별 사냥 시간 누적 (HINCRBY)
   * Hash 키: newbie:moco:total:{guildId}:{hunterId}
   * Hash 필드: newbieMemberId, 값: minutes
   */
  async incrMocoMinutes(
    guildId: string,
    hunterId: string,
    newbieMemberId: string,
    minutes: number,
  ): Promise<void> {
    await this.client.hincrby(NewbieKeys.mocoTotal(guildId, hunterId), newbieMemberId, minutes);
  }

  /**
   * 사냥꾼 총 사냥 시간 Sorted Set 갱신 (ZINCRBY)
   * Sorted Set 키: newbie:moco:rank:{guildId}
   * member: hunterId, score += minutes
   */
  async incrMocoRank(guildId: string, hunterId: string, minutes: number): Promise<void> {
    await this.client.zincrby(NewbieKeys.mocoRank(guildId), minutes, hunterId);
  }

  /**
   * 사냥꾼 순위 페이지 조회 (ZREVRANGE WITH SCORES)
   * page는 1-based
   */
  async getMocoRankPage(
    guildId: string,
    page: number,
    pageSize: number,
  ): Promise<Array<{ hunterId: string; totalMinutes: number }>> {
    const start = (page - 1) * pageSize;
    const end = start + pageSize - 1;
    const raw = await this.client.zrevrange(NewbieKeys.mocoRank(guildId), start, end, 'WITHSCORES');

    const result: Array<{ hunterId: string; totalMinutes: number }> = [];
    for (let i = 0; i < raw.length; i += 2) {
      result.push({
        hunterId: raw[i],
        totalMinutes: parseFloat(raw[i + 1]),
      });
    }
    return result;
  }

  /**
   * 사냥꾼의 신규사용자별 상세 시간 조회 (HGETALL)
   * 반환값: { newbieMemberId: minutes }
   */
  async getMocoHunterDetail(
    guildId: string,
    hunterId: string,
  ): Promise<Record<string, number>> {
    const raw = await this.client.hgetall(NewbieKeys.mocoTotal(guildId, hunterId));
    const result: Record<string, number> = {};
    for (const [key, value] of Object.entries(raw)) {
      result[key] = parseFloat(value);
    }
    return result;
  }

  /** 전체 사냥꾼 수 조회 (ZCARD) */
  async getMocoRankCount(guildId: string): Promise<number> {
    return this.client.zcard(NewbieKeys.mocoRank(guildId));
  }
}
