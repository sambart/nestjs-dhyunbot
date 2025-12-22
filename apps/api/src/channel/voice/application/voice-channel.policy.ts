import { Inject, Injectable } from '@nestjs/common';
import { CONSTANTS } from '../../../config/constants';
import { TempChannelStore } from '../infrastructure/temp-channel-store';

@Injectable()
export class VoiceChannelPolicy {
  private readonly CREATE_CHANNEL_IDS = new Set([CONSTANTS.CREATE_CHANNEL_ID]);

  constructor(@Inject('TempChannelStore') private readonly tempChannelStore: TempChannelStore) {}

  shouldCreateTempChannel(channelId: string): boolean {
    return this.CREATE_CHANNEL_IDS.has(channelId);
  }

  async shouldDeleteChannel(guildId: string, channelId: string): Promise<boolean> {
    return (
      (await this.tempChannelStore.isTempChannel(guildId, channelId)) &&
      (await this.tempChannelStore.isEmpty(channelId))
    );
  }
}
