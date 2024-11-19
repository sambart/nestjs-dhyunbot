import { Injectable, Logger } from '@nestjs/common';
import { InjectDiscordClient, Once, On, DiscordClientProvider } from '@discord-nestjs/core';
import { Client, Message, EmbedBuilder, ChannelType } from 'discord.js';
import { Channel } from 'discord.js';

@Injectable()
export class ChannelService {
  constructor(
    @InjectDiscordClient()
    private readonly client: Client,
    private readonly discordProvider: DiscordClientProvider,
  ) {}

  @On('channelCreate')
  handleChannelCreate(channel: Channel): void {
    if ('name' in channel) {
      Logger.log(`New channel created: ${channel.name}`);
    }
  }

  // 채널 삭제 이벤트 처리
  @On('channelDelete')
  handleChannelDelete(channel: Channel): void {
    if ('name' in channel) {
      Logger.log(`Channel deleted: ${channel.name}`);
    }
  }

  // 채널 업데이트 이벤트 처리
  @On('channelUpdate')
  handleChannelUpdate(oldChannel: Channel, newChannel: Channel): void {
    if ('name' in oldChannel && 'name' in newChannel) {
      Logger.log(`Channel updated from ${oldChannel.name} to ${newChannel.name}`);
    }
  }
}
