import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';

import { Member } from '../../../member/member.entity';
import { Channel } from '../../channel.entity';
import { VoiceChannelHistory } from '../domain/voice-channel-history.entity';

@Injectable()
export class VoiceChannelHistoryService {
  private readonly logger = new Logger(VoiceChannelHistoryService.name);

  constructor(
    @InjectRepository(VoiceChannelHistory)
    private readonly voiceChannelHistoryRepository: Repository<VoiceChannelHistory>,
    private readonly dataSource: DataSource,
  ) {}

  async logJoin(member: Member, channel: Channel): Promise<VoiceChannelHistory> {
    const log = this.voiceChannelHistoryRepository.create({
      member,
      channel,
      joinedAt: new Date(),
    });
    return this.voiceChannelHistoryRepository.save(log);
  }

  async logLeave(member: Member, channel: Channel): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const log = await manager
        .createQueryBuilder()
        .select('id')
        .from(VoiceChannelHistory, 'log')
        .where('log.memberId = :memberId', { memberId: member.id })
        .andWhere('log.channelId = :channelId', { channelId: channel.id })
        .andWhere('log.leftAt IS NULL')
        .orderBy('log.joinedAt', 'DESC')
        .limit(1)
        .getRawOne();

      if (log) {
        await manager.update(VoiceChannelHistory, { id: log.id }, { leftAt: new Date() });
      }
    });
  }

  /** leftAt IS NULL인 고아 레코드를 일괄 종료한다 (F-VOICE-023) */
  async closeOrphanRecords(): Promise<number> {
    const result = await this.voiceChannelHistoryRepository
      .createQueryBuilder()
      .update(VoiceChannelHistory)
      .set({ leftAt: () => 'NOW()' })
      .where({ leftAt: IsNull() })
      .execute();

    const affected = result.affected ?? 0;
    if (affected > 0) {
      this.logger.warn(`Closed ${affected} orphan VoiceChannelHistory record(s)`);
    }
    return affected;
  }
}
