import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { MocoService } from '../../newbie/moco/moco.service';
import { NEWBIE_EVENTS, NewbieVoiceStateChangedEvent } from './newbie-events';

@Injectable()
export class NewbieVoiceStateChangedHandler {
  private readonly logger = new Logger(NewbieVoiceStateChangedHandler.name);

  constructor(private readonly mocoService: MocoService) {}

  @OnEvent(NEWBIE_EVENTS.VOICE_STATE_CHANGED)
  async handle(event: NewbieVoiceStateChangedEvent): Promise<void> {
    try {
      await this.mocoService.handleVoiceStateChanged(
        event.guildId,
        event.channelId,
        event.channelMemberIds,
      );
    } catch (error) {
      this.logger.error(
        `[MOCO] handleVoiceStateChanged failed: guild=${event.guildId} channel=${event.channelId}`,
        (error as Error).stack,
      );
    }
  }
}
