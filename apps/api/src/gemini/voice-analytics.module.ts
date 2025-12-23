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
import { VoiceDailyEntity } from 'src/channel/voice/domain/voice-daily-entity';
import { DiscordModule } from '@discord-nestjs/core';

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([VoiceDailyEntity]), DiscordModule.forFeature()],
  controllers: [VoiceAnalyticsController],
  providers: [
    VoiceGeminiService,
    VoiceAnalyticsService,
    VoiceStatsCommand,
    MyVoiceStatsCommand,
    CommunityHealthCommand,
    VoiceLeaderboardCommand,
  ],
  exports: [VoiceGeminiService, VoiceAnalyticsService],
})
export class VoiceAnalyticsModule {}
