import { Injectable, Logger } from '@nestjs/common';

import { VoiceRedisRepository } from '../channel/voice/infrastructure/voice-redis.repository';
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
   * 유저명 보강: Redis MGET → Discord API → Redis
   */
  async enrichUserNames(guildId: string, userMap: Map<string, UserAggregateData>) {
    // 1. 이름이 없는 유저 ID 수집
    const userIdsWithoutName: string[] = [];
    for (const [userId, user] of userMap) {
      if (!user.username || user.username.trim() === '') {
        userIdsWithoutName.push(userId);
      }
    }

    if (userIdsWithoutName.length === 0) return;

    // 2. Redis MGET으로 일괄 조회
    const cachedNames = await this.voiceRedis.getUserNames(guildId, userIdsWithoutName);
    const stillMissing: string[] = [];

    for (const userId of userIdsWithoutName) {
      const cachedName = cachedNames.get(userId);
      if (cachedName) {
        userMap.get(userId)!.username = cachedName;
      } else {
        stillMissing.push(userId);
      }
    }

    // 3. 남은 것은 Discord API 배치 조회
    if (stillMissing.length > 0) {
      this.logger.log(`Fetching ${stillMissing.length} usernames from Discord API`);
      const userNames = await this.discordGateway.getUserNames(guildId, stillMissing);

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
   * 채널명 보강: Redis MGET → Discord API → Redis
   */
  async enrichChannelNames(guildId: string, userMap: Map<string, UserAggregateData>) {
    // 1. 이름이 없는 채널 ID 수집
    const channelIdsWithoutName = new Set<string>();
    for (const user of userMap.values()) {
      for (const [channelId, info] of user.channelMap) {
        if (!info.name || info.name.trim() === '') {
          channelIdsWithoutName.add(channelId);
        }
      }
    }

    if (channelIdsWithoutName.size === 0) return;

    // 2. Redis MGET으로 일괄 조회
    const channelIdList = Array.from(channelIdsWithoutName);
    const cachedNames = await this.voiceRedis.getChannelNames(guildId, channelIdList);
    const stillMissing: string[] = [];

    for (const channelId of channelIdList) {
      const cachedName = cachedNames.get(channelId);
      if (cachedName) {
        // 모든 유저의 해당 채널에 이름 적용
        for (const user of userMap.values()) {
          const info = user.channelMap.get(channelId);
          if (info && (!info.name || info.name.trim() === '')) {
            info.name = cachedName;
          }
        }
      } else {
        stillMissing.push(channelId);
      }
    }

    // 3. 남은 것은 Discord API 배치 조회
    if (stillMissing.length > 0) {
      this.logger.log(`Fetching ${stillMissing.length} channel names from Discord API`);
      const channelNames = await this.discordGateway.getChannelNames(guildId, stillMissing);

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
   * 채널 통계의 채널명 보강: Redis MGET → Discord API → Redis
   */
  async enrichChannelStatsNames<T extends { channelName: string | null }>(
    guildId: string,
    channelMap: Map<string, T>,
  ) {
    // 1. 이름이 없는 채널 ID 수집
    const channelIdsWithoutName: string[] = [];
    for (const [channelId, channel] of channelMap) {
      if (!channel.channelName || channel.channelName.trim() === '') {
        channelIdsWithoutName.push(channelId);
      }
    }

    if (channelIdsWithoutName.length === 0) return;

    // 2. Redis MGET으로 일괄 조회
    const cachedNames = await this.voiceRedis.getChannelNames(guildId, channelIdsWithoutName);
    const stillMissing: string[] = [];

    for (const channelId of channelIdsWithoutName) {
      const cachedName = cachedNames.get(channelId);
      if (cachedName) {
        channelMap.get(channelId).channelName = cachedName;
      } else {
        stillMissing.push(channelId);
      }
    }

    // 3. 남은 것은 Discord API 배치 조회
    if (stillMissing.length > 0) {
      this.logger.log(`Fetching ${stillMissing.length} channel names from Discord API`);
      const channelNames = await this.discordGateway.getChannelNames(guildId, stillMissing);

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
