import { Body, Controller, HttpCode, HttpStatus, Logger, Post, UseGuards } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { BotApiAuthGuard } from '../bot-api-auth.guard';

class VoiceStateUpdateDto {
  guildId: string;
  userId: string;
  channelId: string | null;
  oldChannelId: string | null;
  eventType: string;
  isSelfMute?: boolean;
  displayName?: string;
}

/**
 * Bot → API 음성 이벤트 수신 엔드포인트.
 * Bot의 voiceStateUpdate 이벤트를 HTTP로 수신하여 내부 EventEmitter로 분배한다.
 */
@Controller('bot-api/voice')
@UseGuards(BotApiAuthGuard)
export class BotVoiceController {
  private readonly logger = new Logger(BotVoiceController.name);

  constructor(private readonly eventEmitter: EventEmitter2) {}

  @Post('state-update')
  @HttpCode(HttpStatus.OK)
  async handleVoiceStateUpdate(@Body() dto: VoiceStateUpdateDto): Promise<{ ok: boolean }> {
    this.logger.debug(
      `[BOT-API] voice/${dto.eventType}: guild=${dto.guildId} user=${dto.userId} channel=${dto.channelId}`,
    );

    // 기존 이벤트 시스템과 동일한 이벤트명으로 발행
    const eventName = `bot-api.voice.${dto.eventType}`;
    await this.eventEmitter.emitAsync(eventName, dto);

    return { ok: true };
  }
}
