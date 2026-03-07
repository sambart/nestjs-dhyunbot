import { DiscordModule } from '@discord-nestjs/core';
import { Module } from '@nestjs/common';

import { DiscordGateway } from './discord.gateway';

@Module({
  imports: [DiscordModule.forFeature()],
  providers: [DiscordGateway],
  exports: [DiscordGateway],
})
export class GatewayModule {}
