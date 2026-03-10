import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { MocoHuntingDaily } from '../domain/moco-hunting-daily.entity';
import { MocoHuntingSession } from '../domain/moco-hunting-session.entity';

export interface DailyAggregates {
  totalChannelMinutes: number;
  totalSessionCount: number;
  totalUniqueNewbieCount: number;
  totalScore: number;
}

@Injectable()
export class MocoDbRepository {
  constructor(
    @InjectRepository(MocoHuntingSession)
    private readonly sessionRepo: Repository<MocoHuntingSession>,
    @InjectRepository(MocoHuntingDaily)
    private readonly dailyRepo: Repository<MocoHuntingDaily>,
  ) {}

  /** 모코코 사냥 세션 저장 */
  async saveSession(data: {
    guildId: string;
    hunterId: string;
    channelId: string;
    startedAt: Date;
    endedAt: Date | null;
    durationMin: number | null;
    newbieMemberIds: string[];
    isValid: boolean;
  }): Promise<MocoHuntingSession> {
    const session = this.sessionRepo.create(data);
    return this.sessionRepo.save(session);
  }

  /**
   * 일별 집계 upsert (INSERT ... ON CONFLICT DO UPDATE).
   * 델타 값을 기존 값에 누적하고, score를 가중치로 재계산한다.
   */
  async upsertDaily(
    guildId: string,
    hunterId: string,
    date: string,
    deltas: {
      channelMinutes: number;
      sessionCount: number;
      uniqueNewbieCount: number;
    },
    scoreWeights: {
      perSession: number;
      perMinute: number;
      perUnique: number;
    },
  ): Promise<void> {
    const tableName = this.dailyRepo.metadata.tableName;
    const schemaPrefix = this.dailyRepo.metadata.schema
      ? `"${this.dailyRepo.metadata.schema}".`
      : '';

    await this.dailyRepo.query(
      `
      INSERT INTO ${schemaPrefix}"${tableName}"
        ("guildId", "hunterId", "date", "channelMinutes", "sessionCount", "uniqueNewbieCount", "score")
      VALUES ($1, $2, $3, $4, $5, $6,
        ($5 * $7) + ($4 * $8) + ($6 * $9)
      )
      ON CONFLICT ("guildId", "hunterId", "date") DO UPDATE SET
        "channelMinutes"    = "${tableName}"."channelMinutes"    + EXCLUDED."channelMinutes",
        "sessionCount"      = "${tableName}"."sessionCount"      + EXCLUDED."sessionCount",
        "uniqueNewbieCount" = "${tableName}"."uniqueNewbieCount" + EXCLUDED."uniqueNewbieCount",
        "score" = (("${tableName}"."sessionCount" + EXCLUDED."sessionCount") * $7)
                + (("${tableName}"."channelMinutes" + EXCLUDED."channelMinutes") * $8)
                + (("${tableName}"."uniqueNewbieCount" + EXCLUDED."uniqueNewbieCount") * $9)
      `,
      [
        guildId,
        hunterId,
        date,
        deltas.channelMinutes,
        deltas.sessionCount,
        deltas.uniqueNewbieCount,
        scoreWeights.perSession,
        scoreWeights.perMinute,
        scoreWeights.perUnique,
      ],
    );
  }

  /**
   * 헌터의 일별 집계를 합산하여 반환.
   * fromDate가 주어지면 해당 날짜 이후 데이터만 포함한다.
   */
  async getDailyAggregates(
    guildId: string,
    hunterId: string,
    fromDate?: string,
  ): Promise<DailyAggregates> {
    const qb = this.dailyRepo
      .createQueryBuilder('d')
      .select('COALESCE(SUM(d.channelMinutes), 0)', 'totalChannelMinutes')
      .addSelect('COALESCE(SUM(d.sessionCount), 0)', 'totalSessionCount')
      .addSelect('COALESCE(SUM(d.uniqueNewbieCount), 0)', 'totalUniqueNewbieCount')
      .addSelect('COALESCE(SUM(d.score), 0)', 'totalScore')
      .where('d.guildId = :guildId', { guildId })
      .andWhere('d.hunterId = :hunterId', { hunterId });

    if (fromDate) {
      qb.andWhere('d.date >= :fromDate', { fromDate });
    }

    const raw = await qb.getRawOne<{
      totalChannelMinutes: string;
      totalSessionCount: string;
      totalUniqueNewbieCount: string;
      totalScore: string;
    }>();

    return {
      totalChannelMinutes: parseInt(raw?.totalChannelMinutes ?? '0', 10),
      totalSessionCount: parseInt(raw?.totalSessionCount ?? '0', 10),
      totalUniqueNewbieCount: parseInt(raw?.totalUniqueNewbieCount ?? '0', 10),
      totalScore: parseInt(raw?.totalScore ?? '0', 10),
    };
  }

  /**
   * 헌터의 신입별 유효 세션 횟수 조회.
   * newbieMemberIds JSON 배열을 unnest하여 그룹핑한다.
   * Returns: Record<string, number> (newbieId → session count)
   */
  async getSessionCountByHunterAndNewbie(
    guildId: string,
    hunterId: string,
  ): Promise<Record<string, number>> {
    const tableName = this.sessionRepo.metadata.tableName;
    const schemaPrefix = this.sessionRepo.metadata.schema
      ? `"${this.sessionRepo.metadata.schema}".`
      : '';

    const rows = await this.sessionRepo.query(
      `
      SELECT newbie_id, COUNT(*)::int AS session_count
      FROM ${schemaPrefix}"${tableName}",
           json_array_elements_text("newbieMemberIds") AS newbie_id
      WHERE "guildId" = $1
        AND "hunterId" = $2
        AND "isValid" = true
      GROUP BY newbie_id
      `,
      [guildId, hunterId],
    );

    const result: Record<string, number> = {};
    for (const row of rows as { newbie_id: string; session_count: number }[]) {
      result[row.newbie_id] = row.session_count;
    }
    return result;
  }
}
