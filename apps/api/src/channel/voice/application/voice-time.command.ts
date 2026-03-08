import { SlashCommandPipe } from '@discord-nestjs/common';
import { Command, Handler, InteractionEvent } from '@discord-nestjs/core';
import { Injectable, Logger } from '@nestjs/common';
import { Colors, CommandInteraction, EmbedBuilder } from 'discord.js';

import { VoiceDaysDto } from './voice-days.dto';
import { VoiceStatsQueryService } from './voice-stats-query.service';

@Command({
  name: 'voice-time',
  description: '내 음성 채널 참여 시간을 조회합니다',
})
@Injectable()
export class VoiceTimeCommand {
  private readonly logger = new Logger(VoiceTimeCommand.name);

  constructor(private readonly voiceStatsQueryService: VoiceStatsQueryService) {}

  @Handler()
  async onVoiceTime(
    @InteractionEvent() interaction: CommandInteraction,
    @InteractionEvent(SlashCommandPipe) dto: VoiceDaysDto,
  ): Promise<void> {
    if (!interaction.guildId) {
      await interaction.reply({ content: '서버에서만 사용 가능한 명령어입니다.', ephemeral: true });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const guildId = interaction.guildId;
      const userId = interaction.user.id;
      const days = dto.days || 7;

      const stats = await this.voiceStatsQueryService.getUserVoiceStats(guildId, userId, days);

      if (stats.totalSec === 0 && stats.micOnSec === 0 && stats.micOffSec === 0) {
        await interaction.editReply({
          content: `최근 ${days}일간 음성 채널 활동 기록이 없습니다.`,
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle(`🎤 ${interaction.user.displayName}님의 음성 시간 (최근 ${days}일)`)
        .setColor(Colors.Green)
        .addFields(
          { name: '⏱️ 총 음성 시간', value: formatTime(stats.totalSec), inline: true },
          { name: '🎙️ 마이크 ON', value: formatTime(stats.micOnSec), inline: true },
          { name: '🔇 마이크 OFF', value: formatTime(stats.micOffSec), inline: true },
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      this.logger.error('Voice time command error:', error);
      await interaction.editReply({
        content: '음성 시간 조회 중 오류가 발생했습니다.',
      });
    }
  }
}

function formatTime(sec: number): string {
  if (sec === 0) return '0분';
  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  if (hours > 0) return `${hours}시간 ${minutes}분`;
  return `${minutes}분`;
}
