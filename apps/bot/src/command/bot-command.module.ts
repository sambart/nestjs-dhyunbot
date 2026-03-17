import { DiscordModule } from '@discord-nestjs/core';
import { Module } from '@nestjs/common';

import { VersionCommand } from './version.command';
import { VoiceFlushCommand } from './voice-flush.command';

/**
 * Bot 슬래시 커맨드 모듈.
 * API에서 이동된 커맨드들을 등록한다.
 */
@Module({
  imports: [DiscordModule.forFeature()],
  providers: [VersionCommand, VoiceFlushCommand],
})
export class BotCommandModule {}
