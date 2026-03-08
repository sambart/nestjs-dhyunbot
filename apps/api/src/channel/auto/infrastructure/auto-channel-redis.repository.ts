import { Injectable } from '@nestjs/common';

import { RedisService } from '../../../redis/redis.service';
import { AutoChannelKeys } from './auto-channel.keys';
import { AutoChannelConfirmedState } from './auto-channel-state';

/** Redis TTL 상수 (초 단위) */
const TTL = {
  /** 확정방 상태 TTL — 12시간 */
  CONFIRMED: 60 * 60 * 12,
} as const;

@Injectable()
export class AutoChannelRedisRepository {
  constructor(private readonly redis: RedisService) {}

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
}
