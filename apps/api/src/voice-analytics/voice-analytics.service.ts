import { VoiceActivityData } from '@dhyunbot/shared';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Not, Repository } from 'typeorm';

import { VoiceDailyEntity } from '../channel/voice/domain/voice-daily.entity';
import { DiscordGateway } from '../gateway/discord.gateway';
import { UserAggregateData, VoiceNameEnricherService } from './voice-name-enricher.service';

export { VoiceActivityData } from '@dhyunbot/shared';

interface ChannelAggregate {
  channelId: string;
  channelName: string | null;
  totalVoiceTime: number;
  uniqueUsers: Set<string>;
  sessionCount: number;
}

interface DailyAggregate {
  date: string;
  totalVoiceTime: number;
  activeUsers: Set<string>;
  totalMicOnTime: number;
}

@Injectable()
export class VoiceAnalyticsService {
  private readonly logger = new Logger(VoiceAnalyticsService.name);

  constructor(
    @InjectRepository(VoiceDailyEntity)
    private voiceDailyRepo: Repository<VoiceDailyEntity>,
    private discordGateway: DiscordGateway,
    private nameEnricher: VoiceNameEnricherService,
  ) {}

  async collectVoiceActivityData(
    guildId: string,
    startDate: string,
    endDate: string,
  ): Promise<VoiceActivityData> {
    try {
      this.logger.log(`Collecting voice data for guild ${guildId} from ${startDate} to ${endDate}`);

      const globalData = await this.voiceDailyRepo.find({
        where: { guildId, channelId: 'GLOBAL', date: Between(startDate, endDate) },
        order: { date: 'ASC' },
      });

      const channelData = await this.voiceDailyRepo.find({
        where: { guildId, channelId: Not('GLOBAL'), date: Between(startDate, endDate) },
        order: { date: 'ASC' },
      });

      if (globalData.length === 0 && channelData.length === 0) {
        this.logger.warn(`No voice data found for guild ${guildId}`);
        return await this.createEmptyResponse(guildId, startDate, endDate);
      }

      const totalStats = this.calculateTotalStatsFromGlobal(globalData);
      const userActivities = await this.aggregateUserActivities(guildId, globalData, channelData);
      const channelStats = await this.aggregateChannelStats(guildId, channelData);
      const dailyTrends = this.aggregateDailyTrends(globalData, channelData);
      const guildName = await this.discordGateway.getGuildName(guildId);

      return {
        guildId,
        guildName,
        timeRange: { start: startDate, end: endDate },
        totalStats,
        userActivities,
        channelStats,
        dailyTrends,
      };
    } catch (error) {
      this.logger.error('Failed to collect voice activity data', (error as Error).stack);
      throw error;
    }
  }

  private calculateTotalStatsFromGlobal(globalData: VoiceDailyEntity[]) {
    const uniqueUsers = new Set<string>();
    let totalVoiceTime = 0;
    let totalMicOnTime = 0;
    const dailyActiveUsers = new Map<string, Set<string>>();

    globalData.forEach((record) => {
      uniqueUsers.add(record.userId);
      totalVoiceTime += record.channelDurationSec;
      totalMicOnTime += record.micOnSec;

      if (!dailyActiveUsers.has(record.date)) {
        dailyActiveUsers.set(record.date, new Set());
      }
      dailyActiveUsers.get(record.date)?.add(record.userId);
    });

    const avgDailyActiveUsers =
      dailyActiveUsers.size > 0
        ? Array.from(dailyActiveUsers.values()).reduce((sum, users) => sum + users.size, 0) /
          dailyActiveUsers.size
        : 0;

    return {
      totalUsers: uniqueUsers.size,
      totalVoiceTime: Math.round(totalVoiceTime),
      totalMicOnTime: Math.round(totalMicOnTime),
      avgDailyActiveUsers: Math.round(avgDailyActiveUsers * 10) / 10,
    };
  }

