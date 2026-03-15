import { InjectDiscordClient } from '@discord-nestjs/core';
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Client } from 'discord.js';

import { getErrorStack } from '../../common/util/error.util';
import { InactiveMemberGrade } from '../domain/inactive-member.types';
import { InactiveMemberService } from './inactive-member.service';
import { InactiveMemberActionService } from './inactive-member-action.service';

@Injectable()
export class InactiveMemberScheduler {
  private readonly logger = new Logger(InactiveMemberScheduler.name);

  constructor(
    private readonly inactiveMemberService: InactiveMemberService,
    private readonly actionService: InactiveMemberActionService,
    @InjectDiscordClient() private readonly discord: Client,
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
    const guildIds = this.discord.guilds.cache.map((g) => g.id);

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
