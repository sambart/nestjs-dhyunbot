import { InjectDiscordClient, On } from '@discord-nestjs/core';
import { Injectable, Logger } from '@nestjs/common';
import { Channel,Client } from 'discord.js';

import { ChannelService } from '../../channel/channel.service';

@Injectable()
export class ChannelStateHandler {
  private readonly logger = new Logger(ChannelStateHandler.name);

  constructor(
    @InjectDiscordClient() private readonly client: Client,
    private readonly channelService: ChannelService,
  ) {}

  @On('channelCreate')
  handleChannelCreate(channel: Channel): void {
    try {
      if ('name' in channel) {
        this.logger.log(`New channel created: ${channel.name}`);
      }
    } catch (error) {
      this.logger.error('[channelCreate] Error', (error as Error).stack);
    }
  }

  @On('channelDelete')
  handleChannelDelete(channel: Channel): void {
    try {
      if ('name' in channel) {
        this.logger.log(`Channel deleted: ${channel.name}`);
      }
    } catch (error) {
      this.logger.error('[channelDelete] Error', (error as Error).stack);
    }
  }

  @On('channelUpdate')
  handleChannelUpdate(oldChannel: Channel, newChannel: Channel): void {
    try {
      if ('name' in oldChannel && 'name' in newChannel) {
        this.logger.log(`Channel updated from ${oldChannel.name} to ${newChannel.name}`);
      }
    } catch (error) {
      this.logger.error('[channelUpdate] Error', (error as Error).stack);
    }
  }
}
