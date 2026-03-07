import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { AutoChannelSaveDto } from './dto/auto-channel-save.dto';
import { AutoChannelConfigRepository } from './infrastructure/auto-channel-config.repository';
import { AutoChannelDiscordGateway } from './infrastructure/auto-channel-discord.gateway';
import { AutoChannelRedisRepository } from './infrastructure/auto-channel-redis.repository';

@Controller('api/guilds/:guildId/auto-channel')
@UseGuards(JwtAuthGuard)
export class AutoChannelController {
  constructor(
    private readonly configRepo: AutoChannelConfigRepository,
    private readonly redisRepo: AutoChannelRedisRepository,
    private readonly discordGateway: AutoChannelDiscordGateway,
  ) {}

  /**
   * POST /api/guilds/:guildId/auto-channel
   *
   * 처리 순서 (F-WEB-004 저장 동작):
   *   1. DB upsert (config + buttons + subOptions)
   *   2. 안내 메시지 전송 또는 갱신 (F-VOICE-009)
   *   3. guideMessageId DB 저장
   *   4. Redis trigger set 갱신 (단건 SADD)
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  async save(
    @Param('guildId') guildId: string,
    @Body() dto: AutoChannelSaveDto,
  ): Promise<{ ok: boolean; configId: number; guideMessageId: string }> {
    // 1. DB upsert
    const config = await this.configRepo.upsert(guildId, dto);

    // 2. 저장된 버튼 ID 기반으로 안내 메시지 전송/갱신
    const buttonPayloads = config.buttons.map((btn) => ({
      id: btn.id,
      label: btn.label,
      emoji: btn.emoji,
    }));

    let guideMessageId: string;

    if (config.guideMessageId) {
      // 기존 메시지 수정 시도
      const editResult = await this.discordGateway.editGuideMessage(
        dto.triggerChannelId,
        config.guideMessageId,
        dto.guideMessage,
        dto.embedTitle ?? null,
        dto.embedColor ?? null,
        buttonPayloads,
      );

      if (editResult !== null) {
        guideMessageId = editResult;
      } else {
        // 수정 실패 (메시지 삭제됨 등) → 신규 전송
        guideMessageId = await this.discordGateway.sendGuideMessage(
          dto.triggerChannelId,
          dto.guideMessage,
          dto.embedTitle ?? null,
          dto.embedColor ?? null,
          buttonPayloads,
        );
      }
    } else {
      // 최초 전송
      guideMessageId = await this.discordGateway.sendGuideMessage(
        dto.triggerChannelId,
        dto.guideMessage,
        dto.embedTitle ?? null,
        dto.embedColor ?? null,
        buttonPayloads,
      );
    }

    // 3. guideMessageId DB 저장
    await this.configRepo.updateGuideMessageId(config.id, guideMessageId);

    // 4. Redis trigger set 갱신 (단건 SADD)
    await this.redisRepo.addTriggerChannel(guildId, dto.triggerChannelId);

    return { ok: true, configId: config.id, guideMessageId };
  }

  /**
   * GET /api/guilds/:guildId/auto-channel
   *
   * 서버의 모든 자동방 설정 반환 (웹 대시보드 초기 데이터 로드).
   */
  @Get()
  async findAll(@Param('guildId') guildId: string) {
    return this.configRepo.findAllByGuildId(guildId);
  }
}
