import { Module } from '@nestjs/common';
import { DiscordModule } from '@discord-nestjs/core';
import { DiscordGateway } from './discord.gateway';

@Module({
  imports: [DiscordModule.forFeature()],
  providers: [DiscordGateway],
  exports: [DiscordGateway],
})
export class GatewayModule {}
