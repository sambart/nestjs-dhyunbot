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
  name: 'skip',
  description: '음악을 스킵합니다.',
})
export class MusicSkipCommand {
  constructor(private readonly musicService: MusicService) {}

  @Handler()
  async onSkip(@EventParams() args: ClientEvents['interactionCreate']): Promise<void> {
    const [interaction] = args;
    if (!interaction.isChatInputCommand()) return;

    try {
      await this.musicService.skip(interaction);
      //await interaction.reply(`Playing: ${dto.url}`);
    } catch (error) {
      console.error('Error skip music:', error);
      await interaction.reply('음악을 스킵하는 동안 오류가 발생했습니다.');
    }
  }
}
