import { Command, EventParams, Handler } from '@discord-nestjs/core';
import { Injectable, Logger } from '@nestjs/common';
import { ClientEvents } from 'discord.js';

import { BotI18nService } from '../../../common/application/bot-i18n.service';
import { LocaleResolverService } from '../../../common/application/locale-resolver.service';
import { MusicService } from '../../application/music.service';

@Injectable()
@Command({
  name: 'stop',
  description: 'Stop the music',
  nameLocalizations: { ko: '중지' },
  descriptionLocalizations: { ko: '음악을 중지합니다.' },
})
export class MusicStopCommand {
  private readonly logger = new Logger(MusicStopCommand.name);

  constructor(
    private readonly musicService: MusicService,
    private readonly i18n: BotI18nService,
    private readonly localeResolver: LocaleResolverService,
  ) {}

  @Handler()
  async onStop(@EventParams() args: ClientEvents['interactionCreate']): Promise<void> {
    const [interaction] = args;
    if (!interaction.isChatInputCommand()) return;

    const locale = await this.localeResolver.resolve(
      interaction.user.id,
      interaction.guildId,
      interaction.locale,
    );

    try {
      await this.musicService.stop(interaction);
    } catch (error) {
      this.logger.error('Error stop music:', error);
      await interaction.reply(this.i18n.t(locale, 'music.stopError'));
    }
  }
}