  // eslint-disable-next-line max-lines-per-function
  private async aggregateUserActivities(
    guildId: string,
    globalData: VoiceDailyEntity[],
    channelData: VoiceDailyEntity[],
  ) {
    const userMap = new Map<string, UserAggregateData>();

    globalData.forEach((record) => {
      if (!userMap.has(record.userId)) {
        userMap.set(record.userId, {
          userId: record.userId,
          username: record.userName || null,
          totalVoiceTime: 0,
          totalMicOnTime: 0,
          totalMicOffTime: 0,
          aloneTime: 0,
          channelMap: new Map<string, { name: string; duration: number }>(),
          activeDaysSet: new Set<string>(),
        });
      }

      const user = userMap.get(record.userId);
      if (user) {
        user.totalMicOnTime += record.micOnSec || 0;
        user.totalMicOffTime += record.micOffSec || 0;
        user.aloneTime += record.aloneSec || 0;
        user.activeDaysSet.add(record.date);
      }
    });

    channelData.forEach((record) => {
      if (!userMap.has(record.userId)) {
        userMap.set(record.userId, {
          userId: record.userId,
          username: record.userName || null,
          totalVoiceTime: 0,
          totalMicOnTime: 0,
          totalMicOffTime: 0,
          aloneTime: 0,
          channelMap: new Map<string, { name: string; duration: number }>(),
          activeDaysSet: new Set<string>(),
        });
      }

      const user = userMap.get(record.userId);
      if (user) {
        user.totalVoiceTime += record.channelDurationSec || 0;
        user.activeDaysSet.add(record.date);

        const current = user.channelMap.get(record.channelId) ?? {
          name: record.channelName || '',
          duration: 0,
        };
        current.duration += record.channelDurationSec || 0;
        if (record.channelName) {
          current.name = record.channelName;
        }
        user.channelMap.set(record.channelId, current);
      }
    });

    await this.nameEnricher.enrichUserNames(guildId, userMap);
    await this.nameEnricher.enrichChannelNames(guildId, userMap);

    return Array.from(userMap.values())
      .map((user) => {
        const activeDays = user.activeDaysSet.size;
        const avgDailyVoiceTime = activeDays > 0 ? user.totalVoiceTime / activeDays : 0;
        const micUsageRate =
          user.totalVoiceTime > 0 ? (user.totalMicOnTime / user.totalVoiceTime) * 100 : 0;

        const activeChannels = Array.from(user.channelMap.entries())
          .map(([channelId, info]) => ({
            channelId,
            channelName: info.name || `Channel-${channelId.slice(0, 6)}`,
            duration: Math.round(info.duration),
          }))
          .sort((a, b) => b.duration - a.duration);

        return {
          userId: user.userId,
          username: user.username || `User-${user.userId.slice(0, 6)}`,
          totalVoiceTime: Math.round(user.totalVoiceTime),
          totalMicOnTime: Math.round(user.totalMicOnTime),
          totalMicOffTime: Math.round(user.totalMicOffTime),
          aloneTime: Math.round(user.aloneTime),
          activeChannels,
          activeDays,
          avgDailyVoiceTime: Math.round(avgDailyVoiceTime),
          micUsageRate: Math.round(micUsageRate * 10) / 10,
        };
      })
      .sort((a, b) => b.totalVoiceTime - a.totalVoiceTime);
  }

  private async aggregateChannelStats(guildId: string, channelData: VoiceDailyEntity[]) {
    const channelMap = new Map<string, ChannelAggregate>();

    channelData.forEach((record) => {
      if (!channelMap.has(record.channelId)) {
        channelMap.set(record.channelId, {
          channelId: record.channelId,
          channelName: record.channelName || null,
          totalVoiceTime: 0,
          uniqueUsers: new Set<string>(),
          sessionCount: 0,
        });
      }

      const channel = channelMap.get(record.channelId);
      if (channel) {
        channel.totalVoiceTime += record.channelDurationSec || 0;
        channel.uniqueUsers.add(record.userId);
        channel.sessionCount++;
      }
    });

    await this.nameEnricher.enrichChannelStatsNames(guildId, channelMap);

    return Array.from(channelMap.values())
      .map((channel) => ({
        channelId: channel.channelId,
        channelName: channel.channelName || `Channel-${channel.channelId.slice(0, 6)}`,
        totalVoiceTime: Math.round(channel.totalVoiceTime),
        uniqueUsers: channel.uniqueUsers.size,
        avgSessionDuration: Math.round(channel.totalVoiceTime / channel.sessionCount),
      }))
      .sort((a, b) => b.totalVoiceTime - a.totalVoiceTime);
  }

  private aggregateDailyTrends(globalData: VoiceDailyEntity[], channelData: VoiceDailyEntity[]) {
    const dailyMap = new Map<string, DailyAggregate>();

    globalData.forEach((record) => {
      if (!dailyMap.has(record.date)) {
        dailyMap.set(record.date, {
          date: record.date,
          totalVoiceTime: 0,
          activeUsers: new Set<string>(),
          totalMicOnTime: 0,
        });
      }

      const daily = dailyMap.get(record.date);
      if (daily) {
        daily.totalMicOnTime += record.micOnSec || 0;
        daily.activeUsers.add(record.userId);
      }
    });

    channelData.forEach((record) => {
      if (!dailyMap.has(record.date)) {
        dailyMap.set(record.date, {
          date: record.date,
          totalVoiceTime: 0,
          activeUsers: new Set<string>(),
          totalMicOnTime: 0,
        });
      }

      const daily = dailyMap.get(record.date);
      if (daily) {
        daily.totalVoiceTime += record.channelDurationSec || 0;
        daily.activeUsers.add(record.userId);
      }
    });

    return Array.from(dailyMap.values())
      .map((daily) => ({
        date: daily.date,
        totalVoiceTime: Math.round(daily.totalVoiceTime),
        activeUsers: daily.activeUsers.size,
        avgMicUsage:
          daily.totalVoiceTime > 0
            ? Math.round((daily.totalMicOnTime / daily.totalVoiceTime) * 100 * 10) / 10
            : 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  private async createEmptyResponse(
    guildId: string,
    startDate: string,
    endDate: string,
  ): Promise<VoiceActivityData> {
    const guildName = await this.discordGateway.getGuildName(guildId);

    return {
      guildId,
      guildName,
      timeRange: { start: startDate, end: endDate },
      totalStats: {
        totalUsers: 0,
        totalVoiceTime: 0,
        totalMicOnTime: 0,
        avgDailyActiveUsers: 0,
      },
      userActivities: [],
      channelStats: [],
      dailyTrends: [],
    };
  }

  static getDateRange(days: number): { start: string; end: string } {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);

    const formatDate = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}${month}${day}`;
    };

    return {
      start: formatDate(start),
      end: formatDate(end),
    };
  }
}
