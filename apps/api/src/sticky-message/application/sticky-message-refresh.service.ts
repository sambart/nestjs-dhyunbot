import { InjectDiscordClient } from '@discord-nestjs/core';
import { Injectable, Logger } from '@nestjs/common';
import { Client, EmbedBuilder, TextChannel } from 'discord.js';

import { StickyMessageConfigRepository } from '../infrastructure/sticky-message-config.repository';

@Injectable()
export class StickyMessageRefreshService {
  private readonly logger = new Logger(StickyMessageRefreshService.name);

  /** 채널별 잠금 — 동시 refresh 방지 */
  private readonly refreshing = new Set<string>();

  constructor(
    private readonly configRepo: StickyMessageConfigRepository,
    @InjectDiscordClient() private readonly client: Client,
  ) {}

  /**
   * 채널의 고정메세지 재전송 (F-STICKY-004 디바운스 만료 후 호출).
   * 처리 순서:
   *   1. 채널 잠금 확인 (이미 진행 중이면 스킵)
   *   2. enabled=true 설정 목록 조회 (sortOrder ASC)
   *   3. 고아 메세지 정리 (DB에 추적되지 않는 봇 Embed 삭제)
   *   4. 각 설정에 대해: 기존 메시지 삭제 → 신규 Embed 전송 → messageId 갱신
   */
  async refresh(guildId: string, channelId: string): Promise<void> {
    if (this.refreshing.has(channelId)) {
      this.logger.debug(`[STICKY_MESSAGE] refresh skipped (already in progress): channel=${channelId}`);
      return;
    }

    this.refreshing.add(channelId);
    try {
      await this.doRefresh(guildId, channelId);
    } finally {
      this.refreshing.delete(channelId);
    }
  }

  private async doRefresh(guildId: string, channelId: string): Promise<void> {
    const configs = await this.configRepo.findByGuildAndChannel(guildId, channelId);
    if (configs.length === 0) return;

    // 고아 메세지 정리: DB에 기록된 messageId 외의 봇 Embed 메세지 삭제
    const trackedIds = new Set(configs.map((c) => c.messageId).filter(Boolean));
    await this.cleanupOrphanedMessages(channelId, trackedIds as Set<string>);

    for (const config of configs) {
      if (config.messageId) {
        await this.tryDeleteMessage(config.channelId, config.messageId);
      }

      try {
        const newMessageId = await this.sendEmbed(config.channelId, config);
        await this.configRepo.updateMessageId(config.id, newMessageId);
      } catch (err) {
        this.logger.error(
          `[STICKY_MESSAGE] refresh: Failed to send embed: guild=${guildId} channel=${channelId} config=${config.id}`,
          (err as Error).stack,
        );
      }
    }
  }

  /** Discord 텍스트 채널에 Embed 메시지 전송. 전송된 메시지 ID 반환. */
  private async sendEmbed(
    channelId: string,
    config: { embedTitle: string | null; embedDescription: string | null; embedColor: string | null },
  ): Promise<string> {
    const channel = await this.client.channels.fetch(channelId);

    if (!channel || !channel.isTextBased()) {
      throw new Error(`Channel ${channelId} is not a text-based channel`);
    }

    const embed = new EmbedBuilder();
    if (config.embedTitle) embed.setTitle(config.embedTitle);
    if (config.embedDescription) embed.setDescription(config.embedDescription);
    if (config.embedColor) embed.setColor(config.embedColor as `#${string}`);

    const message = await (channel as TextChannel).send({ embeds: [embed] });
    return message.id;
  }

  /**
   * 고아 메세지 정리: 채널 최근 메세지에서 봇이 보낸 Embed 전용 메세지 중
   * DB에 추적되지 않는 것을 삭제한다.
   */
  private async cleanupOrphanedMessages(channelId: string, trackedIds: Set<string>): Promise<void> {
    try {
      const channel = await this.client.channels.fetch(channelId);
      if (!channel || !channel.isTextBased()) return;

      const textChannel = channel as TextChannel;
      const messages = await textChannel.messages.fetch({ limit: 30 });
      const botId = this.client.user?.id;
      if (!botId) return;

      const orphaned = messages.filter(
        (msg) =>
          msg.author.id === botId &&
          msg.embeds.length > 0 &&
          !msg.content &&
          !trackedIds.has(msg.id),
      );

      for (const [, msg] of orphaned) {
        await msg.delete().catch((err: Error) => {
          this.logger.warn(`[STICKY_MESSAGE] Failed to delete orphaned message ${msg.id}: ${err.message}`);
        });
      }

      if (orphaned.size > 0) {
        this.logger.log(`[STICKY_MESSAGE] Cleaned up ${orphaned.size} orphaned message(s) in channel=${channelId}`);
      }
    } catch (err) {
      this.logger.warn(
        `[STICKY_MESSAGE] cleanupOrphanedMessages failed: channel=${channelId}: ${(err as Error).message}`,
      );
    }
  }

  /** Discord 메시지 삭제 시도. 실패 시 warn 로그 후 무시. */
  private async tryDeleteMessage(channelId: string, messageId: string): Promise<void> {
    try {
      const channel = await this.client.channels.fetch(channelId);
      if (!channel || !channel.isTextBased()) return;
      const message = await (channel as TextChannel).messages.fetch(messageId);
      await message.delete();
    } catch (err) {
      this.logger.warn(
        `[STICKY_MESSAGE] Failed to delete message ${messageId} in channel ${channelId}: ${(err as Error).message}`,
      );
    }
  }
}
