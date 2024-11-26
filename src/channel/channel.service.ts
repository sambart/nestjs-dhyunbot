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
import { Member } from 'src/member/member.entity';
import { CONSTANTS } from '../config/constants';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Channel } from './channel.entity';

@Injectable()
export class ChannelService {
  private readonly logger = new Logger(ChannelService.name);
  constructor(
    @InjectRepository(Channel)
    private readonly channelRepository: Repository<Channel>,
  ) {
    //console.log('ChannelRepository:', this.channelRepository);
  }

  async findOrCreateChannel(channelId: string, a_channelName: string): Promise<Channel> {
    // 1. 채널이 존재하는지 확인
    let channel = await this.channelRepository.findOne({
      where: { discordChannelId: channelId }, // 필요한 조건
    });

    // 2. 채널이 없으면 생성
    if (!channel) {
      channel = this.channelRepository.create({
        discordChannelId: channelId,
        channelName: a_channelName,
      }); // 생성
      channel = await this.channelRepository.save(channel); // 저장
    }

    return channel;
  }

  async getAllChannels(): Promise<Channel[]> {
    return this.channelRepository.find();
  }
}
