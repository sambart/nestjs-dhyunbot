import { InjectDiscordClient } from '@discord-nestjs/core';
import { Injectable, Logger } from '@nestjs/common';
import { Client, EmbedBuilder, TextChannel } from 'discord.js';

import { StickyMessageConfigRepository } from '../infrastructure/sticky-message-config.repository';

@Injectable()
export class StickyMessageRefreshService {
  private readonly logger = new Logger(StickyMessageRefreshService.name);

  constructor(
    private readonly configRepo: StickyMessageConfigRepository,
    @InjectDiscordClient() private readonly client: Client,
  ) {}

  /**
   * 채널의 고정메세지 재전송 (F-STICKY-004 디바운스 만료 후 호출).
   * 처리 순서:
   *   1. enabled=true 설정 목록 조회 (sortOrder ASC)
   *   2. 각 설정에 대해: 기존 메시지 삭제 → 신규 Embed 전송 → messageId 갱신
   */
  async refresh(guildId: string, channelId: string): Promise<void> {
    const configs = await this.configRepo.findByGuildAndChannel(guildId, channelId);
    if (configs.length === 0) return;

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
