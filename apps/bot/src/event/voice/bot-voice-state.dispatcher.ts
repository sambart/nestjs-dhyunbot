import { BotApiClientService } from '@dhyunbot/bot-api-client';
import { On } from '@discord-nestjs/core';
import { Injectable, Logger } from '@nestjs/common';
import type { VoiceState } from 'discord.js';

/**
 * Discord voiceStateUpdate 이벤트를 수신하여 API로 전달한다.
 * API의 VoiceStateDispatcher를 대체하며, 비즈니스 로직은 API에서 처리한다.
 */
@Injectable()
export class BotVoiceStateDispatcher {
  private readonly logger = new Logger(BotVoiceStateDispatcher.name);

  constructor(private readonly apiClient: BotApiClientService) {}

  @On('voiceStateUpdate')
  async handleVoiceStateUpdate(oldState: VoiceState, newState: VoiceState): Promise<void> {
    try {
      const guildId = newState.guild.id;
      const userId = newState.member?.id ?? newState.id;
      const channelId = newState.channelId;
      const oldChannelId = oldState.channelId;
      const displayName = newState.member?.displayName;

      let eventType: string;
      if (!oldChannelId && channelId) {
        eventType = 'join';
      } else if (oldChannelId && !channelId) {
        eventType = 'leave';
      } else if (oldChannelId && channelId && oldChannelId !== channelId) {
        eventType = 'move';
      } else if (oldState.selfMute !== newState.selfMute) {
        eventType = 'mic_toggle';
      } else {
        return; // 관심 없는 이벤트
      }

      // fire-and-forget: API 호출 실패 시 로그만 남김
      await this.apiClient.sendVoiceStateUpdate({
        guildId,
        userId,
        channelId,
        oldChannelId,
        eventType,
        isSelfMute: newState.selfMute ?? undefined,
        displayName,
      });
    } catch (err) {
      this.logger.error(
        `[BOT] voiceStateUpdate forwarding failed: guild=${newState.guild.id}`,
        err instanceof Error ? err.stack : err,
      );
    }
  }
}
