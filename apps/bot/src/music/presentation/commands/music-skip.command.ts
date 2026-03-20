import { Command, EventParams, Handler } from '@discord-nestjs/core';
import { Injectable, Logger } from '@nestjs/common';
import { ClientEvents } from 'discord.js';

import { BotI18nService } from '../../../common/application/bot-i18n.service';
import { LocaleResolverService } from '../../../common/application/locale-resolver.service';
import { MusicService } from '../../application/music.service';
import { buildNowPlayingEmbed } from '../utils/now-playing-embed.builder';

@Injectable()
@Command({
  name: 'skip',
  description: 'Skip the current song',
  nameLocalizations: { ko: '스킵' },
  descriptionLocalizations: { ko: '음악을 스킵합니다.' },
})
export class MusicSkipCommand {
  private readonly logger = new Logger(MusicSkipCommand.name);

  constructor(
    private readonly musicService: MusicService,
    private readonly i18n: BotI18nService,
    private readonly localeResolver: LocaleResolverService,
  ) {}

  @Handler()
  async onSkip(@EventParams() args: ClientEvents['interactionCreate']): Promise<void> {
    const [interaction] = args;
    if (!interaction.isChatInputCommand()) return;

    const locale = await this.localeResolver.resolve(
      interaction.user.id,
      interaction.guildId,
      interaction.locale,
    );

    await interaction.deferReply();

    try {
      const { player, nextTrack } = await this.musicService.skip(interaction.guildId ?? '');

      if (nextTrack) {
        const embed = buildNowPlayingEmbed({ track: nextTrack, player, status: 'playing' });
        await interaction.followUp({
          content: this.i18n.t(locale, 'music.skipped'),
          embeds: [embed],
        });
      } else {
        this.musicService.stop(interaction.guildId ?? '');
        await interaction.followUp(this.i18n.t(locale, 'music.skippedNoNext'));
      }
    } catch (error) {
      this.logger.error('Error skip music:', error);
      await interaction.followUp({ content: this.i18n.t(locale, 'music.skipError'), ephemeral: true });
    }
  }
}
