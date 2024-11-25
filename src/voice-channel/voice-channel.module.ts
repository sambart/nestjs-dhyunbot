import { Module } from '@nestjs/common';
import { DiscordModule } from '@discord-nestjs/core';
import { DiscordConfig } from '../config/discord.config';
import { VoiceStateHandler } from './voice-state-handler';
import { VoiceChannelService } from './voice-channel.service';
import { TypeOrmModule } from '@nestjs/typeorm';
//import { VoiceChannelHistory } from './voice-channel-history.entity';
import { Channel } from '../channel/channel.entity';
import { VoiceChannelHistory } from './voice-channel-history.entity';
import { VoiceChannelHistoryService } from './voice-channel-history.service';
import { ChannelModule } from '../channel/channel.module';
import { MemberModule } from '../member/member.module';

@Module({
  imports: [
    DiscordModule.forRootAsync(DiscordConfig),
    DiscordModule.forFeature(),
    TypeOrmModule.forFeature([VoiceChannelHistory]),
    MemberModule,
    ChannelModule,
  ],
  providers: [VoiceChannelService, VoiceStateHandler, VoiceChannelHistoryService],
  exports: [VoiceChannelService, VoiceStateHandler, TypeOrmModule],
})
export class VoiceChannelModule {}
