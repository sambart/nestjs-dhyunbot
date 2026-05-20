import { Injectable, Logger } from '@nestjs/common';
import type { VoiceActivityData } from '@onyu/shared';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type RESTPostAPIChannelMessageJSONBody,
} from 'discord.js';

import type { TopPairItem } from '../../../channel/voice/co-presence/co-presence-analytics.service';
import { CoPresenceAnalyticsService } from '../../../channel/voice/co-presence/co-presence-analytics.service';
import { getErrorStack } from '../../../common/util/error.util';
import { DiscordRestService } from '../../../discord-rest/discord-rest.service';
import { UserPrivacyConfigService } from '../../../user-privacy/application/user-privacy-config.service';
import { VoiceAiAnalysisService } from '../../application/voice-ai-analysis.service';
import { VoiceAnalyticsService } from '../../application/voice-analytics.service';
import type { WeeklyReportConfigOrmEntity } from '../infrastructure/weekly-report-config.orm-entity';

const REPORT_EMBED_COLOR = 0x5b8def;
const LEADERBOARD_PAGE = 1;
const LEADERBOARD_LIMIT = 5;
const TOP_CHANNELS_LIMIT = 3;
const REPORT_PERIOD_DAYS = 7;
const TOP_PAIRS_LIMIT = 5;
const ANONYMOUS_LABEL = '???';
const MINUTES_PER_HOUR = 60;
// 한쪽만 비공개인 페어의 hiddenSideCount 값
const HIDDEN_SIDE_COUNT_ONE = 1;

interface ReportData {
  currentStats: { totalUsers: number; totalVoiceTime: number; avgDailyActiveUsers: number };
  prevStats: { totalUsers: number; totalVoiceTime: number; avgDailyActiveUsers: number };
  topUsers: Array<{
    rank: number;
    nickName: string;
    totalSec: number;
    micOnSec: number;
    activeDays: number;
  }>;
  topChannels: Array<{ channelName: string; totalSec: number; uniqueUsers: number }>;
  // 사생활 필터가 적용된 베스트 페어 목록
  topPairs: ReportTopPair[];
  aiAnalysis: string | null;
}

/** 사생활 필터 적용 후 리포트에 표시할 페어 정보 */
interface ReportTopPair {
  userAName: string;
  userBName: string;
  totalMinutes: number;
  sessionCount: number;
  /** 0: 양측 공개, 1: 한쪽 비공개 */
  hiddenSideCount: 0 | 1;
}

/** runAiAnalysisSafely 파라미터 묶음 — max-params 경고 회피 */
interface AiAnalysisInput {
  guildId: string;
  currentData: VoiceActivityData;
  prevData: VoiceActivityData;
  topPairs: ReportTopPair[];
}

@Injectable()
export class WeeklyReportService {
  private readonly logger = new Logger(WeeklyReportService.name);

  constructor(
    private readonly analyticsService: VoiceAnalyticsService,
    private readonly aiAnalysisService: VoiceAiAnalysisService,
    private readonly discordRestService: DiscordRestService,
    private readonly coPresenceAnalyticsService: CoPresenceAnalyticsService,
    private readonly userPrivacyConfigService: UserPrivacyConfigService,
  ) {}

  async generateAndSendReport(config: WeeklyReportConfigOrmEntity): Promise<void> {
    if (!config.channelId) {
      this.logger.warn(`[WEEKLY] guild=${config.guildId} channelId is not configured, skipping`);
      return;
    }

    this.logger.log(`[WEEKLY] Generating report for guild=${config.guildId}`);

    try {
      const reportData = await this.collectReportData(config.guildId);
      const payload = this.buildPayload(config.guildId, reportData);

      await this.discordRestService.sendMessage(config.channelId, payload);
      this.logger.log(`[WEEKLY] Report sent for guild=${config.guildId}`);
    } catch (err) {
      this.logger.error(
        `[WEEKLY] Failed to generate/send report for guild=${config.guildId}`,
        getErrorStack(err),
      );
      throw err;
    }
  }

