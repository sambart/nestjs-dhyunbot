import { Module } from '@nestjs/common';
import { DiscordModule } from '@discord-nestjs/core';
import { DiscordConfig } from '../../config/discord.config';
import { VoiceStateHandler } from './voice-state-handler';
import { VoiceChannelService } from './voice-channel.service';
@Module({
  imports: [DiscordModule.forRootAsync(DiscordConfig), DiscordModule.forFeature()],
  providers: [VoiceChannelService, VoiceStateHandler],
  exports: [VoiceChannelService, VoiceStateHandler],
})
export class VoiceChannelModule {}
