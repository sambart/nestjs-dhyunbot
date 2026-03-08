import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';

import { RedisService } from '../../../redis/redis.service';
import { VoiceExcludedChannel, VoiceExcludedChannelType } from '../domain/voice-excluded-channel.entity';
import { VoiceExcludedChannelSaveDto } from '../dto/voice-excluded-channel-save.dto';
import { VoiceExcludedChannelSyncDto } from '../dto/voice-excluded-channel-sync.dto';
import { VoiceKeys } from '../infrastructure/voice-cache.keys';
import { VoiceExcludedChannelRepository } from '../infrastructure/voice-excluded-channel.repository';

const TTL = {
  /** 제외 채널 캐시: 1시간 */
  EXCLUDED: 60 * 60,
} as const;

@Injectable()
export class VoiceExcludedChannelService {
  constructor(
    private readonly repository: VoiceExcludedChannelRepository,
    private readonly redis: RedisService,
  ) {}

  /**
   * 제외 채널 목록 조회 (F-VOICE-013).
   * Redis 캐시 우선, 미스 시 DB 조회 후 캐시 저장.
   */
  async getExcludedChannels(guildId: string): Promise<VoiceExcludedChannel[]> {
    const cached = await this.redis.get<VoiceExcludedChannel[]>(
      VoiceKeys.excludedChannels(guildId),
    );
    if (cached) return cached;

    const items = await this.repository.findByGuildId(guildId);
    if (items.length > 0) {
      await this.redis.set(VoiceKeys.excludedChannels(guildId), items, TTL.EXCLUDED);
    }
    return items;
  }

  /**
   * 제외 채널 등록 (F-VOICE-014).
   * unique constraint 위반 시 ConflictException(409) 반환.
   */
  async saveExcludedChannel(
    guildId: string,
    dto: VoiceExcludedChannelSaveDto,
  ): Promise<VoiceExcludedChannel> {
    try {
      const item = await this.repository.create(guildId, dto.channelId, dto.type);
      await this.redis.del(VoiceKeys.excludedChannels(guildId));
      return item;
    } catch (err) {
      if (err instanceof QueryFailedError && (err as QueryFailedError & { code: string }).code === '23505') {
        throw new ConflictException('이미 등록된 채널입니다');
      }
      throw err;
    }
  }

  /**
   * 제외 채널 삭제 (F-VOICE-015).
   * 존재하지 않거나 타 길드 레코드이면 NotFoundException(404) 반환.
   */
  async deleteExcludedChannel(guildId: string, id: number): Promise<void> {
    const item = await this.repository.findByIdAndGuildId(id, guildId);
    if (!item) {
      throw new NotFoundException('제외 채널을 찾을 수 없습니다');
    }
    await this.repository.delete(id);
    await this.redis.del(VoiceKeys.excludedChannels(guildId));
  }

  /**
   * 제외 채널 전체 교체 (벌크 동기화).
   * 기존 레코드를 모두 삭제하고 새 목록으로 교체한다.
   */
  async syncExcludedChannels(
    guildId: string,
    dto: VoiceExcludedChannelSyncDto,
  ): Promise<VoiceExcludedChannel[]> {
    const channels = dto.channels.map((ch) => ({
      discordChannelId: ch.channelId,
      type: ch.type,
    }));
    const result = await this.repository.sync(guildId, channels);
    await this.redis.del(VoiceKeys.excludedChannels(guildId));
    if (result.length > 0) {
      await this.redis.set(VoiceKeys.excludedChannels(guildId), result, TTL.EXCLUDED);
    }
    return result;
  }

  /**
   * 특정 채널이 제외 채널인지 확인 (F-VOICE-016).
   * channelId(채널 자체)와 parentCategoryId(상위 카테고리) 모두 확인한다.
   * Redis 캐시 우선, 미스 시 DB 조회 후 캐시 저장.
   */
  async isExcludedChannel(
    guildId: string,
    channelId: string,
    parentCategoryId: string | null,
  ): Promise<boolean> {
    let items = await this.redis.get<VoiceExcludedChannel[]>(
      VoiceKeys.excludedChannels(guildId),
    );

    if (!items) {
      items = await this.repository.findByGuildId(guildId);
      await this.redis.set(VoiceKeys.excludedChannels(guildId), items, TTL.EXCLUDED);
    }

    for (const item of items) {
      if (item.type === VoiceExcludedChannelType.CHANNEL && item.discordChannelId === channelId) {
        return true;
      }
      if (
        item.type === VoiceExcludedChannelType.CATEGORY &&
        parentCategoryId !== null &&
        item.discordChannelId === parentCategoryId
      ) {
        return true;
      }
    }

    return false;
  }
}
