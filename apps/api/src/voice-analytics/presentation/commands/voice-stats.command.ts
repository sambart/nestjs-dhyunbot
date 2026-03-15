import { splitByLines, truncate } from '@dhyunbot/shared';
import { SlashCommandPipe } from '@discord-nestjs/common';
import { Command, Handler, InteractionEvent } from '@discord-nestjs/core';
import { Injectable, Logger } from '@nestjs/common';
import { Colors, CommandInteraction, EmbedBuilder, PermissionFlagsBits } from 'discord.js';

import { BotI18nService } from '../../../common/application/bot-i18n.service';
import { LocaleResolverService } from '../../../common/application/locale-resolver.service';
import { VoiceAiAnalysisService } from '../../application/voice-ai-analysis.service';
import { VoiceAnalyticsService } from '../../application/voice-analytics.service';
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

  constructor(
    private readonly aiAnalysisService: VoiceAiAnalysisService,
    private readonly analyticsService: VoiceAnalyticsService,
    private readonly i18n: BotI18nService,
    private readonly localeResolver: LocaleResolverService,
  ) {}

  @Handler()
  async onVoiceStats(
    @InteractionEvent() interaction: CommandInteraction,
    @InteractionEvent(SlashCommandPipe) dto: AnalyticsDaysDto,
  ): Promise<void> {
    const locale = await this.localeResolver.resolve(
      interaction.user.id,
      interaction.guildId,
      interaction.locale,
    );

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({
        content: this.i18n.t(locale, 'errors.adminOnly'),
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();

    try {
      const guildId = interaction.guildId;
      if (!guildId) {
        await interaction.editReply(this.i18n.t(locale, 'errors.guildOnly'));
        return;
      }

      const days = dto.days;
      const { start, end } = VoiceAnalyticsService.getDateRange(days);
      const activityData = await this.analyticsService.collectVoiceActivityData(
        guildId,
        start,
        end,
      );

      if (activityData.userActivities.length === 0) {
        await interaction.editReply({
          content: this.i18n.t(locale, 'voice.statsNoActivity', { days }),
        });
        return;
      }

      const analysis = await this.aiAnalysisService.analyzeVoiceActivity(activityData);

      const formatTime = (seconds: number) => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
      };

      this.logger.debug('AI analysis result', analysis);

      const MAX_EMBED_DESCRIPTION = 4096;
      const statsHeader = this.i18n.t(locale, 'voice.statsHeader', {
        totalUsers: activityData.totalStats.totalUsers,
        totalVoiceTime: formatTime(activityData.totalStats.totalVoiceTime),
        totalMicOnTime: formatTime(activityData.totalStats.totalMicOnTime),
        avgDailyActiveUsers: activityData.totalStats.avgDailyActiveUsers,
      });

      const fullDescription = statsHeader + analysis.text;
      const useInlineAnalysis = fullDescription.length <= MAX_EMBED_DESCRIPTION;

      const overflowSuffix = this.i18n.t(locale, 'voice.statsAnalysisOverflow');
      const embed = new EmbedBuilder()
        .setTitle(this.i18n.t(locale, 'voice.statsTitle', { days }))
        .setColor(Colors.Blue)
        .setDescription(
          useInlineAnalysis
            ? fullDescription
            : statsHeader +
                truncate(analysis.text, MAX_EMBED_DESCRIPTION - statsHeader.length - 100) +
                overflowSuffix,
        )
        .setTimestamp()
        .setFooter({ text: this.i18n.t(locale, 'voice.statsFooter') });

      await interaction.editReply({ embeds: [embed] });

      if (!useInlineAnalysis) {
        const chunks = splitByLines(analysis.text, 1900);
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
        content: this.i18n.t(locale, 'voice.statsError'),
      });
    }
  }
}
