import { SlashCommandPipe } from '@discord-nestjs/common';
import { Command, Handler, InteractionEvent } from '@discord-nestjs/core';
import { Injectable, Logger } from '@nestjs/common';
import { Colors, CommandInteraction, EmbedBuilder } from 'discord.js';

import { VoiceAnalyticsService } from '../voice-analytics.service';
import { VoiceGeminiService } from '../voice-gemini.service';
import { AnalyticsDaysDto } from './analytics-days.dto';

@Command({
  name: 'community-health',
  description: '서버 커뮤니티의 건강도를 AI로 진단합니다',
})
@Injectable()
export class CommunityHealthCommand {
  private readonly logger = new Logger(CommunityHealthCommand.name);

  constructor(
    private readonly geminiService: VoiceGeminiService,
    private readonly analyticsService: VoiceAnalyticsService,
  ) {}

  @Handler()
  async onCommunityHealth(
    @InteractionEvent() interaction: CommandInteraction,
    @InteractionEvent(SlashCommandPipe) dto: AnalyticsDaysDto,
  ): Promise<void> {
    await interaction.deferReply();

    try {
      const guildId = interaction.guildId;
      if (!guildId) {
        await interaction.editReply('서버에서만 사용 가능한 명령어입니다.');
        return;
      }

      const days = dto.days || 30;
      const { start, end } = VoiceAnalyticsService.getDateRange(days);
      const activityData = await this.analyticsService.collectVoiceActivityData(
        guildId,
        start,
        end,
      );

      if (activityData.userActivities.length === 0) {
        await interaction.editReply({
          content: '활동 데이터가 부족하여 건강도를 측정할 수 없습니다.',
        });
        return;
      }

      const healthText = await this.geminiService.calculateCommunityHealth(activityData);

      const embed = new EmbedBuilder()
        .setTitle('🏥 커뮤니티 건강도 진단')
        .setColor(Colors.Blue)
        .setDescription(healthText)
        .addFields({
          name: '📅 분석 기간',
          value: `최근 ${days}일`,
          inline: false,
        })
        .setTimestamp()
        .setFooter({ text: 'AI 기반 분석 결과' });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      this.logger.error('Community health command error:', error);
      await interaction.editReply({
        content: '건강도 측정 중 오류가 발생했습니다.',
      });
    }
  }
}
