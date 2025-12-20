import { Injectable } from '@nestjs/common';
import { Command, Handler, InteractionEvent, EventParams } from '@discord-nestjs/core';
import { MusicService } from './music.service';
import { PlayDto } from './play.dto';
import {
  CommandInteraction,
  GuildMember,
  ClientEvents,
  ChatInputCommandInteraction,
} from 'discord.js';
import { SlashCommandPipe } from '@discord-nestjs/common';

@Injectable()
@Command({
  name: 'play',
  description: 'YouTube URL을 입력하면 노래 재생',
})
export class MusicPlayCommand {
  constructor(private readonly musicService: MusicService) {}

  @Handler()
  async onPlay(
    @InteractionEvent(SlashCommandPipe) dto: PlayDto, // DTO를 사용하여 매개변수 수집
    @EventParams() args: ClientEvents['interactionCreate'],
  ): Promise<void> {
    // console.log('DTO', dto);
    // console.log('ARGS', args);

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
      console.error('Error playing music:', error);
      await interaction.reply('URl을 재생하는 동안 오류가 발생했습니다.');
    }
  }
}
