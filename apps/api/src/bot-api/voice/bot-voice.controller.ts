import { Body, Controller, HttpCode, HttpStatus, Logger, Post, UseGuards } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { BotApiAuthGuard } from '../bot-api-auth.guard';

/**
 * Bot → API 음성 이벤트 수신 엔드포인트.
 * Bot의 voiceStateUpdate 이벤트를 HTTP로 수신하여 BotVoiceEventListener로 분배한다.
 */
@Controller('bot-api/voice')
@UseGuards(BotApiAuthGuard)
export class BotVoiceController {
  private readonly logger = new Logger(BotVoiceController.name);

  constructor(private readonly eventEmitter: EventEmitter2) {}

  @Post('state-update')
  @HttpCode(HttpStatus.OK)
  async handleVoiceStateUpdate(@Body() dto: Record<string, unknown>): Promise<{ ok: boolean }> {
    this.logger.debug(
      `[BOT-API] voice/${dto.eventType}: guild=${dto.guildId} user=${dto.userId} channel=${dto.channelId}`,
    );

    // 단일 이벤트명으로 통합 — BotVoiceEventListener가 수신
    await this.eventEmitter.emitAsync('bot-api.voice.state-update', dto);

    return { ok: true };
  }
}
