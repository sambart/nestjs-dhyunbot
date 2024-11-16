import { Module } from '@nestjs/common';
import { ConfigModule } from '../config/config.module';
import { ConfigService } from '../config/config.service';
import { DiscordService } from './discord.service';

@Module({
  imports: [ConfigModule],
  providers: [DiscordService, ConfigService],
  exports: [DiscordService],
  //controllers: [DiscordController],
})
export class DiscordModule {}
