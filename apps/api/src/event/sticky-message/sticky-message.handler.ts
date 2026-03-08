import { On } from '@discord-nestjs/core';
import { Injectable, Logger } from '@nestjs/common';
import { Message } from 'discord.js';

import { StickyMessageRefreshService } from '../../sticky-message/application/sticky-message-refresh.service';
import { StickyMessageConfigRepository } from '../../sticky-message/infrastructure/sticky-message-config.repository';
import { StickyMessageRedisRepository } from '../../sticky-message/infrastructure/sticky-message-redis.repository';

@Injectable()
export class StickyMessageHandler {
  private readonly logger = new Logger(StickyMessageHandler.name);
  private readonly timers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly redisRepo: StickyMessageRedisRepository,
    private readonly configRepo: StickyMessageConfigRepository,
    private readonly refreshService: StickyMessageRefreshService,
  ) {}

  @On('messageCreate')
  async handleMessageCreate(message: Message): Promise<void> {
    try {
      if (message.author.bot) return;

      const guildId = message.guildId;
      if (!guildId) return;

      const channelId = message.channelId;

      let configs = await this.redisRepo.getConfig(guildId);
      if (!configs) {
        configs = await this.configRepo.findByGuildId(guildId);
        await this.redisRepo.setConfig(guildId, configs);
      }

      const hasConfig = configs.some((c) => c.channelId === channelId && c.enabled);
      if (!hasConfig) return;

      const existing = this.timers.get(channelId);
      if (existing) clearTimeout(existing);

      const timer = setTimeout(() => {
        this.timers.delete(channelId);
        this.refreshService.refresh(guildId, channelId).catch((err: Error) => {
          this.logger.error(
            `[messageCreate] refresh failed: guild=${guildId} channel=${channelId}`,
            err.stack,
          );
        });
      }, 3000);
      this.timers.set(channelId, timer);

      this.redisRepo.setDebounce(channelId).catch((err: Error) => {
        this.logger.warn(`[messageCreate] setDebounce failed: channel=${channelId}`, err.stack);
      });
    } catch (err) {
      this.logger.error(
        `[messageCreate] unhandled error: guild=${message.guildId} channel=${message.channelId}`,
        (err as Error).stack,
      );
    }
  }
}
