import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { VoiceChannelHistory } from './voice-channel-history.entity';
import { Member } from 'src/member/member.entity';
import { Channel } from '../channel.entity';

@Injectable()
export class VoiceChannelHistoryService {
  constructor(
    @InjectRepository(VoiceChannelHistory)
    private readonly voiceChannelHistoryRepository: Repository<VoiceChannelHistory>,
    private readonly dataSource: DataSource,
  ) {}

  async logJoin(member: Member, channel: Channel): Promise<VoiceChannelHistory> {
    const log = this.voiceChannelHistoryRepository.create({
      member,
      channel,
      joinAt: new Date(),
    });
    return this.voiceChannelHistoryRepository.save(log);
  }

  async logLeave(member: Member, channel: Channel): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const log = await manager
        .createQueryBuilder()
        .select('id')
        .from(VoiceChannelHistory, 'id')
        .where('log.memberId = :memberId', { memberId: member.id })
        .andWhere('log.channelId = :channelId', { channelId: channel.id })
        .orderBy('log.joinedAt', 'DESC')
        .limit(1)
        .getOne();

      if (log) {
        await manager.update(VoiceChannelHistory, { id: log.id }, { leftAt: new Date() });
      }
    });
  }
}
