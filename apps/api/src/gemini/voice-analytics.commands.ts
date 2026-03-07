import { truncate } from '@dhyunbot/shared';
import { SlashCommandPipe } from '@discord-nestjs/common';
import { Command, Handler, InteractionEvent, Param, ParamType } from '@discord-nestjs/core';
import { Injectable, Logger } from '@nestjs/common';
import { Colors, CommandInteraction,EmbedBuilder } from 'discord.js';

import { VoiceAnalyticsService } from './voice-analytics.service';
import { VoiceGeminiService } from './voice-gemini.service';

class AnalyticsDaysDto {
  @Param({
    name: 'days',
    description: '분석할 기간 (일)',
    required: false,
    type: ParamType.INTEGER,
    minValue: 1,
    maxValue: 90,
  })
  days: number = 7;
}

@Command({
  name: 'voice-stats',
  description: '서버의 음성 채널 활동을 AI로 분석합니다',
})
@Injectable()
export class VoiceStatsCommand {
  private readonly logger = new Logger(VoiceStatsCommand.name);

  constructor(
    private readonly geminiService: VoiceGeminiService,
    private readonly analyticsService: VoiceAnalyticsService,
  ) {}

  @Handler()
  async onVoiceStats(
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

      // 날짜 범위 계산
      const { start, end } = VoiceAnalyticsService.getDateRange(days);

      // 데이터 수집
      const activityData = await this.analyticsService.collectVoiceActivityData(
        guildId,
        start,
        end,
      );

      if (activityData.userActivities.length === 0) {
        await interaction.editReply({
          content: `최근 ${days}일간 음성 채널 활동이 없습니다. 😢`,
        });
        return;
      }

      // AI 분석
      const analysis = await this.geminiService.analyzeVoiceActivity(activityData);

      // 시간 변환 헬퍼
      const formatTime = (seconds: number) => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        return hours > 0 ? `${hours}시간 ${minutes}분` : `${minutes}분`;
      };

      this.logger.debug('AI analysis result', analysis);

      const BASE_DESCRIPTION =
        `📊 **기본 통계**\n` +
        `👥 총 활성 유저: ${activityData.totalStats.totalUsers}명\n` +
        `🎙️ 총 음성 시간: ${formatTime(activityData.totalStats.totalVoiceTime)}\n` +
        `🔊 마이크 사용 시간: ${formatTime(activityData.totalStats.totalMicOnTime)}\n` +
        `📈 일평균 활성 유저: ${activityData.totalStats.avgDailyActiveUsers}명\n\n` +
        `${analysis.text}`;
      const MAX_EMBED_DESCRIPTION = 4096;
      // analysis.text를 포함했을 때 길이 계산
      const fullDescription = BASE_DESCRIPTION + analysis.text;

      // embed에 다 들어갈 수 있는 경우
      const useInlineAnalysis = fullDescription.length <= MAX_EMBED_DESCRIPTION;

      // Discord Embed 생성
      const embed = new EmbedBuilder()
        .setTitle(`🎤 음성 채널 활동 분석 (최근 ${days}일)`)
        .setColor(Colors.Blue)
        .setDescription(
          useInlineAnalysis
            ? fullDescription
            : BASE_DESCRIPTION +
                truncate(analysis.text, MAX_EMBED_DESCRIPTION - BASE_DESCRIPTION.length - 100) +
                '\n\n📄 **전체 분석은 아래 메시지를 확인하세요.**',
        )
        .setTimestamp()
        .setFooter({ text: '💡 Powered by Gemini AI' });

      await interaction.editReply({ embeds: [embed] });

      if (!useInlineAnalysis) {
        // 일반 메시지는 2000자 제한
        const chunks = analysis.text.match(/[\s\S]{1,1900}/g) ?? [];

        for (const chunk of chunks) {
          await interaction.followUp({
            content: chunk,
            ephemeral: false, // 필요하면 true
          });
        }
      }
    } catch (error) {
      this.logger.error('Voice stats command error:', error);
      await interaction.editReply({
        content: '분석 중 오류가 발생했습니다. 나중에 다시 시도해주세요.',
      });
    }
  }
}

@Command({
  name: 'my-voice-stats',
  description: '내 음성 채널 활동 통계를 확인합니다',
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
    await interaction.deferReply({ ephemeral: true });

    try {
      const guildId = interaction.guildId;
      const userId = interaction.user.id;

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

      const myActivity = activityData.userActivities.find((u) => u.userId === userId);

      if (!myActivity) {
        await interaction.editReply({
          content: `최근 ${days}일간 음성 채널 활동 기록이 없습니다.`,
        });
        return;
      }

      // 시간 변환
      const formatTime = (seconds: number) => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        return hours > 0 ? `${hours}시간 ${minutes}분` : `${minutes}분`;
      };

      // 순위 계산
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

      // 활동 채널 추가
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

      // AI로 건강도 분석
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

      // 메달 이모지
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
