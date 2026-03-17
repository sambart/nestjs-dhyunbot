import { InjectDiscordClient } from '@discord-nestjs/core';
import { Injectable, Logger } from '@nestjs/common';
import type { APIEmbed } from 'discord.js';
import { Client, Collection, Message, TextChannel } from 'discord.js';

import { getErrorMessage } from '../../common/util/error.util';

/** Discord API를 통한 고정메세지 관련 조작 전담. */
@Injectable()
export class StickyMessageDiscordAdapter {
  private readonly logger = new Logger(StickyMessageDiscordAdapter.name);

  constructor(
    @InjectDiscordClient() private readonly client: Client,
  ) {}

  /** 텍스트 채널을 페치한다. 텍스트 기반이 아니면 null 반환. */
  async fetchChannel(channelId: string): Promise<TextChannel | null> {
    const channel = await this.client.channels.fetch(channelId);
    if (!channel?.isTextBased()) return null;
    return channel as TextChannel;
  }

  /** 채널에 메시지(Embed 포함)를 전송하고, 전송된 메시지 ID를 반환한다. */
  async sendMessage(channelId: string, payload: { embeds: APIEmbed[] }): Promise<string> {
    const channel = await this.fetchChannel(channelId);
    if (!channel) {
      throw new Error(`Channel ${channelId} is not a text-based channel`);
    }
    const message = await channel.send(payload);
    return message.id;
  }

  /** 기존 메시지를 수정한다. */
  async editMessage(
    channelId: string,
    messageId: string,
    payload: { embeds: APIEmbed[] },
  ): Promise<void> {
    const channel = await this.fetchChannel(channelId);
    if (!channel) return;
    const message = await channel.messages.fetch(messageId);
    await message.edit(payload);
  }

  /** 메시지를 삭제한다. 실패 시 warn 로그 후 무시. */
  async deleteMessage(channelId: string, messageId: string): Promise<void> {
    try {
      const channel = await this.fetchChannel(channelId);
      if (!channel) return;
      const message = await channel.messages.fetch(messageId);
      await message.delete();
    } catch (err) {
      this.logger.warn(
        `[STICKY_MESSAGE] Failed to delete message ${messageId} in channel ${channelId}: ${getErrorMessage(err)}`,
      );
    }
  }

  /** 채널의 최근 메시지를 가져온다. */
  async fetchMessages(channelId: string, limit: number): Promise<Collection<string, Message> | null> {
    const channel = await this.fetchChannel(channelId);
    if (!channel) return null;
    return channel.messages.fetch({ limit });
  }

  /** 봇 유저 ID를 반환한다. */
  getBotUserId(): string | undefined {
    return this.client.user?.id;
  }
}
