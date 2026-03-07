import { On } from '@discord-nestjs/core';
import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { VoiceState } from 'discord.js';

import { VoiceStateDto } from '../../channel/voice/infrastructure/voice-state.dto';
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

  constructor(private readonly eventEmitter: EventEmitter2) {}

  @On('voiceStateUpdate')
  async dispatch(oldState: VoiceState, newState: VoiceState) {
    try {
      const isMuteChanged = oldState.selfMute !== newState.selfMute;
      const isJoin = !oldState.channelId && newState.channelId;
      const isLeave = oldState.channelId && !newState.channelId;
      const isMove =
        oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId;

      if (isMove) {
        const oldDto = VoiceStateDto.fromVoiceState(oldState);
        const newDto = VoiceStateDto.fromVoiceState(newState);
        await this.eventEmitter.emitAsync(VOICE_EVENTS.MOVE, new VoiceMoveEvent(oldDto, newDto));
        this.emitAloneChanged(oldState);
        this.emitAloneChanged(newState);
      }

      if (isJoin) {
        const dto = VoiceStateDto.fromVoiceState(newState);
        await this.eventEmitter.emitAsync(VOICE_EVENTS.JOIN, new VoiceJoinEvent(dto));
        this.emitAloneChanged(newState);
      }

      if (isLeave) {
        const dto = VoiceStateDto.fromVoiceState(oldState);
        await this.eventEmitter.emitAsync(VOICE_EVENTS.LEAVE, new VoiceLeaveEvent(dto));
        this.emitAloneChanged(oldState);
      }

      if (isMuteChanged && !isJoin && !isLeave && !isMove) {
        const dto = VoiceStateDto.fromVoiceState(newState);
        await this.eventEmitter.emitAsync(
          VOICE_EVENTS.MIC_TOGGLE,
          new VoiceMicToggleEvent(dto),
        );
      }
    } catch (error) {
      this.logger.error(
        `[voiceStateUpdate] guild=${newState.guild?.id} user=${newState.member?.id ?? 'unknown'}`,
        (error as Error).stack,
      );
    }
  }

  /** 이벤트 발생 후 해당 채널에 남은 유저들의 alone 상태 변경 이벤트 발행 */
  private emitAloneChanged(state: VoiceState): void {
    if (!state.channel || !state.guild) return;

    const memberIds = [...state.channel.members.keys()];
    if (memberIds.length > 2) return;

    const isAlone = memberIds.length === 1;
    this.eventEmitter.emit(
      VOICE_EVENTS.ALONE_CHANGED,
      new VoiceAloneChangedEvent(state.guild.id, memberIds, isAlone),
    );
  }
}
