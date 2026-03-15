import { Command, Handler, InteractionEvent } from '@discord-nestjs/core';
import { Injectable, Logger } from '@nestjs/common';
import { CommandInteraction, EmbedBuilder } from 'discord.js';

import { BotI18nService } from '../../../common/application/bot-i18n.service';
import { LocaleResolverService } from '../../../common/application/locale-resolver.service';
import { RedisService } from '../../../redis/redis.service';
import { LlmQuotaExhaustedException } from '../../infrastructure/llm/llm-provider.interface';
import { hhiToDiversityScore } from '../application/hhi-calculator';
import {
  DiagnosisCooldownException,
  SelfDiagnosisService,
} from '../application/self-diagnosis.service';
import type { SelfDiagnosisResult } from '../application/self-diagnosis.types';
import { VoiceHealthKeys } from '../infrastructure/voice-health-cache.keys';
import { VoiceHealthConfigOrmEntity as VoiceHealthConfig } from '../infrastructure/voice-health-config.orm-entity';
import { VoiceHealthConfigRepository } from '../infrastructure/voice-health-config.repository';

const EMBED_COLOR = 0x5b8def;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;

@Command({
  name: 'self-diagnosis',
  nameLocalizations: { ko: '자가진단' },
  description: 'Diagnose your own voice activity',
  descriptionLocalizations: { ko: '내 음성 활동을 진단합니다' },
})
@Injectable()
export class SelfDiagnosisCommand {
  private readonly logger = new Logger(SelfDiagnosisCommand.name);

  constructor(
    private readonly diagnosisService: SelfDiagnosisService,
    private readonly configRepo: VoiceHealthConfigRepository,
    private readonly redis: RedisService,
    private readonly i18n: BotI18nService,
    private readonly localeResolver: LocaleResolverService,
  ) {}

  @Handler()
  async onSelfDiagnosis(@InteractionEvent() interaction: CommandInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    const locale = await this.localeResolver.resolve(
      interaction.user.id,
      interaction.guildId,
      interaction.locale,
    );

    try {
      const guildId = interaction.guildId;
      if (!guildId) {
        await interaction.editReply({ content: this.i18n.t(locale, 'errors.guildOnly') });
        return;
      }

      const config = await this.configRepo.findByGuildId(guildId);
      if (!config?.isEnabled) {
        await interaction.editReply({
          content: this.i18n.t(locale, 'voice.selfDiagnosisNotEnabled'),
        });
        return;
      }

      const userId = interaction.user.id;
      const cooldownKey = VoiceHealthKeys.cooldown(guildId, userId);
      const isOnCooldown = await this.redis.exists(cooldownKey);
      if (isOnCooldown) {
        const remaining = await this.redis.ttl(cooldownKey);
        const timeText = this.formatRemainingTime(remaining);
        await interaction.editReply({
          content: this.i18n.t(locale, 'voice.selfDiagnosisCooldown', { time: timeText }),
        });
        return;
      }

      const result = await this.diagnosisService.diagnose(guildId, userId);

      if (result.totalMinutes === 0) {
        await interaction.editReply({
          content: this.i18n.t(locale, 'voice.selfDiagnosisNoActivity', {
            days: config.analysisDays,
          }),
        });
        return;
      }

      const embed = this.buildEmbed(result, config, locale);
      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      if (error instanceof DiagnosisCooldownException) {
        const timeText = this.formatRemainingTime(error.remainingSeconds);
        await interaction.editReply({
          content: this.i18n.t(locale, 'voice.selfDiagnosisCooldown', { time: timeText }),
        });
        return;
      }
      if (error instanceof LlmQuotaExhaustedException) {
        const quotaEmbed = new EmbedBuilder()
          .setTitle(this.i18n.t(locale, 'voice.selfDiagnosisQuotaTitle'))
          .setColor(0xffa500)
          .setDescription(this.i18n.t(locale, 'voice.selfDiagnosisQuotaDesc'));
        await interaction.editReply({ embeds: [quotaEmbed] });
        return;
      }
      this.logger.error('Self-diagnosis command error:', error);
      await interaction.editReply({
        content: this.i18n.t(locale, 'voice.selfDiagnosisError'),
      });
    }
  }

  private buildEmbed(
    result: SelfDiagnosisResult,
    config: VoiceHealthConfig,
    locale: string,
  ): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setTitle(this.i18n.t(locale, 'voice.selfDiagnosisTitle'))
      .setColor(EMBED_COLOR);

    const sections: string[] = [];

