import { On } from '@discord-nestjs/core';
import { Injectable } from '@nestjs/common';
import { VoiceState } from 'discord.js';
import { VoiceJoinHandler } from './voice-join.handler';
import { VoiceLeaveHandler } from './voice-leave.handler';
import { VoiceMoveHandler } from './voice-move.handler';
import { MicToggleHandler } from './voice-mic-toggle.handler';

@Injectable()
export class VoiceStateDispatcher {
  constructor(
    private readonly joinHandler: VoiceJoinHandler,
    private readonly leaveHandler: VoiceLeaveHandler,
    private readonly moveHandler: VoiceMoveHandler,
    private readonly micToggleHandler: MicToggleHandler,
  ) {}

  @On('voiceStateUpdate')
  async dispatch(oldState: VoiceState, newState: VoiceState) {
    // 마이크 켜짐/꺼짐 상태
    const isMuteChanged = oldState.selfMute !== newState.selfMute;
    const isJoin = !oldState.channelId && newState.channelId;
    const isLeave = oldState.channelId && !newState.channelId;
    const isMove =
      oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId;

    if (isMove) {
      await this.moveHandler.handle(oldState, newState);
    }

    if (isJoin) {
      await this.joinHandler.handle(newState);
    }

    if (isLeave) {
      await this.leaveHandler.handle(oldState);
    }

    if (isMuteChanged) {
      await this.micToggleHandler.handle(newState);
    }
  }
}
