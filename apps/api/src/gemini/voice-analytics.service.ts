import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThanOrEqual } from 'typeorm';
import { InjectDiscordClient } from '@discord-nestjs/core';
import { Client, Guild } from 'discord.js';
import { VoiceDailyEntity } from 'src/channel/voice/domain/voice-daily-entity';

export interface VoiceActivityData {
  guildId: string;
  guildName: string;
  timeRange: {
    start: string; // YYYYMMDD
    end: string; // YYYYMMDD
  };
  totalStats: {
    totalUsers: number;
    totalVoiceTime: number;
    totalMicOnTime: number;
    avgDailyActiveUsers: number;
  };
  userActivities: Array<{
    userId: string;
    username: string;
    totalVoiceTime: number;
    totalMicOnTime: number;
    totalMicOffTime: number;
    aloneTime: number;
    activeChannels: Array<{
      channelId: string;
      channelName: string;
      duration: number;
    }>;
    activeDays: number;
    avgDailyVoiceTime: number;
    micUsageRate: number; // 마이크 사용 비율 (%)
  }>;
  channelStats: Array<{
    channelId: string;
    channelName: string;
    totalVoiceTime: number;
    uniqueUsers: number;
    avgSessionDuration: number;
  }>;
  dailyTrends: Array<{
    date: string;
    totalVoiceTime: number;
    activeUsers: number;
    avgMicUsage: number;
  }>;
}

@Injectable()
export class VoiceAnalyticsService {
  private readonly logger = new Logger(VoiceAnalyticsService.name);

  constructor(
    @InjectRepository(VoiceDailyEntity)
    private voiceDailyRepo: Repository<VoiceDailyEntity>,
    @InjectDiscordClient()
    private readonly client: Client,
  ) {}

  /**
   * 서버의 음성 활동 데이터를 수집하여 Gemini에 전달할 JSON 형식으로 변환
   */
  async collectVoiceActivityData(
    guildId: string,
    startDate: string, // YYYYMMDD
    endDate: string, // YYYYMMDD
  ): Promise<VoiceActivityData> {
    try {
      this.logger.log(`Collecting voice data for guild ${guildId} from ${startDate} to ${endDate}`);

      // 1. 기간 내 모든 음성 데이터 조회
      const voiceData = await this.voiceDailyRepo.find({
        where: {
          guildId,
          date: Between(startDate, endDate),
        },
        order: {
          date: 'ASC',
        },
      });

      if (voiceData.length === 0) {
        this.logger.warn(`No voice data found for guild ${guildId}`);
        return this.createEmptyResponse(guildId, startDate, endDate);
      }

      // 2. 전체 통계 계산
      const totalStats = this.calculateTotalStats(voiceData, startDate, endDate);

      // 3. 유저별 활동 집계
      const userActivities = await this.aggregateUserActivities(guildId, voiceData);

      // 4. 채널별 통계 집계
      const channelStats = await this.aggregateChannelStats(guildId, voiceData);

      // 5. 일별 트렌드 집계
      const dailyTrends = this.aggregateDailyTrends(voiceData);

      // 6. 길드 이름 가져오기 (Discord.js Client에서)
      const guildName = await this.getGuildName(guildId);

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
      this.logger.error('Failed to collect voice activity data', error.stack);
      throw error;
    }
  }

  /**
   * 전체 통계 계산
   */
  private calculateTotalStats(voiceData: VoiceDailyEntity[], startDate: string, endDate: string) {
    const uniqueUsers = new Set(voiceData.map((v) => v.userId));
    const totalVoiceTime = voiceData.reduce((sum, v) => sum + v.channelDurationSec, 0);
    const totalMicOnTime = voiceData.reduce((sum, v) => sum + v.micOnSec, 0);

    // 일별 활성 유저 수 계산
    const dailyActiveUsers = new Map<string, Set<string>>();
    voiceData.forEach((v) => {
      if (!dailyActiveUsers.has(v.date)) {
        dailyActiveUsers.set(v.date, new Set());
      }
      dailyActiveUsers.get(v.date).add(v.userId);
    });

    const avgDailyActiveUsers =
      Array.from(dailyActiveUsers.values()).reduce((sum, users) => sum + users.size, 0) /
      dailyActiveUsers.size;

    return {
      totalUsers: uniqueUsers.size,
      totalVoiceTime: Math.round(totalVoiceTime),
      totalMicOnTime: Math.round(totalMicOnTime),
      avgDailyActiveUsers: Math.round(avgDailyActiveUsers * 10) / 10,
    };
  }

