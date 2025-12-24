import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VoiceAnalyticsController } from './voice-analytics.controller';
import { VoiceGeminiService } from './voice-gemini.service';
import { VoiceAnalyticsService } from './voice-analytics.service';
import { RedisModule } from '../redis/redis.module'; // Redis 모듈 import
import {
  VoiceStatsCommand,
  MyVoiceStatsCommand,
  CommunityHealthCommand,
  VoiceLeaderboardCommand,
} from './voice-analytics.commands';
import { VoiceDailyEntity } from 'src/channel/voice/domain/voice-daily-entity';
import { DiscordGateway } from 'src/gateway/discord.gateway';
import { VoiceRedisRepository } from 'src/channel/voice/infrastructure/voice.redis.repository';
import { DiscordModule } from '@discord-nestjs/core';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([VoiceDailyEntity]),
    RedisModule, // Redis 모듈 추가,
    DiscordModule.forFeature(),
  ],
  controllers: [VoiceAnalyticsController],
  providers: [
    VoiceGeminiService,
    VoiceAnalyticsService,
    DiscordGateway,
    VoiceRedisRepository, // Redis Repository 추가
    VoiceStatsCommand,
    MyVoiceStatsCommand,
    CommunityHealthCommand,
    VoiceLeaderboardCommand,
  ],
  exports: [VoiceGeminiService, VoiceAnalyticsService, DiscordGateway, VoiceRedisRepository],
})
export class VoiceAnalyticsModule {}
