import { InjectDiscordClient } from '@discord-nestjs/core';
import { Injectable } from '@nestjs/common';
import { ChannelType, Client } from 'discord.js';

@Injectable()
export class DiscordVoiceGateway {
  constructor(@InjectDiscordClient() private readonly client: Client) {}

  async createVoiceChannel(cmd: {
    guildId: string;
    name: string;
    parentCategoryId?: string;
  }): Promise<string> {
    const guild = await this.client.guilds.fetch(cmd.guildId);

    const channel = await guild.channels.create({
      name: cmd.name,
      type: ChannelType.GuildVoice,
      parent: cmd.parentCategoryId,
    });

    return channel.id;
  }

  async moveUserToChannel(guildId: string, userId: string, channelId: string): Promise<void> {
    const guild = await this.client.guilds.fetch(guildId);
    const member = await guild.members.fetch(userId);

    await member.voice.setChannel(channelId);
  }

  async deleteChannel(channelId: string): Promise<void> {
    const channel = await this.client.channels.fetch(channelId);
    if (channel?.isVoiceBased()) {
      await channel.delete();
    }
  }
}
