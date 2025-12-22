import { Injectable } from '@nestjs/common';
import { RedisService } from 'src/redis/redis.service';
import { VoiceKeys } from './voice-cache.keys';

@Injectable()
export class VoiceRedisRepository {
  constructor(private readonly redis: RedisService) {}

  async addChannelDuration(
    guild: string,
    user: string,
    date: string,
    channel: string,
    seconds: number,
  ) {
    const key = VoiceKeys.channelDuration(guild, user, date, channel);

    await this.redis.incrBy(key, seconds);
  }

  async addMicDuration(
    guild: string,
    user: string,
    date: string,
    state: 'on' | 'off',
    seconds: number,
  ) {
    const key = VoiceKeys.micDuration(guild, user, date, state);

    await this.redis.incrBy(key, seconds);
  }

  async addAloneDuration(guild: string, user: string, date: string, seconds: number) {
    const key = VoiceKeys.aloneDuration(guild, user, date);
    await this.redis.incrBy(key, seconds);
  }
}
