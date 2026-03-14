import { GuildOverviewResponse } from '@dhyunbot/shared';
import { Controller, Get, Param, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OverviewService } from './overview.service';

@Controller('api/guilds/:guildId')
@UseGuards(JwtAuthGuard)
export class OverviewController {
  constructor(private readonly overviewService: OverviewService) {}

  @Get('overview')
  async getOverview(@Param('guildId') guildId: string): Promise<GuildOverviewResponse> {
    return this.overviewService.getOverview(guildId);
  }
}
