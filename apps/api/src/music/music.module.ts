import { Module } from '@nestjs/common';
import { MusicService } from './music.service';
import { MusicPlayCommand } from './music-play.command';
import { DiscordModule } from '@discord-nestjs/core';
import { MusicStopCommand } from './music-stop.command';
import { MusicSkipCommand } from './music-skip.command';

@Module({
  imports: [DiscordModule.forFeature()],

  providers: [MusicService, MusicPlayCommand, MusicStopCommand, MusicSkipCommand],
})
export class MusicModule {}
