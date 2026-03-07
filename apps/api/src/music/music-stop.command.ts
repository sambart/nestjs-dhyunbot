import { Command, EventParams,Handler } from '@discord-nestjs/core';
import { Injectable, Logger } from '@nestjs/common';
import {
  ClientEvents,
} from 'discord.js';

import { MusicService } from './music.service';

@Injectable()
@Command({
  name: 'stop',
  description: '음악을 중지합니다.',
})
export class MusicStopCommand {
  private readonly logger = new Logger(MusicStopCommand.name);
  constructor(private readonly musicService: MusicService) {}

  @Handler()
  async onStop(@EventParams() args: ClientEvents['interactionCreate']): Promise<void> {
    const [interaction] = args;
    if (!interaction.isChatInputCommand()) return;

    try {
      await this.musicService.stop(interaction);
      //await interaction.reply(`Playing: ${dto.url}`);
    } catch (error) {
      this.logger.error('Error stop music:', error);
      await interaction.reply('음악을 중지하는 동안 오류가 발생했습니다.');
    }
  }
}
