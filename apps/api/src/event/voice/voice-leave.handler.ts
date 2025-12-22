import { Injectable } from '@nestjs/common';
import { VoiceState } from 'discord.js';
import { VoiceChannelService } from 'src/channel/voice/application/voice-channel.service';
import { LeaveCommand } from 'src/commands/leave.command';

@Injectable()
export class VoiceLeaveHandler {
  constructor(private readonly voiceChannelService: VoiceChannelService) {}

  async handle(state: VoiceState) {
    await this.voiceChannelService.onUserLeave(LeaveCommand.fromVoiceState(state));
  }
}
