import { BotApiClientService } from '@dhyunbot/bot-api-client';
import { SlashCommandPipe } from '@discord-nestjs/common';
import { Command, Handler, InteractionEvent } from '@discord-nestjs/core';
import { Injectable, Logger } from '@nestjs/common';
import { Colors, CommandInteraction, EmbedBuilder, PermissionFlagsBits } from 'discord.js';

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

  constructor(private readonly apiClient: BotApiClientService) {}

  @Handler()
  async onMyVoiceStats(
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

    await interaction.deferReply({ ephemeral: true });

    try {
      const result = await this.apiClient.getMyVoiceStats(
        interaction.guildId,
        interaction.user.id,
        dto.days,
      );

      if (!result.data) {
        await interaction.editReply({
          content: `최근 ${result.days}일간 음성 채널 활동 기록이 없습니다.`,
        });
        return;
      }

      const data = result.data;

      const formatTime = (seconds: number) => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
      };

      const embed = new EmbedBuilder()
        .setTitle(`📊 ${interaction.user.displayName}님의 음성 통계`)
        .setColor(Colors.Green)
        .setThumbnail(interaction.user.displayAvatarURL())
        .addFields(
          {
            name: '📋 기본 정보',
            value: [
              `🏅 순위: ${data.userRank}위 / ${data.totalUsers}명`,
              `⏱️ 총 음성 시간: ${formatTime(data.totalVoiceTime)}`,
              `🎤 마이크 ON: ${formatTime(data.totalMicOnTime)}`,
              `🔇 마이크 OFF: ${formatTime(data.totalMicOffTime)}`,
              `👤 혼자 있던 시간: ${formatTime(data.aloneTime)}`,
            ].join('\n'),
            inline: false,
          },
          {
            name: '📈 활동 패턴',
            value: [
              `📆 활동일 수: ${data.activeDays}일`,
              `⏱️ 일평균: ${formatTime(data.avgDailyVoiceTime)}`,
              `🎤 마이크 사용률: ${data.micUsageRate}%`,
            ].join('\n'),
            inline: false,
          },
        )
        .setTimestamp();

      if (data.activeChannels.length > 0) {
        const topChannels = data.activeChannels
          .slice(0, 5)
          .map((c, idx) => `${idx + 1}. ${c.channelName}: ${formatTime(c.duration)}`)
          .join('\n');

        embed.addFields({
          name: '🔊 자주 사용한 채널 TOP 5',
          value: topChannels,
          inline: false,
        });
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      this.logger.error('My voice stats command error:', error);
      await interaction.editReply({ content: '통계 조회 중 오류가 발생했습니다.' });
    }
  }
}
