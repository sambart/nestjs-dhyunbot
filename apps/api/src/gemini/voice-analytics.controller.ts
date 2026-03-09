import { VoiceActivityData, VoiceAnalysisResult } from '@dhyunbot/shared';
import { BadRequestException, Controller, Get, Logger, Param, Query, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RedisService } from '../redis/redis.service';
import { VoiceAnalyticsCompareQueryDto, VoiceAnalyticsQueryDto } from './dto/voice-analytics-query.dto';
import { VoiceAnalyticsService } from './voice-analytics.service';
import { VoiceGeminiService } from './voice-gemini.service';

const ANALYSIS_CACHE_TTL = 60 * 30; // 30분

@Controller('voice-analytics')
@UseGuards(JwtAuthGuard)
export class VoiceAnalyticsController {
  private readonly logger = new Logger(VoiceAnalyticsController.name);

  constructor(
    private readonly geminiService: VoiceGeminiService,
    private readonly analyticsService: VoiceAnalyticsService,
    private readonly redis: RedisService,
  ) {}

  @Get('guild/:guildId')
  async analyzeGuildVoiceActivity(
    @Param('guildId') guildId: string,
    @Query() query: VoiceAnalyticsQueryDto,
  ): Promise<VoiceAnalysisResult> {
    const cacheKey = `voice:analysis:guild:${guildId}:${query.days}`;
    const cached = await this.redis.get<VoiceAnalysisResult>(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for guild analysis: ${cacheKey}`);
      return cached;
    }

    const { start, end } = VoiceAnalyticsService.getDateRange(query.days);
    const activityData = await this.analyticsService.collectVoiceActivityData(guildId, start, end);

    if (activityData.userActivities.length === 0) {
      throw new BadRequestException('No voice activity data found for the specified period');
    }

    const result = await this.geminiService.analyzeVoiceActivity(activityData);
    await this.redis.set(cacheKey, result, ANALYSIS_CACHE_TTL);
    return result;
  }

  @Get('guild/:guildId/raw')
  async getRawVoiceData(
    @Param('guildId') guildId: string,
    @Query() query: VoiceAnalyticsQueryDto,
  ): Promise<VoiceActivityData> {
    const { start, end } = VoiceAnalyticsService.getDateRange(query.days);
    return this.analyticsService.collectVoiceActivityData(guildId, start, end);
  }

  @Get('user/:userId')
  async analyzeUserVoiceActivity(
    @Param('userId') userId: string,
    @Query('guildId') guildId?: string,
    @Query() query?: VoiceAnalyticsQueryDto,
  ) {
    if (!guildId) {
      throw new BadRequestException('guildId query parameter is required');
    }

    const cacheKey = `voice:analysis:user:${guildId}:${userId}:${query.days}`;
    const cached = await this.redis.get<{ userData: VoiceActivityData['userActivities'][number]; analysis: string }>(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for user analysis: ${cacheKey}`);
      return cached;
    }

    const { start, end } = VoiceAnalyticsService.getDateRange(query.days);
    const activityData = await this.analyticsService.collectVoiceActivityData(guildId, start, end);

    const userActivity = activityData.userActivities.find((u) => u.userId === userId);
    if (!userActivity) {
      throw new BadRequestException('User has no voice activity in the specified period');
    }

    const analysis = await this.geminiService.analyzeSpecificUser(activityData, userId);
    const result = { userData: userActivity, analysis };
    await this.redis.set(cacheKey, result, ANALYSIS_CACHE_TTL);
    return result;
  }

  @Get('guild/:guildId/compare')
  async comparePerformance(
    @Param('guildId') guildId: string,
    @Query() query: VoiceAnalyticsCompareQueryDto,
  ) {
    const range1 = VoiceAnalyticsService.getDateRange(query.period1);
    const data1 = await this.analyticsService.collectVoiceActivityData(
      guildId,
      range1.start,
      range1.end,
    );

    const range2 = VoiceAnalyticsService.getDateRange(query.period2);
    const data2 = await this.analyticsService.collectVoiceActivityData(
      guildId,
      range2.start,
      range2.end,
    );

    return {
      period1: { range: range1, stats: data1.totalStats },
      period2: { range: range2, stats: data2.totalStats },
      changes: {
        totalUsersChange: data1.totalStats.totalUsers - data2.totalStats.totalUsers,
        voiceTimeChange: data1.totalStats.totalVoiceTime - data2.totalStats.totalVoiceTime,
        avgActiveUsersChange:
          data1.totalStats.avgDailyActiveUsers - data2.totalStats.avgDailyActiveUsers,
      },
    };
  }

  @Get('guild/:guildId/summary')
  async getQuickSummary(
    @Param('guildId') guildId: string,
    @Query() query: VoiceAnalyticsQueryDto,
  ) {
    const { start, end } = VoiceAnalyticsService.getDateRange(query.days);
    const data = await this.analyticsService.collectVoiceActivityData(guildId, start, end);

    return {
      period: { start, end, days: query.days },
      totalStats: data.totalStats,
      topUsers: data.userActivities.slice(0, 5).map((u) => ({
        username: u.username,
        totalVoiceTime: u.totalVoiceTime,
        micUsageRate: u.micUsageRate,
      })),
      topChannels: data.channelStats.slice(0, 5).map((c) => ({
        channelName: c.channelName,
        totalVoiceTime: c.totalVoiceTime,
        uniqueUsers: c.uniqueUsers,
      })),
      recentTrend: data.dailyTrends.slice(-7),
    };
  }
}
