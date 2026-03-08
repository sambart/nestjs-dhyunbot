import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { VoiceDailyEntity } from '../domain/voice-daily.entity';
import { VoiceDailyFlushService } from './voice-daily-flush-service';

@Injectable()
export class VoiceStatsQueryService {
  private readonly logger = new Logger(VoiceStatsQueryService.name);

  constructor(
    @InjectRepository(VoiceDailyEntity)
    private readonly voiceDailyRepository: Repository<VoiceDailyEntity>,
    private readonly flushService: VoiceDailyFlushService,
  ) {}

  /** 활성 세션의 미누적 데이터를 DB에 반영 (실패 시 무시) */
  private async flushBeforeQuery(): Promise<void> {
    try {
      await this.flushService.safeFlushAll();
    } catch {
      this.logger.warn('Flush skipped (already in progress or failed)');
    }
  }

  async getUserVoiceStats(
    guildId: string,
    userId: string,
    days: number,
  ): Promise<{ totalSec: number; micOnSec: number; micOffSec: number }> {
    await this.flushBeforeQuery();
    const { start, end } = this.getDateRange(days);

    const channelResult = await this.voiceDailyRepository
      .createQueryBuilder('vd')
      .select('COALESCE(SUM(vd."channelDurationSec"), 0)', 'total')
      .where('vd."guildId" = :guildId', { guildId })
      .andWhere('vd."userId" = :userId', { userId })
      .andWhere('vd."channelId" != :global', { global: 'GLOBAL' })
      .andWhere('vd.date BETWEEN :start AND :end', { start, end })
      .getRawOne<{ total: string }>();

    const micResult = await this.voiceDailyRepository
      .createQueryBuilder('vd')
      .select('COALESCE(SUM(vd."micOnSec"), 0)', 'micOn')
      .addSelect('COALESCE(SUM(vd."micOffSec"), 0)', 'micOff')
      .where('vd."guildId" = :guildId', { guildId })
      .andWhere('vd."userId" = :userId', { userId })
      .andWhere('vd."channelId" = :global', { global: 'GLOBAL' })
      .andWhere('vd.date BETWEEN :start AND :end', { start, end })
      .getRawOne<{ micOn: string; micOff: string }>();

    return {
      totalSec: parseInt(channelResult?.total ?? '0', 10),
      micOnSec: parseInt(micResult?.micOn ?? '0', 10),
      micOffSec: parseInt(micResult?.micOff ?? '0', 10),
    };
  }

  async getGuildVoiceRank(
    guildId: string,
    days: number,
  ): Promise<
    Array<{
      userId: string;
      userName: string;
      totalSec: number;
      micOnSec: number;
      micOffSec: number;
    }>
  > {
    await this.flushBeforeQuery();
    const { start, end } = this.getDateRange(days);

    const rows = await this.voiceDailyRepository.query(
      `
      SELECT
        c."userId",
        c."userName",
        COALESCE(c.total, 0) AS "totalSec",
        COALESCE(g."micOnSec", 0) AS "micOnSec",
        COALESCE(g."micOffSec", 0) AS "micOffSec"
      FROM (
        SELECT "userId",
               MAX("userName") AS "userName",
               SUM("channelDurationSec") AS total
        FROM voice_daily
        WHERE "guildId" = $1 AND "channelId" != 'GLOBAL'
          AND "date" BETWEEN $2 AND $3
        GROUP BY "userId"
      ) c
      LEFT JOIN (
        SELECT "userId",
               SUM("micOnSec") AS "micOnSec",
               SUM("micOffSec") AS "micOffSec"
        FROM voice_daily
        WHERE "guildId" = $1 AND "channelId" = 'GLOBAL'
          AND "date" BETWEEN $2 AND $3
        GROUP BY "userId"
      ) g ON c."userId" = g."userId"
      ORDER BY "totalSec" DESC
      `,
      [guildId, start, end],
    );

    return rows.map(
      (row: {
        userId: string;
        userName: string;
        totalSec: string | number;
        micOnSec: string | number;
        micOffSec: string | number;
      }) => ({
        userId: row.userId,
        userName: row.userName,
        totalSec: parseInt(String(row.totalSec), 10),
        micOnSec: parseInt(String(row.micOnSec), 10),
        micOffSec: parseInt(String(row.micOffSec), 10),
      }),
    );
  }

  private getDateRange(days: number): { start: string; end: string } {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    const fmt = (d: Date) =>
      `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    return { start: fmt(start), end: fmt(end) };
  }
}
