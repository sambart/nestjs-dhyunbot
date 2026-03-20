import { DiscordModule } from '@discord-nestjs/core';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { BotI18nService } from '../common/application/bot-i18n.service';
import { LocaleResolverService } from '../common/application/locale-resolver.service';
import { MusicService } from './application/music.service';
import { KazagumoProvider } from './infrastructure/kazagumo.provider';
import { MusicPauseCommand } from './presentation/commands/music-pause.command';
import { MusicPlayCommand } from './presentation/commands/music-play.command';
import { MusicResumeCommand } from './presentation/commands/music-resume.command';
import { MusicSkipCommand } from './presentation/commands/music-skip.command';
import { MusicStopCommand } from './presentation/commands/music-stop.command';

@Module({
  imports: [DiscordModule.forFeature(), ConfigModule],
  providers: [
    BotI18nService,
    LocaleResolverService,
    KazagumoProvider,
    MusicService,
    MusicPlayCommand,
    MusicSkipCommand,
    MusicStopCommand,
    MusicPauseCommand,
    MusicResumeCommand,
  ],
})
export class MusicModule {}
