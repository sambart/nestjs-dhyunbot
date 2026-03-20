import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { VoiceExcludedChannelType } from '../domain/voice-excluded-channel.types';
import { VoiceExcludedChannelOrm } from './voice-excluded-channel.orm-entity';

@Injectable()
export class VoiceExcludedChannelRepository {
  constructor(
    @InjectRepository(VoiceExcludedChannelOrm)
    private readonly repo: Repository<VoiceExcludedChannelOrm>,
  ) {}

  /** 길드의 제외 채널 전체 조회. 캐시 미스 워밍업용. */
  async findByGuildId(guildId: string): Promise<VoiceExcludedChannelOrm[]> {
    return this.repo.find({ where: { guildId } });
  }

  /** 신규 제외 채널 레코드 생성. unique constraint 위반 시 QueryFailedError가 상위로 전파됨. */
  async create(
    guildId: string,
    discordChannelId: string,
    type: VoiceExcludedChannelType,
  ): Promise<VoiceExcludedChannelOrm> {
    const entity = this.repo.create({ guildId, discordChannelId, type });
    return this.repo.save(entity);
  }

  /** id + guildId로 단건 조회. 삭제 전 소유권 검증용. */
  async findByIdAndGuildId(id: number, guildId: string): Promise<VoiceExcludedChannelOrm | null> {
    return this.repo.findOne({ where: { id, guildId } });
  }

  /** 단건 삭제. */
  async delete(id: number): Promise<void> {
    await this.repo.delete({ id });
  }

  /** 길드의 제외 채널을 전체 교체 (벌크 동기화). */
  async sync(
    guildId: string,
    channels: { discordChannelId: string; type: VoiceExcludedChannelType }[],
  ): Promise<VoiceExcludedChannelOrm[]> {
    return this.repo.manager.transaction(async (manager) => {
      await manager.delete(VoiceExcludedChannelOrm, { guildId });
      if (channels.length === 0) return [];
      const entities = channels.map((ch) =>
        manager.create(VoiceExcludedChannelOrm, {
          guildId,
          discordChannelId: ch.discordChannelId,
          type: ch.type,
        }),
      );
      return manager.save(entities);
    });
  }
}
