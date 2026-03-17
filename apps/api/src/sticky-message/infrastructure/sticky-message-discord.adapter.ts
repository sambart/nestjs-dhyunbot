import { Injectable, Logger } from '@nestjs/common';
import type { APIEmbed, APIMessage } from 'discord.js';

import { getErrorMessage } from '../../common/util/error.util';
import { DiscordRestService } from '../../discord-rest/discord-rest.service';

/** Discord REST API를 통한 고정메세지 관련 조작 전담. */
@Injectable()
export class StickyMessageDiscordAdapter {
  private readonly logger = new Logger(StickyMessageDiscordAdapter.name);

  constructor(private readonly discordRest: DiscordRestService) {}

  /** 채널에 메시지(Embed 포함)를 전송하고, 전송된 메시지 ID를 반환한다. */
  async sendMessage(channelId: string, payload: { embeds: APIEmbed[] }): Promise<string> {
    const message = await this.discordRest.sendMessage(channelId, payload);
    return message.id;
  }

  /** 기존 메시지를 수정한다. */
  async editMessage(
    channelId: string,
    messageId: string,
    payload: { embeds: APIEmbed[] },
  ): Promise<void> {
    await this.discordRest.editMessage(channelId, messageId, payload);
  }

  /** 메시지를 삭제한다. 실패 시 warn 로그 후 무시. */
  async deleteMessage(channelId: string, messageId: string): Promise<void> {
    try {
      await this.discordRest.deleteMessage(channelId, messageId);
    } catch (err) {
      this.logger.warn(
        `[STICKY_MESSAGE] Failed to delete message ${messageId} in channel ${channelId}: ${getErrorMessage(err)}`,
      );
    }
  }

  /** 채널의 최근 메시지를 가져온다. */
  async fetchMessages(channelId: string, limit: number): Promise<APIMessage[]> {
    return this.discordRest.fetchMessages(channelId, { limit });
  }

  /** 봇 유저 ID를 반환한다. */
  getBotUserId(): string {
    return this.discordRest.getBotUserId();
  }
}
