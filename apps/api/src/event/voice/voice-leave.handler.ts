import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { VoiceChannelService } from '../../channel/voice/application/voice-channel.service';
import { VOICE_EVENTS, VoiceLeaveEvent } from './voice-events';

@Injectable()
export class VoiceLeaveHandler {
  constructor(private readonly voiceChannelService: VoiceChannelService) {}

  @OnEvent(VOICE_EVENTS.LEAVE)
  async handle(event: VoiceLeaveEvent) {
    await this.voiceChannelService.onUserLeave(event.state);
  }
}
