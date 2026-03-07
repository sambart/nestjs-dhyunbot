import { Injectable, Logger } from '@nestjs/common';
import { VoiceRedisRepository } from '../channel/voice/infrastructure/voice.redis.repository';
import { DiscordGateway } from '../gateway/discord.gateway';

export interface UserAggregateData {
  userId: string;
  username: string | null;
  totalVoiceTime: number;
  totalMicOnTime: number;
  totalMicOffTime: number;
  aloneTime: number;
  channelMap: Map<string, { name: string; duration: number }>;
  activeDaysSet: Set<string>;
}

@Injectable()
export class VoiceNameEnricherService {
  private readonly logger = new Logger(VoiceNameEnricherService.name);

  constructor(
    private readonly voiceRedis: VoiceRedisRepository,
    private readonly discordGateway: DiscordGateway,
  ) {}

  /**
   * 유저명 보강: Redis → Discord API → Redis
   */
  async enrichUserNames(guildId: string, userMap: Map<string, UserAggregateData>) {
    const userIdsWithoutName: string[] = [];

    for (const [userId, user] of userMap) {
      if (!user.username || user.username.trim() === '') {
        const cachedName = await this.voiceRedis.getUserName(guildId, userId);
        if (cachedName) {
          user.username = cachedName;
        } else {
          userIdsWithoutName.push(userId);
        }
      }
    }

    if (userIdsWithoutName.length > 0) {
      this.logger.log(`Fetching ${userIdsWithoutName.length} usernames from Discord API`);
      const userNames = await this.discordGateway.getUserNames(guildId, userIdsWithoutName);

      for (const [userId, username] of userNames) {
        const user = userMap.get(userId);
        if (user) {
          user.username = username;
          await this.voiceRedis.setUserName(guildId, userId, username);
        }
      }
    }
  }

  /**
   * 채널명 보강: Redis → Discord API → Redis
   */
  async enrichChannelNames(guildId: string, userMap: Map<string, UserAggregateData>) {
    const channelIdsWithoutName = new Set<string>();

    for (const user of userMap.values()) {
      for (const [channelId, info] of user.channelMap) {
        if (!info.name || info.name.trim() === '') {
          const cachedName = await this.voiceRedis.getChannelName(guildId, channelId);
          if (cachedName) {
            info.name = cachedName;
          } else {
            channelIdsWithoutName.add(channelId);
          }
        }
      }
    }

    if (channelIdsWithoutName.size > 0) {
      this.logger.log(`Fetching ${channelIdsWithoutName.size} channel names from Discord API`);
      const channelNames = await this.discordGateway.getChannelNames(
        guildId,
        Array.from(channelIdsWithoutName),
      );

      for (const [channelId, channelName] of channelNames) {
        await this.voiceRedis.setChannelName(guildId, channelId, channelName);

        for (const user of userMap.values()) {
          const info = user.channelMap.get(channelId);
          if (info && (!info.name || info.name.trim() === '')) {
            info.name = channelName;
          }
        }
      }
    }
  }

  /**
   * 채널 통계의 채널명 보강: Redis → Discord API → Redis
   */
  async enrichChannelStatsNames(guildId: string, channelMap: Map<string, any>) {
    const channelIdsWithoutName: string[] = [];

    for (const [channelId, channel] of channelMap) {
      if (!channel.channelName || channel.channelName.trim() === '') {
        const cachedName = await this.voiceRedis.getChannelName(guildId, channelId);
        if (cachedName) {
          channel.channelName = cachedName;
        } else {
          channelIdsWithoutName.push(channelId);
        }
      }
    }

    if (channelIdsWithoutName.length > 0) {
      this.logger.log(`Fetching ${channelIdsWithoutName.length} channel names from Discord API`);
      const channelNames = await this.discordGateway.getChannelNames(
        guildId,
        channelIdsWithoutName,
      );

      for (const [channelId, channelName] of channelNames) {
        const channel = channelMap.get(channelId);
        if (channel) {
          channel.channelName = channelName;
          await this.voiceRedis.setChannelName(guildId, channelId, channelName);
        }
      }
    }
  }
}
