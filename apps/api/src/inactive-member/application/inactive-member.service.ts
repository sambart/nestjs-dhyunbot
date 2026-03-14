import { getKSTDateString } from '@dhyunbot/shared';
import { InjectDiscordClient } from '@discord-nestjs/core';
import { Injectable, Logger } from '@nestjs/common';
import { Client, Collection, type Guild, type GuildMember } from 'discord.js';

import { VoiceDailyFlushService } from '../../channel/voice/application/voice-daily-flush-service';
import { InactiveMemberConfig } from '../domain/inactive-member-config.entity';
import { InactiveMemberGrade, InactiveMemberRecord } from '../domain/inactive-member-record.entity';
import {
  InactiveMemberRepository,
  type UpsertRecordData,
} from '../infrastructure/inactive-member.repository';
import {
  InactiveMemberQueryRepository,
  type TrendEntry,
} from '../infrastructure/inactive-member-query.repository';

const SEC_PER_MIN = 60;

export interface InactiveStats {
  totalMembers: number;
  activeCount: number;
  fullyInactiveCount: number;
  lowActiveCount: number;
  decliningCount: number;
  returnedCount: number;
  trend: TrendEntry[];
}

@Injectable()
export class InactiveMemberService {
  private readonly logger = new Logger(InactiveMemberService.name);

  constructor(
    private readonly repo: InactiveMemberRepository,
    private readonly queryRepo: InactiveMemberQueryRepository,
    private readonly flushService: VoiceDailyFlushService,
    @InjectDiscordClient() private readonly discord: Client,
  ) {}

  async getOrCreateConfig(guildId: string): Promise<InactiveMemberConfig> {
    const config = await this.repo.findConfigByGuildId(guildId);
    return config ?? this.repo.createDefaultConfig(guildId);
  }

  async classifyGuild(guildId: string): Promise<InactiveMemberRecord[]> {
    // 활성 세션의 미누적 데이터를 DB에 반영 (실패 시 무시)
    try {
      await this.flushService.safeFlushAll();
    } catch {
      this.logger.warn('[INACTIVE] Flush skipped (already in progress or failed)');
    }

    const config = await this.getOrCreateConfig(guildId);

    const { fromDate, toDate, prevFromDate, prevToDate } = this.buildDateRanges(config.periodDays);

    const guild = this.discord.guilds.cache.get(guildId);
    if (!guild) {
      this.logger.warn(`[INACTIVE] Guild not found in cache: ${guildId}`);
      return [];
    }
    // 전체 길드 멤버를 API로 가져옴 (캐시에는 봇이 "본" 멤버만 존재)
    // Gateway rate limit(opcode 8) 발생 시 재시도
    const members = await this.fetchMembersWithRetry(guild);

    const targetMembers = members.filter(
      (m: GuildMember) =>
        !m.user.bot && !config.excludedRoleIds.some((roleId) => m.roles.cache.has(roleId)),
    );

    const [currentMap, prevMap, lastVoiceDateMap] = await Promise.all([
      this.queryRepo.sumVoiceDurationByUser(guildId, fromDate, toDate),
      this.queryRepo.sumVoiceDurationByUser(guildId, prevFromDate, prevToDate),
      this.queryRepo.findLastVoiceDateByUser(guildId, prevFromDate),
    ]);

    const classifiedAt = new Date();
    const records: UpsertRecordData[] = [];

    for (const [, member] of targetMembers) {
      const userId = member.user.id;
      const totalSec = currentMap.get(userId) ?? 0;
      const totalMinutes = Math.floor(totalSec / SEC_PER_MIN);
      const prevTotalSec = prevMap.get(userId) ?? 0;
      const prevTotalMinutes = Math.floor(prevTotalSec / SEC_PER_MIN);
      const lastVoiceDate = lastVoiceDateMap.get(userId) ?? null;

      const grade = this.determineGrade(totalMinutes, prevTotalMinutes, config);

      records.push({
        guildId,
        userId,
        grade,
        totalMinutes,
        prevTotalMinutes,
        lastVoiceDate,
        classifiedAt,
      });
    }

    await this.repo.batchUpsertRecords(records);

    this.logger.log(`[INACTIVE] Classified guild=${guildId} members=${records.length}`);

    // 갱신된 레코드를 메모리에서 구성해 반환 (batchUpsert는 RETURNING 미지원)
    return records.map((r) => {
      const record = new InactiveMemberRecord();
      record.guildId = r.guildId;
      record.userId = r.userId;
      record.grade = r.grade as InactiveMemberGrade | null;
      record.totalMinutes = r.totalMinutes;
      record.prevTotalMinutes = r.prevTotalMinutes;
      record.lastVoiceDate = r.lastVoiceDate;
      record.classifiedAt = r.classifiedAt;
      return record;
    });
  }

