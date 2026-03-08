import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { VoiceSessionService } from '../../channel/voice/application/voice-session.service';
import { VOICE_EVENTS, VoiceAloneChangedEvent } from './voice-events';

@Injectable()
export class VoiceAloneHandler {
  constructor(private readonly sessionService: VoiceSessionService) {}

  @OnEvent(VOICE_EVENTS.ALONE_CHANGED)
  async handle(event: VoiceAloneChangedEvent) {
    await this.sessionService.updateAloneForChannel(
      event.guildId,
      event.memberIds,
      event.isAlone,
    );
  }
}
