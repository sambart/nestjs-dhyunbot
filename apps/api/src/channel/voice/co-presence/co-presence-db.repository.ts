import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { VoiceCoPresenceDaily } from './domain/voice-co-presence-daily.entity';
import { VoiceCoPresenceSession } from './domain/voice-co-presence-session.entity';

export interface SaveSessionDto {
  guildId: string;
  userId: string;
  channelId: string;
  startedAt: Date;
  endedAt: Date;
  durationMin: number;
  peerIds: string[];
  peerMinutes: Record<string, number>;
}

export interface UpsertPairDailyRow {
  guildId: string;
  userId: string;
  peerId: string;
  date: string;
  minutes: number;
  sessionCount: number;
}

@Injectable()
export class CoPresenceDbRepository {
  constructor(
    @InjectRepository(VoiceCoPresenceSession)
    private readonly sessionRepo: Repository<VoiceCoPresenceSession>,
    @InjectRepository(VoiceCoPresenceDaily)
    private readonly dailyRepo: Repository<VoiceCoPresenceDaily>,
    private readonly dataSource: DataSource,
  ) {}

  async saveSession(data: SaveSessionDto): Promise<void> {
    const session = this.sessionRepo.create(data);
    await this.sessionRepo.save(session);
  }

  async upsertDaily(
    guildId: string,
    userId: string,
    date: string,
    channelMinutes: number,
    sessionCount: number,
  ): Promise<void> {
    const tableName = this.dailyRepo.metadata.tableName;
    const schemaPrefix = this.dailyRepo.metadata.schema
      ? `"${this.dailyRepo.metadata.schema}".`
      : '';

    await this.dailyRepo.query(
      `
      INSERT INTO ${schemaPrefix}"${tableName}"
        ("guildId", "userId", "date", "channelMinutes", "sessionCount")
      VALUES ($1, $2, $3, $4::int, $5::int)
      ON CONFLICT ("guildId", "userId", "date") DO UPDATE SET
        "channelMinutes" = "${tableName}"."channelMinutes" + EXCLUDED."channelMinutes",
        "sessionCount"   = "${tableName}"."sessionCount"   + EXCLUDED."sessionCount"
      `,
      [guildId, userId, date, channelMinutes, sessionCount],
    );
  }

  /**
   * PairDaily 배치 upsert.
   * 세션 종료 시 모든 peer 레코드(양방향)를 한 번의 쿼리로 처리한다.
   */
  async upsertPairDailyBatch(rows: UpsertPairDailyRow[]): Promise<void> {
    if (rows.length === 0) return;

    const params: (string | number)[] = [];
    const valueClauses: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const offset = i * 6;
      valueClauses.push(
        `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}::date, $${offset + 5}::int, $${offset + 6}::int)`,
      );
      params.push(
        rows[i].guildId,
        rows[i].userId,
        rows[i].peerId,
        rows[i].date,
        rows[i].minutes,
        rows[i].sessionCount,
      );
    }

    await this.dataSource.query(
      `
      INSERT INTO "public"."voice_co_presence_pair_daily"
        ("guildId", "userId", "peerId", "date", "minutes", "sessionCount")
      VALUES ${valueClauses.join(', ')}
      ON CONFLICT ("guildId", "userId", "peerId", "date")
      DO UPDATE SET
        "minutes"      = "voice_co_presence_pair_daily"."minutes"      + EXCLUDED."minutes",
        "sessionCount" = "voice_co_presence_pair_daily"."sessionCount" + EXCLUDED."sessionCount"
      `,
      params,
    );
  }

  /** 90일 초과 세션 삭제 */
  async deleteExpiredSessions(cutoffDate: Date): Promise<number> {
    const result = await this.sessionRepo
      .createQueryBuilder()
      .delete()
      .where('"endedAt" < :cutoff', { cutoff: cutoffDate })
      .execute();

    return result.affected ?? 0;
  }
}
