import { Injectable, Logger } from '@nestjs/common';
import { InjectDiscordClient, On } from '@discord-nestjs/core';
import { Client, VoiceState, Channel } from 'discord.js';
import { VoiceChannelService } from './voice-channel.service';

@Injectable()
export class VoiceStateHandler {
  private readonly logger = new Logger(VoiceStateHandler.name);

  constructor(
    @InjectDiscordClient() private readonly client: Client,
    private readonly voiceChannelService: VoiceChannelService,
  ) {
    Logger.log('VoiceStateHandler constructed');
    this.registerListeners();
  }

  private registerListeners(): void {
    this.client.on('voiceStateUpdate', this.handleVoiceStateUpdate.bind(this));
  }

  private async handleVoiceStateUpdate(oldState: VoiceState, newState: VoiceState): Promise<void> {
    // 사용자가 음성 채널에 새로 접속했을 경우
    if (!oldState.channelId && newState.channelId) {
      this.logger.log(`User ${newState.member?.user.tag} joined channel ${newState.channel?.name}`);

      await this.voiceChannelService.handleUserJoin(newState);
    }

    // 사용자가 음성 채널에서 나갔을 경우
    if (oldState.channelId && !newState.channelId) {
      this.logger.log(`User ${oldState.member?.user.tag} left channel ${oldState.channel?.name}`);

      await this.voiceChannelService.handleUserLeave(oldState);
    }
  }

  @On('channelCreate')
  handleChannelCreate(channel: Channel): void {
    if ('name' in channel) {
      this.logger.log(`New channel created: ${channel.name}`);
    }
  }

  // 채널 삭제 이벤트 처리
  @On('channelDelete')
  handleChannelDelete(channel: Channel): void {
    if ('name' in channel) {
      this.logger.log(`Channel deleted: ${channel.name}`);
    }
  }

  // 채널 업데이트 이벤트 처리
  @On('channelUpdate')
  handleChannelUpdate(oldChannel: Channel, newChannel: Channel): void {
    if ('name' in oldChannel && 'name' in newChannel) {
      this.logger.log(`Channel updated from ${oldChannel.name} to ${newChannel.name}`);
    }
  }
}
