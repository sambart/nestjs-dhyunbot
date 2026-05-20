import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';

import { UserPrivacyConfigService } from '../../user-privacy/application/user-privacy-config.service';
import { BotUpsertPrivacyDto } from '../../user-privacy/dto/user-privacy.dto';
import { BotApiAuthGuard } from '../bot-api-auth.guard';

/**
 * Bot → API 프라이버시 설정 수신 엔드포인트.
 * `/privacy` 슬래시 커맨드가 BotApiClientService를 통해 호출한다.
 */
@Controller('bot-api/user-privacy')
@UseGuards(BotApiAuthGuard)
export class BotUserPrivacyController {
  constructor(private readonly userPrivacyService: UserPrivacyConfigService) {}

  @Post('upsert')
  @HttpCode(HttpStatus.OK)
  async upsert(@Body() dto: BotUpsertPrivacyDto): Promise<{ ok: true }> {
    await this.userPrivacyService.upsert(dto.guildId, dto.userId, dto.disableRelationshipShare);
    return { ok: true };
  }
}
