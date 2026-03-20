import { SlashCommandPipe } from '@discord-nestjs/common';
import { Command, EventParams, Handler, InteractionEvent } from '@discord-nestjs/core';
import { Injectable, Logger } from '@nestjs/common';
import { ClientEvents, GuildMember } from 'discord.js';

import { BotI18nService } from '../../../common/application/bot-i18n.service';
import { LocaleResolverService } from '../../../common/application/locale-resolver.service';
import { MusicService } from '../../application/music.service';
import { PlayDto } from '../dto/play.dto';
import { buildNowPlayingEmbed } from '../utils/now-playing-embed.builder';

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

    // discord.js의 GuildMember 타입은 guild 컨텍스트에서만 사용되므로 안전한 단언
    const member = interaction.member as GuildMember;
    if (!member.voice.channel) {
      await interaction.reply({ content: this.i18n.t(locale, 'music.joinVoiceChannel'), ephemeral: true });
      return;
    }

    await interaction.deferReply();

    try {
      const result = await this.musicService.play({
        query: dto.url,
        guildId: interaction.guildId ?? '',
        textChannelId: interaction.channelId,
        voiceChannelId: member.voice.channelId ?? '',
        requesterId: interaction.user.id,
      });

      if (result.isPlaylist) {
        const content = this.i18n.t(locale, 'music.playlistAdded', {
          count: String(result.trackCount),
        });
        await interaction.followUp({ content });
      } else if (result.isQueued) {
        const embed = buildNowPlayingEmbed({ track: result.firstTrack, player: result.player, status: 'queued' });
        await interaction.followUp({
          content: this.i18n.t(locale, 'music.addedToQueue'),
          embeds: [embed],
        });
      } else {
        const currentTrack = result.player.queue.current;
        const embed = buildNowPlayingEmbed({
          track: currentTrack ?? result.firstTrack,
          player: result.player,
          status: 'playing',
        });
        await interaction.followUp({ embeds: [embed] });
      }
    } catch (error) {
      this.logger.error('Error playing music:', error);
      await interaction.followUp({ content: this.i18n.t(locale, 'music.playError'), ephemeral: true });
    }
  }
}
