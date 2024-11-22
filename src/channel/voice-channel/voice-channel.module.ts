import { Module } from '@nestjs/common';
import { DiscordModule } from '@discord-nestjs/core';
import { DiscordConfig } from '../../config/discord.config';
import { VoiceStateHandler } from './voice-state-handler';
import { VoiceChannelService } from './voice-channel.service';
import { TypeOrmModule } from '@nestjs/typeorm';
//import { VoiceChannelHistory } from './voice-channel-history.entity';
import { Channel } from '../channel.entity';
import { VoiceChannelHistory } from './voice-channel-history.entity';
import { VoiceChannelHistoryService } from './voice-channel-history.service';
import { ChannelModule } from '../channel.module';
import { MemberModule } from '../../member/member.module';

@Module({
  imports: [TypeOrmModule.forFeature([VoiceChannelHistory]), MemberModule],
  providers: [VoiceChannelService, VoiceStateHandler, VoiceChannelHistoryService],
  exports: [VoiceChannelService, VoiceStateHandler],
})
export class VoiceChannelModule {}
