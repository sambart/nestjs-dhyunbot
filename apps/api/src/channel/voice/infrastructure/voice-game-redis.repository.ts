import { Injectable } from '@nestjs/common';

import { RedisService } from '../../../redis/redis.service';
import { VoiceGameKeys } from './voice-game.keys';
import { VoiceGameSession } from './voice-game-session';

/** 게임 세션 Redis TTL (초 단위) — 24시간 */
const GAME_SESSION_TTL = 60 * 60 * 24;

@Injectable()
export class VoiceGameRedisRepository {
  constructor(private readonly redis: RedisService) {}

  /** Redis에서 게임 세션 조회 */
  async getGameSession(guildId: string, userId: string): Promise<VoiceGameSession | null> {
    const key = VoiceGameKeys.gameSession(guildId, userId);
    return this.redis.get<VoiceGameSession>(key);
  }

  /** Redis에 게임 세션 저장 (TTL 24시간) */
  async setGameSession(guildId: string, userId: string, session: VoiceGameSession): Promise<void> {
    const key = VoiceGameKeys.gameSession(guildId, userId);
    await this.redis.set(key, session, GAME_SESSION_TTL);
  }

  /** Redis 게임 세션 삭제 */
  async deleteGameSession(guildId: string, userId: string): Promise<void> {
    const key = VoiceGameKeys.gameSession(guildId, userId);
    await this.redis.del(key);
  }

  /** 모든 게임 세션 키 SCAN */
  async scanAllSessionKeys(): Promise<string[]> {
    return this.redis.scanKeys(VoiceGameKeys.gameSessionPattern());
  }
}
