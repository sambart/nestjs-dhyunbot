import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { VoiceDailyEntity } from '../channel/voice/domain/voice-daily-entity';
import { VoiceRedisRepository } from '../channel/voice/infrastructure/voice.redis.repository';
import { DiscordGateway } from '../gateway/discord.gateway';
import { Repository, Between, Not } from 'typeorm';

export interface VoiceActivityData {
  guildId: string;
  guildName: string;
  timeRange: {
    start: string;
    end: string;
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
    micUsageRate: number;
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
    private discordGateway: DiscordGateway,
    private voiceRedis: VoiceRedisRepository,
  ) {}

  /**
   * 서버의 음성 활동 데이터를 수집
   * 1. DB에서 데이터 조회
   * 2. Redis 캐시에서 이름 조회
   * 3. 없으면 Discord API → Redis 저장
   */
  async collectVoiceActivityData(
    guildId: string,
    startDate: string,
    endDate: string,
  ): Promise<VoiceActivityData> {
    try {
      this.logger.log(`Collecting voice data for guild ${guildId} from ${startDate} to ${endDate}`);

      // 1. GLOBAL 데이터 조회 (전체 집계)
      const globalData = await this.voiceDailyRepo.find({
        where: {
          guildId,
          channelId: 'GLOBAL',
          date: Between(startDate, endDate),
        },
        order: { date: 'ASC' },
      });

      // 2. 개별 채널 데이터 조회
      const channelData = await this.voiceDailyRepo.find({
        where: {
          guildId,
          channelId: Not('GLOBAL'),
          date: Between(startDate, endDate),
        },
        order: { date: 'ASC' },
      });

      if (globalData.length === 0 && channelData.length === 0) {
        this.logger.warn(`No voice data found for guild ${guildId}`);
        return this.createEmptyResponse(guildId, startDate, endDate);
      }

      // 3. 전체 통계 계산 (GLOBAL + 개별 채널 데이터 모두 필요)
      const totalStats = this.calculateTotalStatsFromGlobal(globalData);

      // 4. 유저별 활동 집계
      const userActivities = await this.aggregateUserActivitiesWithRedis(
        guildId,
        globalData,
        channelData,
      );

      // 5. 채널별 통계 집계
      const channelStats = await this.aggregateChannelStatsWithRedis(guildId, channelData);

      // 6. 일별 트렌드 집계
      const dailyTrends = this.aggregateDailyTrendsFromGlobal(globalData, channelData);

      // 7. 길드 이름 가져오기
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
      this.logger.error('Failed to collect voice activity data', error.stack);
      throw error;
    }
  }

  /**
   * GLOBAL 데이터로 전체 통계 계산
   */
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
      dailyActiveUsers.get(record.date).add(record.userId);
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

