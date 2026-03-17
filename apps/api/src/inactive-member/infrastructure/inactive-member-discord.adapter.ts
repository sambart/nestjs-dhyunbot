import { InjectDiscordClient } from '@discord-nestjs/core';
import { Injectable, Logger } from '@nestjs/common';
import { Client, Collection, EmbedBuilder, type Guild, type GuildMember } from 'discord.js';

import { getErrorStack } from '../../common/util/error.util';

/** Discord API를 통한 비활동 회원 관련 조작 전담. */
@Injectable()
export class InactiveMemberDiscordAdapter {
  private readonly logger = new Logger(InactiveMemberDiscordAdapter.name);

  constructor(
    @InjectDiscordClient() private readonly discord: Client,
  ) {}

  /** 길드 객체를 API로 페치한다. */
  async fetchGuild(guildId: string): Promise<Guild | null> {
    try {
      return (await this.discord.guilds.fetch(guildId)) as Guild;
    } catch {
      return null;
    }
  }

  /** 캐시에서 길드 객체를 가져온다. */
  getGuildFromCache(guildId: string): Guild | undefined {
    return this.discord.guilds.cache.get(guildId);
  }

  /** 캐시에 있는 모든 길드 ID를 반환한다. */
  getCachedGuildIds(): string[] {
    return this.discord.guilds.cache.map((g) => g.id);
  }

  /**
   * 길드 전체 멤버를 API로 가져온다.
   * Gateway rate limit 발생 시 재시도.
   */
  async fetchGuildMembers(guildId: string, maxRetries = 3): Promise<Collection<string, GuildMember> | null> {
    const guild = this.discord.guilds.cache.get(guildId);
    if (!guild) return null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await guild.members.fetch();
      } catch (err) {
        const isRateLimit =
          err instanceof Error && err.constructor.name === 'GatewayRateLimitError';

        if (!isRateLimit || attempt === maxRetries) {
          this.logger.error(
            `[INACTIVE] Members fetch failed guild=${guildId}`,
            getErrorStack(err),
          );
          return null;
        }

        const retryAfterMs = this.extractRetryAfter(err as Error) ?? 25_000;
        this.logger.warn(
          `[INACTIVE] Gateway rate limit hit (attempt ${attempt}/${maxRetries}), retrying after ${retryAfterMs}ms`,
        );
        await this.sleep(retryAfterMs);
      }
    }

    return null;
  }

  /** 멤버 displayName을 일괄 조회한다. 캐시 우선, 실패 시 API 호출. */
  async fetchMemberDisplayNames(
    guildId: string,
    userIds: string[],
  ): Promise<Record<string, string>> {
    const names: Record<string, string> = {};
    const guild = this.discord.guilds.cache.get(guildId);
    if (!guild) return names;

    for (const userId of userIds) {
      try {
        const member = guild.members.cache.get(userId);
        if (member) {
          names[userId] = member.displayName;
          continue;
        }
        const fetched = await guild.members.fetch(userId).catch(() => null);
        names[userId] = fetched?.displayName ?? userId;
      } catch {
        // user.fetch fallback
        try {
          const user = await this.discord.users.fetch(userId).catch(() => null);
          names[userId] = user?.displayName ?? userId;
        } catch {
          names[userId] = userId;
        }
      }
    }
    return names;
  }

  /** 멤버를 강퇴한다. */
  async kickMember(guild: Guild, userId: string, reason: string): Promise<boolean> {
    try {
      const member = await guild.members.fetch(userId).catch(() => null);
      if (!member) return false;
      if (!member.kickable) {
        this.logger.warn(`[INACTIVE] Kick not permitted userId=${userId} (role hierarchy)`);
        return false;
      }
      await member.kick(reason);
      return true;
    } catch (err) {
      this.logger.warn(`[INACTIVE] Kick failed userId=${userId}`, getErrorStack(err));
      return false;
    }
  }

  /** 멤버에게 DM을 보낸다. */
  async sendDm(guild: Guild, userId: string, embed: EmbedBuilder): Promise<boolean> {
    try {
      const member = await guild.members.fetch(userId).catch(() => null);
      if (!member) return false;
      await member.send({ embeds: [embed] });
      return true;
    } catch (err) {
      this.logger.warn(`[INACTIVE] DM failed userId=${userId}`, getErrorStack(err));
      return false;
    }
  }

  /** DM 전송 시 멤버 displayName을 가져온다. */
  async fetchMemberDisplayName(guild: Guild, userId: string): Promise<string | null> {
    try {
      const member = await guild.members.fetch(userId).catch(() => null);
      return member?.displayName ?? null;
    } catch {
      return null;
    }
  }

  /** 멤버에게 역할을 부여/제거한다. */
  async modifyRole(
    guild: Guild,
    userId: string,
    roleId: string,
    action: 'add' | 'remove',
  ): Promise<boolean> {
    try {
      const member = await guild.members.fetch(userId).catch(() => null);
      if (!member) return false;
      if (action === 'add') {
        await member.roles.add(roleId);
      } else {
        await member.roles.remove(roleId);
      }
      return true;
    } catch (err) {
      this.logger.warn(`[INACTIVE] Role ${action} failed userId=${userId}`, getErrorStack(err));
      return false;
    }
  }

  private extractRetryAfter(err: Error): number | null {
    const match = err.message.match(/Retry after ([\d.]+)/);
    if (!match) return null;
    return Math.ceil(parseFloat(match[1]) * 1000) + 1000;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
