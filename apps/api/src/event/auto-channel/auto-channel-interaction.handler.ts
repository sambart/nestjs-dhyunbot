import { On } from '@discord-nestjs/core';
import { Injectable, Logger } from '@nestjs/common';
import { Interaction } from 'discord.js';

import { AutoChannelService } from '../../channel/auto/application/auto-channel.service';

/** 자동방 customId 접두사 */
const CUSTOM_ID_PREFIX = {
  BUTTON: 'auto_btn:',
  SUB_OPTION: 'auto_sub:',
} as const;

@Injectable()
export class AutoChannelInteractionHandler {
  private readonly logger = new Logger(AutoChannelInteractionHandler.name);

  constructor(private readonly autoChannelService: AutoChannelService) {}

  /**
   * Discord interactionCreate 이벤트 수신.
   * auto_btn: 또는 auto_sub: 접두사를 가진 버튼 인터랙션만 처리한다.
   * 다른 모듈의 버튼 인터랙션과 충돌 방지를 위해 접두사 필터링 적용.
   */
  @On('interactionCreate')
  async handle(interaction: Interaction): Promise<void> {
    if (!interaction.isButton()) {
      return;
    }

    const customId = interaction.customId;

    if (!customId.startsWith(CUSTOM_ID_PREFIX.BUTTON) && !customId.startsWith(CUSTOM_ID_PREFIX.SUB_OPTION)) {
      return;
    }

    try {
      if (customId.startsWith(CUSTOM_ID_PREFIX.BUTTON)) {
        await this.autoChannelService.handleButtonClick(interaction);
      } else if (customId.startsWith(CUSTOM_ID_PREFIX.SUB_OPTION)) {
        await this.autoChannelService.handleSubOptionClick(interaction);
      }
    } catch (error) {
      this.logger.error(
        `[interactionCreate] Failed to handle interaction: customId=${customId}`,
        (error as Error).stack,
      );

      try {
        const errorContent = '오류가 발생했습니다. 잠시 후 다시 시도하세요.';

        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ ephemeral: true, content: errorContent });
        } else {
          await interaction.reply({ ephemeral: true, content: errorContent });
        }
      } catch (replyError) {
        this.logger.error(
          `[interactionCreate] Failed to send error reply`,
          (replyError as Error).stack,
        );
      }
    }
  }
}
