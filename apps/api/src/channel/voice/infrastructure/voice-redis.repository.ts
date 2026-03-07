import { Injectable } from '@nestjs/common';

import { RedisService } from '../../../redis/redis.service';
import { VoiceKeys } from './voice-cache.keys';
import { VoiceSession } from './voice-session.keys';

/** Redis TTL 상수 (초 단위) */
const TTL = {
  /** 음성 세션 TTL — 12시간 */
  SESSION: 60 * 60 * 12,
  /** 채널명·유저명 캐시 TTL — 7일 */
  NAME_CACHE: 60 * 60 * 24 * 7,
} as const;

@Injectable()
export class VoiceRedisRepository {
  constructor(private readonly redis: RedisService) {}

  /** 세션 기반으로 duration 누적 */
  async accumulateDuration(
    guild: string,
    user: string,
    session: VoiceSession,
    now: number = Date.now(),
  ) {
    // 최초 진입
    if (!session.lastUpdatedAt) {
      session.lastUpdatedAt = now;
      return;
    }

    const elapsedSeconds = Math.floor((now - session.lastUpdatedAt) / 1000);
    if (elapsedSeconds <= 0) return;

    // ⭐ 핵심: date는 session 기준
    const date = session.date;
    /**
     * 1️⃣ 채널별 체류 시간
     */
    if (session.channelId) {
      const channelKey = VoiceKeys.channelDuration(guild, user, date, session.channelId);
      await this.redis.incrBy(channelKey, elapsedSeconds);
    }
    /**
     * 2️⃣ 마이크 상태별 시간
     */

    if (session.channelId) {
      const micKey = VoiceKeys.micDuration(guild, user, date, session.mic ? 'on' : 'off');
      await this.redis.incrBy(micKey, elapsedSeconds);
    }
    /**
     * 3️⃣ 혼자 있었던 시간
     */
    if (session.alone && session.channelId) {
      const aloneKey = VoiceKeys.aloneDuration(guild, user, date);
      await this.redis.incrBy(aloneKey, elapsedSeconds);
    }

    /**
     * 4️⃣ 세션 갱신
     */
    session.lastUpdatedAt = now;

    /**
     * 5️⃣ Redis 세션 저장 (TTL 12시간)
     */
    const sessionKey = VoiceKeys.session(guild, user);
    await this.redis.set(sessionKey, session, TTL.SESSION);
  }

  /** 세션 조회 */
  async getSession(guild: string, user: string): Promise<VoiceSession | null> {
    const key = VoiceKeys.session(guild, user);
    return this.redis.get<VoiceSession>(key);
  }

  /** 세션 저장 */
  async setSession(guild: string, user: string, session: VoiceSession) {
    const key = VoiceKeys.session(guild, user);
    await this.redis.set(key, session, TTL.SESSION);
  }
  async deleteSession(guild: string, user: string) {
    const key = VoiceKeys.session(guild, user);
    this.redis.del(key);
    return true;
  }

  /** 채널명 캐시 */
  async setChannelName(guild: string, channelId: string, channelName: string) {
    const key = VoiceKeys.channelName(guild, channelId);
    await this.redis.set(key, channelName, TTL.NAME_CACHE);
  }

  async getChannelName(guild: string, channelId: string): Promise<string | null> {
    const key = VoiceKeys.channelName(guild, channelId);
    return this.redis.get<string>(key);
  }

  /** 사용자명 캐시 */
  async setUserName(guild: string, userId: string, userName: string) {
    const key = VoiceKeys.userName(guild, userId);
    await this.redis.set(key, userName, TTL.NAME_CACHE);
  }

  async getUserName(guild: string, userId: string): Promise<string | null> {
    const key = VoiceKeys.userName(guild, userId);
    return this.redis.get<string>(key);
  }
}
