import { InjectDiscordClient } from '@discord-nestjs/core';
import { Injectable } from '@nestjs/common';
import { Client } from 'discord.js';

import type { MocoMemberResolver } from '../application/moco/moco-member-resolver.port';

/** Discord 캐시를 통한 MocoMemberResolver 구현체. */
@Injectable()
export class MocoMemberDiscordAdapter implements MocoMemberResolver {
  constructor(
    @InjectDiscordClient() private readonly discord: Client,
  ) {}

  async getNewbieIds(
    guildId: string,
    channelId: string,
    userIds: string[],
    cutoffMs: number,
  ): Promise<string[]> {
    const guild = this.discord.guilds.cache.get(guildId);
    if (!guild) return [];

    const channel = guild.channels.cache.get(channelId);
    if (!channel?.isVoiceBased()) return [];

    const members = [...channel.members.values()].filter((m) => userIds.includes(m.id));

    return members
      .filter((m) => !m.user.bot && m.joinedAt && m.joinedAt.getTime() >= cutoffMs)
      .map((m) => m.id);
  }

  async isValidHunter(
    guildId: string,
    hunterId: string,
    cutoffMs: number,
    allowNewbie: boolean,
  ): Promise<boolean> {
    const guild = this.discord.guilds.cache.get(guildId);
    if (!guild) return false;

    const member = guild.members.cache.get(hunterId);
    if (!member || member.user.bot) return false;

    const isNewbie = member.joinedAt && member.joinedAt.getTime() >= cutoffMs;
    if (isNewbie && !allowNewbie) return false;

    return true;
  }

  async getNewbiePeerIds(
    guildId: string,
    peerIds: string[],
    cutoffMs: number,
  ): Promise<string[]> {
    const guild = this.discord.guilds.cache.get(guildId);
    if (!guild) return [];

    const newbies: string[] = [];
    for (const peerId of peerIds) {
      const member = guild.members.cache.get(peerId);
      if (!member || member.user.bot) continue;
      if (member.joinedAt && member.joinedAt.getTime() >= cutoffMs) {
        newbies.push(peerId);
      }
    }
    return newbies;
  }
}
