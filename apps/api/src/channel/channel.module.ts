import { DiscordModule } from '@discord-nestjs/core';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DiscordConfig } from '../config/discord.config';
import { Channel } from './channel.entity';
import { ChannelService } from './channel.service';

@Module({
  imports: [
    DiscordModule.forRootAsync(DiscordConfig),
    DiscordModule.forFeature(),
    TypeOrmModule.forFeature([Channel]),
  ],
  providers: [ChannelService],
  exports: [ChannelService],
})
export class ChannelModule {}
