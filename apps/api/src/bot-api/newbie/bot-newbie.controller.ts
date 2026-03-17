import { Body, Controller, Get, HttpCode, HttpStatus, Logger, Post, Query, UseGuards } from '@nestjs/common';

import { MissionService } from '../../newbie/application/mission/mission.service';
import { MocoService } from '../../newbie/application/moco/moco.service';
import { BotApiAuthGuard } from '../bot-api-auth.guard';

class MemberJoinDto {
  guildId: string;
  memberId: string;
  displayName: string;
}

class MissionRefreshDto {
  guildId: string;
}

/**
 * Bot → API 신규사용자 관련 엔드포인트.
 * Bot의 guildMemberAdd, 갱신 버튼 등을 HTTP로 수신하여 처리한다.
 */
@Controller('bot-api/newbie')
@UseGuards(BotApiAuthGuard)
export class BotNewbieController {
  private readonly logger = new Logger(BotNewbieController.name);

  constructor(
    private readonly missionService: MissionService,
    private readonly mocoService: MocoService,
  ) {}

  @Post('mission-refresh')
  @HttpCode(HttpStatus.OK)
  async refreshMissionEmbed(@Body() dto: MissionRefreshDto): Promise<{ ok: boolean }> {
    await this.missionService.invalidateAndRefresh(dto.guildId);
    return { ok: true };
  }

  @Get('moco-rank')
  async getMocoRank(
    @Query('guildId') guildId: string,
    @Query('page') page: string,
  ): Promise<unknown> {
    return this.mocoService.buildRankPayload(guildId, parseInt(page, 10) || 1);
  }

  @Get('moco-my')
  async getMyHunting(
    @Query('guildId') guildId: string,
    @Query('userId') userId: string,
  ): Promise<{ ok: boolean; data: string }> {
    const message = await this.mocoService.buildMyHuntingMessage(guildId, userId);
    return { ok: true, data: message };
  }
}
