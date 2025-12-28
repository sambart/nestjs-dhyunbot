import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { RedisService } from '../../../redis/redis.service';
import { VoiceDailyEntity } from '../domain/voice-daily-entity';
import { Repository } from 'typeorm';
import { getKSTDateString } from '../../../common/helper';
import { VoiceRedisRepository } from '../infrastructure/voice.redis.repository';

@Injectable()
export class VoiceDailyFlushService {
  constructor(
    private readonly redis: RedisService,
    @InjectRepository(VoiceDailyEntity)
    private readonly repo: Repository<VoiceDailyEntity>,
    private readonly voiceRedisRepository: VoiceRedisRepository,
  ) {}

  async flushTodayAll() {
    const today = getKSTDateString(); // 예: 2025-12-23

    // guild 전체 scan
    const guildKeys = await this.redis.scanKeys(`voice:duration:*`);

    // guild / user / date 파싱\
    for (const entry of guildKeys) {
      const [guild, user] = entry.split(':');
      await this.flushDate(guild, user, today);
    }
  }

  async flushDate(guild: string, user: string, date: string) {
    /**
     * 1️⃣ 채널별 체류 시간
     */
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

      await this.repo.query(
        `
        INSERT INTO voice_daily AS vd
            ("guildId","userId","userName","date","channelId","channelName","channelDurationSec")
        VALUES ($1,$2,$3,$4,$5,$6,$7)
        ON CONFLICT ("guildId","userId","date","channelId")
        DO UPDATE SET
          "channelDurationSec" =
          vd."channelDurationSec" + EXCLUDED."channelDurationSec",
          "channelName" = EXCLUDED."channelName",
          "userName"    = EXCLUDED."userName"
        `,
        [
          guild,
          user,
          userName, // fallback
          date,
          channelId,
          channelName,
          duration,
        ],
      );

      await this.redis.del(key);
    }

    /**
     * 2️⃣ 마이크 ON / OFF 누적
     * - channelId = 'GLOBAL'
     */
    for (const state of ['on', 'off'] as const) {
      const key = `voice:duration:mic:${guild}:${user}:${date}:${state}`;
      const duration = Number((await this.redis.get(key)) || 0);
      if (duration <= 0) continue;

      await this.repo.query(
        `
        INSERT INTO voice_daily AS vd
            ("guildId","userId","date","channelId","micOnSec","micOffSec")
        VALUES ($1,$2,$3,'GLOBAL',$4,$5)
        ON CONFLICT ("guildId","userId","date","channelId")
        DO UPDATE SET
            "micOnSec"  = vd."micOnSec"  + EXCLUDED."micOnSec",
            "micOffSec" = vd."micOffSec" + EXCLUDED."micOffSec"
        `,
        [guild, user, date, state === 'on' ? duration : 0, state === 'off' ? duration : 0],
      );

      await this.redis.del(key);
    }

    /**
     * 3️⃣ 혼자 있었던 시간
     * - channelId = 'GLOBAL'
     */
    const aloneKey = `voice:duration:alone:${guild}:${user}:${date}`;
    const aloneSec = Number((await this.redis.get(aloneKey)) || 0);

    if (aloneSec > 0) {
      await this.repo.query(
        `
        INSERT INTO voice_daily AS vd
            ("guildId","userId","date","channelId","aloneSec")
        VALUES ($1,$2,$3,'GLOBAL',$4)
        ON CONFLICT ("guildId","userId","date","channelId")
        DO UPDATE SET
            "aloneSec" = vd."aloneSec" + EXCLUDED."aloneSec"
        `,
        [guild, user, date, aloneSec],
      );
      await this.redis.del(aloneKey);
    }
  }
}
