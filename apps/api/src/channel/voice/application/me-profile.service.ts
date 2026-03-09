import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { VoiceDailyEntity } from '../domain/voice-daily.entity';
import { VoiceDailyFlushService } from './voice-daily-flush-service';

export interface MeProfileData {
  rank: number;
  totalUsers: number;
  totalSec: number;
  activeDays: number;
  avgDailySec: number;
  micOnSec: number;
  micOffSec: number;
  micUsageRate: number;
  aloneSec: number;
  topChannels: TopChannel[];
  dailyChart: DailyChartEntry[];
  peakDayOfWeek: string | null;
  weeklyAvgSec: number;
}

export interface TopChannel {
  channelId: string;
  channelName: string;
  categoryName: string | null;
  durationSec: number;
}

export interface DailyChartEntry {
  date: string; // YYYYMMDD
  durationSec: number;
}

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

@Injectable()
export class MeProfileService {
  private readonly logger = new Logger(MeProfileService.name);

  constructor(
    @InjectRepository(VoiceDailyEntity)
    private readonly voiceDailyRepo: Repository<VoiceDailyEntity>,
    private readonly flushService: VoiceDailyFlushService,
  ) {}

  async getProfile(guildId: string, userId: string, days: number): Promise<MeProfileData | null> {
    await this.safeFlush();

    const { start, end } = this.getDateRange(days);

    const [globalStats, channelRecords, rankInfo, dailyChart] = await Promise.all([
      this.getGlobalStats(guildId, userId, start, end),
      this.getChannelRecords(guildId, userId, start, end),
      this.getRankInfo(guildId, userId, start, end),
      this.getDailyChart(guildId, userId),
    ]);

    const totalSec = channelRecords.reduce((sum, r) => sum + r.durationSec, 0);

    if (totalSec === 0 && globalStats.micOnSec === 0 && globalStats.micOffSec === 0) {
      return null;
    }

    const activeDays = globalStats.activeDays;
    const avgDailySec = activeDays > 0 ? Math.round(totalSec / activeDays) : 0;
    const micUsageRate = totalSec > 0 ? Math.round((globalStats.micOnSec / totalSec) * 1000) / 10 : 0;

    const topChannels = this.aggregateTopChannels(channelRecords);
    const { peakDayOfWeek, weeklyAvgSec } = this.calculatePeakDay(dailyChart);

    return {
      rank: rankInfo.rank,
      totalUsers: rankInfo.totalUsers,
      totalSec,
      activeDays,
      avgDailySec,
      micOnSec: globalStats.micOnSec,
      micOffSec: globalStats.micOffSec,
      micUsageRate,
      aloneSec: globalStats.aloneSec,
      topChannels,
      dailyChart,
      peakDayOfWeek,
      weeklyAvgSec,
    };
  }

  private async getGlobalStats(
    guildId: string,
    userId: string,
    start: string,
    end: string,
  ): Promise<{ micOnSec: number; micOffSec: number; aloneSec: number; activeDays: number }> {
    const result = await this.voiceDailyRepo
      .createQueryBuilder('vd')
      .select('COALESCE(SUM(vd."micOnSec"), 0)', 'micOn')
      .addSelect('COALESCE(SUM(vd."micOffSec"), 0)', 'micOff')
      .addSelect('COALESCE(SUM(vd."aloneSec"), 0)', 'alone')
      .addSelect('COUNT(DISTINCT vd.date)', 'days')
      .where('vd."guildId" = :guildId', { guildId })
      .andWhere('vd."userId" = :userId', { userId })
      .andWhere('vd."channelId" = :global', { global: 'GLOBAL' })
      .andWhere('vd.date BETWEEN :start AND :end', { start, end })
      .getRawOne<{ micOn: string; micOff: string; alone: string; days: string }>();

    return {
      micOnSec: parseInt(result?.micOn ?? '0', 10),
      micOffSec: parseInt(result?.micOff ?? '0', 10),
      aloneSec: parseInt(result?.alone ?? '0', 10),
      activeDays: parseInt(result?.days ?? '0', 10),
    };
  }

  private async getChannelRecords(
    guildId: string,
    userId: string,
    start: string,
    end: string,
  ): Promise<Array<{ channelId: string; channelName: string; categoryName: string | null; durationSec: number }>> {
    const rows = await this.voiceDailyRepo
      .createQueryBuilder('vd')
      .select('vd."channelId"', 'channelId')
      .addSelect('MAX(vd."channelName")', 'channelName')
      .addSelect('MAX(vd."categoryName")', 'categoryName')
      .addSelect('SUM(vd."channelDurationSec")', 'duration')
      .where('vd."guildId" = :guildId', { guildId })
      .andWhere('vd."userId" = :userId', { userId })
      .andWhere('vd."channelId" != :global', { global: 'GLOBAL' })
      .andWhere('vd.date BETWEEN :start AND :end', { start, end })
      .groupBy('vd."channelId"')
      .getRawMany<{ channelId: string; channelName: string; categoryName: string | null; duration: string }>();

    return rows.map((r) => ({
      channelId: r.channelId,
      channelName: r.channelName || `Channel-${r.channelId.slice(0, 6)}`,
      categoryName: r.categoryName || null,
      durationSec: parseInt(r.duration ?? '0', 10),
    }));
  }

