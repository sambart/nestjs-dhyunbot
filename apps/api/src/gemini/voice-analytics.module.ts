import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VoiceAnalyticsController } from './voice-analytics.controller';
import { VoiceGeminiService } from './voice-gemini.service';
import { VoiceAnalyticsService } from './voice-analytics.service';
import {
  VoiceStatsCommand,
  MyVoiceStatsCommand,
  CommunityHealthCommand,
  VoiceLeaderboardCommand,
} from './voice-analytics.commands';
import { VoiceDailyEntity } from '../channel/voice/domain/voice-daily-entity';
import { VoiceRedisRepository } from '../channel/voice/infrastructure/voice.redis.repository';
import { VoiceNameEnricherService } from './voice-name-enricher.service';
import { GatewayModule } from '../gateway/gateway.module';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([VoiceDailyEntity]),
    GatewayModule,
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
