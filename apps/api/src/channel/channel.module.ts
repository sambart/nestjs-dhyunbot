import { DiscordModule } from '@discord-nestjs/core';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ChannelService } from './channel.service';
import { ChannelOrm } from './infrastructure/channel.orm-entity';

@Module({
  imports: [DiscordModule.forFeature(), TypeOrmModule.forFeature([ChannelOrm])],
  providers: [ChannelService],
  exports: [ChannelService],
})
export class ChannelModule {}
