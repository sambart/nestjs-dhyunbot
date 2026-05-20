import { SlashCommandPipe } from '@discord-nestjs/common';
import { Command, Handler, InteractionEvent } from '@discord-nestjs/core';
import { Injectable, Logger } from '@nestjs/common';
import { BotApiClientService } from '@onyu/bot-api-client';
import { ChatInputCommandInteraction } from 'discord.js';

import { PrivacyDto } from './privacy.dto';

@Command({
  name: 'privacy',
  nameLocalizations: { ko: '사생활' },
  description: 'Toggle relationship visibility',
  descriptionLocalizations: { ko: '친밀도 노출 공개/비공개 설정' },
})
@Injectable()
export class PrivacyCommand {
  private readonly logger = new Logger(PrivacyCommand.name);

  constructor(private readonly apiClient: BotApiClientService) {}

  @Handler()
  async onPrivacy(
    @InteractionEvent() interaction: ChatInputCommandInteraction,
    @InteractionEvent(SlashCommandPipe) dto: PrivacyDto,
  ): Promise<void> {
    if (!interaction.guildId) {
      await interaction.reply({ content: '서버에서만 사용 가능한 명령어입니다.', ephemeral: true });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    const isRelationshipShare = dto.relationshipShare;

    try {
      const result = await this.apiClient.upsertUserPrivacy(
        interaction.guildId,
        interaction.user.id,
        { disableRelationshipShare: !isRelationshipShare },
      );

      if (result.ok) {
        const statusText = isRelationshipShare ? '공개' : '비공개';
        await interaction.editReply({
          content: `✅ 친밀도 공개 설정이 적용되었습니다. (현재: ${statusText})`,
        });
      } else {
        await interaction.editReply({ content: '⚠️ 설정 저장에 실패했습니다.' });
      }
    } catch (error) {
      this.logger.error(
        'Privacy command error',
        error instanceof Error ? error.stack : String(error),
      );
      await interaction.editReply({ content: '사생활 설정 변경 중 오류가 발생했습니다.' });
    }
  }
}
