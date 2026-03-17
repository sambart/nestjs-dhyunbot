import { DiscordModule } from '@discord-nestjs/core';
import { Module } from '@nestjs/common';

import { BotVoiceStateDispatcher } from './voice/bot-voice-state.dispatcher';

/**
 * Discord 이벤트를 수신하여 API로 전달하는 모듈.
 * API의 DiscordEventsModule을 대체한다.
 */
@Module({
  imports: [DiscordModule.forFeature()],
  providers: [BotVoiceStateDispatcher],
})
export class BotEventModule {}
