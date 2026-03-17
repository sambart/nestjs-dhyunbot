import { On } from '@discord-nestjs/core';
import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { VoiceState } from 'discord.js';

import { VoiceExcludedChannelService } from '../../channel/voice/application/voice-excluded-channel.service';
import { VoiceStateDto } from '../../channel/voice/infrastructure/voice-state.dto';
import { getErrorStack } from '../../common/util/error.util';
import {
  AUTO_CHANNEL_EVENTS,
  AutoChannelChannelEmptyEvent,
} from '../auto-channel/auto-channel-events';
import {
  VOICE_EVENTS,
  VoiceAloneChangedEvent,
  VoiceJoinEvent,
  VoiceLeaveEvent,
  VoiceMicToggleEvent,
  VoiceMoveEvent,
} from './voice-events';

@Injectable()
export class VoiceStateDispatcher {
  private readonly logger = new Logger(VoiceStateDispatcher.name);

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly excludedChannelService: VoiceExcludedChannelService,
  ) {}

  @On('voiceStateUpdate')
  async dispatch(oldState: VoiceState, newState: VoiceState) {
    try {
      const isMuteChanged = oldState.selfMute !== newState.selfMute;
      const isJoin = !oldState.channelId && newState.channelId;
      const isLeave = oldState.channelId && !newState.channelId;
      const isMove =
        oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId;

      if (isMove) {
        const oldExcluded = await this.isExcluded(
          oldState.guild.id,
          oldState.channelId,
          oldState.channel?.parentId ?? null,
        );
        const newExcluded = await this.isExcluded(
          newState.guild.id,
          newState.channelId,
          newState.channel?.parentId ?? null,
        );

        if (!oldExcluded && !newExcluded) {
          // 경우 D: 둘 다 일반 채널 — MOVE 이벤트 발행 (기존 동작)
          const oldDto = VoiceStateDto.fromVoiceState(oldState);
          const newDto = VoiceStateDto.fromVoiceState(newState);
          await this.eventEmitter.emitAsync(VOICE_EVENTS.MOVE, new VoiceMoveEvent(oldDto, newDto));
        } else if (oldExcluded && !newExcluded) {
          // 경우 B: old만 제외 — JOIN(newState)만 발행
          const newDto = VoiceStateDto.fromVoiceState(newState);
          await this.eventEmitter.emitAsync(VOICE_EVENTS.JOIN, new VoiceJoinEvent(newDto));
        } else if (!oldExcluded && newExcluded) {
          // 경우 C: new만 제외 — LEAVE(oldState)만 발행
          const oldDto = VoiceStateDto.fromVoiceState(oldState);
          await this.eventEmitter.emitAsync(VOICE_EVENTS.LEAVE, new VoiceLeaveEvent(oldDto));
        }
        // 경우 A: 둘 다 제외 — MOVE/JOIN/LEAVE 모두 발행 안 함

        await this.emitAloneChanged(oldState);
        await this.emitAloneChanged(newState);

        // 이동 후 이전 채널이 비어있으면 자동방 삭제 이벤트 발행 (fire-and-forget)
        if (oldState.channel?.members.size === 0) {
          this.eventEmitter.emit(
            AUTO_CHANNEL_EVENTS.CHANNEL_EMPTY,
            new AutoChannelChannelEmptyEvent(oldState.guild.id, oldState.channelId!),
          );
        }
      }

      if (isJoin) {
        const excluded = await this.isExcluded(
          newState.guild.id,
          newState.channelId,
          newState.channel?.parentId ?? null,
        );

        if (!excluded) {
          const dto = VoiceStateDto.fromVoiceState(newState);
          await this.eventEmitter.emitAsync(VOICE_EVENTS.JOIN, new VoiceJoinEvent(dto));
        }

        await this.emitAloneChanged(newState);
      }

      if (isLeave) {
        const excluded = await this.isExcluded(
          oldState.guild.id,
          oldState.channelId,
          oldState.channel?.parentId ?? null,
        );

        if (!excluded) {
          const dto = VoiceStateDto.fromVoiceState(oldState);
          await this.eventEmitter.emitAsync(VOICE_EVENTS.LEAVE, new VoiceLeaveEvent(dto));
        }

        await this.emitAloneChanged(oldState);

        // 퇴장 후 채널이 비어있으면 자동방 삭제 이벤트 발행 (fire-and-forget)
        if (oldState.channel?.members.size === 0) {
          this.eventEmitter.emit(
            AUTO_CHANNEL_EVENTS.CHANNEL_EMPTY,
            new AutoChannelChannelEmptyEvent(oldState.guild.id, oldState.channelId!),
          );
        }
      }

      if (isMuteChanged && !isJoin && !isLeave && !isMove) {
        const excluded = await this.isExcluded(
          newState.guild.id,
          newState.channelId,
          newState.channel?.parentId ?? null,
        );

        if (!excluded) {
          const dto = VoiceStateDto.fromVoiceState(newState);
          await this.eventEmitter.emitAsync(VOICE_EVENTS.MIC_TOGGLE, new VoiceMicToggleEvent(dto));
        }
      }
    } catch (error) {
      this.logger.error(
        `[voiceStateUpdate] guild=${newState.guild?.id} user=${newState.member?.id ?? 'unknown'}`,
        getErrorStack(error),
      );
    }
  }

  /** 제외 채널 여부 확인. channelId가 null이면 false 반환. */
  private async isExcluded(
    guildId: string,
    channelId: string | null,
    parentCategoryId: string | null,
  ): Promise<boolean> {
    if (!channelId) return false;
    return this.excludedChannelService.isExcludedChannel(guildId, channelId, parentCategoryId);
  }

  /** 이벤트 발생 후 해당 채널에 남은 유저들의 alone 상태 변경 이벤트 발행 */
  private async emitAloneChanged(state: VoiceState): Promise<void> {
    if (!state.channel || !state.guild) return;

    const excluded = await this.isExcluded(
      state.guild.id,
      state.channelId,
      state.channel.parentId ?? null,
    );
    if (excluded) return;

    const humanMembers = state.channel.members.filter((m) => !m.user.bot);
    const memberIds = [...humanMembers.keys()];
    if (memberIds.length > 2) return;

    const isAlone = memberIds.length === 1;
    this.eventEmitter.emit(
      VOICE_EVENTS.ALONE_CHANGED,
      new VoiceAloneChangedEvent(state.guild.id, memberIds, isAlone),
    );
  }
}
