import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { MissionStatus } from '../../domain/newbie-mission.types';
import { NewbieConfigRepository } from '../../infrastructure/newbie-config.repository';
import { NewbieMissionRepository } from '../../infrastructure/newbie-mission.repository';
import { NewbieRedisRepository } from '../../infrastructure/newbie-redis.repository';
import { MissionService } from './mission.service';

@Injectable()
export class MissionScheduler {
  private readonly logger = new Logger(MissionScheduler.name);

  constructor(
    private readonly missionRepo: NewbieMissionRepository,
    private readonly configRepo: NewbieConfigRepository,
    private readonly newbieRedis: NewbieRedisRepository,
    private readonly missionService: MissionService,
  ) {}

  /**
   * 매일 자정 KST 실행.
   * IN_PROGRESS 상태이며 endDate가 오늘 이전인 만료 미션을 COMPLETED 또는 FAILED로 갱신한다.
   * timeZone: 'Asia/Seoul' 옵션으로 KST 자정(00:00) 기준 실행.
   */
  @Cron('0 0 * * *', { name: 'mission-daily-expiry', timeZone: 'Asia/Seoul' })
  async runDailyExpiry(): Promise<void> {
    this.logger.log('[MISSION SCHEDULER] Starting daily expiry check...');
    try {
      await this.processExpiredMissions();
    } catch (err) {
      this.logger.error(
        '[MISSION SCHEDULER] Unhandled error during expiry check',
        (err as Error).stack,
      );
    }
  }

  private async processExpiredMissions(): Promise<void> {
    const today = this.toDateString(new Date());

    // 1. endDate < today 이고 status = 'IN_PROGRESS' 인 미션 전체 조회
    //    IDX_newbie_mission_status_end_date 인덱스 활용
    const expiredMissions = await this.missionRepo.findExpired(today);

    if (expiredMissions.length === 0) {
      this.logger.log('[MISSION SCHEDULER] No expired missions found.');
      return;
    }

    this.logger.log(`[MISSION SCHEDULER] Found ${expiredMissions.length} expired missions.`);

    // guildId별로 캐시 무효화가 필요한 집합
    const affectedGuildIds = new Set<string>();

    for (const mission of expiredMissions) {
      try {
        // 2. 해당 기간 동안의 플레이타임 조회
        const playtimeSec = await this.missionService.getPlaytimeSec(
          mission.guildId,
          mission.memberId,
          mission.startDate,
          mission.endDate,
        );

        // 3. 목표 달성 여부 판별
        const newStatus =
          playtimeSec >= mission.targetPlaytimeSec ? MissionStatus.COMPLETED : MissionStatus.FAILED;

        // 4. 상태 갱신
        await this.missionRepo.updateStatus(mission.id, newStatus);

        affectedGuildIds.add(mission.guildId);

        this.logger.log(
          `[MISSION SCHEDULER] Updated: id=${mission.id} member=${mission.memberId} ` +
            `playtime=${playtimeSec}s target=${mission.targetPlaytimeSec}s status=${newStatus}`,
        );
      } catch (err) {
        this.logger.error(
          `[MISSION SCHEDULER] Failed to process mission id=${mission.id}`,
          (err as Error).stack,
        );
        // 개별 실패는 로그 후 다음 미션 계속 처리
      }
    }

    // 5. 영향받은 길드의 미션 캐시 무효화
    for (const guildId of affectedGuildIds) {
      await this.newbieRedis.deleteMissionActive(guildId);
    }

    // 6. 영향받은 길드의 미등록 멤버 자동 등록 + Embed 갱신
    for (const guildId of affectedGuildIds) {
      const config = await this.configRepo.findByGuildId(guildId);
      if (config) {
        await this.missionService.registerMissingMembers(guildId, config).catch((err) => {
          this.logger.warn(
            `[MISSION SCHEDULER] registerMissingMembers failed: guild=${guildId}`,
            (err as Error).stack,
          );
        });
      }
      await this.missionService.refreshMissionEmbed(guildId).catch((err) => {
        this.logger.error(
          `[MISSION SCHEDULER] Failed to refresh embed: guild=${guildId}`,
          (err as Error).stack,
        );
      });
    }

    this.logger.log(
      `[MISSION SCHEDULER] Completed. Affected guilds: [${[...affectedGuildIds].join(', ')}]`,
    );
  }

  /**
   * Date 객체를 KST 기준 YYYYMMDD 형식 문자열로 변환.
   */
  private toDateString(date: Date): string {
    const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
    return kst.toISOString().slice(0, 10).replace(/-/g, '');
  }
}
