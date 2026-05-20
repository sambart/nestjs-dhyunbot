import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../../../../auth/infrastructure/jwt-auth.guard';
import { GuildMembershipGuard } from '../../../../common/guards/guild-membership.guard';
import { GuildCoPresenceConfigService } from '../application/guild-co-presence-config.service';
import {
  GuildCoPresenceConfigDto,
  UpdateGuildCoPresenceConfigDto,
} from '../dto/guild-co-presence-config.dto';

@Controller('api/guilds/:guildId/co-presence-config')
@UseGuards(JwtAuthGuard, GuildMembershipGuard)
export class GuildCoPresenceConfigController {
  constructor(private readonly configService: GuildCoPresenceConfigService) {}

  // F-COPRESENCE-015
  @Get()
  async getConfig(@Param('guildId') guildId: string): Promise<GuildCoPresenceConfigDto> {
    const config = await this.configService.getConfig(guildId);
    return {
      guildId: config.guildId,
      allowPublicAffinityQuery: config.allowPublicAffinityQuery,
      updatedAt: config.updatedAt.toISOString(),
    };
  }

  // F-COPRESENCE-015
  @Put()
  async updateConfig(
    @Param('guildId') guildId: string,
    @Body() dto: UpdateGuildCoPresenceConfigDto,
  ): Promise<GuildCoPresenceConfigDto> {
    const config = await this.configService.upsert(guildId, dto);
    return {
      guildId: config.guildId,
      allowPublicAffinityQuery: config.allowPublicAffinityQuery,
      updatedAt: config.updatedAt.toISOString(),
    };
  }
}
