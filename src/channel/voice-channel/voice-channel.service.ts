import { Injectable, Logger } from '@nestjs/common';
import { InjectDiscordClient, Once, On, DiscordClientProvider } from '@discord-nestjs/core';
import {
  Client,
  Message,
  EmbedBuilder,
  ChannelType,
  Guild,
  CategoryChannel,
  VoiceChannel,
  GuildMember,
  GuildChannel,
} from 'discord.js';
import { Channel, VoiceState } from 'discord.js';
import { Member } from 'src/member/member.entity';
import { CONSTANTS } from '../../config/constants';

@Injectable()
export class VoiceChannelService {
  private readonly logger = new Logger(VoiceChannelService.name);
  private readonly channelActions: Record<string, (state: VoiceState) => void>;
  // 생성된 채널들을 저장할 Map
  private readonly createdChannels: Map<string, VoiceChannel> = new Map();

  constructor(
    @InjectDiscordClient()
    private readonly client: Client,
    private readonly discordProvider: DiscordClientProvider,
  ) {
    this.channelActions = {
      [CONSTANTS.CREATE_CHANNEL_ID]: this.handleCreateTypeChannel.bind(this),
    };
  }

  async handleUserJoin(newState: VoiceState): Promise<void> {
    const channelId = newState.channelId;
    if (channelId && this.channelActions[channelId]) {
      this.channelActions[channelId](newState); // 해당 채널 동작 실행
    } else {
      this.logger.log(`No specific action for channel ${newState.channel?.name}`);
    }
  }

  async handleUserLeave(oldState: VoiceState): Promise<void> {
    const channel = oldState.channel;

    // 생성된 임시 채널인지 확인 (예: 이름으로 구분)
    const createdChannel = this.getChannelById(oldState.channelId);
    if (channel.members.size === 0 && createdChannel) {
      await this.deleteChannel(channel.id);
      this.logger.log(`Deleted empty channel: ${channel.name}`);
    }
  }

  // 생성채널에 대한 동작
  private async handleCreateTypeChannel(state: VoiceState): Promise<void> {
    const username = state.member?.nickname || state.member?.user.username;
    this.logger.log(`Welcome to the special channel, ${username}!`);

    // 추가 로직 (예: DB 기록, 알림 등)
    const createChannel = await this.createChannel(
      state.guild,
      `채널명을 변경해주세요`,
      state.channel.parent,
    );
    if (createChannel) {
      await this.moveUserToChannel(state, createChannel.id);
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

  async createChannel(
    guild: Guild,
    channelName: string,
    categoryChannel: CategoryChannel,
  ): Promise<GuildChannel | null> {
    try {
      const category = guild.channels.cache.find(
        (channel) =>
          channel.type === ChannelType.GuildCategory && channel.id === categoryChannel.id,
      );

      // 채널 생성
      if (category) {
        const newChannel = await guild.channels.create({
          name: channelName,
          type: ChannelType.GuildVoice,
          parent: category.id, // 카테고리 설정
        });
        this.createdChannels.set(newChannel.id, newChannel);
        this.logger.log(`Created new channel in category: ${newChannel.name}`);
        return newChannel;
      } else {
        this.logger.warn('Category not found.');
        return null;
      }
    } catch (error) {
      this.logger.error('Error creating channel:', error);
      return null;
    }
  }

  // 채널 삭제 및 리스트에서 제거
  async deleteChannel(channelId: string): Promise<void> {
    const channel = this.createdChannels.get(channelId);
    if (channel) {
      await channel.delete();
      this.createdChannels.delete(channelId);
      this.logger.log(`Deleted channel: ${channel.name}`);
    } else {
      this.logger.warn(`Channel with ID ${channelId} not found in created channels.`);
    }
  }

  async setChannelName(channelId: string, name: string): Promise<void> {
    const channel = this.createdChannels.get(channelId);
    if (channel) {
      await channel.setName(name);
      this.logger.log(`Changed channel name to ${name}`);
    } else {
      this.logger.warn(`Channel with ID ${channelId} not found in created channels.`);
    }
  }

  // 채널을 ID로 조회
  getChannelById(channelId: string): VoiceChannel | undefined {
    return this.createdChannels.get(channelId);
  }

  // 생성된 채널 리스트 조회
  getAllCreatedChannels(): VoiceChannel[] {
    return Array.from(this.createdChannels.values());
  }
}
