import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';

import { AutoChannelService } from '../../channel/auto/application/auto-channel.service';
import { BotApiAuthGuard } from '../bot-api-auth.guard';

class ButtonClickDto {
  guildId: string;
  userId: string;
  buttonId: number;
  voiceChannelId: string | null;
  displayName: string;
}

class SubOptionDto {
  guildId: string;
  userId: string;
  subOptionId: number;
  voiceChannelId: string | null;
  displayName: string;
}

@Controller('bot-api/auto-channel')
@UseGuards(BotApiAuthGuard)
export class BotAutoChannelController {
  constructor(private readonly autoChannelService: AutoChannelService) {}

  @Post('button-click')
  @HttpCode(HttpStatus.OK)
  async handleButtonClick(@Body() dto: ButtonClickDto) {
    return this.autoChannelService.handleButtonClickFromBot(dto);
  }

  @Post('sub-option')
  @HttpCode(HttpStatus.OK)
  async handleSubOption(@Body() dto: SubOptionDto) {
    return this.autoChannelService.handleSubOptionClickFromBot(dto);
  }
}
