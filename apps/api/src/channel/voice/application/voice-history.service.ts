import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { VoiceChannelHistory } from '../domain/voice-channel-history.entity';
import { VoiceHistoryItemDto, VoiceHistoryPageDto } from '../dto/voice-history-page.dto';
import { VoiceHistoryQueryDto } from '../dto/voice-history-query.dto';

@Injectable()
export class VoiceHistoryService {
  constructor(
    @InjectRepository(VoiceChannelHistory)
    private readonly historyRepo: Repository<VoiceChannelHistory>,
  ) {}

  async getHistory(
    guildId: string,
    userId: string,
    query: VoiceHistoryQueryDto,
  ): Promise<VoiceHistoryPageDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const qb = this.historyRepo
      .createQueryBuilder('h')
      .innerJoin('h.member', 'm')
      .innerJoin('h.channel', 'c')
      .addSelect(['m.discordMemberId', 'c.discordChannelId', 'c.channelName', 'c.categoryId', 'c.categoryName'])
      .where('m."discordMemberId" = :userId', { userId })
      .andWhere('c."guildId" = :guildId', { guildId })
      .orderBy('h.joinedAt', 'DESC')
      .skip(skip)
      .take(limit);

    if (query.from) {
      qb.andWhere(
        "DATE(h.joinedAt AT TIME ZONE 'Asia/Seoul') >= TO_DATE(:from, 'YYYYMMDD')",
        { from: query.from },
      );
    }
    if (query.to) {
      qb.andWhere(
        "DATE(h.joinedAt AT TIME ZONE 'Asia/Seoul') <= TO_DATE(:to, 'YYYYMMDD')",
        { to: query.to },
      );
    }

    const [items, total] = await qb.getManyAndCount();

    return {
      total,
      page,
      limit,
      items: items.map((h) => this.toItemDto(h)),
    };
  }

  private toItemDto(h: VoiceChannelHistory): VoiceHistoryItemDto {
    return {
      id: h.id,
      channelId: h.channel.discordChannelId,
      channelName: h.channel.channelName,
      categoryId: h.channel.categoryId ?? null,
      categoryName: h.channel.categoryName ?? null,
      joinAt: h.joinedAt.toISOString(),
      leftAt: h.leftAt ? h.leftAt.toISOString() : null,
      durationSec: h.duration,
    };
  }
}
