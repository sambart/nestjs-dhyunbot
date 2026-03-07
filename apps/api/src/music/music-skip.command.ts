import { Command, EventParams,Handler } from '@discord-nestjs/core';
import { Injectable, Logger } from '@nestjs/common';
import {
  ClientEvents,
} from 'discord.js';

import { MusicService } from './music.service';

@Injectable()
@Command({
  name: 'skip',
  description: '음악을 스킵합니다.',
})
export class MusicSkipCommand {
  private readonly logger = new Logger(MusicSkipCommand.name);
  constructor(private readonly musicService: MusicService) {}

  @Handler()
  async onSkip(@EventParams() args: ClientEvents['interactionCreate']): Promise<void> {
    const [interaction] = args;
    if (!interaction.isChatInputCommand()) return;

    try {
      await this.musicService.skip(interaction);
      //await interaction.reply(`Playing: ${dto.url}`);
    } catch (error) {
      this.logger.error('Error skip music:', error);
      await interaction.reply('음악을 스킵하는 동안 오류가 발생했습니다.');
    }
  }
}
