import { Injectable } from '@nestjs/common';
import { VoiceState } from 'discord.js';
import { VoiceChannelService } from 'src/channel/voice/application/voice-channel.service';
import { VoiceCommand } from 'src/commands/voice.command';

@Injectable()
export class MicToggleHandler {
  constructor(private readonly voiceChannelService: VoiceChannelService) {}

  async handle(state: VoiceState) {
    await this.voiceChannelService.onUserMicToggle(VoiceCommand.fromVoiceState(state));
  }
}
