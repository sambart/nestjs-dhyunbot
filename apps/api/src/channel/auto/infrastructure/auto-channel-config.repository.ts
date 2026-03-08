import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { AutoChannelButton } from '../domain/auto-channel-button.entity';
import { AutoChannelConfig } from '../domain/auto-channel-config.entity';
import { AutoChannelSubOption } from '../domain/auto-channel-sub-option.entity';
import { AutoChannelSaveDto } from '../dto/auto-channel-save.dto';

@Injectable()
export class AutoChannelConfigRepository {
  constructor(
    @InjectRepository(AutoChannelConfig)
    private readonly configRepo: Repository<AutoChannelConfig>,
    @InjectRepository(AutoChannelButton)
    private readonly buttonRepo: Repository<AutoChannelButton>,
    @InjectRepository(AutoChannelSubOption)
    private readonly subOptionRepo: Repository<AutoChannelSubOption>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * 봇 기동 초기화에서 사용.
   * relations 없이 guildId, triggerChannelId만 조회한다.
   */
  async findAllConfigs(): Promise<AutoChannelConfig[]> {
    return this.configRepo.find();
  }

  /**
   * 설정 ID로 단건 조회 (buttons, subOptions 포함).
   * F-VOICE-009: sendOrUpdateGuideMessage에서 사용.
   */
  async findById(configId: number): Promise<AutoChannelConfig | null> {
    return this.configRepo.findOne({
      where: { id: configId },
      relations: { buttons: { subOptions: true } },
    });
  }

  /**
   * 서버 내 모든 설정 조회 (buttons, subOptions 포함).
   * 웹 대시보드 초기 데이터 로드에서 사용.
   */
  async findAllByGuildId(guildId: string): Promise<AutoChannelConfig[]> {
    return this.configRepo.find({
      where: { guildId },
      relations: { buttons: { subOptions: true } },
    });
  }

  /**
   * 특정 트리거 채널 설정 조회.
   */
  async findByTriggerChannel(
    guildId: string,
    triggerChannelId: string,
  ): Promise<AutoChannelConfig | null> {
    return this.configRepo.findOne({
      where: { guildId, triggerChannelId },
      relations: { buttons: { subOptions: true } },
    });
  }

  /**
   * 설정 upsert:
   *   1. (guildId, triggerChannelId) 기준으로 기존 레코드 조회
   *   2. 없으면 INSERT, 있으면 UPDATE
   *   3. 기존 buttons를 DELETE 후 새 buttons/subOptions INSERT
   *
   * 트랜잭션 내에서 처리하여 부분 실패를 방지한다.
   * guideMessageId는 upsert에서 초기화하지 않고 updateGuideMessageId()로만 변경한다.
   */
  async upsert(guildId: string, dto: AutoChannelSaveDto): Promise<AutoChannelConfig> {
    return this.dataSource.transaction(async (manager) => {
      // 1. 기존 설정 조회
      let config = await manager.findOne(AutoChannelConfig, {
        where: { guildId, triggerChannelId: dto.triggerChannelId },
      });

      if (config) {
        // 2a. 기존 설정 업데이트
        config.guideChannelId = dto.guideChannelId;
        config.waitingRoomTemplate = dto.waitingRoomTemplate ?? null;
        config.guideMessage = dto.guideMessage;
        config.embedTitle = dto.embedTitle ?? null;
        config.embedColor = dto.embedColor ?? null;
        await manager.save(AutoChannelConfig, config);

        // 2b. 기존 버튼 전체 삭제 (CASCADE로 subOptions도 삭제됨)
        await manager.delete(AutoChannelButton, { configId: config.id });
      } else {
        // 3. 신규 생성
        config = manager.create(AutoChannelConfig, {
          guildId,
          triggerChannelId: dto.triggerChannelId,
          guideChannelId: dto.guideChannelId,
          waitingRoomTemplate: dto.waitingRoomTemplate ?? null,
          guideMessage: dto.guideMessage,
          embedTitle: dto.embedTitle ?? null,
          embedColor: dto.embedColor ?? null,
          guideMessageId: null,
        });
        config = await manager.save(AutoChannelConfig, config);
      }

      // 4. 버튼 + 하위 선택지 INSERT
      for (const btnDto of dto.buttons) {
        let button = manager.create(AutoChannelButton, {
          configId: config.id,
          label: btnDto.label,
          emoji: btnDto.emoji ?? null,
          targetCategoryId: btnDto.targetCategoryId,
          channelNameTemplate: btnDto.channelNameTemplate ?? null,
          sortOrder: btnDto.sortOrder,
        });
        button = await manager.save(AutoChannelButton, button);

        for (const subDto of btnDto.subOptions) {
          const sub = manager.create(AutoChannelSubOption, {
            buttonId: button.id,
            label: subDto.label,
            emoji: subDto.emoji ?? null,
            channelNameTemplate: subDto.channelNameTemplate,
            sortOrder: subDto.sortOrder,
          });
          await manager.save(AutoChannelSubOption, sub);
        }
      }

      // 5. 최종 상태를 relations 포함하여 반환
      return manager.findOneOrFail(AutoChannelConfig, {
        where: { id: config.id },
        relations: { buttons: { subOptions: true } },
      });
    });
  }

  /**
   * 안내 메시지 Discord ID 저장.
   * F-VOICE-009에서 메시지 전송 후 호출.
   */
  async updateGuideMessageId(configId: number, messageId: string): Promise<void> {
    await this.configRepo.update(configId, { guideMessageId: messageId });
  }

  /**
   * 버튼 ID로 버튼 조회 (subOptions 관계 포함).
   * F-VOICE-010/011: 버튼 클릭 인터랙션 처리에서 사용.
   */
  async findButtonById(buttonId: number): Promise<AutoChannelButton | null> {
    return this.buttonRepo.findOne({
      where: { id: buttonId },
      relations: { subOptions: true, config: true },
    });
  }

  /**
   * 하위 선택지 ID로 하위 선택지 조회 (button + config 관계 포함).
   * F-VOICE-011: 2단계 하위 선택지 클릭 인터랙션 처리에서 사용.
   */
  async findSubOptionById(subOptionId: number): Promise<AutoChannelSubOption | null> {
    return this.subOptionRepo.findOne({
      where: { id: subOptionId },
      relations: { button: { config: true } },
    });
  }
}
