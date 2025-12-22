import { Injectable } from '@nestjs/common';
import { VoiceState } from 'discord.js';
import { VoiceChannelService } from 'src/channel/voice/application/voice-channel.service';
import { VoiceCommand } from 'src/commands/voice.command';

@Injectable()
export class VoiceJoinHandler {
  constructor(private readonly voiceChannelService: VoiceChannelService) {}

  async handle(state: VoiceState) {
    await this.voiceChannelService.onUserJoined(VoiceCommand.fromVoiceState(state));
  }
}
