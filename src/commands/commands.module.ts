import { Module } from '@nestjs/common';

// Dependencies
import { ConfigModule } from '../config/config.module';
import { DiscordModule } from '../discord/discord.module';
import { CommandsService } from './commands.service';

import { PingHandler } from './ping/ping.handler';

@Module({
  imports: [ConfigModule, DiscordModule],
  providers: [CommandsService, PingHandler],
  exports: [CommandsService],
})
export class CommandsModule {}
