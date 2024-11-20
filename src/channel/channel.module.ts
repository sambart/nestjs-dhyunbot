import { Module } from '@nestjs/common';
import { DiscordModule } from '@discord-nestjs/core';
import { DiscordConfig } from '../config/discord.config';
import { ChannelService } from './channel.service';
import { VoiceStateHandler } from './voice-state-handler';

@Module({
  imports: [DiscordModule.forRootAsync(DiscordConfig), DiscordModule.forFeature()],
  providers: [ChannelService, VoiceStateHandler],
  exports: [ChannelService],
})
export class ChannelModule {}
