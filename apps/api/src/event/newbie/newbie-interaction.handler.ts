import { On } from '@discord-nestjs/core';
import { Injectable, Logger } from '@nestjs/common';
import { ButtonInteraction, Interaction } from 'discord.js';

import { NEWBIE_CUSTOM_ID } from '../../newbie/infrastructure/newbie-custom-id.constants';
import { MissionService } from '../../newbie/mission/mission.service';
import { MocoService } from '../../newbie/moco/moco.service';

@Injectable()
export class NewbieInteractionHandler {
  private readonly logger = new Logger(NewbieInteractionHandler.name);

  constructor(
    private readonly missionService: MissionService,
    private readonly mocoService: MocoService,
  ) {}

  /**
   * Discord interactionCreate 이벤트 수신.
   * newbie_mission: 또는 newbie_moco: 접두사를 가진 버튼 인터랙션만 처리한다.
   * 다른 모듈의 버튼 인터랙션과 충돌 방지를 위해 접두사 필터링 적용.
   */
  @On('interactionCreate')
  async handle(interaction: Interaction): Promise<void> {
    if (!interaction.isButton()) return;

    const customId = interaction.customId;
    const isMission = customId.startsWith(NEWBIE_CUSTOM_ID.MISSION_REFRESH);
    const isMoco =
      customId.startsWith(NEWBIE_CUSTOM_ID.MOCO_PREV) ||
      customId.startsWith(NEWBIE_CUSTOM_ID.MOCO_NEXT) ||
      customId.startsWith(NEWBIE_CUSTOM_ID.MOCO_REFRESH);

    if (!isMission && !isMoco) return;

    try {
      if (isMission) {
        await this.handleMissionButton(interaction);
      } else {
        await this.handleMocoButton(interaction);
      }
    } catch (error) {
      this.logger.error(
        `[NEWBIE] Interaction failed: customId=${customId}`,
        (error as Error).stack,
      );

      try {
        const content = '오류가 발생했습니다. 잠시 후 다시 시도하세요.';
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ ephemeral: true, content });
        } else {
          await interaction.reply({ ephemeral: true, content });
        }
      } catch (replyError) {
        this.logger.error(
          `[NEWBIE] Failed to send error reply`,
          (replyError as Error).stack,
        );
      }
    }
  }

  /**
   * newbie_mission:refresh:{guildId} 버튼 처리.
   * Redis 캐시 무효화 후 Embed를 최신 데이터로 갱신한다.
   */
  private async handleMissionButton(interaction: ButtonInteraction): Promise<void> {
    const customId = interaction.customId;

    if (customId.startsWith(NEWBIE_CUSTOM_ID.MISSION_REFRESH)) {
      // newbie_mission:refresh:{guildId}
      const guildId = customId.slice(NEWBIE_CUSTOM_ID.MISSION_REFRESH.length);

      if (!guildId) {
        await interaction.reply({ ephemeral: true, content: '잘못된 요청입니다.' });
        return;
      }

      await interaction.deferReply({ ephemeral: true });
      await this.missionService.invalidateAndRefresh(guildId);
      await interaction.editReply({ content: '미션 현황이 갱신되었습니다.' });
    }
  }

  private async handleMocoButton(interaction: ButtonInteraction): Promise<void> {
    const customId = interaction.customId;

    if (customId.startsWith(NEWBIE_CUSTOM_ID.MOCO_REFRESH)) {
      // newbie_moco:refresh:{guildId}
      const guildId = customId.slice(NEWBIE_CUSTOM_ID.MOCO_REFRESH.length);
      const payload = await this.mocoService.buildRankPayload(guildId, 1);
      await interaction.update(payload);
      return;
    }

    if (customId.startsWith(NEWBIE_CUSTOM_ID.MOCO_PREV)) {
      // newbie_moco:prev:{guildId}:{currentPage}
      const rest = customId.slice(NEWBIE_CUSTOM_ID.MOCO_PREV.length);
      const lastColon = rest.lastIndexOf(':');
      const guildId = rest.slice(0, lastColon);
      const currentPage = parseInt(rest.slice(lastColon + 1), 10);
      const payload = await this.mocoService.buildRankPayload(guildId, currentPage - 1);
      await interaction.update(payload);
      return;
    }

    if (customId.startsWith(NEWBIE_CUSTOM_ID.MOCO_NEXT)) {
      // newbie_moco:next:{guildId}:{currentPage}
      const rest = customId.slice(NEWBIE_CUSTOM_ID.MOCO_NEXT.length);
      const lastColon = rest.lastIndexOf(':');
      const guildId = rest.slice(0, lastColon);
      const currentPage = parseInt(rest.slice(lastColon + 1), 10);
      const payload = await this.mocoService.buildRankPayload(guildId, currentPage + 1);
      await interaction.update(payload);
    }
  }
}
