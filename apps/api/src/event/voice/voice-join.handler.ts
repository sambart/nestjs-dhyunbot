import { Injectable } from '@nestjs/common';
import { VoiceState } from 'discord.js';
import { VoiceChannelService } from 'src/channel/voice/application/voice-channel.service';
import { JoinCommand } from 'src/commands/join.command';

@Injectable()
export class VoiceJoinHandler {
  constructor(private readonly voiceChannelService: VoiceChannelService) {}

  async handle(state: VoiceState) {
    await this.voiceChannelService.onUserJoined(JoinCommand.fromVoiceState(state));
  }
}
