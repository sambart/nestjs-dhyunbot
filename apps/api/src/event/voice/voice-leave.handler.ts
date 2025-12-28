import { Injectable } from '@nestjs/common';
import { VoiceState } from 'discord.js';
import { VoiceChannelService } from '../../channel/voice/application/voice-channel.service';
import { VoiceStateDTO } from '../../channel/voice/infrastructure/voice-state.dto';

@Injectable()
export class VoiceLeaveHandler {
  constructor(private readonly voiceChannelService: VoiceChannelService) {}

  async handle(state: VoiceState) {
    await this.voiceChannelService.onUserLeave(VoiceStateDTO.fromVoiceState(state));
  }
}
