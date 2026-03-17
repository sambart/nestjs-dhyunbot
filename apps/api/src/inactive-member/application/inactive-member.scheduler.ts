import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { getErrorStack } from '../../common/util/error.util';
import { InactiveMemberGrade } from '../domain/inactive-member.types';
import { InactiveMemberRepository } from '../infrastructure/inactive-member.repository';
import { InactiveMemberService } from './inactive-member.service';
import { InactiveMemberActionService } from './inactive-member-action.service';

@Injectable()
export class InactiveMemberScheduler {
  private readonly logger = new Logger(InactiveMemberScheduler.name);

  constructor(
    private readonly inactiveMemberService: InactiveMemberService,
    private readonly actionService: InactiveMemberActionService,
    private readonly repo: InactiveMemberRepository,
  ) {}

  @Cron('0 0 * * *', {
    name: 'inactive-member-classify',
    timeZone: 'Asia/Seoul',
  })
  async runDailyClassify(): Promise<void> {
    this.logger.log('[INACTIVE] Starting daily classify...');
    try {
      await this.processAllGuilds();
    } catch (err) {
      this.logger.error('[INACTIVE] Unhandled error during daily classify', getErrorStack(err));
    }
  }

  private async processAllGuilds(): Promise<void> {
    // Gateway 캐시 대신 DB에서 설정된 길드 목록 조회
    const guildIds = await this.repo.findAllConfiguredGuildIds();

    for (const guildId of guildIds) {
      try {
        const records = await this.inactiveMemberService.classifyGuild(guildId);

        const config = await this.inactiveMemberService.getOrCreateConfig(guildId);

        if (config.autoActionEnabled) {
          const newlyFullyInactiveIds = records
            .filter((r) => r.grade === InactiveMemberGrade.FULLY_INACTIVE)
            .map((r) => r.userId);

          await this.actionService.executeAutoActions(guildId, newlyFullyInactiveIds);
        }
      } catch (err) {
        this.logger.error(`[INACTIVE] Failed guild=${guildId}`, getErrorStack(err));
      }
    }
  }
}
