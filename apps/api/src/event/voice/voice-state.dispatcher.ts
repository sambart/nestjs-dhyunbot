import { On } from '@discord-nestjs/core';
import { Injectable } from '@nestjs/common';
import { VoiceState } from 'discord.js';
import { VoiceJoinHandler } from './voice-join.handler';
import { VoiceLeaveHandler } from './voice-leave.handler';
import { VoiceMoveHandler } from './voice-move.handler';

@Injectable()
export class VoiceStateDispatcher {
  constructor(
    private readonly joinHandler: VoiceJoinHandler,
    private readonly leaveHandler: VoiceLeaveHandler,
    private readonly moveHandler: VoiceMoveHandler,
  ) {}

  @On('voiceStateUpdate')
  async dispatch(oldState: VoiceState, newState: VoiceState) {
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
