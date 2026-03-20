import { BotApiClientService } from '@dhyunbot/bot-api-client';
import { splitByLines, truncate } from '@dhyunbot/shared';
import { SlashCommandPipe } from '@discord-nestjs/common';
import { Command, Handler, InteractionEvent } from '@discord-nestjs/core';
import { Injectable, Logger } from '@nestjs/common';
import { Colors, CommandInteraction, EmbedBuilder, PermissionFlagsBits } from 'discord.js';

import { AnalyticsDaysDto } from './analytics-days.dto';

@Command({
  name: 'community-health',
  description: 'Diagnose server community health with AI',
  nameLocalizations: { ko: '커뮤니티건강도' },
  descriptionLocalizations: { ko: '서버 커뮤니티의 건강도를 AI로 진단합니다' },
  defaultMemberPermissions: PermissionFlagsBits.Administrator,
})
@Injectable()
export class CommunityHealthCommand {
  private readonly logger = new Logger(CommunityHealthCommand.name);

  constructor(private readonly apiClient: BotApiClientService) {}

  @Handler()
  async onCommunityHealth(
    @InteractionEvent() interaction: CommandInteraction,
    @InteractionEvent(SlashCommandPipe) dto: AnalyticsDaysDto,
  ): Promise<void> {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({ content: '관리자만 사용할 수 있는 명령어입니다.', ephemeral: true });
      return;
    }

    if (!interaction.guildId) {
      await interaction.reply({ content: '서버에서만 사용 가능한 명령어입니다.', ephemeral: true });
      return;
    }

    await interaction.deferReply();

    try {
      const result = await this.apiClient.getCommunityHealth(interaction.guildId, dto.days);

      if (!result.data) {
        await interaction.editReply({ content: '해당 기간에 음성 채널 활동 데이터가 없습니다.' });
        return;
      }

      const { healthText } = result.data;

      const MAX_EMBED_DESCRIPTION = 4096;
      const needsSplit = healthText.length > MAX_EMBED_DESCRIPTION;
      const overflowSuffix = '\n\n*... 분석 결과가 길어 후속 메시지로 전송합니다.*';

      const embed = new EmbedBuilder()
        .setTitle('\u{1F3E5} 커뮤니티 건강도 진단')
        .setColor(Colors.Blue)
        .setDescription(
          needsSplit
            ? truncate(healthText, MAX_EMBED_DESCRIPTION - 80) + overflowSuffix
            : healthText,
        )
        .addFields({
          name: '\u{1F4C5} 분석 기간',
          value: `최근 ${result.days}일`,
          inline: false,
        })
        .setTimestamp()
        .setFooter({ text: 'Powered by AI' });

      await interaction.editReply({ embeds: [embed] });

      if (needsSplit) {
        const chunks = splitByLines(healthText, 1900);
        for (const chunk of chunks) {
          await interaction.followUp({ content: chunk, ephemeral: false });
        }
      }
    } catch (error) {
      this.logger.error('Community health command error:', error);
      await interaction.editReply({ content: '커뮤니티 건강도 진단 중 오류가 발생했습니다.' });
    }
  }
}
