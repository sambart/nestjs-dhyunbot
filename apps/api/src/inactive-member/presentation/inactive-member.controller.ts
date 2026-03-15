import { InjectDiscordClient } from '@discord-nestjs/core';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Client } from 'discord.js';
import type { Request } from 'express';

import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { InactiveMemberService } from '../application/inactive-member.service';
import { InactiveMemberActionService } from '../application/inactive-member-action.service';
import { InactiveMemberActionType } from '../domain/inactive-member.types';
import { InactiveMemberActionDto } from '../dto/inactive-member-action.dto';
import { InactiveMemberConfigSaveDto } from '../dto/inactive-member-config-save.dto';
import { InactiveMemberRepository } from '../infrastructure/inactive-member.repository';
import { InactiveMemberQueryRepository } from '../infrastructure/inactive-member-query.repository';
import type { InactiveMemberRecordOrm } from '../infrastructure/inactive-member-record.orm-entity';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_SEARCH_LIMIT = 1000;
const VALID_GRADES = ['FULLY_INACTIVE', 'LOW_ACTIVE', 'DECLINING'] as const;
const VALID_SORT_BY = ['lastVoiceDate', 'totalMinutes'] as const;
const VALID_SORT_ORDER = ['ASC', 'DESC'] as const;

interface EnrichedMember {
  userId: string;
  nickName: string;
  grade: string | null;
  totalMinutes: number;
  prevTotalMinutes: number;
  lastVoiceDate: string | null;
  gradeChangedAt: Date | null;
  classifiedAt: Date;
}

interface JwtUser {
  discordId: string;
  username: string;
}

@Controller('api/guilds/:guildId/inactive-members')
@UseGuards(JwtAuthGuard)
export class InactiveMemberController {
  private readonly logger = new Logger(InactiveMemberController.name);

  constructor(
    private readonly inactiveMemberService: InactiveMemberService,
    private readonly actionService: InactiveMemberActionService,
    private readonly queryRepo: InactiveMemberQueryRepository,
    private readonly repo: InactiveMemberRepository,
    @InjectDiscordClient() private readonly discord: Client,
  ) {}

