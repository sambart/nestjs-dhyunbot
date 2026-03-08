import { On } from '@discord-nestjs/core';
import { Injectable, Logger } from '@nestjs/common';
import { Message } from 'discord.js';

import { StickyMessageRefreshService } from '../application/sticky-message-refresh.service';
import { StickyMessageConfigRepository } from '../infrastructure/sticky-message-config.repository';
import { StickyMessageRedisRepository } from '../infrastructure/sticky-message-redis.repository';

@Injectable()
export class StickyMessageGateway {
  private readonly logger = new Logger(StickyMessageGateway.name);
  private readonly timers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly redisRepo: StickyMessageRedisRepository,
    private readonly configRepo: StickyMessageConfigRepository,
    private readonly refreshService: StickyMessageRefreshService,
  ) {}

  @On('messageCreate')
  async handleMessageCreate(message: Message): Promise<void> {
    try {
      // 1. 봇 메시지 무시
      if (message.author.bot) return;

      // 2. DM 메시지 무시
      const guildId = message.guildId;
      if (!guildId) return;

      const channelId = message.channelId;

      // 3. Redis 설정 캐시 조회 (미스 시 DB 조회 후 캐시 저장)
      let configs = await this.redisRepo.getConfig(guildId);
      if (!configs) {
        configs = await this.configRepo.findByGuildId(guildId);
        await this.redisRepo.setConfig(guildId, configs);
      }

      // 4. 해당 채널에 활성 고정메세지 설정 있는지 확인
      const hasConfig = configs.some((c) => c.channelId === channelId && c.enabled);
      if (!hasConfig) return;

      // 5. 기존 타이머 취소 + 새 타이머 등록 (동기 블록 — await 없이 처리하여 race condition 방지)
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

      // 6. Redis 디바운스 키 설정/리셋 (TTL 3초) — 타이머 등록 후 비동기 처리
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
