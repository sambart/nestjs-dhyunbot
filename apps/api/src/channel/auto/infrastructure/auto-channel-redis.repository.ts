import { Injectable } from '@nestjs/common';

import { RedisService } from '../../../redis/redis.service';
import { AutoChannelKeys } from './auto-channel.keys';
import { AutoChannelConfirmedState, AutoChannelWaitingState } from './auto-channel-state';

/** Redis TTL 상수 (초 단위) */
const TTL = {
  /** 대기방 상태 TTL — 12시간 */
  WAITING: 60 * 60 * 12,
  /** 확정방 상태 TTL — 12시간 */
  CONFIRMED: 60 * 60 * 12,
} as const;

@Injectable()
export class AutoChannelRedisRepository {
  constructor(private readonly redis: RedisService) {}

  // --- 대기방 ---

  /** 대기방 상태 저장 */
  async setWaitingState(channelId: string, state: AutoChannelWaitingState): Promise<void> {
    await this.redis.set(AutoChannelKeys.waiting(channelId), state, TTL.WAITING);
  }

  /** 대기방 상태 조회 */
  async getWaitingState(channelId: string): Promise<AutoChannelWaitingState | null> {
    return this.redis.get<AutoChannelWaitingState>(AutoChannelKeys.waiting(channelId));
  }

  /** 대기방 상태 삭제 */
  async deleteWaitingState(channelId: string): Promise<void> {
    await this.redis.del(AutoChannelKeys.waiting(channelId));
  }

  // --- 확정방 ---

  /** 확정방 상태 저장 */
  async setConfirmedState(channelId: string, state: AutoChannelConfirmedState): Promise<void> {
    await this.redis.set(AutoChannelKeys.confirmed(channelId), state, TTL.CONFIRMED);
  }

  /** 확정방 상태 조회 */
  async getConfirmedState(channelId: string): Promise<AutoChannelConfirmedState | null> {
    return this.redis.get<AutoChannelConfirmedState>(AutoChannelKeys.confirmed(channelId));
  }

  /** 확정방 상태 삭제 */
  async deleteConfirmedState(channelId: string): Promise<void> {
    await this.redis.del(AutoChannelKeys.confirmed(channelId));
  }

  // --- 트리거 채널 집합 ---

  /** 트리거 채널 집합에 추가 (SADD) */
  async addTriggerChannel(guildId: string, triggerChannelId: string): Promise<void> {
    await this.redis.sadd(AutoChannelKeys.triggerSet(guildId), triggerChannelId);
  }

  /** 트리거 채널 집합에서 제거 (SREM) */
  async removeTriggerChannel(guildId: string, triggerChannelId: string): Promise<void> {
    await this.redis.srem(AutoChannelKeys.triggerSet(guildId), triggerChannelId);
  }

  /** 트리거 채널 여부 확인 (SISMEMBER) */
  async isTriggerChannel(guildId: string, channelId: string): Promise<boolean> {
    return this.redis.sismember(AutoChannelKeys.triggerSet(guildId), channelId);
  }

  /**
   * 봇 기동 시 또는 설정 전체 갱신 시 호출.
   * 기존 Set을 삭제 후 새 목록으로 덮어쓴다.
   * triggerChannelIds가 빈 배열이면 키를 삭제한다.
   */
  async initTriggerSet(guildId: string, triggerChannelIds: string[]): Promise<void> {
    const key = AutoChannelKeys.triggerSet(guildId);
    await this.redis.del(key);
    if (triggerChannelIds.length > 0) {
      await this.redis.sadd(key, triggerChannelIds);
    }
  }
}
