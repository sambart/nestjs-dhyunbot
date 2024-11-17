import { Injectable, Logger } from '@nestjs/common';
import { Client, Message, EmbedBuilder, ChannelType } from 'discord.js';

import { PingHandler } from './ping/ping.handler';
import { ICommandHandler } from './ICommandHandler';
import { ConfigService } from '../config/config.service';

@Injectable()
export class CommandsService {
  commandHandlers: ICommandHandler[] = [];

  constructor(
    private readonly pingHandler: PingHandler,
    private readonly configService: ConfigService,
  ) {
    this.commandHandlers = [pingHandler];
  }
  register(client: Client) {
    for (const command of this.commandHandlers) {
      Logger.log(
        `${command.name} registered => ${command.regex ?? command.description ?? '?'}`,
        'CommandExplorer',
      );
    }

    client.on('message', async (message) => {
      try {
        await this.messageHandler(message);
      } catch (error) {
        Logger.error(error.message, error.stack);
        const errorEmbed = new EmbedBuilder().setColor('Red').setDescription(error.message);
        message.channel.send(errorEmbed);
      }
    });
  }

  async messageHandler(message: Message) {
    if (message.author.bot) return;
    const { content } = message;

    // Test for custom prefix
    //const serverPrefix = await this.serverService.getServerPrefix(message.guild.id);
    const serverPrefix = '!';
    const prefixRegexp = new RegExp(
      `^(${this.escapePrefixForRegexp(
        this.configService.adminPrefix,
      )}|${this.escapePrefixForRegexp(serverPrefix)})`,
      'i',
    );
    if (!prefixRegexp.test(message.content)) return;
    const serverPrefixRegexp = new RegExp(`^${this.escapePrefixForRegexp(serverPrefix)}`, 'i');
    if (serverPrefixRegexp.test(message.content)) {
      // test if channel is allowed only on user commands
      /*
      if (!(await this.serverService.isChannelAllowed(message.guild.id, message.channel.id))) {
        return;
      }
        */
      message.content = message.content.replace(serverPrefixRegexp, '').trim();
    }

    for (const handler of this.commandHandlers) {
      if (handler.test(message.content)) {
        try {
          Logger.debug(`executing command [${handler.name}] => ${content}`);
          await handler.execute(message);
          return;
        } catch (error) {
          Logger.error(error.message, error.stack);
          const errorEmbed = new EmbedBuilder().setColor('Red').setDescription(error.message);

          const mChannel = message.channel;

          if (mChannel.type === ChannelType.GuildText) {
            mChannel.send({ embeds: [errorEmbed] });
          }
        }
      }
    }
  }

  private escapePrefixForRegexp(serverPrefix: string): string {
    const char = serverPrefix[0];
    if ('./+\\*!?)([]{}^$'.split('').includes(char)) return `\\${serverPrefix}`;
    return serverPrefix;
  }
}
