import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NewbieConfigSaveDto } from './dto/newbie-config-save.dto';
import { NewbieConfigRepository } from './infrastructure/newbie-config.repository';
import { NewbieMissionRepository } from './infrastructure/newbie-mission.repository';
import { NewbieRedisRepository } from './infrastructure/newbie-redis.repository';

@Controller('api/guilds/:guildId/newbie')
@UseGuards(JwtAuthGuard)
export class NewbieController {
  constructor(
    private readonly configRepo: NewbieConfigRepository,
    private readonly missionRepo: NewbieMissionRepository,
    private readonly redisRepo: NewbieRedisRepository,
  ) {}

  /**
   * GET /api/guilds/:guildId/newbie/config
   * 설정 조회. Redis 캐시 우선, 미스 시 DB 조회 후 캐시 저장.
   */
  @Get('config')
  async getConfig(@Param('guildId') guildId: string) {
    const cached = await this.redisRepo.getConfig(guildId);
    if (cached) return cached;

    const config = await this.configRepo.findByGuildId(guildId);
    if (config) {
      await this.redisRepo.setConfig(guildId, config);
    }
    return config;
  }

  /**
   * POST /api/guilds/:guildId/newbie/config
   * 설정 저장. DB upsert 후 Redis 캐시 갱신.
   * 반환: { ok: boolean }
   */
  @Post('config')
  @HttpCode(HttpStatus.OK)
  async saveConfig(
    @Param('guildId') guildId: string,
    @Body() dto: NewbieConfigSaveDto,
  ): Promise<{ ok: boolean }> {
    const savedConfig = await this.configRepo.upsert(guildId, dto);
    await this.redisRepo.setConfig(guildId, savedConfig);
    return { ok: true };
  }

  /**
   * GET /api/guilds/:guildId/newbie/missions
   * 길드의 IN_PROGRESS 미션 목록 조회.
   * Redis 캐시 우선, 미스 시 DB 조회 후 캐시 저장.
   */
  @Get('missions')
  async getMissions(@Param('guildId') guildId: string) {
    const cached = await this.redisRepo.getMissionActive(guildId);
    if (cached) return cached;

    const missions = await this.missionRepo.findActiveByGuild(guildId);
    await this.redisRepo.setMissionActive(guildId, missions);
    return missions;
  }

  /**
   * GET /api/guilds/:guildId/newbie/moco?page=1&pageSize=10
   * 모코코 사냥 순위 페이지 조회.
   * 반환: { items: Array<{ hunterId, totalMinutes }>, total: number, page: number, pageSize: number }
   */
  @Get('moco')
  async getMocoRank(
    @Param('guildId') guildId: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const parsedPage = parseInt(page ?? '', 10);
    const parsedPageSize = parseInt(pageSize ?? '', 10);

    const resolvedPage = isNaN(parsedPage) || parsedPage < 1 ? 1 : parsedPage;
    const resolvedPageSize = isNaN(parsedPageSize) || parsedPageSize < 1 ? 10 : parsedPageSize;

    const [items, total] = await Promise.all([
      this.redisRepo.getMocoRankPage(guildId, resolvedPage, resolvedPageSize),
      this.redisRepo.getMocoRankCount(guildId),
    ]);

    return { items, total, page: resolvedPage, pageSize: resolvedPageSize };
  }
}
