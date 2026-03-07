import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { AutoChannelService } from '../../channel/auto/application/auto-channel.service';
import { AUTO_CHANNEL_EVENTS, AutoChannelTriggerJoinEvent } from './auto-channel-events';

@Injectable()
export class AutoChannelTriggerJoinHandler {
  constructor(private readonly autoChannelService: AutoChannelService) {}

  @OnEvent(AUTO_CHANNEL_EVENTS.TRIGGER_JOIN)
  async handle(event: AutoChannelTriggerJoinEvent): Promise<void> {
    await this.autoChannelService.handleTriggerJoin(event.state);
  }
}
