import { BotApiClientService, type VoiceStateUpdateDto } from '@dhyunbot/bot-api-client';
import { On } from '@discord-nestjs/core';
import { Injectable, Logger } from '@nestjs/common';
import type { VoiceState } from 'discord.js';

/**
 * Discord voiceStateUpdate 이벤트를 수신하여 API로 전달한다.
 * 기존 VoiceStateDispatcher의 이벤트 분류 역할만 담당하며,
 * 제외 채널 필터링·alone 감지·auto-channel empty 판단은 API에서 수행한다.
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

      let eventType: VoiceStateUpdateDto['eventType'];
      if (!oldChannelId && channelId) {
        eventType = 'join';
      } else if (oldChannelId && !channelId) {
        eventType = 'leave';
      } else if (oldChannelId && channelId && oldChannelId !== channelId) {
        eventType = 'move';
      } else if (oldState.selfMute !== newState.selfMute) {
        eventType = 'mic_toggle';
      } else {
        return;
      }

      // 현재 채널 멤버 정보 (봇 제외)
      const channelHumanMembers = newState.channel
        ? [...newState.channel.members.values()].filter((m) => !m.user.bot)
        : [];
      // 이전 채널 멤버 정보 (봇 제외)
      const oldChannelHumanMembers = oldState.channel
        ? [...oldState.channel.members.values()].filter((m) => !m.user.bot)
        : [];

      await this.apiClient.sendVoiceStateUpdate({
        guildId,
        userId,
        channelId,
        oldChannelId,
        eventType,

        userName: newState.member?.displayName ?? '',
        channelName: newState.channel?.name ?? null,
        oldChannelName: oldState.channel?.name ?? null,
        parentCategoryId: newState.channel?.parentId ?? null,
        categoryName: newState.channel?.parent?.name ?? null,
        oldParentCategoryId: oldState.channel?.parentId ?? null,
        oldCategoryName: oldState.channel?.parent?.name ?? null,
        micOn: !(newState.selfMute ?? false),
        avatarUrl: newState.member?.displayAvatarURL({ size: 128 }) ?? null,

        channelMemberCount: channelHumanMembers.length,
        oldChannelMemberCount: oldChannelHumanMembers.length,
        channelMemberIds: channelHumanMembers.map((m) => m.id),
        oldChannelMemberIds: oldChannelHumanMembers.map((m) => m.id),
      });
    } catch (err) {
      this.logger.error(
        `[BOT] voiceStateUpdate forwarding failed: guild=${newState.guild.id}`,
        err instanceof Error ? err.stack : err,
      );
    }
  }
}
