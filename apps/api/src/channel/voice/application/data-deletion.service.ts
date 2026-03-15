import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { VoiceCoPresencePairDailyOrm } from '../co-presence/infrastructure/voice-co-presence-pair-daily.orm-entity';
import { VoiceChannelHistoryOrm } from '../infrastructure/voice-channel-history.orm-entity';
import { VoiceDailyOrm } from '../infrastructure/voice-daily.orm-entity';

export interface DataDeletionResult {
  voiceDaily: number;
  voiceHistory: number;
  coPresence: number;
}

@Injectable()
export class DataDeletionService {
  private readonly logger = new Logger(DataDeletionService.name);

  constructor(
    @InjectRepository(VoiceDailyOrm)
    private readonly voiceDailyRepo: Repository<VoiceDailyOrm>,
    @InjectRepository(VoiceChannelHistoryOrm)
    private readonly voiceHistoryRepo: Repository<VoiceChannelHistoryOrm>,
    @InjectRepository(VoiceCoPresencePairDailyOrm)
    private readonly coPresenceRepo: Repository<VoiceCoPresencePairDailyOrm>,
  ) {}

  /** 특정 사용자의 음성 활동 데이터를 전체 삭제한다 */
  async deleteUserData(discordId: string): Promise<DataDeletionResult> {
    const [voiceDailyResult, voiceHistoryResult, coPresenceResult] = await Promise.all([
      this.voiceDailyRepo
        .createQueryBuilder()
        .delete()
        .where('userId = :discordId', { discordId })
        .execute(),
      this.voiceHistoryRepo
        .createQueryBuilder('vch')
        .delete()
        .where(
          'id IN (SELECT vch2.id FROM voice_channel_history vch2 INNER JOIN member m ON m.id = vch2."memberId" WHERE m."discordMemberId" = :discordId)',
          { discordId },
        )
        .execute(),
      this.coPresenceRepo
        .createQueryBuilder()
        .delete()
        .where('userId = :discordId OR peerId = :discordId', { discordId })
        .execute(),
    ]);

    const result: DataDeletionResult = {
      voiceDaily: voiceDailyResult.affected ?? 0,
      voiceHistory: voiceHistoryResult.affected ?? 0,
      coPresence: coPresenceResult.affected ?? 0,
    };

    this.logger.log(
      `[DATA DELETION] 사용자 데이터 삭제 완료 userId=${discordId}` +
        ` — VoiceDaily: ${result.voiceDaily}건,` +
        ` VoiceHistory: ${result.voiceHistory}건,` +
        ` CoPresence: ${result.coPresence}건`,
    );

    return result;
  }
}
