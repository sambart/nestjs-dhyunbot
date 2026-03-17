import { Injectable, Logger } from '@nestjs/common';
import type { APIChannel, APIGuildMember, APIMessage } from 'discord.js';

import { getErrorStack } from '../../common/util/error.util';
import { DiscordRestService } from '../../discord-rest/discord-rest.service';

/** Discord REST API를 통한 상태 접두사 관련 조작 전담. */
@Injectable()
export class StatusPrefixDiscordAdapter {
  private readonly logger = new Logger(StatusPrefixDiscordAdapter.name);

  constructor(private readonly discordRest: DiscordRestService) {}

  // ── Reset Service 용 ──

  /** 길드에서 멤버를 REST API로 페치한다. */
  async fetchMember(guildId: string, memberId: string): Promise<APIGuildMember | null> {
    try {
      return await this.discordRest.fetchGuildMember(guildId, memberId);
    } catch (err) {
      this.logger.warn(
        `[STATUS_PREFIX] Failed to fetch member guild=${guildId} member=${memberId}`,
        getErrorStack(err),
      );
      return null;
    }
  }

  /** 멤버의 닉네임을 변경한다. */
  async setNickname(guildId: string, memberId: string, nickname: string): Promise<boolean> {
    try {
      await this.discordRest.setMemberNickname(guildId, memberId, nickname);
      return true;
    } catch (err) {
      this.logger.warn(
        `[STATUS_PREFIX] setNickname failed: member=${memberId}`,
        getErrorStack(err),
      );
      return false;
    }
  }

  // ── Config Service 용 ──

  /** 채널을 REST API로 페치한다. */
  async fetchChannel(channelId: string): Promise<APIChannel | null> {
    try {
      return await this.discordRest.fetchChannel(channelId);
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
    channelId: string,
    payload: Record<string, unknown>,
  ): Promise<APIMessage> {
    return this.discordRest.sendMessage(channelId, payload);
  }

  /** 기존 메시지를 수정한다. 실패 시 null 반환. */
  async editMessage(
    channelId: string,
    messageId: string,
    payload: Record<string, unknown>,
  ): Promise<APIMessage | null> {
    try {
      return await this.discordRest.editMessage(channelId, messageId, payload);
    } catch (err) {
      this.logger.warn(
        `[STATUS_PREFIX] Failed to edit message ${messageId}`,
        getErrorStack(err),
      );
      return null;
    }
  }
}
