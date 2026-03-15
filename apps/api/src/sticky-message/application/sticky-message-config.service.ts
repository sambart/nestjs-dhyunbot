import { InjectDiscordClient } from '@discord-nestjs/core';
import { Injectable, Logger } from '@nestjs/common';
import { Client, EmbedBuilder, TextChannel } from 'discord.js';

import { StickyMessageSaveDto } from '../dto/sticky-message-save.dto';
import { StickyMessageConfigOrm } from '../infrastructure/sticky-message-config.orm-entity';
import { StickyMessageConfigRepository } from '../infrastructure/sticky-message-config.repository';
import { StickyMessageRedisRepository } from '../infrastructure/sticky-message-redis.repository';
import { STICKY_FOOTER_MARKER } from '../sticky-message.constants';

@Injectable()
export class StickyMessageConfigService {
  private readonly logger = new Logger(StickyMessageConfigService.name);

  constructor(
    private readonly configRepo: StickyMessageConfigRepository,
    private readonly redisRepo: StickyMessageRedisRepository,
    @InjectDiscordClient() private readonly client: Client,
  ) {}

  /**
   * 설정 목록 조회 (F-STICKY-001).
   * Redis 캐시 우선, 미스 시 DB 조회 후 캐시 저장.
   */
  async getConfigs(guildId: string): Promise<StickyMessageConfigOrm[]> {
    const cached = await this.redisRepo.getConfig(guildId);
    if (cached) return cached;

    const configs = await this.configRepo.findByGuildId(guildId);
    if (configs.length > 0) {
      await this.redisRepo.setConfig(guildId, configs);
    }
    return configs;
  }

  /**
   * 설정 저장 (F-STICKY-002).
   * 처리 순서:
   *   1. DB save (id 기준 upsert)
   *   2. Redis 설정 캐시 갱신
   *   3. enabled = true이면 기존 메시지 삭제 후 신규 Embed 전송 및 messageId 갱신
   */
  async saveConfig(guildId: string, dto: StickyMessageSaveDto): Promise<StickyMessageConfigOrm> {
    // 1. DB save
    const config = await this.configRepo.save(guildId, dto);

    // 2. Redis 캐시 갱신 (최신 전체 목록 재조회)
    const allConfigs = await this.configRepo.findByGuildId(guildId);
    await this.redisRepo.setConfig(guildId, allConfigs);

    // 3. enabled = true이면 Discord 메시지 처리
    if (config.enabled) {
      if (config.messageId) {
        await this.tryDeleteMessage(config.channelId, config.messageId);
      }

      try {
        const newMessageId = await this.sendEmbed(config.channelId, config);
        await this.configRepo.updateMessageId(config.id, newMessageId);
        config.messageId = newMessageId;
      } catch (err) {
        this.logger.error(
          `[STICKY_MESSAGE] Failed to send embed: guild=${guildId} channel=${config.channelId}`,
          (err as Error).stack,
        );
        throw err;
      }
    }

    return config;
  }

  /**
   * 설정 삭제 (F-STICKY-003).
   * 처리 순서:
   *   1. 단건 조회 (messageId, channelId 확인)
   *   2. messageId 존재 시 Discord 메시지 삭제 시도
   *   3. DB 삭제
   *   4. Redis 캐시 무효화
   */
  async deleteConfig(guildId: string, id: number): Promise<void> {
    const config = await this.configRepo.findById(id);

    if (config?.messageId) {
      await this.tryDeleteMessage(config.channelId, config.messageId);
    }

    await this.configRepo.delete(id);
    await this.redisRepo.deleteConfig(guildId);
  }

  /**
   * 채널 내 고정메세지 전체 삭제 (F-STICKY-007).
   * 처리 순서:
   *   1. guildId + channelId로 전체 설정 목록 조회 (enabled 무관)
   *   2. 각 설정의 Discord 메시지 삭제 시도 (실패 시 계속)
   *   3. DB에서 채널 전체 삭제
   *   4. Redis 캐시 무효화
   */
  async deleteByChannel(guildId: string, channelId: string): Promise<{ deletedCount: number }> {
    const allConfigs = await this.configRepo.findByGuildId(guildId);
    const channelConfigs = allConfigs.filter((c) => c.channelId === channelId);

    for (const config of channelConfigs) {
      if (config.messageId) {
        await this.tryDeleteMessage(config.channelId, config.messageId);
      }
    }

    await this.configRepo.deleteByGuildAndChannel(guildId, channelId);
    await this.redisRepo.deleteConfig(guildId);

    return { deletedCount: channelConfigs.length };
  }

  /** Discord 텍스트 채널에 Embed 메시지 전송. 전송된 메시지 ID 반환. */
  private async sendEmbed(
    channelId: string,
    config: {
      embedTitle: string | null;
      embedDescription: string | null;
      embedColor: string | null;
    },
  ): Promise<string> {
    const channel = await this.client.channels.fetch(channelId);

    if (!channel?.isTextBased()) {
      throw new Error(`Channel ${channelId} is not a text-based channel`);
    }

    const embed = new EmbedBuilder();
    if (config.embedTitle) embed.setTitle(config.embedTitle);
    if (config.embedDescription) embed.setDescription(config.embedDescription);
    if (config.embedColor) embed.setColor(config.embedColor as `#${string}`);
    embed.setFooter({ text: STICKY_FOOTER_MARKER });

    const message = await (channel as TextChannel).send({ embeds: [embed] });
    return message.id;
  }

  /** Discord 메시지 삭제 시도. 실패 시 warn 로그 후 무시. */
  private async tryDeleteMessage(channelId: string, messageId: string): Promise<void> {
    try {
      const channel = await this.client.channels.fetch(channelId);
      if (!channel?.isTextBased()) return;
      const message = await (channel as TextChannel).messages.fetch(messageId);
      await message.delete();
    } catch (err) {
      this.logger.warn(
        `[STICKY_MESSAGE] Failed to delete message ${messageId} in channel ${channelId}: ${(err as Error).message}`,
      );
    }
  }
}
