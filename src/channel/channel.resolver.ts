import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { ChannelService } from './channel.service';
import { ChannelModel } from './channel.model';

@Resolver(() => ChannelModel)
export class ChannelResolver {
  constructor(private readonly channelService: ChannelService) {}

  @Query(() => [ChannelModel], { name: 'channels' })
  async getChannels() {
    return this.channelService.getAllChannels();
  }
}
