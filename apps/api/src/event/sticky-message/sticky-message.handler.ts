import { InjectDiscordClient, On } from '@discord-nestjs/core';
import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { Client, Message } from 'discord.js';

import { StickyMessageRefreshService } from '../../sticky-message/application/sticky-message-refresh.service';
import { StickyMessageConfigRepository } from '../../sticky-message/infrastructure/sticky-message-config.repository';
import { StickyMessageRedisRepository } from '../../sticky-message/infrastructure/sticky-message-redis.repository';

@Injectable()
export class StickyMessageHandler implements OnApplicationShutdown {
  private readonly logger = new Logger(StickyMessageHandler.name);
  private readonly timers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly redisRepo: StickyMessageRedisRepository,
    private readonly configRepo: StickyMessageConfigRepository,
    private readonly refreshService: StickyMessageRefreshService,
    @InjectDiscordClient() private readonly client: Client,
  ) {}

  onApplicationShutdown(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
  }

  @On('messageCreate')
  async handleMessageCreate(message: Message): Promise<void> {
    try {
      // 봇 자신의 메시지 && 해당 채널에서 고정메세지 재전송 진행 중 → 무시 (무한루프 방지)
      // 슬래시 커맨드 결과 등 봇의 다른 메시지는 갱신 트리거
      if (
        message.author.id === this.client.user?.id &&
        this.refreshService.isRefreshing(message.channelId)
      ) {
        return;
      }

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
      }, 1000);
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