  /**
   * 유저별 활동 집계 (Redis 캐시 우선)
   * GLOBAL: micOnSec, micOffSec, aloneSec
   * 개별 채널: channelDurationSec
   */
  private async aggregateUserActivitiesWithRedis(
    guildId: string,
    globalData: VoiceDailyEntity[],
    channelData: VoiceDailyEntity[],
  ) {
    const userMap = new Map<string, any>();

    // 1. GLOBAL 데이터에서 마이크/혼자 시간 집계
    globalData.forEach((record) => {
      if (!userMap.has(record.userId)) {
        userMap.set(record.userId, {
          userId: record.userId,
          username: record.userName || null,
          totalVoiceTime: 0, // 개별 채널에서 계산
          totalMicOnTime: 0,
          totalMicOffTime: 0,
          aloneTime: 0,
          channelMap: new Map<string, { name: string; duration: number }>(),
          activeDaysSet: new Set<string>(),
        });
      }

      const user = userMap.get(record.userId);
      user.totalMicOnTime += record.micOnSec || 0;
      user.totalMicOffTime += record.micOffSec || 0;
      user.aloneTime += record.aloneSec || 0;
      user.activeDaysSet.add(record.date);
    });

    // 2. 개별 채널 데이터에서 채널별 시간 집계
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

      // 총 음성 시간 누적
      user.totalVoiceTime += record.channelDurationSec || 0;
      user.activeDaysSet.add(record.date);

      // 채널별 시간 집계
      const current = user.channelMap.get(record.channelId) || {
        name: record.channelName || null,
        duration: 0,
      };
      current.duration += record.channelDurationSec || 0;
      if (record.channelName) {
        current.name = record.channelName;
      }
      user.channelMap.set(record.channelId, current);
    });

    // 3. 이름 보강: Redis → Discord API → Redis 저장
    await this.enrichUserNamesWithRedis(guildId, userMap);
    await this.enrichChannelNamesWithRedis(guildId, userMap);

    // 4. 최종 결과 생성
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

  /**
   * 유저명 보강: Redis → Discord API → Redis
   */
  private async enrichUserNamesWithRedis(guildId: string, userMap: Map<string, any>) {
    const userIdsWithoutName: string[] = [];

    // 1. Redis에서 유저명 조회
    for (const [userId, user] of userMap) {
      if (!user.username || user.username.trim() === '') {
        const cachedName = await this.voiceRedis.getUserName(guildId, userId);
        if (cachedName) {
          user.username = cachedName;
          this.logger.debug(`✅ Redis hit: user ${userId} = ${cachedName}`);
        } else {
          userIdsWithoutName.push(userId);
        }
      }
    }

    // 2. Redis에 없으면 Discord API 배치 조회
    if (userIdsWithoutName.length > 0) {
      this.logger.log(`🔍 Fetching ${userIdsWithoutName.length} usernames from Discord API`);
      const userNames = await this.discordGateway.getUserNames(guildId, userIdsWithoutName);

      // 3. Discord API 결과를 Redis에 저장
      for (const [userId, username] of userNames) {
        const user = userMap.get(userId);
        if (user) {
          user.username = username;
          // Redis에 캐시 저장 (7일)
          await this.voiceRedis.setUserName(guildId, userId, username);
          this.logger.debug(`💾 Cached username: ${userId} = ${username}`);
        }
      }
    }
  }

  /**
   * 채널명 보강: Redis → Discord API → Redis
   */
  private async enrichChannelNamesWithRedis(guildId: string, userMap: Map<string, any>) {
    const channelIdsWithoutName = new Set<string>();

    // 1. Redis에서 채널명 조회
    for (const user of userMap.values()) {
      for (const [channelId, info] of user.channelMap) {
        if (!info.name || info.name.trim() === '') {
          const cachedName = await this.voiceRedis.getChannelName(guildId, channelId);
          if (cachedName) {
            info.name = cachedName;
            this.logger.debug(`✅ Redis hit: channel ${channelId} = ${cachedName}`);
          } else {
            channelIdsWithoutName.add(channelId);
          }
        }
      }
    }

    // 2. Redis에 없으면 Discord API 배치 조회
    if (channelIdsWithoutName.size > 0) {
      this.logger.log(`🔍 Fetching ${channelIdsWithoutName.size} channel names from Discord API`);
      const channelNames = await this.discordGateway.getChannelNames(
        guildId,
        Array.from(channelIdsWithoutName),
      );

      // 3. Discord API 결과를 Redis에 저장
      for (const [channelId, channelName] of channelNames) {
        // Redis에 캐시 저장 (7일)
        await this.voiceRedis.setChannelName(guildId, channelId, channelName);
        this.logger.debug(`💾 Cached channel name: ${channelId} = ${channelName}`);

        // userMap 업데이트
        for (const user of userMap.values()) {
          const info = user.channelMap.get(channelId);
          if (info && (!info.name || info.name.trim() === '')) {
            info.name = channelName;
          }
        }
      }
    }
  }

  /**
   * 채널별 통계 집계 (Redis 캐시 우선)
   * 개별 채널 데이터만 사용 (channelDurationSec만 존재)
   */
  private async aggregateChannelStatsWithRedis(guildId: string, channelData: VoiceDailyEntity[]) {
    const channelMap = new Map<string, any>();

    // 1. 채널 데이터 집계 (channelDurationSec만 사용)
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
      channel.totalVoiceTime += record.channelDurationSec || 0;
      channel.uniqueUsers.add(record.userId);
      channel.sessionCount++;
    });

    // 2. 채널명 보강: Redis → Discord API → Redis
    const channelIdsWithoutName: string[] = [];

    for (const [channelId, channel] of channelMap) {
      if (!channel.channelName || channel.channelName.trim() === '') {
        // Redis에서 조회
        const cachedName = await this.voiceRedis.getChannelName(guildId, channelId);
        if (cachedName) {
          channel.channelName = cachedName;
          this.logger.debug(`✅ Redis hit: channel ${channelId} = ${cachedName}`);
        } else {
          channelIdsWithoutName.push(channelId);
        }
      }
    }

    // 3. Redis에 없으면 Discord API 배치 조회
    if (channelIdsWithoutName.length > 0) {
      this.logger.log(`🔍 Fetching ${channelIdsWithoutName.length} channel names from Discord API`);
      const channelNames = await this.discordGateway.getChannelNames(
        guildId,
        channelIdsWithoutName,
      );

      for (const [channelId, channelName] of channelNames) {
        const channel = channelMap.get(channelId);
        if (channel) {
          channel.channelName = channelName;
          // Redis에 캐시 저장
          await this.voiceRedis.setChannelName(guildId, channelId, channelName);
          this.logger.debug(`💾 Cached channel name: ${channelId} = ${channelName}`);
        }
      }
    }

    // 4. 최종 결과 생성
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

  /**
   * 일별 트렌드 집계
   * GLOBAL: micOnSec 사용
   * 개별 채널: channelDurationSec 사용
   */
  private aggregateDailyTrendsFromGlobal(
    globalData: VoiceDailyEntity[],
    channelData: VoiceDailyEntity[],
  ) {
    const dailyMap = new Map<string, any>();

    // 1. GLOBAL 데이터에서 마이크 시간 집계
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
      daily.totalMicOnTime += record.micOnSec || 0;
      daily.activeUsers.add(record.userId);
    });

    // 2. 개별 채널 데이터에서 총 음성 시간 집계
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
      daily.totalVoiceTime += record.channelDurationSec || 0;
      daily.activeUsers.add(record.userId);
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

  /**
   * 빈 응답 생성
   */
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

  /**
   * 날짜 범위 유틸리티
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