  private async collectReportData(guildId: string): Promise<ReportData> {
    const currentRange = VoiceAnalyticsService.getDateRange(REPORT_PERIOD_DAYS);
    const prevRange = VoiceAnalyticsService.getPrevDateRange(REPORT_PERIOD_DAYS);

    const [currentData, prevData, leaderboard, channelStats, rawTopPairs] = await Promise.all([
      this.analyticsService.collectVoiceActivityData(guildId, currentRange.start, currentRange.end),
      this.analyticsService.collectVoiceActivityData(guildId, prevRange.start, prevRange.end),
      this.analyticsService.getLeaderboard(guildId, {
        days: REPORT_PERIOD_DAYS,
        page: LEADERBOARD_PAGE,
        limit: LEADERBOARD_LIMIT,
      }),
      this.analyticsService.getChannelStats(guildId, REPORT_PERIOD_DAYS),
      // 친밀도 조회 실패 시 다른 섹션에 영향 없도록 안전하게 처리
      this.fetchTopPairsSafely(guildId),
    ]);

    const topPairs = await this.applyPrivacyFilterSafely(guildId, rawTopPairs);
    const aiAnalysis = await this.runAiAnalysisSafely({ guildId, currentData, prevData, topPairs });

    return {
      currentStats: currentData.totalStats,
      prevStats: prevData.totalStats,
      topUsers: leaderboard.users,
      topChannels: channelStats.slice(0, TOP_CHANNELS_LIMIT),
      topPairs,
      aiAnalysis,
    };
  }

  /** 친밀도 조회 실패는 리포트 전체를 막지 않는다. */
  private async fetchTopPairsSafely(guildId: string): Promise<TopPairItem[]> {
    try {
      return await this.coPresenceAnalyticsService.getTopPairs(
        guildId,
        REPORT_PERIOD_DAYS,
        TOP_PAIRS_LIMIT,
      );
    } catch (err) {
      this.logger.warn(
        `[WEEKLY] getTopPairs failed for guild=${guildId} — section omitted`,
        getErrorStack(err),
      );
      return [];
    }
  }

  /** opt-out 조회 실패 시 사생활 우선: 모든 페어를 안전하게 제거한다. */
  private async applyPrivacyFilterSafely(
    guildId: string,
    pairs: TopPairItem[],
  ): Promise<ReportTopPair[]> {
    if (pairs.length === 0) return [];
    try {
      return await this.applyPrivacyFilter(guildId, pairs);
    } catch (err) {
      this.logger.warn(
        `[WEEKLY] privacy filter failed for guild=${guildId} — pairs section dropped`,
        getErrorStack(err),
      );
      return [];
    }
  }

  private async applyPrivacyFilter(
    guildId: string,
    pairs: TopPairItem[],
  ): Promise<ReportTopPair[]> {
    const userIds = [...new Set(pairs.flatMap((p) => [p.userA.userId, p.userB.userId]))];
    // filterPeers: Map<userId, { isAnonymous: boolean }>
    const privacyMap = await this.userPrivacyConfigService.filterPeers(guildId, userIds);

    return pairs
      .map<ReportTopPair | null>((p) => {
        const isAHidden = privacyMap.get(p.userA.userId)?.isAnonymous ?? false;
        const isBHidden = privacyMap.get(p.userB.userId)?.isAnonymous ?? false;
        // 양측 모두 비공개 → 사생활 보호를 위해 페어 자체를 제거
        if (isAHidden && isBHidden) return null;
        return {
          userAName: isAHidden ? ANONYMOUS_LABEL : p.userA.userName,
          userBName: isBHidden ? ANONYMOUS_LABEL : p.userB.userName,
          totalMinutes: p.totalMinutes,
          sessionCount: p.sessionCount,
          hiddenSideCount: (isAHidden || isBHidden ? HIDDEN_SIDE_COUNT_ONE : 0) as 0 | 1,
        };
      })
      .filter((p): p is ReportTopPair => p !== null);
  }

  private async runAiAnalysisSafely(input: AiAnalysisInput): Promise<string | null> {
    const { guildId, currentData, prevData, topPairs } = input;
    try {
      return await this.aiAnalysisService.generateWeeklyReport(
        currentData,
        prevData,
        currentData.channelStats,
        topPairs,
      );
    } catch (err) {
      this.logger.warn(`[WEEKLY] AI analysis failed for guild=${guildId}`, getErrorStack(err));
      return null;
    }
  }

