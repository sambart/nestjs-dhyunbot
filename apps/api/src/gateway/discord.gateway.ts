import { Injectable, Logger } from '@nestjs/common';
import { InjectDiscordClient } from '@discord-nestjs/core';
import { Client, Guild, GuildMember, GuildChannel } from 'discord.js';

/**
 * Discord API와 통신하는 Gateway 클래스
 * Discord 관련 모든 API 호출은 이 클래스를 통해 수행
 */
@Injectable()
export class DiscordGateway {
  private readonly logger = new Logger(DiscordGateway.name);

  // 캐시 (메모리 효율성을 위해 LRU 캐시 고려 가능)
  private guildCache = new Map<string, Guild>();
  private userCache = new Map<string, string>(); // userId -> username
  private channelCache = new Map<string, string>(); // channelId -> channelName

  constructor(
    @InjectDiscordClient()
    private readonly client: Client,
  ) {}

  /**
   * Guild 가져오기 (캐시 사용)
   */
  async getGuild(guildId: string): Promise<Guild | null> {
    try {
      // 캐시 확인
      if (this.guildCache.has(guildId)) {
        return this.guildCache.get(guildId);
      }

      // Discord API 호출
      const guild = await this.client.guilds.fetch(guildId);
      this.guildCache.set(guildId, guild);
      return guild;
    } catch (error) {
      this.logger.warn(`Failed to fetch guild ${guildId}:`, error.message);
      return null;
    }
  }

  /**
   * Guild 이름 가져오기
   */
  async getGuildName(guildId: string): Promise<string> {
    const guild = await this.getGuild(guildId);
    return guild ? guild.name : `Guild-${guildId.slice(0, 6)}`;
  }

  /**
   * 유저명 가져오기 (캐시 사용)
   */
  async getUserName(guildId: string, userId: string): Promise<string> {
    try {
      // 캐시 확인
      const cacheKey = `${guildId}:${userId}`;
      if (this.userCache.has(cacheKey)) {
        return this.userCache.get(cacheKey);
      }

      // Guild 가져오기
      const guild = await this.getGuild(guildId);
      if (!guild) {
        return `User-${userId.slice(0, 6)}`;
      }

      // Member 가져오기
      const member = await guild.members.fetch(userId).catch(() => null);
      const username = member ? member.user.displayName : `User-${userId.slice(0, 6)}`;

      // 캐시 저장
      this.userCache.set(cacheKey, username);
      return username;
    } catch (error) {
      this.logger.warn(`Failed to fetch user ${userId}:`, error.message);
      return `User-${userId.slice(0, 6)}`;
    }
  }

  /**
   * 채널명 가져오기 (캐시 사용)
   */
  async getChannelName(guildId: string, channelId: string): Promise<string> {
    try {
      // GLOBAL 채널은 특수 처리
      if (channelId === 'GLOBAL') {
        return '전체';
      }

      // 캐시 확인
      const cacheKey = `${guildId}:${channelId}`;
      if (this.channelCache.has(cacheKey)) {
        return this.channelCache.get(cacheKey);
      }

      // Guild 가져오기
      const guild = await this.getGuild(guildId);
      if (!guild) {
        return `Channel-${channelId.slice(0, 6)}`;
      }

      // Channel 가져오기
      const channel = await guild.channels.fetch(channelId).catch(() => null);
      const channelName = channel ? channel.name : `Channel-${channelId.slice(0, 6)}`;

      // 캐시 저장
      this.channelCache.set(cacheKey, channelName);
      return channelName;
    } catch (error) {
      this.logger.warn(`Failed to fetch channel ${channelId}:`, error.message);
      return `Channel-${channelId.slice(0, 6)}`;
    }
  }

  /**
   * 여러 유저명을 일괄 조회 (성능 최적화)
   */
  async getUserNames(guildId: string, userIds: string[]): Promise<Map<string, string>> {
    const result = new Map<string, string>();
    const guild = await this.getGuild(guildId);

    if (!guild) {
      userIds.forEach((userId) => {
        result.set(userId, `User-${userId.slice(0, 6)}`);
      });
      return result;
    }

    // 캐시에 없는 유저만 조회
    const uncachedUserIds = userIds.filter((userId) => !this.userCache.has(`${guildId}:${userId}`));

    if (uncachedUserIds.length > 0) {
      try {
        // 일괄 조회
        await guild.members.fetch({ user: uncachedUserIds });
      } catch (error) {
        this.logger.warn('Failed to fetch members in bulk:', error.message);
      }
    }

    // 결과 생성
    for (const userId of userIds) {
      const cacheKey = `${guildId}:${userId}`;

      if (this.userCache.has(cacheKey)) {
        result.set(userId, this.userCache.get(cacheKey));
      } else {
        const member = guild.members.cache.get(userId);
        const username = member ? member.user.displayName : `User-${userId.slice(0, 6)}`;
        this.userCache.set(cacheKey, username);
        result.set(userId, username);
      }
    }

    return result;
  }

  /**
   * 여러 채널명을 일괄 조회 (성능 최적화)
   */
  async getChannelNames(guildId: string, channelIds: string[]): Promise<Map<string, string>> {
    const result = new Map<string, string>();
    const guild = await this.getGuild(guildId);

    if (!guild) {
      channelIds.forEach((channelId) => {
        if (channelId === 'GLOBAL') {
          result.set(channelId, '전체');
        } else {
          result.set(channelId, `Channel-${channelId.slice(0, 6)}`);
        }
      });
      return result;
    }

    for (const channelId of channelIds) {
      if (channelId === 'GLOBAL') {
        result.set(channelId, '전체');
        continue;
      }

      const cacheKey = `${guildId}:${channelId}`;

      if (this.channelCache.has(cacheKey)) {
        result.set(channelId, this.channelCache.get(cacheKey));
      } else {
        const channel = guild.channels.cache.get(channelId);
        const channelName = channel ? channel.name : `Channel-${channelId.slice(0, 6)}`;
        this.channelCache.set(cacheKey, channelName);
        result.set(channelId, channelName);
      }
    }

    return result;
  }

  /**
   * 캐시 클리어 (필요한 경우)
   */
  clearCache() {
    this.guildCache.clear();
    this.userCache.clear();
    this.channelCache.clear();
    this.logger.log('Discord gateway cache cleared');
  }

  /**
   * 특정 길드의 캐시만 클리어
   */
  clearGuildCache(guildId: string) {
    this.guildCache.delete(guildId);

    // 해당 길드의 유저/채널 캐시 제거
    for (const key of this.userCache.keys()) {
      if (key.startsWith(`${guildId}:`)) {
        this.userCache.delete(key);
      }
    }
    for (const key of this.channelCache.keys()) {
      if (key.startsWith(`${guildId}:`)) {
        this.channelCache.delete(key);
      }
    }

    this.logger.log(`Cleared cache for guild ${guildId}`);
  }
}
