import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { VoiceDailyEntity } from '../domain/voice-daily.entity';

@Injectable()
export class VoiceDailyRepository {
  constructor(
    @InjectRepository(VoiceDailyEntity)
    private readonly repo: Repository<VoiceDailyEntity>,
  ) {}

  async accumulateChannelDuration(
    guildId: string,
    userId: string,
    userName: string,
    date: string,
    channelId: string,
    channelName: string,
    durationSec: number,
  ): Promise<void> {
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
      [guildId, userId, userName, date, channelId, channelName, durationSec],
    );
  }

  async accumulateMicDuration(
    guildId: string,
    userId: string,
    date: string,
    micOnSec: number,
    micOffSec: number,
  ): Promise<void> {
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
      [guildId, userId, date, micOnSec, micOffSec],
    );
  }

  async accumulateAloneDuration(
    guildId: string,
    userId: string,
    date: string,
    aloneSec: number,
  ): Promise<void> {
    await this.repo.query(
      `
      INSERT INTO voice_daily AS vd
          ("guildId","userId","date","channelId","aloneSec")
      VALUES ($1,$2,$3,'GLOBAL',$4)
      ON CONFLICT ("guildId","userId","date","channelId")
      DO UPDATE SET
          "aloneSec" = vd."aloneSec" + EXCLUDED."aloneSec"
      `,
      [guildId, userId, date, aloneSec],
    );
  }
}
