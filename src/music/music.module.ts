import { Module } from '@nestjs/common';
import { MusicService } from './music.service';
import { MusicCommand } from './music.command';
import { DiscordModule } from '@discord-nestjs/core';

@Module({
  imports: [DiscordModule.forFeature()],

  providers: [MusicService, MusicCommand],
})
export class MusicModule {}
