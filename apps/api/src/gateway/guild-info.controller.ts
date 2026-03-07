import { InjectDiscordClient } from '@discord-nestjs/core';
import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ChannelType, Client } from 'discord.js';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('api/guilds/:guildId')
@UseGuards(JwtAuthGuard)
export class GuildInfoController {
  constructor(
    @InjectDiscordClient() private readonly client: Client,
  ) {}

  @Get('channels')
  async getChannels(@Param('guildId') guildId: string) {
    const guild = this.client.guilds.cache.get(guildId);
    if (!guild) return [];

    const channels = await guild.channels.fetch();
    return channels
      .filter((ch) => ch !== null)
      .map((ch) => ({
        id: ch!.id,
        name: ch!.name,
        type: ch!.type,
      }))
      .filter((ch) =>
        [ChannelType.GuildText, ChannelType.GuildVoice, ChannelType.GuildCategory].includes(ch.type),
      );
  }

  @Get('roles')
  async getRoles(@Param('guildId') guildId: string) {
    const guild = this.client.guilds.cache.get(guildId);
    if (!guild) return [];

    const roles = await guild.roles.fetch();
    return roles
      .filter((role) => !role.managed && role.name !== '@everyone')
      .sort((a, b) => b.position - a.position)
      .map((role) => ({
        id: role.id,
        name: role.name,
        color: role.color,
      }));
  }
}
