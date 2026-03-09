import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Channel } from './channel.entity';

@Injectable()
export class ChannelService {
  private readonly logger = new Logger(ChannelService.name);
  constructor(
    @InjectRepository(Channel)
    private readonly channelRepository: Repository<Channel>,
  ) {}

  async findOrCreateChannel(channelId: string, channelName: string, guildId?: string): Promise<Channel> {
    let channel = await this.channelRepository.findOne({
      where: { discordChannelId: channelId },
    });

    if (!channel) {
      channel = this.channelRepository.create({
        discordChannelId: channelId,
        channelName,
        guildId: guildId ?? null,
      });
      channel = await this.channelRepository.save(channel);
    } else if (guildId && !channel.guildId) {
      channel.guildId = guildId;
      channel = await this.channelRepository.save(channel);
    }

    return channel;
  }

  async getAllChannels(): Promise<Channel[]> {
    return this.channelRepository.find();
  }
}
