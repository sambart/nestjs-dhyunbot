import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  InactiveMemberActionLog,
  InactiveMemberActionType,
} from '../domain/inactive-member-action-log.entity';
import { InactiveMemberConfig } from '../domain/inactive-member-config.entity';
import { InactiveMemberRecord } from '../domain/inactive-member-record.entity';
import type { InactiveMemberConfigSaveDto } from '../dto/inactive-member-config-save.dto';

export interface UpsertRecordData {
  guildId: string;
  userId: string;
  grade: string | null;
  totalMinutes: number;
  prevTotalMinutes: number;
  lastVoiceDate: string | null;
  classifiedAt: Date;
}

export interface CreateActionLogData {
  guildId: string;
  actionType: InactiveMemberActionType;
  targetUserIds: string[];
  executorUserId: string | null;
  successCount: number;
  failCount: number;
  note?: string | null;
}

@Injectable()
export class InactiveMemberRepository {
  constructor(
    @InjectRepository(InactiveMemberConfig)
    private readonly configRepo: Repository<InactiveMemberConfig>,
    @InjectRepository(InactiveMemberRecord)
    private readonly recordRepo: Repository<InactiveMemberRecord>,
    @InjectRepository(InactiveMemberActionLog)
    private readonly actionLogRepo: Repository<InactiveMemberActionLog>,
  ) {}

  async findConfigByGuildId(guildId: string): Promise<InactiveMemberConfig | null> {
    return this.configRepo.findOne({ where: { guildId } });
  }

  async createDefaultConfig(guildId: string): Promise<InactiveMemberConfig> {
    const config = this.configRepo.create({ guildId });
    return this.configRepo.save(config);
  }

  async upsertConfig(
    guildId: string,
    dto: InactiveMemberConfigSaveDto,
  ): Promise<InactiveMemberConfig> {
    let config = await this.findConfigByGuildId(guildId);

    if (!config) {
      config = this.configRepo.create({ guildId });
    }

    if (dto.periodDays !== undefined) config.periodDays = dto.periodDays;
    if (dto.lowActiveThresholdMin !== undefined)
      config.lowActiveThresholdMin = dto.lowActiveThresholdMin;
    if (dto.decliningPercent !== undefined) config.decliningPercent = dto.decliningPercent;
    if (dto.autoActionEnabled !== undefined) config.autoActionEnabled = dto.autoActionEnabled;
    if (dto.autoRoleAdd !== undefined) config.autoRoleAdd = dto.autoRoleAdd;
    if (dto.autoDm !== undefined) config.autoDm = dto.autoDm;
    if (dto.inactiveRoleId !== undefined) config.inactiveRoleId = dto.inactiveRoleId ?? null;
    if (dto.removeRoleId !== undefined) config.removeRoleId = dto.removeRoleId ?? null;
    if (dto.excludedRoleIds !== undefined) config.excludedRoleIds = dto.excludedRoleIds;
    if (dto.dmEmbedTitle !== undefined) config.dmEmbedTitle = dto.dmEmbedTitle ?? null;
    if (dto.dmEmbedBody !== undefined) config.dmEmbedBody = dto.dmEmbedBody ?? null;
    if (dto.dmEmbedColor !== undefined) config.dmEmbedColor = dto.dmEmbedColor ?? null;

    return this.configRepo.save(config);
  }

  async batchUpsertRecords(records: UpsertRecordData[]): Promise<void> {
    if (records.length === 0) return;

    for (const record of records) {
      await this.recordRepo.query(
        `INSERT INTO inactive_member_record
          ("guildId","userId","grade","totalMinutes","prevTotalMinutes","lastVoiceDate","gradeChangedAt","classifiedAt","createdAt","updatedAt")
        VALUES ($1,$2,$3,$4,$5,$6,NOW(),$7,NOW(),NOW())
        ON CONFLICT ("guildId","userId")
        DO UPDATE SET
          "grade" = EXCLUDED."grade",
          "totalMinutes" = EXCLUDED."totalMinutes",
          "prevTotalMinutes" = EXCLUDED."prevTotalMinutes",
          "lastVoiceDate" = EXCLUDED."lastVoiceDate",
          "gradeChangedAt" = CASE
            WHEN inactive_member_record."grade" IS DISTINCT FROM EXCLUDED."grade"
            THEN NOW()
            ELSE inactive_member_record."gradeChangedAt"
          END,
          "classifiedAt" = EXCLUDED."classifiedAt",
          "updatedAt" = NOW()`,
        [
          record.guildId,
          record.userId,
          record.grade,
          record.totalMinutes,
          record.prevTotalMinutes,
          record.lastVoiceDate,
          record.classifiedAt,
        ],
      );
    }
  }

  async findNewlyFullyInactive(
    guildId: string,
    classifiedAt: Date,
  ): Promise<InactiveMemberRecord[]> {
    return this.recordRepo
      .createQueryBuilder('r')
      .where('r.guildId = :guildId', { guildId })
      .andWhere('r.grade = :grade', { grade: 'FULLY_INACTIVE' })
      .andWhere('r.gradeChangedAt >= :classifiedAt', { classifiedAt })
      .getMany();
  }

  async saveActionLog(data: CreateActionLogData): Promise<InactiveMemberActionLog> {
    const log = this.actionLogRepo.create({
      guildId: data.guildId,
      actionType: data.actionType,
      targetUserIds: data.targetUserIds,
      executorUserId: data.executorUserId,
      successCount: data.successCount,
      failCount: data.failCount,
      note: data.note ?? null,
    });
    return this.actionLogRepo.save(log);
  }
}
