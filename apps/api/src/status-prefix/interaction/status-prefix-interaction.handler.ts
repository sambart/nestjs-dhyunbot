import { On } from '@discord-nestjs/core';
import { Injectable, Logger } from '@nestjs/common';
import { Interaction } from 'discord.js';

import { StatusPrefixApplyService } from '../application/status-prefix-apply.service';
import { StatusPrefixResetService } from '../application/status-prefix-reset.service';

/** 버튼 customId 접두사 */
const CUSTOM_ID_PREFIX = {
  APPLY: 'status_prefix:', // F-STATUS-PREFIX-003 (type = PREFIX)
  RESET: 'status_reset:', // F-STATUS-PREFIX-004 (type = RESET)
} as const;

@Injectable()
export class StatusPrefixInteractionHandler {
  private readonly logger = new Logger(StatusPrefixInteractionHandler.name);

  constructor(
    private readonly applyService: StatusPrefixApplyService,
    private readonly resetService: StatusPrefixResetService,
  ) {}

  /**
   * Discord interactionCreate 이벤트 수신.
   * status_prefix: 또는 status_reset: 접두사를 가진 버튼 인터랙션만 처리한다.
   * 다른 모듈의 버튼 인터랙션과 충돌 방지를 위해 접두사 필터링 적용.
   *
   * customId 형식:
   *   status_prefix:{buttonId}  — PREFIX 버튼 클릭 (예: status_prefix:3)
   *   status_reset:{buttonId}   — RESET 버튼 클릭  (예: status_reset:4)
   */
  @On('interactionCreate')
  async handle(interaction: Interaction): Promise<void> {
    // 버튼 인터랙션만 처리
    if (!interaction.isButton()) return;

    const customId = interaction.customId;
    const isApply = customId.startsWith(CUSTOM_ID_PREFIX.APPLY);
    const isReset = customId.startsWith(CUSTOM_ID_PREFIX.RESET);

    // 이 핸들러와 무관한 버튼이면 즉시 반환 (타 도메인과 충돌 없음)
    if (!isApply && !isReset) return;

    // 길드 컨텍스트 필수 확인
    if (!interaction.guildId) {
      await interaction.reply({
        ephemeral: true,
        content: '이 기능은 서버에서만 사용할 수 있습니다.',
      });
      return;
    }

    const guildId = interaction.guildId;
    const memberId = interaction.user.id;

    try {
      if (isApply) {
        // customId: status_prefix:{buttonId}
        const buttonId = parseInt(customId.slice(CUSTOM_ID_PREFIX.APPLY.length), 10);

        if (isNaN(buttonId)) {
          await interaction.reply({ ephemeral: true, content: '잘못된 요청입니다.' });
          return;
        }

        await this.applyService.apply(guildId, memberId, buttonId, interaction);
      } else {
        // customId: status_reset:{buttonId}
        // buttonId는 DB 조회에 사용하지 않지만 형식 일관성 유지
        await this.resetService.reset(guildId, memberId, interaction);
      }
    } catch (error) {
      this.logger.error(
        `[STATUS_PREFIX] Interaction failed: customId=${customId}`,
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
          `[STATUS_PREFIX] Failed to send error reply`,
          (replyError as Error).stack,
        );
      }
    }
  }
}
