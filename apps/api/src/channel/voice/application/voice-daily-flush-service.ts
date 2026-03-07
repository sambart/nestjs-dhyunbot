import { getKSTDateString } from '@dhyunbot/shared';
import { Injectable } from '@nestjs/common';

import { RedisService } from '../../../redis/redis.service';
import { VoiceDailyRepository } from '../infrastructure/voice-daily.repository';
import { VoiceRedisRepository } from '../infrastructure/voice-redis.repository';

@Injectable()
export class VoiceDailyFlushService {
  constructor(
    private readonly redis: RedisService,
    private readonly voiceDailyRepository: VoiceDailyRepository,
    private readonly voiceRedisRepository: VoiceRedisRepository,
  ) {}

  async flushTodayAll() {
    const today = getKSTDateString();

    const guildKeys = await this.redis.scanKeys(`voice:duration:*`);

    for (const entry of guildKeys) {
      const [guild, user] = entry.split(':');
      await this.flushDate(guild, user, today);
    }
  }

  async flushDate(guild: string, user: string, date: string) {
    // 1. 채널별 체류 시간
    const userName = (await this.voiceRedisRepository.getUserName(guild, user)) ?? 'UNKNOWN';
    const channelKeys = await this.redis.scanKeys(
      `voice:duration:channel:${guild}:${user}:${date}:*`,
    );
    for (const key of channelKeys) {
      const duration = Number((await this.redis.get(key)) || 0);
      if (duration <= 0) continue;
      const channelId = key.split(':').at(-1)!;
      const channelName =
        (await this.voiceRedisRepository.getChannelName(guild, channelId)) ?? 'UNKNOWN';

      await this.voiceDailyRepository.accumulateChannelDuration(
        guild,
        user,
        userName,
        date,
        channelId,
        channelName,
        duration,
      );

      await this.redis.del(key);
    }

    // 2. 마이크 ON / OFF 누적
    for (const state of ['on', 'off'] as const) {
      const key = `voice:duration:mic:${guild}:${user}:${date}:${state}`;
      const duration = Number((await this.redis.get(key)) || 0);
      if (duration <= 0) continue;

      await this.voiceDailyRepository.accumulateMicDuration(
        guild,
        user,
        date,
        state === 'on' ? duration : 0,
        state === 'off' ? duration : 0,
      );

      await this.redis.del(key);
    }

    // 3. 혼자 있었던 시간
    const aloneKey = `voice:duration:alone:${guild}:${user}:${date}`;
    const aloneSec = Number((await this.redis.get(aloneKey)) || 0);

    if (aloneSec > 0) {
      await this.voiceDailyRepository.accumulateAloneDuration(guild, user, date, aloneSec);
      await this.redis.del(aloneKey);
    }
  }
}
