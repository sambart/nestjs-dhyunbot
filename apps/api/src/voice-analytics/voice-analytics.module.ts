import { DiscordModule } from '@discord-nestjs/core';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { VoiceCoPresencePairDaily } from '../channel/voice/co-presence/domain/voice-co-presence-pair-daily.entity';
import { VoiceDailyEntity } from '../channel/voice/domain/voice-daily.entity';
import { VoiceRedisRepository } from '../channel/voice/infrastructure/voice-redis.repository';
import { GatewayModule } from '../gateway/gateway.module';
import { MocoHuntingDaily } from '../newbie/domain/moco-hunting-daily.entity';
import { CommunityHealthCommand } from './commands/community-health.command';
import { MyVoiceStatsCommand } from './commands/my-voice-stats.command';
import { VoiceLeaderboardCommand } from './commands/voice-leaderboard.command';
import { VoiceStatsCommand } from './commands/voice-stats.command';
import { LlmModule } from './llm/llm.module';
import { BadgeScheduler } from './self-diagnosis/badge.scheduler';
import { BadgeService } from './self-diagnosis/badge.service';
import { BadgeQueryService } from './self-diagnosis/badge-query.service';
import { VoiceHealthBadge } from './self-diagnosis/domain/voice-health-badge.entity';
import { VoiceHealthConfig } from './self-diagnosis/domain/voice-health-config.entity';
import { SelfDiagnosisCommand } from './self-diagnosis/self-diagnosis.command';
import { SelfDiagnosisController } from './self-diagnosis/self-diagnosis.controller';
import { SelfDiagnosisService } from './self-diagnosis/self-diagnosis.service';
import { VoiceHealthConfigRepository } from './self-diagnosis/voice-health-config.repository';
import { VoiceAiAnalysisService } from './voice-ai-analysis.service';
import { VoiceAnalyticsController } from './voice-analytics.controller';
import { VoiceAnalyticsService } from './voice-analytics.service';
import { VoiceNameEnricherService } from './voice-name-enricher.service';

@Module({
  imports: [
    DiscordModule.forFeature(),
    ConfigModule,
    TypeOrmModule.forFeature([
      VoiceDailyEntity,
      VoiceCoPresencePairDaily,
      MocoHuntingDaily,
      VoiceHealthConfig,
      VoiceHealthBadge,
    ]),
    GatewayModule,
    AuthModule,
    LlmModule,
  ],
  controllers: [VoiceAnalyticsController, SelfDiagnosisController],
  providers: [
    VoiceAiAnalysisService,
    VoiceAnalyticsService,
    VoiceNameEnricherService,
    VoiceRedisRepository,
    VoiceStatsCommand,
    MyVoiceStatsCommand,
    CommunityHealthCommand,
    VoiceLeaderboardCommand,
    VoiceHealthConfigRepository,
    SelfDiagnosisService,
    SelfDiagnosisCommand,
    BadgeService,
    BadgeScheduler,
    BadgeQueryService,
  ],
  exports: [VoiceAiAnalysisService, VoiceAnalyticsService, VoiceRedisRepository, BadgeQueryService],
})
export class VoiceAnalyticsModule {}