  /**
   * 유저별 활동 집계
   */
  private async aggregateUserActivities(guildId: string, voiceData: VoiceDailyEntity[]) {
    const userMap = new Map<string, any>();

    voiceData.forEach((record) => {
      if (!userMap.has(record.userId)) {
        userMap.set(record.userId, {
          userId: record.userId,
          username: record.userId, // 일단 ID로 초기화
          totalVoiceTime: 0,
          totalMicOnTime: 0,
          totalMicOffTime: 0,
          aloneTime: 0,
          channelMap: new Map<string, number>(),
          activeDaysSet: new Set<string>(),
        });
      }

      const user = userMap.get(record.userId);
      user.totalVoiceTime += record.channelDurationSec;
      user.totalMicOnTime += record.micOnSec;
      user.totalMicOffTime += record.micOffSec;
      user.aloneTime += record.aloneSec;
      user.activeDaysSet.add(record.date);

      // 채널별 시간 집계
      const currentChannelTime = user.channelMap.get(record.channelId) || 0;
      user.channelMap.set(record.channelId, currentChannelTime + record.channelDurationSec);
    });

    // Map을 배열로 변환하고 정렬
    const userActivities = Array.from(userMap.values())
      .map((user) => {
        const activeDays = user.activeDaysSet.size;
        const avgDailyVoiceTime = activeDays > 0 ? user.totalVoiceTime / activeDays : 0;
        const micUsageRate =
          user.totalVoiceTime > 0 ? (user.totalMicOnTime / user.totalVoiceTime) * 100 : 0;

        // 채널별 활동 정리
        const activeChannels = Array.from(user.channelMap.entries())
          .map(([channelId, duration]) => ({
            channelId,
            channelName: channelId, // 일단 ID로 초기화
            duration: Math.round(duration),
          }))
          .sort((a, b) => b.duration - a.duration);

        return {
          userId: user.userId,
          username: user.username,
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

    // Discord에서 유저명과 채널명 매핑 (여기서 실제로 호출!)
    return await this.enrichWithDiscordData(guildId, userActivities);
  }

  /**
   * 채널별 통계 집계
   */
  private async aggregateChannelStats(guildId: string, voiceData: VoiceDailyEntity[]) {
    const channelMap = new Map<string, any>();

    voiceData.forEach((record) => {
      if (!channelMap.has(record.channelId)) {
        channelMap.set(record.channelId, {
          channelId: record.channelId,
          channelName: record.channelId, // 일단 ID로 초기화
          totalVoiceTime: 0,
          uniqueUsers: new Set<string>(),
          sessionCount: 0,
        });
      }

      const channel = channelMap.get(record.channelId);
      channel.totalVoiceTime += record.channelDurationSec;
      channel.uniqueUsers.add(record.userId);
      channel.sessionCount++;
    });

    const channelStats = Array.from(channelMap.values())
      .map((channel) => ({
        channelId: channel.channelId,
        channelName: channel.channelName,
        totalVoiceTime: Math.round(channel.totalVoiceTime),
        uniqueUsers: channel.uniqueUsers.size,
        avgSessionDuration: Math.round(channel.totalVoiceTime / channel.sessionCount),
      }))
      .sort((a, b) => b.totalVoiceTime - a.totalVoiceTime);

    // Discord에서 채널명 매핑 (여기서 실제로 호출!)
    return await this.enrichChannelsWithNames(guildId, channelStats);
  }

  /**
   * 일별 트렌드 집계
   */
  private aggregateDailyTrends(voiceData: VoiceDailyEntity[]) {
    const dailyMap = new Map<string, any>();

    voiceData.forEach((record) => {
      if (!dailyMap.has(record.date)) {
        dailyMap.set(record.date, {
          date: record.date,
          totalVoiceTime: 0,
          activeUsers: new Set<string>(),
          totalMicOnTime: 0,
          totalDuration: 0,
        });
      }

      const daily = dailyMap.get(record.date);
      daily.totalVoiceTime += record.channelDurationSec;
      daily.totalMicOnTime += record.micOnSec;
      daily.totalDuration += record.channelDurationSec;
      daily.activeUsers.add(record.userId);
    });

    return Array.from(dailyMap.values())
      .map((daily) => ({
        date: daily.date,
        totalVoiceTime: Math.round(daily.totalVoiceTime),
        activeUsers: daily.activeUsers.size,
        avgMicUsage:
          daily.totalDuration > 0
            ? Math.round((daily.totalMicOnTime / daily.totalDuration) * 100 * 10) / 10
            : 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Discord 데이터로 유저명과 채널명 보강
   */
  private async enrichWithDiscordData(guildId: string, userActivities: any[]) {
    try {
      const guild = await this.client.guilds.fetch(guildId);

      for (const activity of userActivities) {
        try {
          // 유저명 가져오기
          const member = await guild.members.fetch(activity.userId).catch(() => null);
          if (member) {
            activity.username = member.user.username;
          } else {
            activity.username = `User-${activity.userId.slice(0, 6)}`;
          }

          // 채널명 가져오기
          for (const channel of activity.activeChannels) {
            try {
              const discordChannel = await guild.channels
                .fetch(channel.channelId)
                .catch(() => null);
              if (discordChannel) {
                channel.channelName = discordChannel.name;
              } else {
                channel.channelName = `Channel-${channel.channelId.slice(0, 6)}`;
              }
            } catch (error) {
              this.logger.warn(`Failed to fetch channel ${channel.channelId}`);
              channel.channelName = `Channel-${channel.channelId.slice(0, 6)}`;
            }
          }
        } catch (error) {
          this.logger.warn(`Failed to fetch user ${activity.userId}:`, error.message);
          activity.username = `User-${activity.userId.slice(0, 6)}`;
        }
      }
    } catch (error) {
      this.logger.error('Failed to enrich with Discord data:', error.message);
    }

    return userActivities;
  }

  /**
   * 채널명 보강
   */
  private async enrichChannelsWithNames(guildId: string, channelStats: any[]) {
    try {
      const guild = await this.client.guilds.fetch(guildId);

      for (const stat of channelStats) {
        try {
          const channel = await guild.channels.fetch(stat.channelId).catch(() => null);
          if (channel) {
            stat.channelName = channel.name;
          } else {
            stat.channelName = `Channel-${stat.channelId.slice(0, 6)}`;
          }
        } catch (error) {
          this.logger.warn(`Failed to fetch channel ${stat.channelId}`);
          stat.channelName = `Channel-${stat.channelId.slice(0, 6)}`;
        }
      }
    } catch (error) {
      this.logger.error('Failed to enrich channels with names:', error.message);
    }

    return channelStats;
  }

  /**
   * 길드 이름 가져오기
   */
  private async getGuildName(guildId: string): Promise<string> {
    try {
      const guild = await this.client.guilds.fetch(guildId);
      return guild.name;
    } catch (error) {
      this.logger.warn(`Failed to fetch guild ${guildId}:`, error.message);
      return `Guild-${guildId.slice(0, 6)}`;
    }
  }

  /**
   * 빈 응답 생성
   */
  private createEmptyResponse(
    guildId: string,
    startDate: string,
    endDate: string,
  ): VoiceActivityData {
    return {
      guildId,
      guildName: `Guild ${guildId}`,
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

  /**
   * 날짜 범위 유틸리티: 최근 N일의 시작/종료 날짜 생성
   */
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
