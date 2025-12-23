import { Controller, Get, Query, Param, BadRequestException, UseGuards } from '@nestjs/common';
import { VoiceAnalyticsService, VoiceActivityData } from './voice-analytics.service';
import { VoiceAnalysisResult, VoiceGeminiService } from './voice-gemini.service';

@Controller('voice-analytics')
export class VoiceAnalyticsController {
  constructor(
    private readonly geminiService: VoiceGeminiService,
    private readonly analyticsService: VoiceAnalyticsService,
  ) {}

  /**
   * 음성 채널 활동 분석 API
   * GET /voice-analytics/guild/:guildId
   *
   * 예시: GET /voice-analytics/guild/123456789?days=7
   */
  @Get('guild/:guildId')
  async analyzeGuildVoiceActivity(
    @Param('guildId') guildId: string,
    @Query('days') days?: string,
  ): Promise<VoiceAnalysisResult> {
    const dayCount = this.validateDays(days);

    // 날짜 범위 계산 (YYYYMMDD 형식)
    const { start, end } = VoiceAnalyticsService.getDateRange(dayCount);

    // 1. 음성 활동 데이터 수집
    const activityData = await this.analyticsService.collectVoiceActivityData(guildId, start, end);

    // 데이터가 없는 경우
    if (activityData.userActivities.length === 0) {
      throw new BadRequestException('No voice activity data found for the specified period');
    }

    // 2. Gemini로 분석
    const analysis = await this.geminiService.analyzeVoiceActivity(activityData);

    return analysis;
  }

  /**
   * 원본 음성 활동 데이터 조회 (분석 없이)
   * GET /voice-analytics/guild/:guildId/raw
   */
  @Get('guild/:guildId/raw')
  async getRawVoiceData(
    @Param('guildId') guildId: string,
    @Query('days') days?: string,
  ): Promise<VoiceActivityData> {
    const dayCount = this.validateDays(days);
    const { start, end } = VoiceAnalyticsService.getDateRange(dayCount);

    return this.analyticsService.collectVoiceActivityData(guildId, start, end);
  }

  /**
   * 특정 유저의 음성 활동 분석
   * GET /voice-analytics/user/:userId?guildId=xxx&days=30
   */
  @Get('user/:userId')
  async analyzeUserVoiceActivity(
    @Param('userId') userId: string,
    @Query('guildId') guildId?: string,
    @Query('days') days?: string,
  ) {
    if (!guildId) {
      throw new BadRequestException('guildId query parameter is required');
    }

    const dayCount = this.validateDays(days);
    const { start, end } = VoiceAnalyticsService.getDateRange(dayCount);

    const activityData = await this.analyticsService.collectVoiceActivityData(guildId, start, end);

    // 특정 유저 데이터 확인
    const userActivity = activityData.userActivities.find((u) => u.userId === userId);
    if (!userActivity) {
      throw new BadRequestException('User has no voice activity in the specified period');
    }

    // Gemini로 개별 유저 심층 분석
    const analysis = await this.geminiService.analyzeSpecificUser(activityData, userId);

    return {
      userData: userActivity,
      analysis,
    };
  }

  /**
   * 커뮤니티 건강도 점수
   * GET /voice-analytics/guild/:guildId/health?days=30
   */
  @Get('guild/:guildId/health')
  async getCommunityHealth(@Param('guildId') guildId: string, @Query('days') days?: string) {
    const dayCount = this.validateDays(days);
    const { start, end } = VoiceAnalyticsService.getDateRange(dayCount);

    const activityData = await this.analyticsService.collectVoiceActivityData(guildId, start, end);

    if (activityData.userActivities.length === 0) {
      return {
        healthScore: 0,
        status: 'inactive',
        message: 'No activity data available',
      };
    }

    const healthAnalysis = await this.geminiService.calculateCommunityHealth(activityData);

    return {
      period: { start, end, days: dayCount },
      ...healthAnalysis,
    };
  }

  /**
   * 기간별 비교 분석
   * GET /voice-analytics/guild/:guildId/compare?period1=7&period2=14
   */
  @Get('guild/:guildId/compare')
  async comparePerformance(
    @Param('guildId') guildId: string,
    @Query('period1') period1?: string,
    @Query('period2') period2?: string,
  ) {
    const days1 = this.validateDays(period1, 7);
    const days2 = this.validateDays(period2, 14);

    // 최근 기간
    const range1 = VoiceAnalyticsService.getDateRange(days1);
    const data1 = await this.analyticsService.collectVoiceActivityData(
      guildId,
      range1.start,
      range1.end,
    );

    // 이전 기간
    const range2 = VoiceAnalyticsService.getDateRange(days2);
    const data2 = await this.analyticsService.collectVoiceActivityData(
      guildId,
      range2.start,
      range2.end,
    );

    // 비교 통계 계산
    return {
      period1: {
        range: range1,
        stats: data1.totalStats,
      },
      period2: {
        range: range2,
        stats: data2.totalStats,
      },
      changes: {
        totalUsersChange: data1.totalStats.totalUsers - data2.totalStats.totalUsers,
        voiceTimeChange: data1.totalStats.totalVoiceTime - data2.totalStats.totalVoiceTime,
        avgActiveUsersChange:
          data1.totalStats.avgDailyActiveUsers - data2.totalStats.avgDailyActiveUsers,
      },
    };
  }

  /**
   * 일수 유효성 검증 헬퍼
   */
  private validateDays(days?: string, defaultValue: number = 7): number {
    if (!days) return defaultValue;

    const parsed = parseInt(days, 10);
    if (isNaN(parsed) || parsed < 1 || parsed > 90) {
      throw new BadRequestException('days must be between 1 and 90');
    }

    return parsed;
  }

  /**
   * 통계 요약 API (간단한 대시보드용)
   * GET /voice-analytics/guild/:guildId/summary
   */
  @Get('guild/:guildId/summary')
  async getQuickSummary(@Param('guildId') guildId: string, @Query('days') days?: string) {
    const dayCount = this.validateDays(days, 7);
    const { start, end } = VoiceAnalyticsService.getDateRange(dayCount);

    const data = await this.analyticsService.collectVoiceActivityData(guildId, start, end);

    // 간단한 요약 정보만 반환 (Gemini 호출 없이)
    return {
      period: { start, end, days: dayCount },
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
      recentTrend: data.dailyTrends.slice(-7), // 최근 7일
    };
  }
}
