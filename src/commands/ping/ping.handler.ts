import { Injectable } from '@nestjs/common';
import { Message, EmbedBuilder, ChannelType } from 'discord.js';

import { ICommandHandler } from '../ICommandHandler';

@Injectable()
export class PingHandler implements ICommandHandler {
  name = 'ping';
  regex = new RegExp(`^ping$`, 'i');

  test(content: string): boolean {
    return this.regex.test(content);
  }

  async execute(message: Message): Promise<void> {
    const embed = new EmbedBuilder().setDescription('Pong!');
    const mChannel = message.channel;

    if (mChannel.type === ChannelType.GuildText) {
      mChannel.send({ embeds: [embed] });
    }
  }
}
