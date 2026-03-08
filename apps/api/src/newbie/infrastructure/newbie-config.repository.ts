import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { NewbieConfig } from '../domain/newbie-config.entity';
import { NewbieConfigSaveDto } from '../dto/newbie-config-save.dto';

@Injectable()
export class NewbieConfigRepository {
  constructor(
    @InjectRepository(NewbieConfig)
    private readonly repo: Repository<NewbieConfig>,
  ) {}

  /** guildId로 설정 단건 조회 */
  async findByGuildId(guildId: string): Promise<NewbieConfig | null> {
    return this.repo.findOne({ where: { guildId } });
  }

  /**
   * 설정 생성 또는 갱신 (guildId 기준).
   * missionNotifyMessageId, mocoRankMessageId는 건드리지 않는다.
   */
  async upsert(guildId: string, dto: NewbieConfigSaveDto): Promise<NewbieConfig> {
    let config = await this.repo.findOne({ where: { guildId } });

    if (config) {
      // 기존 레코드 업데이트 (메시지 ID 필드 보존)
      config.welcomeEnabled = dto.welcomeEnabled;
      config.welcomeChannelId = dto.welcomeChannelId ?? null;
      config.welcomeEmbedTitle = dto.welcomeEmbedTitle ?? null;
      config.welcomeEmbedDescription = dto.welcomeEmbedDescription ?? null;
      config.welcomeEmbedColor = dto.welcomeEmbedColor ?? null;
      config.welcomeEmbedThumbnailUrl = dto.welcomeEmbedThumbnailUrl ?? null;
      config.missionEnabled = dto.missionEnabled;
      config.missionDurationDays = dto.missionDurationDays ?? null;
      config.missionTargetPlaytimeHours = dto.missionTargetPlaytimeHours ?? null;
      config.missionNotifyChannelId = dto.missionNotifyChannelId ?? null;
      config.missionEmbedTitle = dto.missionEmbedTitle ?? null;
      config.missionEmbedDescription = dto.missionEmbedDescription ?? null;
      config.missionEmbedColor = dto.missionEmbedColor ?? null;
      config.missionEmbedThumbnailUrl = dto.missionEmbedThumbnailUrl ?? null;
      config.mocoEnabled = dto.mocoEnabled;
      config.mocoRankChannelId = dto.mocoRankChannelId ?? null;
      config.mocoAutoRefreshMinutes = dto.mocoAutoRefreshMinutes ?? null;
      config.mocoEmbedTitle = dto.mocoEmbedTitle ?? null;
      config.mocoEmbedDescription = dto.mocoEmbedDescription ?? null;
      config.mocoEmbedColor = dto.mocoEmbedColor ?? null;
      config.mocoEmbedThumbnailUrl = dto.mocoEmbedThumbnailUrl ?? null;
      config.roleEnabled = dto.roleEnabled;
      config.roleDurationDays = dto.roleDurationDays ?? null;
      config.newbieRoleId = dto.newbieRoleId ?? null;
    } else {
      // 신규 생성
      config = this.repo.create({
        guildId,
        welcomeEnabled: dto.welcomeEnabled,
        welcomeChannelId: dto.welcomeChannelId ?? null,
        welcomeEmbedTitle: dto.welcomeEmbedTitle ?? null,
        welcomeEmbedDescription: dto.welcomeEmbedDescription ?? null,
        welcomeEmbedColor: dto.welcomeEmbedColor ?? null,
        welcomeEmbedThumbnailUrl: dto.welcomeEmbedThumbnailUrl ?? null,
        missionEnabled: dto.missionEnabled,
        missionDurationDays: dto.missionDurationDays ?? null,
        missionTargetPlaytimeHours: dto.missionTargetPlaytimeHours ?? null,
        missionNotifyChannelId: dto.missionNotifyChannelId ?? null,
        missionNotifyMessageId: null,
        missionEmbedTitle: dto.missionEmbedTitle ?? null,
        missionEmbedDescription: dto.missionEmbedDescription ?? null,
        missionEmbedColor: dto.missionEmbedColor ?? null,
        missionEmbedThumbnailUrl: dto.missionEmbedThumbnailUrl ?? null,
        mocoEnabled: dto.mocoEnabled,
        mocoRankChannelId: dto.mocoRankChannelId ?? null,
        mocoRankMessageId: null,
        mocoAutoRefreshMinutes: dto.mocoAutoRefreshMinutes ?? null,
        mocoEmbedTitle: dto.mocoEmbedTitle ?? null,
        mocoEmbedDescription: dto.mocoEmbedDescription ?? null,
        mocoEmbedColor: dto.mocoEmbedColor ?? null,
        mocoEmbedThumbnailUrl: dto.mocoEmbedThumbnailUrl ?? null,
        roleEnabled: dto.roleEnabled,
        roleDurationDays: dto.roleDurationDays ?? null,
        newbieRoleId: dto.newbieRoleId ?? null,
      });
    }

    return this.repo.save(config);
  }

  /** 미션 현황 Embed 메시지 ID 갱신 */
  async updateMissionNotifyMessageId(guildId: string, messageId: string | null): Promise<void> {
    await this.repo.update({ guildId }, { missionNotifyMessageId: messageId });
  }

  /** 모코코 사냥 순위 Embed 메시지 ID 갱신 */
  async updateMocoRankMessageId(guildId: string, messageId: string | null): Promise<void> {
    await this.repo.update({ guildId }, { mocoRankMessageId: messageId });
  }
}
