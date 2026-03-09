import { Injectable, Logger } from '@nestjs/common';

import { MemberService } from '../../../member/member.service';
import { ChannelService } from '../../channel.service';
import { VoiceStateDto } from '../infrastructure/voice-state.dto';
import { VoiceChannelHistoryService } from './voice-channel-history.service';
import { VoiceSessionService } from './voice-session.service';
import { VoiceTempChannelService } from './voice-temp-channel.service';

@Injectable()
export class VoiceChannelService {
  private readonly logger = new Logger(VoiceChannelService.name);

  constructor(
    private readonly sessionService: VoiceSessionService,
    private readonly tempChannelService: VoiceTempChannelService,
    private readonly historyService: VoiceChannelHistoryService,
    private readonly memberService: MemberService,
    private readonly channelService: ChannelService,
  ) {}

  async onUserJoined(cmd: VoiceStateDto) {
    const [member, channel] = await Promise.all([
      this.memberService.findOrCreateMember(cmd.userId, cmd.userName, cmd.avatarUrl),
      this.channelService.findOrCreateChannel(cmd.channelId, cmd.channelName, cmd.guildId, cmd.parentCategoryId, cmd.categoryName),
    ]);

    await Promise.all([
      this.historyService.logJoin(member, channel),
      this.sessionService.startOrUpdateSession(cmd),
      this.tempChannelService.handleJoin(cmd),
    ]);

    this.logger.log(`[VOICE ENTER] ${cmd.userId} ${cmd.channelName}`);
  }

  async onUserLeave(cmd: VoiceStateDto) {
    const [member, channel] = await Promise.all([
      this.memberService.findOrCreateMember(cmd.userId, cmd.userName, cmd.avatarUrl),
      this.channelService.findOrCreateChannel(cmd.channelId, cmd.channelName, cmd.guildId),
    ]);

    await this.historyService.logLeave(member, channel);
    await this.sessionService.closeSession(cmd);
    await this.tempChannelService.handleLeave(cmd);

    this.logger.log(`[VOICE LEAVE] ${cmd.userId} ${cmd.channelName}`);
  }

  async onUserMove(oldCmd: VoiceStateDto, newCmd: VoiceStateDto) {
    const [member, oldChannel, newChannel] = await Promise.all([
      this.memberService.findOrCreateMember(newCmd.userId, newCmd.userName, newCmd.avatarUrl),
      this.channelService.findOrCreateChannel(oldCmd.channelId, oldCmd.channelName, oldCmd.guildId),
      this.channelService.findOrCreateChannel(newCmd.channelId, newCmd.channelName, newCmd.guildId, newCmd.parentCategoryId, newCmd.categoryName),
    ]);

    await this.historyService.logLeave(member, oldChannel);
    await this.historyService.logJoin(member, newChannel);
    await this.sessionService.switchChannel(oldCmd, newCmd);
  }

  async onUserMicToggle(cmd: VoiceStateDto) {
    await this.sessionService.startOrUpdateSession(cmd);
  }
}
