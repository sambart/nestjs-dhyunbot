import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { VoiceChannelService } from '../../channel/voice/application/voice-channel.service';
import { VOICE_EVENTS, VoiceMicToggleEvent } from './voice-events';

@Injectable()
export class MicToggleHandler {
  constructor(private readonly voiceChannelService: VoiceChannelService) {}

  @OnEvent(VOICE_EVENTS.MIC_TOGGLE)
  async handle(event: VoiceMicToggleEvent) {
    await this.voiceChannelService.onUserMicToggle(event.state);
  }
}
