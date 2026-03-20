import { SlashCommandPipe } from '@discord-nestjs/common';
import { Command, Handler, InteractionEvent } from '@discord-nestjs/core';
import { Injectable, Logger } from '@nestjs/common';
import { BotApiClientService } from '@onyu/bot-api-client';
import { splitByLines, truncate } from '@onyu/shared';
import { Colors, CommandInteraction, EmbedBuilder, PermissionFlagsBits } from 'discord.js';

import { AnalyticsDaysDto } from './analytics-days.dto';

@Command({
  name: 'voice-stats',
  description: 'Analyze voice channel activity with AI',
  nameLocalizations: { ko: '음성통계' },
  descriptionLocalizations: { ko: '서버의 음성 채널 활동을 AI로 분석합니다' },
  defaultMemberPermissions: PermissionFlagsBits.Administrator,
})
@Injectable()
export class VoiceStatsCommand {
  private readonly logger = new Logger(VoiceStatsCommand.name);

  constructor(private readonly apiClient: BotApiClientService) {}

  @Handler()
  async onVoiceStats(
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
      const result = await this.apiClient.analyzeVoiceActivity(interaction.guildId, dto.days);

      if (!result.data) {
        await interaction.editReply({
          content: `최근 ${result.days}일간 음성 채널 활동 기록이 없습니다.`,
        });
        return;
      }

      const { analysisText, totalStats } = result.data;

      const formatTime = (seconds: number) => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
      };

      const MAX_EMBED_DESCRIPTION = 4096;
      const statsHeader =
        `**참여자** ${totalStats.totalUsers}명 | ` +
        `**총 음성 시간** ${formatTime(totalStats.totalVoiceTime)} | ` +
        `**마이크 ON** ${formatTime(totalStats.totalMicOnTime)} | ` +
        `**일평균 활동 유저** ${totalStats.avgDailyActiveUsers}명\n\n`;

      const fullDescription = statsHeader + analysisText;
      const useInlineAnalysis = fullDescription.length <= MAX_EMBED_DESCRIPTION;

      const overflowSuffix = '\n\n*... 분석 결과가 길어 후속 메시지로 전송합니다.*';
      const embed = new EmbedBuilder()
        .setTitle(`\u{1F4CA} 음성 활동 AI 분석 (${result.days}일)`)
        .setColor(Colors.Blue)
        .setDescription(
          useInlineAnalysis
            ? fullDescription
            : statsHeader +
                truncate(analysisText, MAX_EMBED_DESCRIPTION - statsHeader.length - 100) +
                overflowSuffix,
        )
        .setTimestamp()
        .setFooter({ text: 'Powered by AI' });

      await interaction.editReply({ embeds: [embed] });

      if (!useInlineAnalysis) {
        const chunks = splitByLines(analysisText, 1900);
        for (const chunk of chunks) {
          await interaction.followUp({ content: chunk, ephemeral: false });
        }
      }
    } catch (error) {
      this.logger.error('Voice stats command error:', error);
      await interaction.editReply({ content: 'AI 분석 중 오류가 발생했습니다.' });
    }
  }
}
