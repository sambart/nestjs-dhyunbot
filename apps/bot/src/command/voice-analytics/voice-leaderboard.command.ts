import { BotApiClientService } from '@onyu/bot-api-client';
import { SlashCommandPipe } from '@discord-nestjs/common';
import { Command, Handler, InteractionEvent } from '@discord-nestjs/core';
import { Injectable, Logger } from '@nestjs/common';
import { Colors, CommandInteraction, EmbedBuilder, PermissionFlagsBits } from 'discord.js';

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

  constructor(private readonly apiClient: BotApiClientService) {}

  @Handler()
  async onVoiceLeaderboard(
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
      const result = await this.apiClient.getVoiceLeaderboard(interaction.guildId, dto.days);

      if (!result.data || result.data.userActivities.length === 0) {
        await interaction.editReply('해당 기간에 음성 채널 활동 데이터가 없습니다.');
        return;
      }

      const formatTime = (seconds: number) => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
      };

      const medals = ['\u{1F947}', '\u{1F948}', '\u{1F949}'];

      const leaderboard = result.data.userActivities
        .map((user, idx) => {
          const medal = idx < 3 ? medals[idx] : `**${idx + 1}.**`;
          return (
            `${medal} **${user.username}**\n` +
            `   \u23F1\uFE0F ${formatTime(user.totalVoiceTime)} | \u{1F3A4} ${user.micUsageRate}%`
          );
        })
        .join('\n\n');

      const embed = new EmbedBuilder()
        .setTitle(`\u{1F3C6} 음성 활동 리더보드 (${result.days}일)`)
        .setColor(Colors.Gold)
        .setDescription(leaderboard)
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      this.logger.error('Voice leaderboard command error:', error);
      await interaction.editReply({ content: '리더보드 조회 중 오류가 발생했습니다.' });
    }
  }
}
