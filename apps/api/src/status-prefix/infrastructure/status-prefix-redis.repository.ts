import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';

import { REDIS_CLIENT } from '../../redis/redis.constants';
import { RedisService } from '../../redis/redis.service';
import { StatusPrefixConfig } from '../domain/status-prefix-config.entity';
import { StatusPrefixKeys } from './status-prefix-cache.keys';

/** Redis TTL 상수 (초 단위) */
const TTL = {
  /** 설정 캐시: 1시간 */
  CONFIG: 60 * 60,
} as const;

@Injectable()
export class StatusPrefixRedisRepository {
  constructor(
    private readonly redis: RedisService,
    @Inject(REDIS_CLIENT) private readonly client: Redis,
  ) {}

  // --- 원래 닉네임 ---

  /** 원래 닉네임 조회 (GET) */
  async getOriginalNickname(guildId: string, memberId: string): Promise<string | null> {
    return this.redis.get<string>(StatusPrefixKeys.originalNickname(guildId, memberId));
  }

  /**
   * 원래 닉네임 저장 (SET NX — 이미 존재하면 무시)
   * 반환값: true = 저장 성공, false = 이미 존재하여 무시
   */
  async setOriginalNicknameNx(
    guildId: string,
    memberId: string,
    nickname: string,
  ): Promise<boolean> {
    const key = StatusPrefixKeys.originalNickname(guildId, memberId);
    const result = await this.client.set(key, JSON.stringify(nickname), 'NX');
    return result === 'OK';
  }

  /** 원래 닉네임 삭제 (DEL) — RESET 버튼 또는 음성 퇴장 시 */
  async deleteOriginalNickname(guildId: string, memberId: string): Promise<void> {
    await this.redis.del(StatusPrefixKeys.originalNickname(guildId, memberId));
  }

  // --- 설정 캐시 ---

  /** 설정 캐시 조회 (GET → JSON 역직렬화) */
  async getConfig(guildId: string): Promise<StatusPrefixConfig | null> {
    return this.redis.get<StatusPrefixConfig>(StatusPrefixKeys.config(guildId));
  }

  /** 설정 캐시 저장 (SET EX 3600 — TTL 1시간) */
  async setConfig(guildId: string, config: StatusPrefixConfig): Promise<void> {
    await this.redis.set(StatusPrefixKeys.config(guildId), config, TTL.CONFIG);
  }

  /** 설정 캐시 삭제 (DEL) — 필요 시 무효화용 */
  async deleteConfig(guildId: string): Promise<void> {
    await this.redis.del(StatusPrefixKeys.config(guildId));
  }
}