    if (result.llmSummary) {
      // AI 요약이 있으면 LLM 결과만 표시
      sections.push(
        `${this.i18n.t(locale, 'voice.selfDiagnosisAiSummaryLabel')}\n${result.llmSummary}`,
      );
      sections.push(this.buildBadgeSection(result, locale));
    } else {
      // AI 요약이 없으면 상세 데이터 표시
      sections.push(this.buildActivitySection(result, locale));
      sections.push(this.buildRelationshipSection(result, locale));
      sections.push(this.buildMocoSection(result, locale));
      sections.push(this.buildPatternSection(result, locale));
      sections.push(this.buildBadgeSection(result, locale));
    }

    embed.setDescription(sections.join('\n\n'));

    const nextAvailable = config.isCooldownEnabled
      ? this.formatNextAvailableTime(config.cooldownHours)
      : this.i18n.t(locale, 'voice.selfDiagnosisCooldownNone');
    embed.setFooter({
      text: this.i18n.t(locale, 'voice.selfDiagnosisFooter', {
        days: config.analysisDays,
        nextAvailable,
      }),
    });

    return embed;
  }

  private buildActivitySection(result: SelfDiagnosisResult, locale: string): string {
    const activityVerdict = result.verdicts.find(
      (v) => v.category === this.i18n.t('ko', 'voice.selfDiagnosisVerdictActivity'),
    );
    const daysVerdict = result.verdicts.find(
      (v) => v.category === this.i18n.t('ko', 'voice.selfDiagnosisVerdictDays'),
    );

    const lines = [
      this.i18n.t(locale, 'voice.selfDiagnosisActivityHeader'),
      this.i18n.t(locale, 'voice.selfDiagnosisActivityLine', {
        totalTime: this.formatMinutes(result.totalMinutes),
        activeDays: result.activeDays,
        totalDays: result.totalDays,
        activeDaysRatio: this.formatPercent(result.activeDaysRatio),
      }),
      this.i18n.t(locale, 'voice.selfDiagnosisActivityLine2', {
        avgDaily: this.formatMinutes(result.avgDailyMinutes),
        rank: result.activityRank,
        total: result.activityTotalUsers,
        topPercent: result.activityTopPercent.toFixed(1),
      }),
    ];

    if (activityVerdict) {
      lines.push(
        `${this.verdictEmoji(activityVerdict.isPassed)} ${this.i18n.t(locale, 'voice.selfDiagnosisVerdictFormat', { label: this.i18n.t(locale, 'voice.selfDiagnosisVerdictActivity'), actual: activityVerdict.actual, criterion: activityVerdict.criterion })}`,
      );
    }
    if (daysVerdict) {
      lines.push(
        `${this.verdictEmoji(daysVerdict.isPassed)} ${this.i18n.t(locale, 'voice.selfDiagnosisVerdictFormat', { label: this.i18n.t(locale, 'voice.selfDiagnosisVerdictDays'), actual: daysVerdict.actual, criterion: daysVerdict.criterion })}`,
      );
    }

    return lines.join('\n');
  }

  private buildRelationshipSection(result: SelfDiagnosisResult, locale: string): string {
    const hhiVerdict = result.verdicts.find(
      (v) => v.category === this.i18n.t('ko', 'voice.selfDiagnosisVerdictRelation'),
    );
    const peerVerdict = result.verdicts.find(
      (v) => v.category === this.i18n.t('ko', 'voice.selfDiagnosisVerdictPeer'),
    );

    const lines = [
      this.i18n.t(locale, 'voice.selfDiagnosisRelationHeader'),
      this.i18n.t(locale, 'voice.selfDiagnosisRelationLine', {
        peerCount: result.peerCount,
        diversityScore: hhiToDiversityScore(result.hhiScore),
      }),
    ];

    if (result.topPeers.length > 0) {
      const peerList = result.topPeers
        .map(
          (p) => `${p.userName} (${this.formatMinutes(p.minutes)}, ${this.formatPercent(p.ratio)})`,
        )
        .join(', ');
      lines.push(this.i18n.t(locale, 'voice.selfDiagnosisRelationPeers', { peers: peerList }));
    }

    if (hhiVerdict) {
      lines.push(
        `${this.verdictEmoji(hhiVerdict.isPassed)} ${this.i18n.t(locale, 'voice.selfDiagnosisVerdictFormat', { label: this.i18n.t(locale, 'voice.selfDiagnosisVerdictRelation'), actual: hhiVerdict.actual, criterion: hhiVerdict.criterion })}`,
      );
    }
    if (peerVerdict) {
      lines.push(
        `${this.verdictEmoji(peerVerdict.isPassed)} ${this.i18n.t(locale, 'voice.selfDiagnosisVerdictFormat', { label: this.i18n.t(locale, 'voice.selfDiagnosisVerdictPeer'), actual: peerVerdict.actual, criterion: peerVerdict.criterion })}`,
      );
    }

    return lines.join('\n');
  }

  private buildMocoSection(result: SelfDiagnosisResult, locale: string): string {
    if (result.mocoTotalUsers === 0) {
      return `${this.i18n.t(locale, 'voice.selfDiagnosisMocoHeader')}\n${this.i18n.t(locale, 'voice.selfDiagnosisMocoNoServer')}`;
    }

    if (!result.hasMocoActivity) {
      return [
        this.i18n.t(locale, 'voice.selfDiagnosisMocoHeader'),
        this.i18n.t(locale, 'voice.selfDiagnosisMocoNoActivity'),
        this.i18n.t(locale, 'voice.selfDiagnosisMocoNoActivityHint'),
        this.i18n.t(locale, 'voice.selfDiagnosisMocoParticipants', {
          count: result.mocoTotalUsers,
        }),
      ].join('\n');
    }

    const lines = [
      this.i18n.t(locale, 'voice.selfDiagnosisMocoHeader'),
      this.i18n.t(locale, 'voice.selfDiagnosisMocoScore', {
        score: result.mocoScore,
        rank: result.mocoRank,
        total: result.mocoTotalUsers,
        topPercent: result.mocoTopPercent.toFixed(1),
      }),
      this.i18n.t(locale, 'voice.selfDiagnosisMocoHelped', { count: result.mocoHelpedNewbies }),
    ];

    return lines.join('\n');
  }

  private buildPatternSection(result: SelfDiagnosisResult, locale: string): string {
    const lines = [
      this.i18n.t(locale, 'voice.selfDiagnosisPatternHeader'),
      this.i18n.t(locale, 'voice.selfDiagnosisPatternLine', {
        micUsage: this.formatPercent(result.micUsageRate),
        aloneRatio: this.formatPercent(result.aloneRatio),
      }),
    ];

    return lines.join('\n');
  }

  private buildBadgeSection(result: SelfDiagnosisResult, locale: string): string {
    const earned = result.badgeGuides.filter((b) => b.isEarned);
    const unearned = result.badgeGuides.filter((b) => !b.isEarned);

    const lines: string[] = [];

    if (earned.length > 0) {
      const badgeText = earned.map((b) => `${b.icon} ${b.name}`).join('  ');
      lines.push(`${this.i18n.t(locale, 'voice.selfDiagnosisBadgeEarned')}\n${badgeText}`);
    } else {
      lines.push(
        `${this.i18n.t(locale, 'voice.selfDiagnosisBadgeEarned')}\n${this.i18n.t(locale, 'voice.selfDiagnosisBadgeNone')}`,
      );
    }

    if (unearned.length > 0) {
      const guideLines = unearned.map((b) => `${b.icon} ${b.name} — ${b.criterion} (${b.current})`);
      lines.push(
        `${this.i18n.t(locale, 'voice.selfDiagnosisBadgeGuide')}\n${guideLines.join('\n')}`,
      );
    }

    return lines.join('\n\n');
  }

  /** 분(minutes)을 "N시간 M분" 또는 "M분" 형식으로 포매팅 */
  private formatMinutes(minutes: number): string {
    const totalMin = Math.floor(minutes);
    const hours = Math.floor(totalMin / MINUTES_PER_HOUR);
    const mins = totalMin % MINUTES_PER_HOUR;

    if (hours > 0) {
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }
    return `${mins}m`;
  }

  /** 비율(0~1)을 "N.N%" 형식으로 포매팅 */
  private formatPercent(ratio: number): string {
    return `${(ratio * 100).toFixed(1)}%`;
  }

  /** 다음 진단 가능 시간 포매팅 */
  private formatNextAvailableTime(cooldownHours: number): string {
    // Return locale-neutral format; the caller uses it inside a translated string
    if (cooldownHours < HOURS_PER_DAY) {
      return `${cooldownHours}h`;
    }
    const days = Math.floor(cooldownHours / HOURS_PER_DAY);
    const hours = cooldownHours % HOURS_PER_DAY;
    if (days > 0 && hours > 0) {
      return `${days}d ${hours}h`;
    }
    if (days > 0) {
      return `${days}d`;
    }
    return `${hours}h`;
  }

  /** 남은 초를 "Nh Mm" 형식으로 포매팅 */
  private formatRemainingTime(seconds: number): string {
    const totalMin = Math.ceil(seconds / SECONDS_PER_MINUTE);
    const hours = Math.floor(totalMin / MINUTES_PER_HOUR);
    const mins = totalMin % MINUTES_PER_HOUR;

    if (hours > 0) {
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }
    return `${mins}m`;
  }

  /** 판정 결과 이모지 */
  private verdictEmoji(isPassed: boolean): string {
    return isPassed ? '\u2705' : '\u26A0\uFE0F';
  }
}
