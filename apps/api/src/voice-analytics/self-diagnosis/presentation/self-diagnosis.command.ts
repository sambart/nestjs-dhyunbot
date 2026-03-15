import { Command, Handler, InteractionEvent } from '@discord-nestjs/core';
import { Injectable, Logger } from '@nestjs/common';
import { CommandInteraction, EmbedBuilder } from 'discord.js';

import { RedisService } from '../../../redis/redis.service';
import { LlmQuotaExhaustedException } from '../../infrastructure/llm/llm-provider.interface';
import { hhiToDiversityScore } from '../application/hhi-calculator';
import {
  DiagnosisCooldownException,
  SelfDiagnosisService,
} from '../application/self-diagnosis.service';
import type { SelfDiagnosisResult } from '../application/self-diagnosis.types';
import { VoiceHealthConfig } from '../domain/voice-health-config.entity';
import { VoiceHealthKeys } from '../infrastructure/voice-health-cache.keys';
import { VoiceHealthConfigRepository } from '../infrastructure/voice-health-config.repository';

const EMBED_COLOR = 0x5b8def;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;

@Command({
  name: 'self-diagnosis',
  nameLocalizations: { ko: '자가진단' },
  description: '내 음성 활동을 진단합니다',
})
@Injectable()
export class SelfDiagnosisCommand {
  private readonly logger = new Logger(SelfDiagnosisCommand.name);

  constructor(
    private readonly diagnosisService: SelfDiagnosisService,
    private readonly configRepo: VoiceHealthConfigRepository,
    private readonly redis: RedisService,
  ) {}

  @Handler()
  async onSelfDiagnosis(@InteractionEvent() interaction: CommandInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    try {
      const guildId = interaction.guildId;
      if (!guildId) {
        await interaction.editReply({ content: '서버에서만 사용 가능한 명령어입니다.' });
        return;
      }

      const config = await this.configRepo.findByGuildId(guildId);
      if (!config?.isEnabled) {
        await interaction.editReply({ content: '자가진단 기능이 활성화되지 않았습니다.' });
        return;
      }

      const userId = interaction.user.id;
      const cooldownKey = VoiceHealthKeys.cooldown(guildId, userId);
      const isOnCooldown = await this.redis.exists(cooldownKey);
      if (isOnCooldown) {
        const remaining = await this.redis.ttl(cooldownKey);
        const timeText = this.formatRemainingTime(remaining);
        await interaction.editReply({ content: `다음 진단은 ${timeText} 후에 가능합니다.` });
        return;
      }

      const result = await this.diagnosisService.diagnose(guildId, userId);

      if (result.totalMinutes === 0) {
        await interaction.editReply({
          content: `최근 ${config.analysisDays}일간 음성 활동 기록이 없습니다.`,
        });
        return;
      }

      const embed = this.buildEmbed(result, config);
      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      if (error instanceof DiagnosisCooldownException) {
        const timeText = this.formatRemainingTime(error.remainingSeconds);
        await interaction.editReply({ content: `다음 진단은 ${timeText} 후에 가능합니다.` });
        return;
      }
      if (error instanceof LlmQuotaExhaustedException) {
        const quotaEmbed = new EmbedBuilder()
          .setTitle('\uD83D\uDE22 AI 진단 엔진이 지쳐버렸어요...')
          .setColor(0xffa500)
          .setDescription(
            [
              '이번 달 AI 분석 사용량이 모두 소진되었습니다.',
              '',
              '이 봇은 제작자가 개인 비용으로 운영하고 있어요.',

              '\uD83D\uDCA1 AI 없이도 기본 진단은 가능합니다 — 관리자가 AI 요약을 잠시 꺼주시면 데이터 기반 진단을 이용할 수 있어요.',
            ].join('\n'),
          );
        await interaction.editReply({ embeds: [quotaEmbed] });
        return;
      }
      this.logger.error('Self-diagnosis command error:', error);
      await interaction.editReply({ content: '자가진단 중 오류가 발생했습니다.' });
    }
  }

