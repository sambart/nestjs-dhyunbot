import { DiscordModule } from '@discord-nestjs/core';
import { Module } from '@nestjs/common';

import { BotI18nService } from '../common/application/bot-i18n.service';
import { LocaleResolverService } from '../common/application/locale-resolver.service';
import { MusicService } from './application/music.service';
import { MusicPlayCommand } from './presentation/commands/music-play.command';
import { MusicSkipCommand } from './presentation/commands/music-skip.command';
import { MusicStopCommand } from './presentation/commands/music-stop.command';

@Module({
  imports: [DiscordModule.forFeature()],

  providers: [
    BotI18nService,
    LocaleResolverService,
    MusicService,
    MusicPlayCommand,
    MusicStopCommand,
    MusicSkipCommand,
  ],
})
export class MusicModule {}
