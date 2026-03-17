import { BotApiClientService } from '@dhyunbot/bot-api-client';
import { On } from '@discord-nestjs/core';
import { Injectable, Logger } from '@nestjs/common';
import { type GuildMember, Interaction } from 'discord.js';

const CUSTOM_ID_PREFIX = {
  APPLY: 'status_prefix:',
  RESET: 'status_reset:',
} as const;

/**
 * Discord interactionCreate 이벤트를 수신하여 status_prefix/status_reset 버튼을 처리한다.
 * 비즈니스 로직은 API에 위임하고, 닉네임 변경과 Discord 응답은 Bot에서 직접 수행한다.
 */
@Injectable()
export class BotStatusPrefixInteractionHandler {
  private readonly logger = new Logger(BotStatusPrefixInteractionHandler.name);

  constructor(private readonly apiClient: BotApiClientService) {}

  @On('interactionCreate')
  async handle(interaction: Interaction): Promise<void> {
    if (!interaction.isButton()) return;

    const customId = interaction.customId;
    const isApply = customId.startsWith(CUSTOM_ID_PREFIX.APPLY);
    const isReset = customId.startsWith(CUSTOM_ID_PREFIX.RESET);
    if (!isApply && !isReset) return;
    if (!interaction.guildId) return;

    const guildId = interaction.guildId;
    const memberId = interaction.user.id;
    const member = interaction.member as GuildMember;

    try {
      if (isApply) {
        const buttonId = parseInt(customId.slice(CUSTOM_ID_PREFIX.APPLY.length), 10);
        if (isNaN(buttonId)) {
          await interaction.reply({ ephemeral: true, content: '잘못된 요청입니다.' });
          return;
        }

        const result = await this.apiClient.applyStatusPrefix({
          guildId,
          memberId,
          buttonId,
          currentDisplayName: member.displayName,
        });

        if (result.success && result.newNickname) {
          try {
            await member.setNickname(result.newNickname);
          } catch (err) {
            await interaction.reply({
              ephemeral: true,
              content: '닉네임을 변경할 권한이 없습니다. 봇 역할을 확인해 주세요.',
            });
            return;
          }
        }

        await interaction.reply({ ephemeral: true, content: result.message });
      } else {
        const result = await this.apiClient.resetStatusPrefix({ guildId, memberId });

        if (result.success && result.originalNickname) {
          try {
            await member.setNickname(result.originalNickname);
          } catch (err) {
            await interaction.reply({
              ephemeral: true,
              content: '닉네임을 변경할 권한이 없습니다. 봇 역할을 확인해 주세요.',
            });
            return;
          }
        }

        await interaction.reply({ ephemeral: true, content: result.message });
      }
    } catch (error) {
      this.logger.error(
        `[STATUS_PREFIX] Interaction failed: customId=${customId}`,
        error instanceof Error ? error.stack : error,
      );

      try {
        const content = '오류가 발생했습니다. 잠시 후 다시 시도하세요.';
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ ephemeral: true, content });
        } else {
          await interaction.reply({ ephemeral: true, content });
        }
      } catch {
        // 응답 실패 무시
      }
    }
  }
}
