import { DiscordModule } from '@discord-nestjs/core';
import { Module } from '@nestjs/common';

import { MusicService } from './application/music.service';
import { MusicPlayCommand } from './presentation/commands/music-play.command';
import { MusicSkipCommand } from './presentation/commands/music-skip.command';
import { MusicStopCommand } from './presentation/commands/music-stop.command';

@Module({
  imports: [DiscordModule.forFeature()],

  providers: [MusicService, MusicPlayCommand, MusicStopCommand, MusicSkipCommand],
})
export class MusicModule {}
