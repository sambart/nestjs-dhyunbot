import { InjectDiscordClient } from '@discord-nestjs/core';
import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ChannelType, Client } from 'discord.js';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('api/guilds/:guildId')
@UseGuards(JwtAuthGuard)
export class GuildInfoController {
  constructor(
    @InjectDiscordClient() private readonly client: Client,
  ) {}

  @Get('channels')
  async getChannels(
    @Param('guildId') guildId: string,
    @Query('refresh') refresh?: string,
  ) {
    const guild = this.client.guilds.cache.get(guildId);
    if (!guild) return [];

    const channels =
      refresh === 'true'
        ? await guild.channels.fetch()
        : guild.channels.cache;

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
  async getRoles(
    @Param('guildId') guildId: string,
    @Query('refresh') refresh?: string,
  ) {
    const guild = this.client.guilds.cache.get(guildId);
    if (!guild) return [];

    const roles =
      refresh === 'true'
        ? await guild.roles.fetch()
        : guild.roles.cache;

    return roles
      .filter((role) => !role.managed && role.name !== '@everyone')
      .sort((a, b) => b.position - a.position)
      .map((role) => ({
        id: role.id,
        name: role.name,
        color: role.color,
      }));
  }

  @Get('emojis')
  async getEmojis(
    @Param('guildId') guildId: string,
    @Query('refresh') refresh?: string,
  ) {
    const guild = this.client.guilds.cache.get(guildId);
    if (!guild) return [];

    const emojis =
      refresh === 'true'
        ? await guild.emojis.fetch()
        : guild.emojis.cache;

    return emojis
      .filter((emoji) => emoji.available !== false)
      .map((emoji) => ({
        id: emoji.id,
        name: emoji.name,
        animated: emoji.animated ?? false,
      }));
  }

  @Get('commands')
  async getCommands() {
    try {
      const commands = await this.client.application?.commands.fetch();
      if (!commands) return [];

      return commands.map((cmd) => ({
        id: cmd.id,
        name: cmd.name,
        description: cmd.description,
      }));
    } catch {
      return [];
    }
  }
}
