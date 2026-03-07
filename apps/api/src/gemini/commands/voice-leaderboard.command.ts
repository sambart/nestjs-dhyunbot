import { SlashCommandPipe } from '@discord-nestjs/common';
import { Command, Handler, InteractionEvent } from '@discord-nestjs/core';
import { Injectable, Logger } from '@nestjs/common';
import { Colors, CommandInteraction, EmbedBuilder } from 'discord.js';

import { VoiceAnalyticsService } from '../voice-analytics.service';
import { AnalyticsDaysDto } from './analytics-days.dto';

@Command({
  name: 'voice-leaderboard',
  description: '음성 채널 활동 리더보드를 표시합니다',
})
@Injectable()
export class VoiceLeaderboardCommand {
  private readonly logger = new Logger(VoiceLeaderboardCommand.name);

  constructor(private readonly analyticsService: VoiceAnalyticsService) {}

  @Handler()
  async onVoiceLeaderboard(
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

      const days = dto.days || 7;
      const { start, end } = VoiceAnalyticsService.getDateRange(days);
      const activityData = await this.analyticsService.collectVoiceActivityData(
        guildId,
        start,
        end,
      );

      if (activityData.userActivities.length === 0) {
        await interaction.editReply('활동 데이터가 없습니다.');
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
        .setTitle(`🏆 음성 채널 리더보드 (최근 ${days}일)`)
        .setColor(Colors.Gold)
        .setDescription(leaderboard)
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      this.logger.error('Voice leaderboard command error:', error);
      await interaction.editReply({
        content: '리더보드 조회 중 오류가 발생했습니다.',
      });
    }
  }
}
