import { Injectable } from '@nestjs/common';
import { VoiceState } from 'discord.js';
import { VoiceChannelService } from 'src/channel/voice/application/voice-channel.service';

@Injectable()
export class VoiceMoveHandler {
  constructor(private readonly voiceChannelService: VoiceChannelService) {}

  async handle(oldState: VoiceState, newState: VoiceState) {
    //await this.voiceChannelService.handleUserLeave(state);
  }
}
