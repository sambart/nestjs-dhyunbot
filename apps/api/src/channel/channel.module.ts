import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ChannelService } from './channel.service';
import { ChannelOrm } from './infrastructure/channel.orm-entity';

@Module({
  imports: [TypeOrmModule.forFeature([ChannelOrm])],
  providers: [ChannelService],
  exports: [ChannelService],
})
export class ChannelModule {}
