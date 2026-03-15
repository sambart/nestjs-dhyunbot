import { SlashCommandPipe } from '@discord-nestjs/common';
import { Command, Handler, InteractionEvent } from '@discord-nestjs/core';
import { Injectable, Logger } from '@nestjs/common';
import { Colors, CommandInteraction, EmbedBuilder, PermissionFlagsBits } from 'discord.js';

import { VoiceAnalyticsService } from '../../application/voice-analytics.service';
import { AnalyticsDaysDto } from './analytics-days.dto';

@Command({
  name: 'my-voice-stats',
  description: '내 음성 채널 활동 통계를 확인합니다',
  defaultMemberPermissions: PermissionFlagsBits.Administrator,
})
@Injectable()
export class MyVoiceStatsCommand {
  private readonly logger = new Logger(MyVoiceStatsCommand.name);

  constructor(private readonly analyticsService: VoiceAnalyticsService) {}

  @Handler()
  async onMyVoiceStats(
    @InteractionEvent() interaction: CommandInteraction,
    @InteractionEvent(SlashCommandPipe) dto: AnalyticsDaysDto,
  ): Promise<void> {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({
        content: '관리자만 사용할 수 있는 명령어입니다.',
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const guildId = interaction.guildId;
      const userId = interaction.user.id;

      if (!guildId) {
        await interaction.editReply('서버에서만 사용 가능한 명령어입니다.');
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
          content: `최근 ${days}일간 음성 채널 활동 기록이 없습니다.`,
        });
        return;
      }

      const formatTime = (seconds: number) => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        return hours > 0 ? `${hours}시간 ${minutes}분` : `${minutes}분`;
      };

      const userRank = activityData.userActivities.findIndex((u) => u.userId === userId) + 1;

      const embed = new EmbedBuilder()
        .setTitle(`🎤 ${interaction.user.displayName}님의 음성 활동 통계`)
        .setColor(Colors.Green)
        .setThumbnail(interaction.user.displayAvatarURL())
        .addFields(
          {
            name: '📊 기본 통계',
            value: [
              `🏆 활동 순위: ${userRank}위 / ${activityData.totalStats.totalUsers}명`,
              `🎙️ 총 음성 시간: ${formatTime(myActivity.totalVoiceTime)}`,
              `🔊 마이크 켠 시간: ${formatTime(myActivity.totalMicOnTime)}`,
              `🔇 마이크 끈 시간: ${formatTime(myActivity.totalMicOffTime)}`,
              `👤 혼자 있던 시간: ${formatTime(myActivity.aloneTime)}`,
            ].join('\n'),
            inline: false,
          },
          {
            name: '📈 활동 패턴',
            value: [
              `📅 활동한 날: ${myActivity.activeDays}일`,
              `⏱️ 일평균 음성 시간: ${formatTime(myActivity.avgDailyVoiceTime)}`,
              `🎤 마이크 사용률: ${myActivity.micUsageRate}%`,
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
          name: '📺 자주 사용한 채널 TOP 5',
          value: topChannels,
          inline: false,
        });
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      this.logger.error('My voice stats command error:', error);
      await interaction.editReply({
        content: '통계 조회 중 오류가 발생했습니다.',
      });
    }
  }
}
