import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectDiscordClient } from '@discord-nestjs/core';
import { Client, GuildMember } from 'discord.js';
import { VoiceState } from 'discord.js';
import { VoiceChannelPolicy } from './voice-channel.policy';
import { DiscordVoiceGateway } from '../infrastructure/discord-voice.gateway';
import { JoinCommand } from 'src/commands/join.command';
import { LeaveCommand } from 'src/commands/leave.command';
import { TempChannelStore } from '../infrastructure/temp-channel-store';

@Injectable()
export class VoiceChannelService {
  private readonly logger = new Logger(VoiceChannelService.name);
  private readonly channelActions: Record<string, (state: VoiceState) => void>;
  private readonly discord: DiscordVoiceGateway;
  constructor(
    @InjectDiscordClient()
    private readonly client: Client,
    @Inject('TempChannelStore') private readonly tempChannelStore: TempChannelStore,
    private readonly policy: VoiceChannelPolicy, // DI
  ) {
    this.discord = new DiscordVoiceGateway(this.client);
  }
  async onUserJoined(cmd: JoinCommand) {
    if (this.policy.shouldCreateTempChannel(cmd.channelId)) {
      const tempChannelId = await this.discord.createVoiceChannel({
        guildId: cmd.guildId,
        name: '임시',
        parentCategoryId: cmd.parentCategoryId,
      });

      await this.tempChannelStore.registerTempChannel(cmd.guildId, tempChannelId);
      await this.tempChannelStore.addMember(tempChannelId, cmd.userId);
      await this.discord.moveUserToChannel(cmd.guildId, cmd.userId, tempChannelId);
    }
  }
  async onUserLeave(cmd: LeaveCommand) {
    if (await this.policy.shouldDeleteChannel(cmd.guildId, cmd.channelId)) {
      this.logger.log(`삭제 동작`);
      await this.tempChannelStore.removeMember(cmd.channelId, cmd.userId);
      await this.tempChannelStore.unregisterTempChannel(cmd.guildId, cmd.channelId);
      await this.discord.deleteChannel(cmd.channelId);
    } else {
      this.logger.log(`삭제 정책 실패`);
    }
  }

  async moveUserToChannel(voiceState: VoiceState, channelId: string): Promise<void> {
    try {
      const member: GuildMember | null = voiceState.member;
      if (member && member.voice.channelId) {
        await member.voice.setChannel(channelId); // 유저를 지정한 채널로 이동
        this.logger.log(`Moved ${member.user.tag} to channel ${channelId}`);
      }
    } catch (error) {
      this.logger.error(`Error moving user to channel: ${error.message}`, error);
    }
  }
}
