import { Module } from '@nestjs/common';
import { DiscordModule } from '@discord-nestjs/core';
import { DiscordConfig } from '../../config/discord.config';
import { VoiceChannelService } from './application/voice-channel.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VoiceChannelHistory } from './domain/voice-channel-history.entity';
import { VoiceChannelHistoryService } from './application/voice-channel-history.service';
import { ChannelModule } from '../channel.module';
import { MemberModule } from '../../member/member.module';
import { VoiceChannelPolicy } from './application/voice-channel.policy';
import { DiscordVoiceGateway } from './infrastructure/discord-voice.gateway';
import { RedisTempChannelStore } from './infrastructure/redis-temp-channel-store';
import { RedisService } from 'src/redis/redis.service';

@Module({
  imports: [
    DiscordModule.forRootAsync(DiscordConfig),
    DiscordModule.forFeature(),
    TypeOrmModule.forFeature([VoiceChannelHistory]),
    MemberModule,
    ChannelModule,
  ],
  providers: [
    VoiceChannelService,
    VoiceChannelHistoryService,
    VoiceChannelPolicy,
    DiscordVoiceGateway,
    RedisService,
    {
      provide: 'TempChannelStore',
      useClass: RedisTempChannelStore,
    },
  ],
  exports: [VoiceChannelService, TypeOrmModule],
})
export class VoiceChannelModule {}
