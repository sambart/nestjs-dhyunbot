import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { VoiceGameActivityOrm } from './voice-game-activity.orm-entity';
import { VoiceGameDailyOrm } from './voice-game-daily.orm-entity';

export interface SaveGameActivityDto {
  guildId: string;
  userId: string;
  channelId: string;
  gameName: string;
  applicationId: string | null;
  startedAt: Date;
  endedAt: Date;
  durationMin: number;
}

@Injectable()
export class VoiceGameDbRepository {
  constructor(
    @InjectRepository(VoiceGameActivityOrm)
    private readonly activityRepo: Repository<VoiceGameActivityOrm>,
    @InjectRepository(VoiceGameDailyOrm)
    private readonly dailyRepo: Repository<VoiceGameDailyOrm>,
  ) {}

  /** voice_game_activity 테이블에 세션 레코드 INSERT */
  async saveActivity(data: SaveGameActivityDto): Promise<void> {
    const entity = this.activityRepo.create(data);
    await this.activityRepo.save(entity);
  }

  /** voice_game_daily 테이블에 일별 집계 UPSERT (totalMinutes += durationMin, sessionCount += 1) */
  async upsertDaily(
    guildId: string,
    userId: string,
    gameName: string,
    date: string,
    durationMin: number,
  ): Promise<void> {
    const tableName = this.dailyRepo.metadata.tableName;
    const schemaPrefix = this.dailyRepo.metadata.schema
      ? `"${this.dailyRepo.metadata.schema}".`
      : '';

    await this.dailyRepo.query(
      `
      INSERT INTO ${schemaPrefix}"${tableName}"
        ("guildId", "userId", "gameName", "date", "totalMinutes", "sessionCount", "recordedAt")
      VALUES ($1, $2, $3, $4::date, $5::int, 1, NOW())
      ON CONFLICT ("guildId", "userId", "gameName", "date") DO UPDATE SET
        "totalMinutes" = "${tableName}"."totalMinutes" + EXCLUDED."totalMinutes",
        "sessionCount" = "${tableName}"."sessionCount" + 1,
        "recordedAt"   = NOW()
      `,
      [guildId, userId, gameName, date, durationMin],
    );
  }

  /** 90일 초과 voice_game_activity 레코드 삭제 */
  async deleteExpiredActivities(cutoffDate: Date): Promise<number> {
    const result = await this.activityRepo
      .createQueryBuilder()
      .delete()
      .where('"startedAt" < :cutoff', { cutoff: cutoffDate })
      .execute();

    return result.affected ?? 0;
  }
}
