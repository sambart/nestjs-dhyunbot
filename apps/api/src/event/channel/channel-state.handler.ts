import { Injectable, Logger } from '@nestjs/common';
import { InjectDiscordClient, On } from '@discord-nestjs/core';
import { Client, Channel } from 'discord.js';
import { ChannelService } from 'src/channel/channel.service';

@Injectable()
export class ChannelStateHandler {
  private readonly logger = new Logger(ChannelStateHandler.name);

  constructor(
    @InjectDiscordClient() private readonly client: Client,
    private readonly channelService: ChannelService,
  ) {}

  @On('channelCreate')
  handleChannelCreate(channel: Channel): void {
    if ('name' in channel) {
      this.logger.log(`New channel created: ${channel.name}`);
    }
  }

  // 채널 삭제 이벤트 처리
  @On('channelDelete')
  handleChannelDelete(channel: Channel): void {
    if ('name' in channel) {
      this.logger.log(`Channel deleted: ${channel.name}`);
    }
  }

  // 채널 업데이트 이벤트 처리
  @On('channelUpdate')
  handleChannelUpdate(oldChannel: Channel, newChannel: Channel): void {
    if ('name' in oldChannel && 'name' in newChannel) {
      this.logger.log(`Channel updated from ${oldChannel.name} to ${newChannel.name}`);
    }
  }
}
