import { Injectable } from '@nestjs/common';

import { DiscordRestService } from '../../discord-rest/discord-rest.service';
import type { MocoMemberResolver } from '../application/moco/moco-member-resolver.port';

/** Discord REST API를 통한 MocoMemberResolver 구현체. */
@Injectable()
export class MocoMemberDiscordAdapter implements MocoMemberResolver {
  constructor(private readonly discordRest: DiscordRestService) {}

  async getNewbieIds(
    guildId: string,
    channelId: string,
    userIds: string[],
    cutoffMs: number,
  ): Promise<string[]> {
    const newbieIds: string[] = [];

    for (const userId of userIds) {
      const member = await this.discordRest.fetchGuildMember(guildId, userId);
      if (!member || member.user?.bot) continue;

      const joinedAt = member.joined_at ? new Date(member.joined_at).getTime() : null;
      if (joinedAt && joinedAt >= cutoffMs) {
        newbieIds.push(userId);
      }
    }

    return newbieIds;
  }

  async isValidHunter(
    guildId: string,
    hunterId: string,
    cutoffMs: number,
    allowNewbie: boolean,
  ): Promise<boolean> {
    const member = await this.discordRest.fetchGuildMember(guildId, hunterId);
    if (!member || member.user?.bot) return false;

    const joinedAt = member.joined_at ? new Date(member.joined_at).getTime() : null;
    const isNewbie = joinedAt && joinedAt >= cutoffMs;
    if (isNewbie && !allowNewbie) return false;

    return true;
  }

  async getNewbiePeerIds(
    guildId: string,
    peerIds: string[],
    cutoffMs: number,
  ): Promise<string[]> {
    const newbies: string[] = [];

    for (const peerId of peerIds) {
      const member = await this.discordRest.fetchGuildMember(guildId, peerId);
      if (!member || member.user?.bot) continue;

      const joinedAt = member.joined_at ? new Date(member.joined_at).getTime() : null;
      if (joinedAt && joinedAt >= cutoffMs) {
        newbies.push(peerId);
      }
    }

    return newbies;
  }
}
