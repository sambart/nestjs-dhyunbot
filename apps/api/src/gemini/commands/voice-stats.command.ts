import { truncate } from '@dhyunbot/shared';
import { SlashCommandPipe } from '@discord-nestjs/common';
import { Command, Handler, InteractionEvent } from '@discord-nestjs/core';
import { Injectable, Logger } from '@nestjs/common';
import { Colors, CommandInteraction, EmbedBuilder, PermissionFlagsBits } from 'discord.js';

import { VoiceAnalyticsService } from '../voice-analytics.service';
import { VoiceGeminiService } from '../voice-gemini.service';
import { AnalyticsDaysDto } from './analytics-days.dto';

@Command({
  name: 'voice-stats',
  description: '서버의 음성 채널 활동을 AI로 분석합니다',
  defaultMemberPermissions: PermissionFlagsBits.Administrator,
})
@Injectable()
export class VoiceStatsCommand {
  private readonly logger = new Logger(VoiceStatsCommand.name);

  constructor(
    private readonly geminiService: VoiceGeminiService,
    private readonly analyticsService: VoiceAnalyticsService,
  ) {}

  @Handler()
  async onVoiceStats(
    @InteractionEvent() interaction: CommandInteraction,
    @InteractionEvent(SlashCommandPipe) dto: AnalyticsDaysDto,
  ): Promise<void> {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({ content: '관리자만 사용할 수 있는 명령어입니다.', ephemeral: true });
      return;
    }

    await interaction.deferReply();

    try {
      const guildId = interaction.guildId;
      if (!guildId) {
        await interaction.editReply('서버에서만 사용 가능한 명령어입니다.');
        return;
      }

      const days = dto.days || 7;
      const { start, end } = VoiceAnalyticsService.getDateRange(days);
      const activityData = await this.analyticsService.collectVoiceActivityData(
        guildId,
        start,
        end,
      );

      if (activityData.userActivities.length === 0) {
        await interaction.editReply({
          content: `최근 ${days}일간 음성 채널 활동이 없습니다. 😢`,
        });
        return;
      }

      const analysis = await this.geminiService.analyzeVoiceActivity(activityData);

      const formatTime = (seconds: number) => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        return hours > 0 ? `${hours}시간 ${minutes}분` : `${minutes}분`;
      };

      this.logger.debug('AI analysis result', analysis);

      const BASE_DESCRIPTION =
        `📊 **기본 통계**\n` +
        `👥 총 활성 유저: ${activityData.totalStats.totalUsers}명\n` +
        `🎙️ 총 음성 시간: ${formatTime(activityData.totalStats.totalVoiceTime)}\n` +
        `🔊 마이크 사용 시간: ${formatTime(activityData.totalStats.totalMicOnTime)}\n` +
        `📈 일평균 활성 유저: ${activityData.totalStats.avgDailyActiveUsers}명\n\n` +
        `${analysis.text}`;
      const MAX_EMBED_DESCRIPTION = 4096;
      const fullDescription = BASE_DESCRIPTION + analysis.text;
      const useInlineAnalysis = fullDescription.length <= MAX_EMBED_DESCRIPTION;

      const embed = new EmbedBuilder()
        .setTitle(`🎤 음성 채널 활동 분석 (최근 ${days}일)`)
        .setColor(Colors.Blue)
        .setDescription(
          useInlineAnalysis
            ? fullDescription
            : BASE_DESCRIPTION +
                truncate(analysis.text, MAX_EMBED_DESCRIPTION - BASE_DESCRIPTION.length - 100) +
                '\n\n📄 **전체 분석은 아래 메시지를 확인하세요.**',
        )
        .setTimestamp()
        .setFooter({ text: '💡 Powered by Gemini AI' });

      await interaction.editReply({ embeds: [embed] });

      if (!useInlineAnalysis) {
        const chunks = analysis.text.match(/[\s\S]{1,1900}/g) ?? [];
        for (const chunk of chunks) {
          await interaction.followUp({
            content: chunk,
            ephemeral: false,
          });
        }
      }
    } catch (error) {
      this.logger.error('Voice stats command error:', error);
      await interaction.editReply({
        content: '분석 중 오류가 발생했습니다. 나중에 다시 시도해주세요.',
      });
    }
  }
}
