import { Injectable } from '@nestjs/common';
import { VoiceState } from 'discord.js';

import { VoiceChannelService } from '../../channel/voice/application/voice-channel.service';
import { VoiceStateDto } from '../../channel/voice/infrastructure/voice-state.dto';

@Injectable()
export class VoiceMoveHandler {
  constructor(private readonly voiceChannelService: VoiceChannelService) {}

  async handle(oldState: VoiceState, newState: VoiceState) {
    await this.voiceChannelService.onUserMove(
      VoiceStateDto.fromVoiceState(oldState),
      VoiceStateDto.fromVoiceState(newState),
    );
  }
}
