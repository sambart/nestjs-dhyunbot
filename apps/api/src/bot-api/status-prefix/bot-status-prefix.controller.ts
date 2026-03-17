import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';

import { StatusPrefixApplyService } from '../../status-prefix/application/status-prefix-apply.service';
import { StatusPrefixResetService } from '../../status-prefix/application/status-prefix-reset.service';
import { BotApiAuthGuard } from '../bot-api-auth.guard';

class StatusPrefixApplyDto {
  guildId: string;
  memberId: string;
  buttonId: number;
  currentDisplayName: string;
}

class StatusPrefixResetDto {
  guildId: string;
  memberId: string;
}

@Controller('bot-api/status-prefix')
@UseGuards(BotApiAuthGuard)
export class BotStatusPrefixController {
  constructor(
    private readonly applyService: StatusPrefixApplyService,
    private readonly resetService: StatusPrefixResetService,
  ) {}

  @Post('apply')
  @HttpCode(HttpStatus.OK)
  async apply(@Body() dto: StatusPrefixApplyDto) {
    return this.applyService.applyFromBot(
      dto.guildId,
      dto.memberId,
      dto.buttonId,
      dto.currentDisplayName,
    );
  }

  @Post('reset')
  @HttpCode(HttpStatus.OK)
  async reset(@Body() dto: StatusPrefixResetDto) {
    return this.resetService.resetFromBot(dto.guildId, dto.memberId);
  }
}
