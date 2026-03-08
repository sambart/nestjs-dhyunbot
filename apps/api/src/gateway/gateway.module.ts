import { DiscordModule } from '@discord-nestjs/core';
import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { DiscordGateway } from './discord.gateway';
import { GuildInfoController } from './guild-info.controller';

@Module({
  imports: [DiscordModule.forFeature(), AuthModule],
  controllers: [GuildInfoController],
  providers: [DiscordGateway],
  exports: [DiscordGateway],
})
export class GatewayModule {}
