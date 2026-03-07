import { Injectable, Logger } from '@nestjs/common';

import { VoiceStateDto } from '../infrastructure/voice-state.dto';
import { VoiceSessionService } from './voice-session.service';
import { VoiceTempChannelService } from './voice-temp-channel.service';

@Injectable()
export class VoiceChannelService {
  private readonly logger = new Logger(VoiceChannelService.name);

  constructor(
    private readonly sessionService: VoiceSessionService,
    private readonly tempChannelService: VoiceTempChannelService,
  ) {}

  async onUserJoined(cmd: VoiceStateDto) {
    await this.sessionService.startOrUpdateSession(cmd);
    await this.tempChannelService.handleJoin(cmd);
    this.logger.log(`[VOICE ENTER] ${cmd.userId} ${cmd.channelName}`);
  }

  async onUserLeave(cmd: VoiceStateDto) {
    await this.sessionService.closeSession(cmd);
    await this.tempChannelService.handleLeave(cmd);
  }

  async onUserMove(oldCmd: VoiceStateDto, newCmd: VoiceStateDto) {
    await this.sessionService.switchChannel(oldCmd, newCmd);
  }

  async onUserMicToggle(cmd: VoiceStateDto) {
    await this.sessionService.startOrUpdateSession(cmd);
  }
}
