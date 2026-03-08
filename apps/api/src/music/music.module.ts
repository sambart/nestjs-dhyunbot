import { DiscordModule } from '@discord-nestjs/core';
import { Module } from '@nestjs/common';

import { MusicService } from './music.service';
import { MusicPlayCommand } from './music-play.command';
import { MusicSkipCommand } from './music-skip.command';
import { MusicStopCommand } from './music-stop.command';

@Module({
  imports: [DiscordModule.forFeature()],

  providers: [MusicService, MusicPlayCommand, MusicStopCommand, MusicSkipCommand],
})
export class MusicModule {}
