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
    const oldMute = oldState.selfMute;
    const newMute = newState.selfMute;

    if (oldMute !== newMute) {
      return this.micToggleHandler.handle(newState);
    }

    if (!oldState.channelId && newState.channelId) {
      return this.joinHandler.handle(newState);
    }

    if (oldState.channelId && !newState.channelId) {
      return this.leaveHandler.handle(oldState);
    }

    if (oldState.channelId !== newState.channelId) {
      return this.moveHandler.handle(oldState, newState);
    }
  }
}