  @Get()
  async getList(
    @Param('guildId') guildId: string,
    @Query('grade') gradeRaw?: string,
    @Query('search') search?: string,
    @Query('sortBy') sortByRaw?: string,
    @Query('sortOrder') sortOrderRaw?: string,
    @Query('page') pageRaw?: string,
    @Query('limit') limitRaw?: string,
  ): Promise<{
    total: number;
    page: number;
    limit: number;
    items: EnrichedMember[];
  }> {
    const grade = VALID_GRADES.includes(gradeRaw as (typeof VALID_GRADES)[number])
      ? gradeRaw
      : undefined;
    const sortBy = VALID_SORT_BY.includes(sortByRaw as (typeof VALID_SORT_BY)[number])
      ? sortByRaw
      : 'lastVoiceDate';
    const sortOrder = VALID_SORT_ORDER.includes(sortOrderRaw as (typeof VALID_SORT_ORDER)[number])
      ? sortOrderRaw
      : 'ASC';
    const page = pageRaw ? Math.max(1, parseInt(pageRaw, 10)) : DEFAULT_PAGE;
    const limit = limitRaw ? Math.min(100, Math.max(1, parseInt(limitRaw, 10))) : DEFAULT_LIMIT;

    // search가 있을 때는 전체 조회 후 in-memory 필터/페이지네이션 수행
    const isSearchMode = !!search;
    const queryLimit = isSearchMode ? MAX_SEARCH_LIMIT : limit;

    const { items, total } = await this.queryRepo.findRecordList(guildId, {
      grade,
      sortBy,
      sortOrder,
      page: isSearchMode ? 1 : page,
      limit: queryLimit,
    });

    const guild = this.discord.guilds.cache.get(guildId);
    const memberCache = guild?.members.cache;

    // 캐시에서 먼저 해소, 없는 멤버만 API fetch (검색모드 대량 조회 시 rate limit 방지)
    const memberMap = new Map<string, string>();
    const uncachedUserIds: string[] = [];
    if (guild) {
      for (const record of items) {
        const cached = memberCache?.get(record.userId);
        if (cached) {
          memberMap.set(record.userId, cached.displayName);
        } else {
          uncachedUserIds.push(record.userId);
        }
      }
    }

    const stillUnresolved: string[] = [];
    if (guild && uncachedUserIds.length > 0) {
      const fetchResults = await Promise.allSettled(
        uncachedUserIds.map((id) => guild.members.fetch(id)),
      );
      for (const result of fetchResults) {
        if (result.status === 'fulfilled') {
          memberMap.set(result.value.id, result.value.displayName);
        }
      }
      for (const id of uncachedUserIds) {
        if (!memberMap.has(id)) {
          stillUnresolved.push(id);
        }
      }
    }

    // 길드를 떠난 유저는 글로벌 유저 정보로 fallback
    if (stillUnresolved.length > 0) {
      const userResults = await Promise.allSettled(
        stillUnresolved.map((id) => this.discord.users.fetch(id)),
      );
      for (const result of userResults) {
        if (result.status === 'fulfilled') {
          memberMap.set(result.value.id, result.value.displayName);
        }
      }
    }

    let enriched: EnrichedMember[] = items.map((record: InactiveMemberRecordOrm) => ({
      userId: record.userId,
      nickName: memberMap.get(record.userId) ?? record.userId,
      grade: record.grade,
      totalMinutes: record.totalMinutes,
      prevTotalMinutes: record.prevTotalMinutes,
      lastVoiceDate: record.lastVoiceDate,
      gradeChangedAt: record.gradeChangedAt,
      classifiedAt: record.classifiedAt,
    }));

    if (isSearchMode && search) {
      const keyword = search.toLowerCase();
      enriched = enriched.filter((m) => m.nickName.toLowerCase().includes(keyword));

      const filteredTotal = enriched.length;
      const startIdx = (page - 1) * limit;
      const paged = enriched.slice(startIdx, startIdx + limit);

      return { total: filteredTotal, page, limit, items: paged };
    }

    return { total, page, limit, items: enriched };
  }

  @Get('stats')
  async getStats(@Param('guildId') guildId: string) {
    return this.inactiveMemberService.getStats(guildId);
  }

  @Get('action-logs')
  async getActionLogs(
    @Param('guildId') guildId: string,
    @Query('page') pageRaw?: string,
    @Query('limit') limitRaw?: string,
  ) {
    const page = pageRaw ? Math.max(1, parseInt(pageRaw, 10)) : DEFAULT_PAGE;
    const limit = limitRaw ? Math.min(100, Math.max(1, parseInt(limitRaw, 10))) : DEFAULT_LIMIT;

    const { items, total } = await this.queryRepo.findActionLogs(guildId, page, limit);

    return { total, page, limit, items };
  }

  @Get('config')
  async getConfig(@Param('guildId') guildId: string) {
    return this.inactiveMemberService.getOrCreateConfig(guildId);
  }

  @Put('config')
  async saveConfig(@Param('guildId') guildId: string, @Body() dto: InactiveMemberConfigSaveDto) {
    return this.repo.upsertConfig(guildId, dto);
  }

  @Post('classify')
  @HttpCode(HttpStatus.OK)
  async classify(@Param('guildId') guildId: string) {
    const records = await this.inactiveMemberService.classifyGuild(guildId);
    return { classifiedCount: records.length };
  }

  @Post('actions')
  @HttpCode(HttpStatus.OK)
  async executeAction(
    @Param('guildId') guildId: string,
    @Body() dto: InactiveMemberActionDto,
    @Req() req: Request,
  ) {
    const user = (req as unknown as { user: JwtUser }).user;
    const executorUserId = user?.discordId ?? null;

    const actionType = dto.actionType as InactiveMemberActionType;

    return this.actionService.executeAction(guildId, actionType, dto.targetUserIds, executorUserId);
  }
}
