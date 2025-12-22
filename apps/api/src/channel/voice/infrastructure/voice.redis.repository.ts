import { Injectable } from '@nestjs/common';
import { RedisService } from 'src/redis/redis.service';
import { VoiceKeys } from './voice-cache.keys';

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
    if (!session.lastUpdatedAt) {
      session.lastUpdatedAt = now;
      return; // 초기화 시점
    }

    const elapsedSeconds = Math.floor((now - session.lastUpdatedAt) / 1000);
    if (elapsedSeconds <= 0) return;

    const date = session.date;

    // 1️⃣ 채널별 누적
    const channelKey = VoiceKeys.channelDuration(guild, user, date, session.channelId);
    await this.redis.incrBy(channelKey, elapsedSeconds);

    // 2️⃣ 마이크 상태별 누적
    const micKey = VoiceKeys.micDuration(guild, user, date, session.mic ? 'on' : 'off');
    await this.redis.incrBy(micKey, elapsedSeconds);

    // 3️⃣ 혼자 있었던 시간 누적
    if (session.alone) {
      const aloneKey = VoiceKeys.aloneDuration(guild, user, date);
      await this.redis.incrBy(aloneKey, elapsedSeconds);
    }

    // 4️⃣ 마지막 업데이트 시간 갱신
    session.lastUpdatedAt = now;

    // 5️⃣ Redis session 갱신 (TTL 1시간)
    const sessionKey = VoiceKeys.session(guild, user);
    await this.redis.set(sessionKey, session, 60 * 60);
  }

  /** 세션 조회 */
  async getSession(guild: string, user: string): Promise<VoiceSession | null> {
    const key = VoiceKeys.session(guild, user);
    return this.redis.get<VoiceSession>(key);
  }

  /** 세션 저장 */
  async setSession(guild: string, user: string, session: VoiceSession) {
    const key = VoiceKeys.session(guild, user);
    await this.redis.set(key, session, 60 * 60); // TTL 1시간
  }
}
