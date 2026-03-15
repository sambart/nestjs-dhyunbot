import { SlashCommandPipe } from '@discord-nestjs/common';
import { Command, Handler, InteractionEvent } from '@discord-nestjs/core';
import { Injectable, Logger } from '@nestjs/common';
import { Colors, CommandInteraction, EmbedBuilder, PermissionFlagsBits } from 'discord.js';

import { BotI18nService } from '../../../common/application/bot-i18n.service';
import { LocaleResolverService } from '../../../common/application/locale-resolver.service';
import { VoiceAnalyticsService } from '../../application/voice-analytics.service';
import { AnalyticsDaysDto } from './analytics-days.dto';

@Command({
  name: 'voice-leaderboard',
  description: 'Show the voice channel activity leaderboard',
  nameLocalizations: { ko: '음성리더보드' },
  descriptionLocalizations: { ko: '음성 채널 활동 리더보드를 표시합니다' },
  defaultMemberPermissions: PermissionFlagsBits.Administrator,
})
@Injectable()
export class VoiceLeaderboardCommand {
  private readonly logger = new Logger(VoiceLeaderboardCommand.name);

  constructor(
    private readonly analyticsService: VoiceAnalyticsService,
    private readonly i18n: BotI18nService,
    private readonly localeResolver: LocaleResolverService,
  ) {}

  @Handler()
  async onVoiceLeaderboard(
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
        await interaction.editReply(this.i18n.t(locale, 'voice.leaderboardNoData'));
        return;
      }

      const formatTime = (seconds: number) => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
      };

      const medals = ['🥇', '🥈', '🥉'];

      const leaderboard = activityData.userActivities
        .slice(0, 10)
        .map((user, idx) => {
          const medal = idx < 3 ? medals[idx] : `**${idx + 1}.**`;
          return (
            `${medal} **${user.username}**\n` +
            `   ⏱️ ${formatTime(user.totalVoiceTime)} | 🎤 ${user.micUsageRate}%`
          );
        })
        .join('\n\n');

      const embed = new EmbedBuilder()
        .setTitle(this.i18n.t(locale, 'voice.leaderboardTitle', { days }))
        .setColor(Colors.Gold)
        .setDescription(leaderboard)
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      this.logger.error('Voice leaderboard command error:', error);
      await interaction.editReply({
        content: this.i18n.t(locale, 'voice.leaderboardError'),
      });
    }
  }
}
