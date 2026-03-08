import { SlashCommandPipe } from '@discord-nestjs/common';
import { Command, Handler, InteractionEvent } from '@discord-nestjs/core';
import { Injectable, Logger } from '@nestjs/common';
import { Colors, CommandInteraction, EmbedBuilder } from 'discord.js';

import { VoiceDaysDto } from './voice-days.dto';
import { VoiceStatsQueryService } from './voice-stats-query.service';

const MEDALS = ['🥇', '🥈', '🥉'];
const TOP_COUNT = 10;

@Command({
  name: 'voice-rank',
  description: '음성 채널 이용 순위를 조회합니다',
})
@Injectable()
export class VoiceRankCommand {
  private readonly logger = new Logger(VoiceRankCommand.name);

  constructor(private readonly voiceStatsQueryService: VoiceStatsQueryService) {}

  @Handler()
  async onVoiceRank(
    @InteractionEvent() interaction: CommandInteraction,
    @InteractionEvent(SlashCommandPipe) dto: VoiceDaysDto,
  ): Promise<void> {
    if (!interaction.guildId) {
      await interaction.reply({ content: '서버에서만 사용 가능한 명령어입니다.', ephemeral: true });
      return;
    }

    await interaction.deferReply();

    try {
      const guildId = interaction.guildId;
      const days = dto.days || 7;

      const rankList = await this.voiceStatsQueryService.getGuildVoiceRank(guildId, days);

      if (rankList.length === 0) {
        await interaction.editReply({
          content: `최근 ${days}일간 음성 채널 활동 기록이 없습니다.`,
        });
        return;
      }

      const top10 = rankList.slice(0, TOP_COUNT);
      const myIndex = rankList.findIndex((u) => u.userId === interaction.user.id);
      const myRank = myIndex + 1;
      const myEntry = myIndex >= 0 ? rankList[myIndex] : null;

      const description = top10
        .map((user, idx) => {
          const medal = idx < MEDALS.length ? MEDALS[idx] : `**${idx + 1}.**`;
          return `${medal} **${user.userName}** — ⏱️ ${formatTime(user.totalSec)} | 🎙️ ON ${formatTime(user.micOnSec)} | 🔇 OFF ${formatTime(user.micOffSec)}`;
        })
        .join('\n');

      const embed = new EmbedBuilder()
        .setTitle(`🏆 음성 채널 순위 (최근 ${days}일)`)
        .setColor(Colors.Gold)
        .setDescription(description)
        .setTimestamp();

      const isInTop10 = myRank > 0 && myRank <= TOP_COUNT;

      if (!isInTop10) {
        const myValue =
          myEntry
            ? `${myRank}위 (총 ${rankList.length}명) — ⏱️ ${formatTime(myEntry.totalSec)} | 🎙️ ON ${formatTime(myEntry.micOnSec)} | 🔇 OFF ${formatTime(myEntry.micOffSec)}`
            : '기록 없음';

        embed.addFields({ name: '📍 내 순위', value: myValue, inline: false });
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      this.logger.error('Voice rank command error:', error);
      await interaction.editReply({
        content: '순위 조회 중 오류가 발생했습니다.',
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
