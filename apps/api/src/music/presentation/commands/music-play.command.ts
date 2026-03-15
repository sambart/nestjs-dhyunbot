import { SlashCommandPipe } from '@discord-nestjs/common';
import { Command, EventParams, Handler, InteractionEvent } from '@discord-nestjs/core';
import { Injectable, Logger } from '@nestjs/common';
import { ClientEvents, GuildMember } from 'discord.js';

import { MusicService } from '../../application/music.service';
import { PlayDto } from '../dto/play.dto';

@Injectable()
@Command({
  name: 'play',
  description: 'YouTube URL을 입력하면 노래 재생',
})
export class MusicPlayCommand {
  private readonly logger = new Logger(MusicPlayCommand.name);
  constructor(private readonly musicService: MusicService) {}

  @Handler()
  async onPlay(
    @InteractionEvent(SlashCommandPipe) dto: PlayDto, // DTO를 사용하여 매개변수 수집
    @EventParams() args: ClientEvents['interactionCreate'],
  ): Promise<void> {
    const [interaction] = args;
    if (!interaction.isChatInputCommand()) return;

    const member = interaction.member as GuildMember;
    if (!member.voice.channel) {
      await interaction.reply('재생하려면 음성 채널에 참가해야 합니다.');
      return;
    }

    try {
      await this.musicService.playMusic(dto.url, interaction);
      //await interaction.reply(`Playing: ${dto.url}`);
    } catch (error) {
      this.logger.error('Error playing music:', error);
      await interaction.reply('URl을 재생하는 동안 오류가 발생했습니다.');
    }
  }
}
