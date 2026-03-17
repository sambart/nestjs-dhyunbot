import { Injectable } from '@nestjs/common';
import { ChannelType } from 'discord.js';

import { DiscordRestService } from '../../../discord-rest/discord-rest.service';

@Injectable()
export class DiscordVoiceGateway {
  constructor(private readonly discordRest: DiscordRestService) {}

  async createVoiceChannel(cmd: {
    guildId: string;
    name: string;
    parentCategoryId?: string;
  }): Promise<string> {
    const channel = await this.discordRest.createGuildChannel(cmd.guildId, {
      name: cmd.name,
      type: ChannelType.GuildVoice,
      parent_id: cmd.parentCategoryId,
    });

    return channel.id;
  }

  async moveUserToChannel(guildId: string, userId: string, channelId: string): Promise<void> {
    await this.discordRest.moveMemberVoiceChannel(guildId, userId, channelId);
  }

  async deleteChannel(channelId: string): Promise<void> {
    await this.discordRest.deleteChannel(channelId);
  }
}
