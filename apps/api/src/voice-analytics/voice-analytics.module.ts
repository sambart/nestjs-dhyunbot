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
import { VoiceAiAnalysisService } from './application/voice-ai-analysis.service';
import { VoiceAnalyticsService } from './application/voice-analytics.service';
import { VoiceNameEnricherService } from './application/voice-name-enricher.service';
import { LlmModule } from './infrastructure/llm/llm.module';
import { CommunityHealthCommand } from './presentation/commands/community-health.command';
import { MyVoiceStatsCommand } from './presentation/commands/my-voice-stats.command';
import { VoiceLeaderboardCommand } from './presentation/commands/voice-leaderboard.command';
import { VoiceStatsCommand } from './presentation/commands/voice-stats.command';
import { VoiceAnalyticsController } from './presentation/voice-analytics.controller';
import { BadgeScheduler } from './self-diagnosis/application/badge.scheduler';
import { BadgeService } from './self-diagnosis/application/badge.service';
import { BadgeQueryService } from './self-diagnosis/application/badge-query.service';
import { SelfDiagnosisService } from './self-diagnosis/application/self-diagnosis.service';
import { VoiceHealthBadge } from './self-diagnosis/domain/voice-health-badge.entity';
import { VoiceHealthConfig } from './self-diagnosis/domain/voice-health-config.entity';
import { VoiceHealthConfigRepository } from './self-diagnosis/infrastructure/voice-health-config.repository';
import { SelfDiagnosisCommand } from './self-diagnosis/presentation/self-diagnosis.command';
import { SelfDiagnosisController } from './self-diagnosis/presentation/self-diagnosis.controller';

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
