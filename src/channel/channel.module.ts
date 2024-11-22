import { Module } from '@nestjs/common';
import { DiscordModule } from '@discord-nestjs/core';
import { DiscordConfig } from '../config/discord.config';
import { ChannelService } from './channel.service';
import { VoiceChannelService } from './voice-channel/voice-channel.service';
import { ChannelStateHandler } from './channel-state-handler';
import { VoiceChannelModule } from './voice-channel/voice-channel.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Channel } from './channel.entity';

@Module({
  imports: [
    DiscordModule.forRootAsync(DiscordConfig),
    DiscordModule.forFeature(),
    VoiceChannelModule,
    TypeOrmModule.forFeature([Channel]),
  ],
  providers: [ChannelService, ChannelStateHandler],
  exports: [ChannelService],
})
export class ChannelModule {}