  private buildEmbed(result: SelfDiagnosisResult, config: VoiceHealthConfig): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setTitle('\uD83E\uDE7A 음성 활동 자가진단')
      .setColor(EMBED_COLOR);

    const sections: string[] = [];

    if (result.llmSummary) {
      // AI 요약이 있으면 LLM 결과만 표시
      sections.push(`\uD83D\uDCAC **AI 종합 진단**\n${result.llmSummary}`);
      sections.push(this.buildBadgeSection(result));
    } else {
      // AI 요약이 없으면 상세 데이터 표시
      sections.push(this.buildActivitySection(result));
      sections.push(this.buildRelationshipSection(result));
      sections.push(this.buildMocoSection(result));
      sections.push(this.buildPatternSection(result));
      sections.push(this.buildBadgeSection(result));
    }

    embed.setDescription(sections.join('\n\n'));

    const nextAvailable = config.isCooldownEnabled
      ? this.formatNextAvailableTime(config.cooldownHours)
      : '제한 없음';
    embed.setFooter({
      text: `\uD83D\uDCC5 분석 기간: 최근 ${config.analysisDays}일 · 다음 진단 가능: ${nextAvailable}`,
    });

    return embed;
  }

  private buildActivitySection(result: SelfDiagnosisResult): string {
    const activityVerdict = result.verdicts.find((v) => v.category === '활동량');
    const daysVerdict = result.verdicts.find((v) => v.category === '활동 일수');

    const lines = [
      `\uD83D\uDCCA **활동량**`,
      `총 ${this.formatMinutes(result.totalMinutes)} | 활동일 ${result.activeDays}/${result.totalDays}일 (${this.formatPercent(result.activeDaysRatio)})`,
      `일평균 ${this.formatMinutes(result.avgDailyMinutes)} | 서버 ${result.activityRank}위 / ${result.activityTotalUsers}명 (상위 ${result.activityTopPercent.toFixed(1)}%)`,
    ];

    if (activityVerdict) {
      lines.push(
        `${this.verdictEmoji(activityVerdict.isPassed)} 활동량: ${activityVerdict.actual} (기준: ${activityVerdict.criterion})`,
      );
    }
    if (daysVerdict) {
      lines.push(
        `${this.verdictEmoji(daysVerdict.isPassed)} 활동 일수: ${daysVerdict.actual} (기준: ${daysVerdict.criterion})`,
      );
    }

    return lines.join('\n');
  }

  private buildRelationshipSection(result: SelfDiagnosisResult): string {
    const hhiVerdict = result.verdicts.find((v) => v.category === '관계 다양성');
    const peerVerdict = result.verdicts.find((v) => v.category === '교류 인원');

    const lines = [
      `\uD83D\uDC65 **관계 다양성**`,
      `교류 인원: ${result.peerCount}명 | 관계 다양성: ${hhiToDiversityScore(result.hhiScore)}점 / 100`,
    ];

    if (result.topPeers.length > 0) {
      const peerList = result.topPeers
        .map(
          (p) => `${p.userName} (${this.formatMinutes(p.minutes)}, ${this.formatPercent(p.ratio)})`,
        )
        .join(', ');
      lines.push(`주요 교류: ${peerList}`);
    }

    if (hhiVerdict) {
      lines.push(
        `${this.verdictEmoji(hhiVerdict.isPassed)} 관계 다양성: ${hhiVerdict.actual} (기준: ${hhiVerdict.criterion})`,
      );
    }
    if (peerVerdict) {
      lines.push(
        `${this.verdictEmoji(peerVerdict.isPassed)} 교류 인원: ${peerVerdict.actual} (기준: ${peerVerdict.criterion})`,
      );
    }

    return lines.join('\n');
  }

  private buildMocoSection(result: SelfDiagnosisResult): string {
    if (result.mocoTotalUsers === 0) {
      return `\uD83C\uDF31 **모코코 기여**\n서버에 모코코 사냥 기록이 없습니다`;
    }

    if (!result.hasMocoActivity) {
      return [
        `\uD83C\uDF31 **모코코 기여**`,
        `아직 모코코 사냥 기록이 없습니다`,
        `신입 멤버와 함께 음성 채널에 참여하면 점수를 얻을 수 있어요!`,
        `현재 ${result.mocoTotalUsers}명이 모코코 사냥에 참여 중`,
      ].join('\n');
    }

    const lines = [
      `\uD83C\uDF31 **모코코 기여**`,
      `점수: ${result.mocoScore}점 | ${result.mocoRank}위 / ${result.mocoTotalUsers}명 (상위 ${result.mocoTopPercent.toFixed(1)}%)`,
      `도움준 신입 (연인원): ${result.mocoHelpedNewbies}명`,
    ];

    return lines.join('\n');
  }

  private buildPatternSection(result: SelfDiagnosisResult): string {
    const lines = [
      `\uD83C\uDFB5 **참여 패턴**`,
      `마이크 사용률: ${this.formatPercent(result.micUsageRate)} | 혼자 보낸 시간: ${this.formatPercent(result.aloneRatio)}`,
    ];

    return lines.join('\n');
  }

  private buildBadgeSection(result: SelfDiagnosisResult): string {
    const earned = result.badgeGuides.filter((b) => b.isEarned);
    const unearned = result.badgeGuides.filter((b) => !b.isEarned);

    const lines: string[] = [];

    // 보유 뱃지
    if (earned.length > 0) {
      const badgeText = earned.map((b) => `${b.icon} ${b.name}`).join('  ');
      lines.push(`\uD83C\uDFC5 **보유 뱃지**\n${badgeText}`);
    } else {
      lines.push(`\uD83C\uDFC5 **보유 뱃지**\n없음`);
    }

    // 미달성 뱃지 가이드
    if (unearned.length > 0) {
      const guideLines = unearned.map((b) => `${b.icon} ${b.name} — ${b.criterion} (${b.current})`);
      lines.push(`\uD83D\uDCCB **뱃지 달성 가이드**\n${guideLines.join('\n')}`);
    }

    return lines.join('\n\n');
  }

  /** 분(minutes)을 "N시간 M분" 또는 "M분" 형식으로 포매팅 */
  private formatMinutes(minutes: number): string {
    const totalMin = Math.floor(minutes);
    const hours = Math.floor(totalMin / MINUTES_PER_HOUR);
    const mins = totalMin % MINUTES_PER_HOUR;

    if (hours > 0) {
      return mins > 0 ? `${hours}시간 ${mins}분` : `${hours}시간`;
    }
    return `${mins}분`;
  }

  /** 비율(0~1)을 "N.N%" 형식으로 포매팅 */
  private formatPercent(ratio: number): string {
    return `${(ratio * 100).toFixed(1)}%`;
  }

  /** 다음 진단 가능 시간 포매팅 */
  private formatNextAvailableTime(cooldownHours: number): string {
    if (cooldownHours < HOURS_PER_DAY) {
      return `${cooldownHours}시간 후`;
    }
    const days = Math.floor(cooldownHours / HOURS_PER_DAY);
    const hours = cooldownHours % HOURS_PER_DAY;
    if (days > 0 && hours > 0) {
      return `${days}일 ${hours}시간 후`;
    }
    if (days > 0) {
      return `${days}일 후`;
    }
    return `${hours}시간 후`;
  }

  /** 남은 초를 "N시간 M분" 또는 "M분" 형식으로 포매팅 */
  private formatRemainingTime(seconds: number): string {
    const totalMin = Math.ceil(seconds / SECONDS_PER_MINUTE);
    const hours = Math.floor(totalMin / MINUTES_PER_HOUR);
    const mins = totalMin % MINUTES_PER_HOUR;

    if (hours > 0) {
      return mins > 0 ? `${hours}시간 ${mins}분` : `${hours}시간`;
    }
    return `${mins}분`;
  }

  /** 판정 결과 이모지 */
  private verdictEmoji(isPassed: boolean): string {
    return isPassed ? '\u2705' : '\u26A0\uFE0F';
  }
}
