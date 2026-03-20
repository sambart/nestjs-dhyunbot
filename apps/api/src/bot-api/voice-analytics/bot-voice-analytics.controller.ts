import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { RedisService } from '../../redis/redis.service';
import { VoiceAiAnalysisService } from '../../voice-analytics/application/voice-ai-analysis.service';
import { VoiceAnalyticsService } from '../../voice-analytics/application/voice-analytics.service';
import { LlmQuotaExhaustedException } from '../../voice-analytics/infrastructure/llm/llm-provider.interface';
import {
  DiagnosisCooldownException,
  SelfDiagnosisService,
} from '../../voice-analytics/self-diagnosis/application/self-diagnosis.service';
import { VoiceHealthKeys } from '../../voice-analytics/self-diagnosis/infrastructure/voice-health-cache.keys';
import { VoiceHealthConfigRepository } from '../../voice-analytics/self-diagnosis/infrastructure/voice-health-config.repository';
import { BotApiAuthGuard } from '../bot-api-auth.guard';

/**
 * Bot -> API 음성 분석 엔드포인트.
 * Bot 프로세스에서 슬래시 커맨드 실행 시 호출한다.
 */
@Controller('bot-api/voice-analytics')
@UseGuards(BotApiAuthGuard)
export class BotVoiceAnalyticsController {
  private readonly logger = new Logger(BotVoiceAnalyticsController.name);

  constructor(
    private readonly analyticsService: VoiceAnalyticsService,
    private readonly aiAnalysisService: VoiceAiAnalysisService,
    private readonly diagnosisService: SelfDiagnosisService,
    private readonly configRepo: VoiceHealthConfigRepository,
    private readonly redis: RedisService,
  ) {}

  @Get('my-stats')
  @HttpCode(HttpStatus.OK)
  async getMyStats(
    @Query('guildId') guildId: string,
    @Query('userId') userId: string,
    @Query('days') daysStr: string,
  ): Promise<Record<string, unknown>> {
    const days = parseInt(daysStr, 10) || 7;
    const { start, end } = VoiceAnalyticsService.getDateRange(days);
    const activityData = await this.analyticsService.collectVoiceActivityData(guildId, start, end);

    const myActivity = activityData.userActivities.find((u) => u.userId === userId);
    if (!myActivity) {
      return { ok: true, data: null, days };
    }

    const userRank = activityData.userActivities.findIndex((u) => u.userId === userId) + 1;

    return {
      ok: true,
      data: {
        ...myActivity,
        userRank,
        totalUsers: activityData.totalStats.totalUsers,
      },
      days,
    };
  }

  @Get('leaderboard')
  @HttpCode(HttpStatus.OK)
  async getLeaderboard(
    @Query('guildId') guildId: string,
    @Query('days') daysStr: string,
  ): Promise<Record<string, unknown>> {
    const days = parseInt(daysStr, 10) || 7;
    const { start, end } = VoiceAnalyticsService.getDateRange(days);
    const activityData = await this.analyticsService.collectVoiceActivityData(guildId, start, end);

    return {
      ok: true,
      data: {
        userActivities: activityData.userActivities.slice(0, 10),
      },
      days,
    };
  }

  @Post('analyze')
  @HttpCode(HttpStatus.OK)
  async analyzeVoiceActivity(
    @Query('guildId') guildId: string,
    @Query('days') daysStr: string,
  ): Promise<Record<string, unknown>> {
    const days = parseInt(daysStr, 10) || 7;
    const { start, end } = VoiceAnalyticsService.getDateRange(days);
    const activityData = await this.analyticsService.collectVoiceActivityData(guildId, start, end);

    if (activityData.userActivities.length === 0) {
      return { ok: true, data: null, days };
    }

    const analysis = await this.aiAnalysisService.analyzeVoiceActivity(activityData);

    return {
      ok: true,
      data: {
        analysisText: analysis.text,
        totalStats: activityData.totalStats,
      },
      days,
    };
  }

  @Post('community-health')
  @HttpCode(HttpStatus.OK)
  async getCommunityHealth(
    @Query('guildId') guildId: string,
    @Query('days') daysStr: string,
  ): Promise<Record<string, unknown>> {
    const days = parseInt(daysStr, 10) || 7;
    const { start, end } = VoiceAnalyticsService.getDateRange(days);
    const activityData = await this.analyticsService.collectVoiceActivityData(guildId, start, end);

    if (activityData.userActivities.length === 0) {
      return { ok: true, data: null, days };
    }

    const healthText = await this.aiAnalysisService.calculateCommunityHealth(activityData);

    return {
      ok: true,
      data: { healthText },
      days,
    };
  }

  @Post('self-diagnosis')
  @HttpCode(HttpStatus.OK)
  async runSelfDiagnosis(
    @Query('guildId') guildId: string,
    @Query('userId') userId: string,
  ): Promise<Record<string, unknown>> {
    // 설정 확인
    const config = await this.configRepo.findByGuildId(guildId);
    if (!config?.isEnabled) {
      return { ok: true, data: null, reason: 'not_enabled' };
    }

    // 쿨다운 확인
    const cooldownKey = VoiceHealthKeys.cooldown(guildId, userId);
    const isOnCooldown = await this.redis.exists(cooldownKey);
    if (isOnCooldown) {
      const remaining = await this.redis.ttl(cooldownKey);
      return { ok: true, data: null, reason: 'cooldown', remainingSeconds: remaining };
    }

    try {
      const result = await this.diagnosisService.diagnose(guildId, userId);

      return {
        ok: true,
        data: {
          result,
          analysisDays: config.analysisDays,
          isCooldownEnabled: config.isCooldownEnabled,
          cooldownHours: config.cooldownHours,
        },
      };
    } catch (error) {
      if (error instanceof DiagnosisCooldownException) {
        return {
          ok: true,
          data: null,
          reason: 'cooldown',
          remainingSeconds: error.remainingSeconds,
        };
      }
      if (error instanceof LlmQuotaExhaustedException) {
        return { ok: true, data: null, reason: 'quota_exhausted' };
      }
      throw error;
    }
  }
}
