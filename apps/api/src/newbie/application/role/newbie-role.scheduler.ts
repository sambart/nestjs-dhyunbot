import { getKSTDateString } from '@dhyunbot/shared';
import { InjectDiscordClient } from '@discord-nestjs/core';
import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { Client } from 'discord.js';

import { getErrorStack } from '../../../common/util/error.util';
import { NewbieConfigRepository } from '../../infrastructure/newbie-config.repository';
import { NewbiePeriodRepository } from '../../infrastructure/newbie-period.repository';
import { NewbieRedisRepository } from '../../infrastructure/newbie-redis.repository';

/** 24시간 인터벌 (ms) */
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class NewbieRoleScheduler implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(NewbieRoleScheduler.name);
  private initialTimer: NodeJS.Timeout | null = null;
  private dailyInterval: NodeJS.Timeout | null = null;

  constructor(
    @InjectDiscordClient() private readonly client: Client,
    private readonly periodRepository: NewbiePeriodRepository,
    private readonly redisRepository: NewbieRedisRepository,
    private readonly configRepository: NewbieConfigRepository,
  ) {}

  onApplicationBootstrap(): void {
    this.scheduleNextMidnight();
  }

  onApplicationShutdown(): void {
    if (this.initialTimer) {
      clearTimeout(this.initialTimer);
      this.initialTimer = null;
    }
    if (this.dailyInterval) {
      clearInterval(this.dailyInterval);
      this.dailyInterval = null;
    }
  }

  /**
   * 다음 KST 자정까지의 ms를 계산하고, 그 시점에 processExpired()를 실행한다.
   * 이후 24시간마다 반복한다.
   */
  private scheduleNextMidnight(): void {
    const msUntilMidnight = this.getMsUntilNextKSTMidnight();

    this.logger.log(
      `[NEWBIE ROLE SCHEDULER] Next run in ${Math.round(msUntilMidnight / 1000 / 60)} minutes`,
    );

    this.initialTimer = setTimeout(() => {
      void this.processExpired();

      this.dailyInterval = setInterval(() => {
        void this.processExpired();
      }, ONE_DAY_MS);
    }, msUntilMidnight);
  }

  /**
   * 현재 시각(KST 기준)으로부터 다음 자정(00:00:00)까지의 밀리초를 반환한다.
   * KST = UTC+9
   */
  private getMsUntilNextKSTMidnight(): number {
    const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
    const nowUtc = Date.now();
    const nowKst = nowUtc + KST_OFFSET_MS;

    // 오늘 KST 자정의 UTC ms
    const todayKstMidnightUtc = Math.floor(nowKst / ONE_DAY_MS) * ONE_DAY_MS - KST_OFFSET_MS;
    // 다음 KST 자정의 UTC ms
    const nextKstMidnightUtc = todayKstMidnightUtc + ONE_DAY_MS;

    return nextKstMidnightUtc - nowUtc;
  }

  /**
   * 만료된 신입기간 레코드를 일괄 처리한다.
   *
   * 처리 순서:
   * 1. configCache 초기화
   * 2. NewbiePeriod에서 isExpired=false AND expiresDate < today 레코드 조회
   * 3. 각 레코드에 대해 processOne 순차 실행 (Discord 역할 제거 + DB 만료 갱신)
   * 4. 영향받은 guildId의 Redis 캐시 무효화
   */
  async processExpired(): Promise<void> {
    const configCache = new Map<string, string | null>();
    const today = getKSTDateString();
    this.logger.log(`[NEWBIE ROLE SCHEDULER] processExpired start: today=${today}`);

    let expiredRecords;
    try {
      expiredRecords = await this.periodRepository.findExpired(today);
    } catch (error) {
      this.logger.error(
        '[NEWBIE ROLE SCHEDULER] Failed to query expired periods',
        getErrorStack(error),
      );
      return;
    }

    if (expiredRecords.length === 0) {
      this.logger.log('[NEWBIE ROLE SCHEDULER] No expired periods found.');
      return;
    }

    this.logger.log(
      `[NEWBIE ROLE SCHEDULER] Processing ${expiredRecords.length} expired period(s)`,
    );

    // guildId별 캐시 무효화 중복 방지를 위한 Set
    const affectedGuilds = new Set<string>();

    for (const period of expiredRecords) {
      await this.processOne(period.guildId, period.memberId, period.id, configCache);
      affectedGuilds.add(period.guildId);
    }

    // guildId별 Redis 캐시 무효화
    for (const guildId of affectedGuilds) {
      try {
        await this.redisRepository.deletePeriodActive(guildId);
        this.logger.log(`[NEWBIE ROLE SCHEDULER] Cache invalidated: guild=${guildId}`);
      } catch (error) {
        this.logger.error(
          `[NEWBIE ROLE SCHEDULER] Failed to invalidate cache: guild=${guildId}`,
          getErrorStack(error),
        );
      }
    }

    this.logger.log('[NEWBIE ROLE SCHEDULER] processExpired complete.');
  }

  /**
   * 단일 레코드 만료 처리.
   * Discord API 역할 제거 실패 시에도 DB 갱신은 반드시 실행한다 (멱등성).
   */
  private async processOne(
    guildId: string,
    memberId: string,
    periodId: number,
    configCache: Map<string, string | null>,
  ): Promise<void> {
    // Discord API — 역할 제거 시도 (실패 시 warn 로그 후 DB 갱신 계속 진행)
    await this.tryRemoveRole(guildId, memberId, configCache);

    // Discord API 성공 여부와 무관하게 DB 만료 처리 (멱등성 보장)
    try {
      await this.periodRepository.markExpired(periodId);
    } catch (error) {
      this.logger.error(
        `[NEWBIE ROLE SCHEDULER] Failed to mark expired: periodId=${periodId}`,
        getErrorStack(error),
      );
    }
  }

  /** Discord API를 통한 역할 제거 시도 — 실패 시에도 예외를 던지지 않는다 */
  private async tryRemoveRole(
    guildId: string,
    memberId: string,
    configCache: Map<string, string | null>,
  ): Promise<void> {
    try {
      const roleId = await this.getNewbieRoleId(guildId, configCache);
      if (!roleId) return;

      const guild = this.client.guilds.cache.get(guildId);
      if (!guild) throw new Error(`Guild ${guildId} not found in cache`);
      const member = await guild.members.fetch(memberId);
      await member.roles.remove(roleId);
      this.logger.log(`[NEWBIE ROLE SCHEDULER] Role removed: guild=${guildId} member=${memberId}`);
    } catch (error) {
      // 멤버가 서버를 떠났거나, 역할이 이미 없는 경우 등 정상 상황 포함
      this.logger.warn(
        `[NEWBIE ROLE SCHEDULER] Failed to remove role (will still mark expired): ` +
          `guild=${guildId} member=${memberId}`,
        getErrorStack(error),
      );
    }
  }

  /**
   * guildId에 해당하는 newbieRoleId를 NewbieConfigRepository에서 조회한다.
   * 설정이 없거나 newbieRoleId가 null이면 null 반환.
   * 로컬 configCache를 통해 단일 processExpired 실행 내 중복 DB 조회를 방지한다.
   */
  private async getNewbieRoleId(
    guildId: string,
    configCache: Map<string, string | null>,
  ): Promise<string | null> {
    if (configCache.has(guildId)) {
      return configCache.get(guildId) ?? null;
    }
    const config = await this.configRepository.findByGuildId(guildId);
    const roleId = config?.newbieRoleId ?? null;
    configCache.set(guildId, roleId);
    return roleId;
  }
}
