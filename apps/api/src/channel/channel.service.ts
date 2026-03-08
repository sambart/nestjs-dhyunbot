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

  async findOrCreateChannel(channelId: string, channelName: string): Promise<Channel> {
    let channel = await this.channelRepository.findOne({
      where: { discordChannelId: channelId },
    });

    if (!channel) {
      channel = this.channelRepository.create({
        discordChannelId: channelId,
        channelName,
      });
      channel = await this.channelRepository.save(channel);
    }

    return channel;
  }

  async getAllChannels(): Promise<Channel[]> {
    return this.channelRepository.find();
  }
}
