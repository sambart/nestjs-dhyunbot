import { SlashCommandPipe } from '@discord-nestjs/common';
import { Command, EventParams, Handler, InteractionEvent } from '@discord-nestjs/core';
import { Injectable, Logger } from '@nestjs/common';
import { ClientEvents, GuildMember } from 'discord.js';

import { BotI18nService } from '../../../common/application/bot-i18n.service';
import { LocaleResolverService } from '../../../common/application/locale-resolver.service';
import { MusicService } from '../../application/music.service';
import { PlayDto } from '../dto/play.dto';

@Injectable()
@Command({
  name: 'play',
  description: 'Play a song by entering a YouTube URL',
  nameLocalizations: { ko: '재생' },
  descriptionLocalizations: { ko: 'YouTube URL을 입력하면 노래 재생' },
})
export class MusicPlayCommand {
  private readonly logger = new Logger(MusicPlayCommand.name);

  constructor(
    private readonly musicService: MusicService,
    private readonly i18n: BotI18nService,
    private readonly localeResolver: LocaleResolverService,
  ) {}

  @Handler()
  async onPlay(
    @InteractionEvent(SlashCommandPipe) dto: PlayDto,
    @EventParams() args: ClientEvents['interactionCreate'],
  ): Promise<void> {
    const [interaction] = args;
    if (!interaction.isChatInputCommand()) return;

    const locale = await this.localeResolver.resolve(
      interaction.user.id,
      interaction.guildId,
      interaction.locale,
    );

    const member = interaction.member as GuildMember;
    if (!member.voice.channel) {
      await interaction.reply(this.i18n.t(locale, 'music.joinVoiceChannel'));
      return;
    }

    try {
      await this.musicService.playMusic(dto.url, interaction);
    } catch (error) {
      this.logger.error('Error playing music:', error);
      await interaction.reply(this.i18n.t(locale, 'music.playError'));
    }
  }
}
