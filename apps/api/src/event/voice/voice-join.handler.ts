import { Injectable } from '@nestjs/common';
import { VoiceState } from 'discord.js';

import { VoiceChannelService } from '../../channel/voice/application/voice-channel.service';
import { VoiceStateDto } from '../../channel/voice/infrastructure/voice-state.dto';

@Injectable()
export class VoiceJoinHandler {
  constructor(private readonly voiceChannelService: VoiceChannelService) {}

  async handle(state: VoiceState) {
    await this.voiceChannelService.onUserJoined(VoiceStateDto.fromVoiceState(state));
  }
}
