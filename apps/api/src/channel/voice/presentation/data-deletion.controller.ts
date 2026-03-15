import { Controller, Delete, HttpCode, HttpStatus, Logger, Req, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { JwtAuthGuard } from '../../../auth/jwt-auth.guard';
import { VoiceCoPresencePairDaily } from '../co-presence/domain/voice-co-presence-pair-daily.entity';
import { VoiceChannelHistory } from '../domain/voice-channel-history.entity';
import { VoiceDailyEntity } from '../domain/voice-daily.entity';

interface JwtUser {
  discordId: string;
  username: string;
}

interface DeletedCountDto {
  deletedCount: {
    voiceDaily: number;
    voiceHistory: number;
    coPresence: number;
  };
}

@Controller('api/users/me')
@UseGuards(JwtAuthGuard)
export class DataDeletionController {
  private readonly logger = new Logger(DataDeletionController.name);

  constructor(
    @InjectRepository(VoiceDailyEntity)
    private readonly voiceDailyRepo: Repository<VoiceDailyEntity>,
    @InjectRepository(VoiceChannelHistory)
    private readonly voiceHistoryRepo: Repository<VoiceChannelHistory>,
    @InjectRepository(VoiceCoPresencePairDaily)
    private readonly coPresenceRepo: Repository<VoiceCoPresencePairDaily>,
  ) {}

  /**
   * DELETE /api/users/me/data
   * 본인의 음성 활동 데이터를 전체 삭제한다 (GDPR 스타일 데이터 삭제권).
   */
  @Delete('data')
  @HttpCode(HttpStatus.OK)
  @SkipThrottle()
  async deleteMyData(@Req() req: Request): Promise<DeletedCountDto> {
    const user = (req as unknown as { user: JwtUser }).user;
    const discordId = user.discordId;

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

    const result: DeletedCountDto = {
      deletedCount: {
        voiceDaily: voiceDailyResult.affected ?? 0,
        voiceHistory: voiceHistoryResult.affected ?? 0,
        coPresence: coPresenceResult.affected ?? 0,
      },
    };

    this.logger.log(
      `[DATA DELETION] 사용자 데이터 삭제 완료 userId=${discordId}` +
        ` — VoiceDaily: ${result.deletedCount.voiceDaily}건,` +
        ` VoiceHistory: ${result.deletedCount.voiceHistory}건,` +
        ` CoPresence: ${result.deletedCount.coPresence}건`,
    );

    return result;
  }
}
