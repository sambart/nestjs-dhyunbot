import { Injectable } from '@nestjs/common';
import { Command, Handler, InteractionEvent, EventParams } from '@discord-nestjs/core';
import { MusicService } from './music.service';
import {
  CommandInteraction,
  GuildMember,
  ClientEvents,
  ChatInputCommandInteraction,
} from 'discord.js';
import { SlashCommandPipe } from '@discord-nestjs/common';

@Injectable()
@Command({
  name: 'stop',
  description: '음악을 중지합니다.',
})
export class MusicStopCommand {
  constructor(private readonly musicService: MusicService) {}

  @Handler()
  async onStop(@EventParams() args: ClientEvents['interactionCreate']): Promise<void> {
    const [interaction] = args;
    if (!interaction.isChatInputCommand()) return;

    try {
      await this.musicService.stop(interaction);
      //await interaction.reply(`Playing: ${dto.url}`);
    } catch (error) {
      console.error('Error stop music:', error);
      await interaction.reply('음악을 중지하는 동안 오류가 발생했습니다.');
    }
  }
}
