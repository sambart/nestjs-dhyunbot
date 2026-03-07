import { DiscordModule } from '@discord-nestjs/core';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DiscordConfig } from '../../config/discord.config';
import { MemberModule } from '../../member/member.module';
import { ChannelModule } from '../channel.module';
import { VoiceChannelPolicy } from './application/voice-channel.policy';
import { VoiceChannelService } from './application/voice-channel.service';
import { VoiceChannelHistoryService } from './application/voice-channel-history.service';
import { VoiceDailyFlushService } from './application/voice-daily-flush-service';
import { VoiceChannelHistory } from './domain/voice-channel-history.entity';
import { VoiceDailyEntity } from './domain/voice-daily.entity';
import { DiscordVoiceGateway } from './infrastructure/discord-voice.gateway';
import { RedisTempChannelStore } from './infrastructure/redis-temp-channel-store';
import { VoiceRedisRepository } from './infrastructure/voice-redis.repository';

@Module({
  imports: [
    DiscordModule.forRootAsync(DiscordConfig),
    DiscordModule.forFeature(),
    TypeOrmModule.forFeature([VoiceChannelHistory, VoiceDailyEntity]),
    MemberModule,
    ChannelModule,
  ],
  providers: [
    VoiceChannelService,
    VoiceChannelHistoryService,
    VoiceChannelPolicy,
    DiscordVoiceGateway,
    {
      provide: 'TempChannelStore',
      useClass: RedisTempChannelStore,
    },
    VoiceRedisRepository,
    VoiceDailyFlushService,
  ],
  exports: [VoiceChannelService, TypeOrmModule],
})
export class VoiceChannelModule {}