  async getStats(guildId: string): Promise<InactiveStats> {
    const [gradeStats, returnedCount, trend] = await Promise.all([
      this.queryRepo.countByGrade(guildId),
      this.queryRepo.findReturnedCount(guildId),
      this.queryRepo.findTrend(guildId),
    ]);

    const inactiveTotal =
      gradeStats.fullyInactiveCount + gradeStats.lowActiveCount + gradeStats.decliningCount;

    // 분류 대상 전체 수 (봇, 제외 역할 미포함)
    const totalMembers = gradeStats.totalClassified;

    return {
      totalMembers,
      activeCount: totalMembers - inactiveTotal,
      fullyInactiveCount: gradeStats.fullyInactiveCount,
      lowActiveCount: gradeStats.lowActiveCount,
      decliningCount: gradeStats.decliningCount,
      returnedCount,
      trend,
    };
  }

  private determineGrade(
    totalMinutes: number,
    prevTotalMinutes: number,
    config: InactiveMemberConfig,
  ): InactiveMemberGrade | null {
    if (totalMinutes === 0) return InactiveMemberGrade.FULLY_INACTIVE;

    if (totalMinutes < config.lowActiveThresholdMin) {
      return InactiveMemberGrade.LOW_ACTIVE;
    }

    if (prevTotalMinutes > 0) {
      const declineRatio = ((prevTotalMinutes - totalMinutes) / prevTotalMinutes) * 100;
      if (declineRatio >= config.decliningPercent) {
        return InactiveMemberGrade.DECLINING;
      }
    }

    return null;
  }

  private buildDateRanges(periodDays: number): {
    fromDate: string;
    toDate: string;
    prevFromDate: string;
    prevToDate: string;
  } {
    // KST 기준 오늘 날짜 (오늘 포함)
    const toDate = getKSTDateString();

    const toDateObj = this.parseYyyymmdd(toDate);
    const fromDateObj = new Date(toDateObj);
    fromDateObj.setDate(fromDateObj.getDate() - periodDays + 1);
    const fromDate = this.formatYyyymmdd(fromDateObj);

    const prevToDateObj = new Date(fromDateObj);
    prevToDateObj.setDate(prevToDateObj.getDate() - 1);
    const prevToDate = this.formatYyyymmdd(prevToDateObj);

    const prevFromDateObj = new Date(prevToDateObj);
    prevFromDateObj.setDate(prevFromDateObj.getDate() - periodDays + 1);
    const prevFromDate = this.formatYyyymmdd(prevFromDateObj);

    return { fromDate, toDate, prevFromDate, prevToDate };
  }

  private formatYyyymmdd(date: Date): string {
    return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  }

  private parseYyyymmdd(dateStr: string): Date {
    const year = parseInt(dateStr.slice(0, 4), 10);
    const month = parseInt(dateStr.slice(4, 6), 10) - 1;
    const day = parseInt(dateStr.slice(6, 8), 10);
    return new Date(year, month, day);
  }

  /**
   * Gateway rate limit(opcode 8) 발생 시 재시도하여 길드 멤버를 가져온다.
   */
  private async fetchMembersWithRetry(
    guild: Guild,
    maxRetries = 3,
  ): Promise<Collection<string, GuildMember>> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await guild.members.fetch();
      } catch (err) {
        const isRateLimit =
          err instanceof Error && err.constructor.name === 'GatewayRateLimitError';

        if (!isRateLimit || attempt === maxRetries) throw err;

        const retryAfterMs = this.extractRetryAfter(err) ?? 25_000;
        this.logger.warn(
          `[INACTIVE] Gateway rate limit hit (attempt ${attempt}/${maxRetries}), retrying after ${retryAfterMs}ms`,
        );
        await this.sleep(retryAfterMs);
      }
    }

    return guild.members.fetch();
  }

  private extractRetryAfter(err: Error): number | null {
    const match = err.message.match(/Retry after ([\d.]+)/);
    if (!match) return null;
    return Math.ceil(parseFloat(match[1]) * 1000) + 1000;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
