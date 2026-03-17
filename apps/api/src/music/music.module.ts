import { DiscordModule } from '@discord-nestjs/core';
import { Module } from '@nestjs/common';

import { MusicService } from './application/music.service';

@Module({
  imports: [DiscordModule.forFeature()],
  providers: [MusicService],
  exports: [MusicService],
})
export class MusicModule {}
