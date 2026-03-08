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
import { MissionService } from './mission/mission.service';
import { MocoService } from './moco/moco.service';

@Controller('api/guilds/:guildId/newbie')
@UseGuards(JwtAuthGuard)
export class NewbieController {
  constructor(
    private readonly configRepo: NewbieConfigRepository,
    private readonly missionRepo: NewbieMissionRepository,
    private readonly redisRepo: NewbieRedisRepository,
    private readonly missionService: MissionService,
    private readonly mocoService: MocoService,
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
    // prevConfig 스냅샷 (dto와 비교하여 변경 감지용, TypeORM identity map 무관)
    const prevConfig = await this.configRepo.findByGuildId(guildId);
    const prevMission = {
      channelId: prevConfig?.missionNotifyChannelId ?? null,
      messageId: prevConfig?.missionNotifyMessageId ?? null,
    };
    const prevMoco = {
      channelId: prevConfig?.mocoRankChannelId ?? null,
      messageId: prevConfig?.mocoRankMessageId ?? null,
    };

    // dto(요청 body)와 prevConfig를 비교하여 각 섹션 변경 여부 판단
    const missionChanged =
      !prevConfig ||
      (dto.missionEnabled ?? false) !== (prevConfig.missionEnabled ?? false) ||
      (dto.missionNotifyChannelId ?? null) !== (prevConfig.missionNotifyChannelId ?? null) ||
      (dto.missionEmbedTitle ?? null) !== (prevConfig.missionEmbedTitle ?? null) ||
      (dto.missionEmbedDescription ?? null) !== (prevConfig.missionEmbedDescription ?? null) ||
      (dto.missionEmbedColor ?? null) !== (prevConfig.missionEmbedColor ?? null) ||
      (dto.missionEmbedThumbnailUrl ?? null) !== (prevConfig.missionEmbedThumbnailUrl ?? null) ||
      (dto.missionDurationDays ?? null) !== (prevConfig.missionDurationDays ?? null) ||
      (dto.missionTargetPlaytimeHours ?? null) !== (prevConfig.missionTargetPlaytimeHours ?? null);

    const mocoChanged =
      !prevConfig ||
      (dto.mocoEnabled ?? false) !== (prevConfig.mocoEnabled ?? false) ||
      (dto.mocoRankChannelId ?? null) !== (prevConfig.mocoRankChannelId ?? null) ||
      (dto.mocoEmbedTitle ?? null) !== (prevConfig.mocoEmbedTitle ?? null) ||
      (dto.mocoEmbedDescription ?? null) !== (prevConfig.mocoEmbedDescription ?? null) ||
      (dto.mocoEmbedColor ?? null) !== (prevConfig.mocoEmbedColor ?? null) ||
      (dto.mocoEmbedThumbnailUrl ?? null) !== (prevConfig.mocoEmbedThumbnailUrl ?? null) ||
      (dto.mocoAutoRefreshMinutes ?? null) !== (prevConfig.mocoAutoRefreshMinutes ?? null);

    const savedConfig = await this.configRepo.upsert(guildId, dto);
    await this.redisRepo.setConfig(guildId, savedConfig);

    // 미션 Embed: 설정이 변경되었을 때만 기존 메시지 삭제 후 새로 작성
    if (missionChanged && savedConfig.missionEnabled && savedConfig.missionNotifyChannelId) {
      if (prevMission.messageId && prevMission.channelId) {
        await this.missionService.deleteEmbed(prevMission.channelId, prevMission.messageId);
        await this.configRepo.updateMissionNotifyMessageId(guildId, null);
        savedConfig.missionNotifyMessageId = null;
      }
      await this.missionService.refreshMissionEmbed(guildId, savedConfig);
    } else if (prevMission.messageId && prevMission.channelId && !savedConfig.missionNotifyChannelId) {
      await this.missionService.deleteEmbed(prevMission.channelId, prevMission.messageId);
      await this.configRepo.updateMissionNotifyMessageId(guildId, null);
    }

    // 모코코 Embed: 설정이 변경되었을 때만 기존 메시지 삭제 후 새로 작성
    if (mocoChanged && savedConfig.mocoEnabled && savedConfig.mocoRankChannelId) {
      if (prevMoco.messageId && prevMoco.channelId) {
        await this.mocoService.deleteEmbed(prevMoco.channelId, prevMoco.messageId);
        await this.configRepo.updateMocoRankMessageId(guildId, null);
      }
      await this.mocoService.sendOrUpdateRankEmbed(guildId, 1);
    } else if (prevMoco.messageId && prevMoco.channelId && !savedConfig.mocoRankChannelId) {
      await this.mocoService.deleteEmbed(prevMoco.channelId, prevMoco.messageId);
      await this.configRepo.updateMocoRankMessageId(guildId, null);
    }

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
