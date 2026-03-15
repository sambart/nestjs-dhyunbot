import { getKSTDateString } from '@dhyunbot/shared';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { VoiceCoPresencePairDaily } from '../co-presence/domain/voice-co-presence-pair-daily.entity';
import { VoiceChannelHistory } from '../domain/voice-channel-history.entity';
import { VoiceDailyEntity } from '../domain/voice-daily.entity';

@Injectable()
export class VoiceDataRetentionScheduler {
  private readonly logger = new Logger(VoiceDataRetentionScheduler.name);

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(VoiceDailyEntity)
    private readonly voiceDailyRepo: Repository<VoiceDailyEntity>,
    @InjectRepository(VoiceChannelHistory)
    private readonly voiceHistoryRepo: Repository<VoiceChannelHistory>,
    @InjectRepository(VoiceCoPresencePairDaily)
    private readonly coPresenceRepo: Repository<VoiceCoPresencePairDaily>,
  ) {}

  /** 매일 04:00 KST(19:00 UTC) 실행 — 보존 기간 초과 음성 데이터 일괄 삭제 */
  @Cron('0 19 * * *', { name: 'voice-data-retention' })
  async purgeExpiredData(): Promise<void> {
    const retentionDays = this.configService.get<number>('DATA_RETENTION_DAYS', 90);

    // 오늘 KST 날짜 기준으로 커트오프 날짜(YYYYMMDD) 계산
    const todayKst = getKSTDateString(); // YYYYMMDD
    const cutoffDate = this.subtractDaysFromYYYYMMDD(todayKst, retentionDays);

    // PostgreSQL date 타입 비교용 Date 객체 (cutoffDate의 자정 UTC)
    const cutoffDateObj = new Date(
      `${cutoffDate.slice(0, 4)}-${cutoffDate.slice(4, 6)}-${cutoffDate.slice(6, 8)}T00:00:00.000Z`,
    );

    try {
      const [voiceDailyResult, voiceHistoryResult, coPresenceResult] = await Promise.all([
        this.voiceDailyRepo
          .createQueryBuilder()
          .delete()
          .where('date < :cutoff', { cutoff: cutoffDate })
          .execute(),
        this.voiceHistoryRepo
          .createQueryBuilder()
          .delete()
          .where('"joinAt" < :cutoff', { cutoff: cutoffDateObj })
          .execute(),
        this.coPresenceRepo
          .createQueryBuilder()
          .delete()
          .where('date < :cutoff', { cutoff: cutoffDateObj })
          .execute(),
      ]);

      this.logger.log(
        `[DATA RETENTION] 보존 기간 ${retentionDays}일 초과 데이터 삭제 완료` +
          ` — VoiceDaily: ${voiceDailyResult.affected ?? 0}건,` +
          ` VoiceHistory: ${voiceHistoryResult.affected ?? 0}건,` +
          ` CoPresencePairDaily: ${coPresenceResult.affected ?? 0}건`,
      );
    } catch (error) {
      this.logger.error('[DATA RETENTION] 데이터 삭제 중 오류 발생', (error as Error).stack);
    }
  }

  /**
   * YYYYMMDD 문자열에서 days일을 빼서 YYYYMMDD 문자열로 반환한다.
   */
  private subtractDaysFromYYYYMMDD(yyyymmdd: string, days: number): string {
    const year = parseInt(yyyymmdd.slice(0, 4), 10);
    const month = parseInt(yyyymmdd.slice(4, 6), 10) - 1;
    const day = parseInt(yyyymmdd.slice(6, 8), 10);

    const date = new Date(Date.UTC(year, month, day));
    date.setUTCDate(date.getUTCDate() - days);

    const y = date.getUTCFullYear().toString();
    const m = (date.getUTCMonth() + 1).toString().padStart(2, '0');
    const d = date.getUTCDate().toString().padStart(2, '0');

    return `${y}${m}${d}`;
  }
}
