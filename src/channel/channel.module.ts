import { Module } from '@nestjs/common';
import { DiscordModule } from '@discord-nestjs/core';
import { DiscordConfig } from '../config/discord.config';
import { ChannelService } from './channel.service';

@Module({
  imports: [DiscordModule.forRootAsync(DiscordConfig), DiscordModule.forFeature()],
  providers: [ChannelService],
  exports: [ChannelService],
})
export class ChannelModule {}
