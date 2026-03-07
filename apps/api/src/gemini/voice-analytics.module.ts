import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { VoiceDailyEntity } from '../channel/voice/domain/voice-daily.entity';
import { VoiceRedisRepository } from '../channel/voice/infrastructure/voice-redis.repository';
import { GatewayModule } from '../gateway/gateway.module';
import {
  CommunityHealthCommand,
  MyVoiceStatsCommand,
  VoiceLeaderboardCommand,
  VoiceStatsCommand,
} from './voice-analytics.commands';
import { VoiceAnalyticsController } from './voice-analytics.controller';
import { VoiceAnalyticsService } from './voice-analytics.service';
import { VoiceGeminiService } from './voice-gemini.service';
import { VoiceNameEnricherService } from './voice-name-enricher.service';

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([VoiceDailyEntity]), GatewayModule],
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
