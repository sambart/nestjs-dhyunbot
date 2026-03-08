import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { AutoChannelService } from '../../channel/auto/application/auto-channel.service';
import { AUTO_CHANNEL_EVENTS, AutoChannelChannelEmptyEvent } from './auto-channel-events';

@Injectable()
export class AutoChannelChannelEmptyHandler {
  constructor(private readonly autoChannelService: AutoChannelService) {}

  @OnEvent(AUTO_CHANNEL_EVENTS.CHANNEL_EMPTY)
  async handle(event: AutoChannelChannelEmptyEvent): Promise<void> {
    await this.autoChannelService.handleChannelEmpty(event.guildId, event.channelId);
  }
}