  private async getRankInfo(
    guildId: string,
    userId: string,
    start: string,
    end: string,
  ): Promise<{ rank: number; totalUsers: number }> {
    const rows = await this.voiceDailyRepo.query(
      `
      WITH user_totals AS (
        SELECT "userId", SUM("channelDurationSec") AS total
        FROM voice_daily
        WHERE "guildId" = $1 AND "channelId" != 'GLOBAL'
          AND "date" BETWEEN $2 AND $3
        GROUP BY "userId"
      )
      SELECT
        (SELECT COUNT(*) FROM user_totals WHERE total > COALESCE((SELECT total FROM user_totals WHERE "userId" = $4), 0)) + 1 AS rank,
        (SELECT COUNT(*) FROM user_totals) AS "totalUsers"
      `,
      [guildId, start, end, userId],
    );

    const row = rows[0];
    return {
      rank: parseInt(String(row?.rank ?? '0'), 10),
      totalUsers: parseInt(String(row?.totalUsers ?? '0'), 10),
    };
  }

  private async getDailyChart(guildId: string, userId: string): Promise<DailyChartEntry[]> {
    const { start, end } = this.getDateRange(15);

    const rows = await this.voiceDailyRepo
      .createQueryBuilder('vd')
      .select('vd.date', 'date')
      .addSelect('SUM(vd."channelDurationSec")', 'duration')
      .where('vd."guildId" = :guildId', { guildId })
      .andWhere('vd."userId" = :userId', { userId })
      .andWhere('vd."channelId" != :global', { global: 'GLOBAL' })
      .andWhere('vd.date BETWEEN :start AND :end', { start, end })
      .groupBy('vd.date')
      .orderBy('vd.date', 'ASC')
      .getRawMany<{ date: string; duration: string }>();

    const dataMap = new Map(rows.map((r) => [r.date, parseInt(r.duration ?? '0', 10)]));

    const result: DailyChartEntry[] = [];
    const cursor = new Date();
    cursor.setDate(cursor.getDate() - 14);
    for (let i = 0; i < 15; i++) {
      const dateStr = this.formatDate(cursor);
      result.push({ date: dateStr, durationSec: dataMap.get(dateStr) ?? 0 });
      cursor.setDate(cursor.getDate() + 1);
    }

    return result;
  }

  private aggregateTopChannels(
    records: Array<{ channelId: string; channelName: string; categoryName: string | null; durationSec: number }>,
  ): TopChannel[] {
    return records
      .sort((a, b) => b.durationSec - a.durationSec)
      .slice(0, 5)
      .map((r) => ({
        channelId: r.channelId,
        channelName: r.channelName,
        categoryName: r.categoryName,
        durationSec: r.durationSec,
      }));
  }

  private calculatePeakDay(dailyChart: DailyChartEntry[]): {
    peakDayOfWeek: string | null;
    weeklyAvgSec: number;
  } {
    const totalSec = dailyChart.reduce((sum, d) => sum + d.durationSec, 0);
    const weeks = 15 / 7;
    const weeklyAvgSec = Math.round(totalSec / weeks);

    const dayOfWeekTotals = new Array<number>(7).fill(0);
    for (const entry of dailyChart) {
      if (entry.durationSec > 0) {
        const date = this.parseDate(entry.date);
        dayOfWeekTotals[date.getDay()] += entry.durationSec;
      }
    }

    const maxIdx = dayOfWeekTotals.indexOf(Math.max(...dayOfWeekTotals));
    const peakDayOfWeek = dayOfWeekTotals[maxIdx] > 0 ? DAY_NAMES[maxIdx] : null;

    return { peakDayOfWeek, weeklyAvgSec };
  }

  private parseDate(yyyymmdd: string): Date {
    const y = parseInt(yyyymmdd.slice(0, 4), 10);
    const m = parseInt(yyyymmdd.slice(4, 6), 10) - 1;
    const d = parseInt(yyyymmdd.slice(6, 8), 10);
    return new Date(y, m, d);
  }

  private getDateRange(days: number): { start: string; end: string } {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    return { start: this.formatDate(start), end: this.formatDate(end) };
  }

  private formatDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}${m}${d}`;
  }

  private async safeFlush(): Promise<void> {
    try {
      await this.flushService.safeFlushAll();
    } catch {
      this.logger.warn('Flush skipped (already in progress or failed)');
    }
  }
}
