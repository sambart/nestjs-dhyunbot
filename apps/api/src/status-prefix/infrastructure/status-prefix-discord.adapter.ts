import { InjectDiscordClient } from '@discord-nestjs/core';
import { Injectable, Logger } from '@nestjs/common';
import type { Channel, GuildMember, Message } from 'discord.js';
import { Client, TextChannel } from 'discord.js';

import { getErrorStack } from '../../common/util/error.util';

/** Discord API를 통한 상태 접두사 관련 조작 전담. */
@Injectable()
export class StatusPrefixDiscordAdapter {
  private readonly logger = new Logger(StatusPrefixDiscordAdapter.name);

  constructor(
    @InjectDiscordClient() private readonly client: Client,
  ) {}

  // ── Reset Service 용 ──

  /** 길드 캐시에서 멤버를 API로 페치한다. */
  async fetchMember(guildId: string, memberId: string): Promise<GuildMember | null> {
    try {
      const guild = this.client.guilds.cache.get(guildId);
      if (!guild) {
        this.logger.warn(`[STATUS_PREFIX] Guild ${guildId} not found in cache`);
        return null;
      }
      return await guild.members.fetch(memberId);
    } catch (err) {
      this.logger.warn(
        `[STATUS_PREFIX] Failed to fetch member guild=${guildId} member=${memberId}`,
        getErrorStack(err),
      );
      return null;
    }
  }

  /** 멤버의 닉네임을 변경한다. */
  async setNickname(member: GuildMember, nickname: string): Promise<boolean> {
    try {
      await member.setNickname(nickname);
      return true;
    } catch (err) {
      this.logger.warn(
        `[STATUS_PREFIX] setNickname failed: member=${member.id}`,
        getErrorStack(err),
      );
      return false;
    }
  }

  // ── Config Service 용 ──

  /** 채널을 API로 페치한다. */
  async fetchChannel(channelId: string): Promise<Channel | null> {
    try {
      return await this.client.channels.fetch(channelId);
    } catch (err) {
      this.logger.warn(
        `[STATUS_PREFIX] Failed to fetch channel=${channelId}`,
        getErrorStack(err),
      );
      return null;
    }
  }

  /** 텍스트 채널에 메시지를 전송한다. */
  async sendMessage(
    channel: TextChannel,
    payload: Parameters<TextChannel['send']>[0],
  ): Promise<Message> {
    return channel.send(payload);
  }

  /** 기존 메시지를 수정한다. 실패 시 null 반환. */
  async editMessage(
    channel: TextChannel,
    messageId: string,
    payload: Parameters<Message['edit']>[0],
  ): Promise<Message | null> {
    try {
      const message = await channel.messages.fetch(messageId);
      return await message.edit(payload);
    } catch (err) {
      this.logger.warn(
        `[STATUS_PREFIX] Failed to edit message ${messageId}`,
        getErrorStack(err),
      );
      return null;
    }
  }
}
