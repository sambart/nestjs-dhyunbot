import { Injectable } from '@nestjs/common';
import { VoiceState } from 'discord.js';
import { VoiceChannelService } from 'src/channel/voice/application/voice-channel.service';
import { VoiceStateDTO } from 'src/channel/voice/infrastructure/voice-state.dto';

@Injectable()
export class MicToggleHandler {
  constructor(private readonly voiceChannelService: VoiceChannelService) {}

  async handle(state: VoiceState) {
    await this.voiceChannelService.onUserMicToggle(VoiceStateDTO.fromVoiceState(state));
  }
}