  // eslint-disable-next-line max-lines-per-function
  private buildPayload(guildId: string, reportData: ReportData): RESTPostAPIChannelMessageJSONBody {
    const { currentStats, prevStats, topUsers, topChannels, topPairs, aiAnalysis } = reportData;
    const formatTime = (seconds: number): string => {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / MINUTES_PER_HOUR);
      return hours > 0 ? `${hours}시간 ${minutes}분` : `${minutes}분`;
    };

    const formatDiff = (current: number, prev: number): string => {
      const diff = current - prev;
      if (diff > 0) return `+${diff.toFixed(1)}`;
      if (diff < 0) return `${diff.toFixed(1)}`;
      return '±0';
    };

    const sections: string[] = [];

    // 이번 주 vs 지난 주 비교
    sections.push(
      '**📊 이번 주 vs 지난 주**\n' +
        `활성 유저: ${currentStats.totalUsers}명 (${formatDiff(currentStats.totalUsers, prevStats.totalUsers)})\n` +
        `총 음성 시간: ${formatTime(currentStats.totalVoiceTime)}\n` +
        `일평균 활성: ${currentStats.avgDailyActiveUsers}명 (${formatDiff(currentStats.avgDailyActiveUsers, prevStats.avgDailyActiveUsers)})`,
    );

    // TOP 5 유저
    if (topUsers.length > 0) {
      const userLines = topUsers
        .map(
          (u) =>
            `${u.rank}. **${u.nickName}** — ${formatTime(u.totalSec)} (${u.activeDays}일 활동)`,
        )
        .join('\n');
      sections.push(`**👥 TOP 5 유저**\n${userLines}`);
    }

    // TOP 3 채널
    if (topChannels.length > 0) {
      const channelLines = topChannels
        .map((c) => `- **${c.channelName}** — ${formatTime(c.totalSec)} (${c.uniqueUsers}명)`)
        .join('\n');
      sections.push(`**📺 TOP 3 채널**\n${channelLines}`);
    }

    // 친밀도 섹션 — TOP 3 채널 뒤, AI 종합 분석 앞
    this.appendCoPresenceSection(sections, topPairs);

    // AI 종합 분석
    if (aiAnalysis) {
      sections.push(`**🤖 AI 종합 분석**\n${aiAnalysis}`);
    }

    const button = new ButtonBuilder()
      .setLabel('대시보드에서 자세히 보기')
      .setStyle(ButtonStyle.Link)
      .setURL(`${process.env['WEB_URL'] ?? 'https://onyu.dev'}/guilds/${guildId}/voice-analytics`);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);

    return {
      embeds: [
        {
          title: '📋 주간 음성 활동 리포트',
          description: sections.join('\n\n'),
          color: REPORT_EMBED_COLOR,
          timestamp: new Date().toISOString(),
        },
      ],
      // discord.js ActionRowBuilder JSON 변환
      components: [row.toJSON()],
    };
  }

  /** 0건이면 섹션 자체를 생략한다. */
  private appendCoPresenceSection(sections: string[], topPairs: ReportTopPair[]): void {
    if (topPairs.length === 0) return;

    const pairLines = topPairs
      .map((p, i) => {
        const time = this.formatPairTime(p.totalMinutes);
        const suffix =
          p.hiddenSideCount === HIDDEN_SIDE_COUNT_ONE
            ? `(${p.sessionCount}세션, 1명 비공개)`
            : `(${p.sessionCount}세션)`;
        return `${i + 1}. ${p.userAName} ↔ ${p.userBName} — ${time} ${suffix}`;
      })
      .join('\n');

    sections.push(`**💞 이번 주 베스트 페어 TOP 5**\n${pairLines}`);
  }

  private formatPairTime(minutes: number): string {
    const hours = Math.floor(minutes / MINUTES_PER_HOUR);
    const mins = minutes % MINUTES_PER_HOUR;
    return hours > 0 ? `${hours}시간 ${mins}분` : `${mins}분`;
  }
}
