import { DiscordModule } from '@discord-nestjs/core';
import { Module } from '@nestjs/common';

import { VersionCommand } from './version.command';

@Module({
  imports: [DiscordModule.forFeature()],
  providers: [VersionCommand],
})
export class VersionModule {}
