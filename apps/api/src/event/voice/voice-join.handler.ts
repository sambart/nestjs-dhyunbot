import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { VoiceChannelService } from '../../channel/voice/application/voice-channel.service';
import { VOICE_EVENTS, VoiceJoinEvent } from './voice-events';

@Injectable()
export class VoiceJoinHandler {
  constructor(private readonly voiceChannelService: VoiceChannelService) {}

  @OnEvent(VOICE_EVENTS.JOIN)
  async handle(event: VoiceJoinEvent) {
    await this.voiceChannelService.onUserJoined(event.state);
  }
}
