import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { VoiceChannelService } from '../../channel/voice/application/voice-channel.service';
import { VOICE_EVENTS, VoiceMoveEvent } from './voice-events';

@Injectable()
export class VoiceMoveHandler {
  constructor(private readonly voiceChannelService: VoiceChannelService) {}

  @OnEvent(VOICE_EVENTS.MOVE)
  async handle(event: VoiceMoveEvent) {
    await this.voiceChannelService.onUserMove(event.oldState, event.newState);
  }
}
