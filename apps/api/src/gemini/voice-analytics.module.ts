import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { VoiceDailyEntity } from '../channel/voice/domain/voice-daily.entity';
import { VoiceRedisRepository } from '../channel/voice/infrastructure/voice-redis.repository';
import { GatewayModule } from '../gateway/gateway.module';
import { CommunityHealthCommand } from './commands/community-health.command';
import { MyVoiceStatsCommand } from './commands/my-voice-stats.command';
import { VoiceLeaderboardCommand } from './commands/voice-leaderboard.command';
import { VoiceStatsCommand } from './commands/voice-stats.command';
import { VoiceAnalyticsController } from './voice-analytics.controller';
import { VoiceAnalyticsService } from './voice-analytics.service';
import { VoiceGeminiService } from './voice-gemini.service';
import { VoiceNameEnricherService } from './voice-name-enricher.service';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([VoiceDailyEntity]),
    GatewayModule,
    AuthModule,
  ],
  controllers: [VoiceAnalyticsController],
  providers: [
    VoiceGeminiService,
    VoiceAnalyticsService,
    VoiceNameEnricherService,
    VoiceRedisRepository,
    VoiceStatsCommand,
    MyVoiceStatsCommand,
    CommunityHealthCommand,
    VoiceLeaderboardCommand,
  ],
  exports: [VoiceGeminiService, VoiceAnalyticsService, VoiceRedisRepository],
})
export class VoiceAnalyticsModule {}
