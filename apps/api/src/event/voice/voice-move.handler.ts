import { Injectable } from '@nestjs/common';
import { VoiceState } from 'discord.js';
import { VoiceChannelService } from 'src/channel/voice/application/voice-channel.service';
import { VoiceStateDTO } from 'src/channel/voice/infrastructure/voice-state.dto';

@Injectable()
export class VoiceMoveHandler {
  constructor(private readonly voiceChannelService: VoiceChannelService) {}

  async handle(oldState: VoiceState, newState: VoiceState) {
    await this.voiceChannelService.onUserMove(
      VoiceStateDTO.fromVoiceState(oldState),
      VoiceStateDTO.fromVoiceState(newState),
    );
  }
}
