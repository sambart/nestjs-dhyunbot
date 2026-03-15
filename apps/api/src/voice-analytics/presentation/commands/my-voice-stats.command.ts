import { SlashCommandPipe } from '@discord-nestjs/common';
import { Command, Handler, InteractionEvent } from '@discord-nestjs/core';
import { Injectable, Logger } from '@nestjs/common';
import { Colors, CommandInteraction, EmbedBuilder, PermissionFlagsBits } from 'discord.js';

import { BotI18nService } from '../../../common/application/bot-i18n.service';
import { LocaleResolverService } from '../../../common/application/locale-resolver.service';
import { VoiceAnalyticsService } from '../../application/voice-analytics.service';
import { AnalyticsDaysDto } from './analytics-days.dto';

@Command({
  name: 'my-voice-stats',
  description: 'Check your voice channel activity stats',
  nameLocalizations: { ko: '내음성통계' },
  descriptionLocalizations: { ko: '내 음성 채널 활동 통계를 확인합니다' },
  defaultMemberPermissions: PermissionFlagsBits.Administrator,
})
@Injectable()
export class MyVoiceStatsCommand {
  private readonly logger = new Logger(MyVoiceStatsCommand.name);

  constructor(
    private readonly analyticsService: VoiceAnalyticsService,
    private readonly i18n: BotI18nService,
    private readonly localeResolver: LocaleResolverService,
  ) {}

  @Handler()
  async onMyVoiceStats(
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

    await interaction.deferReply({ ephemeral: true });

    try {
      const guildId = interaction.guildId;
      const userId = interaction.user.id;

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

      const myActivity = activityData.userActivities.find((u) => u.userId === userId);

      if (!myActivity) {
        await interaction.editReply({
          content: this.i18n.t(locale, 'voice.myStatsNoActivity', { days }),
        });
        return;
      }

      const formatTime = (seconds: number) => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
      };

      const userRank = activityData.userActivities.findIndex((u) => u.userId === userId) + 1;

      const embed = new EmbedBuilder()
        .setTitle(
          this.i18n.t(locale, 'voice.myStatsTitle', {
            displayName: interaction.user.displayName,
          }),
        )
        .setColor(Colors.Green)
        .setThumbnail(interaction.user.displayAvatarURL())
        .addFields(
          {
            name: this.i18n.t(locale, 'voice.myStatsFieldBasic'),
            value: [
              this.i18n.t(locale, 'voice.myStatsRank', {
                rank: userRank,
                total: activityData.totalStats.totalUsers,
              }),
              this.i18n.t(locale, 'voice.myStatsTotalVoiceTime', {
                time: formatTime(myActivity.totalVoiceTime),
              }),
              this.i18n.t(locale, 'voice.myStatsMicOnTime', {
                time: formatTime(myActivity.totalMicOnTime),
              }),
              this.i18n.t(locale, 'voice.myStatsMicOffTime', {
                time: formatTime(myActivity.totalMicOffTime),
              }),
              this.i18n.t(locale, 'voice.myStatsAloneTime', {
                time: formatTime(myActivity.aloneTime),
              }),
            ].join('\n'),
            inline: false,
          },
          {
            name: this.i18n.t(locale, 'voice.myStatsFieldPattern'),
            value: [
              this.i18n.t(locale, 'voice.myStatsActiveDays', { days: myActivity.activeDays }),
              this.i18n.t(locale, 'voice.myStatsAvgDaily', {
                time: formatTime(myActivity.avgDailyVoiceTime),
              }),
              this.i18n.t(locale, 'voice.myStatsMicUsage', { rate: myActivity.micUsageRate }),
            ].join('\n'),
            inline: false,
          },
        )
        .setTimestamp();

      if (myActivity.activeChannels.length > 0) {
        const topChannels = myActivity.activeChannels
          .slice(0, 5)
          .map((c, idx) => `${idx + 1}. ${c.channelName}: ${formatTime(c.duration)}`)
          .join('\n');

        embed.addFields({
          name: this.i18n.t(locale, 'voice.myStatsFieldTopChannels'),
          value: topChannels,
          inline: false,
        });
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      this.logger.error('My voice stats command error:', error);
      await interaction.editReply({
        content: this.i18n.t(locale, 'voice.myStatsError'),
      });
    }
  }
}
