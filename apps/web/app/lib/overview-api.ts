// ─── 타입 정의 (BE GuildOverviewResponse와 일치) ─────────────────────────────

/** 서버 개요 통합 응답 */
export interface OverviewData {
  totalMemberCount: number;
  todayVoiceTotalSec: number;
  currentVoiceUserCount: number;
  activeRate: number; // 0~100 (%)
  inactiveByGrade: {
    fullyInactive: number;
    lowActive: number;
    declining: number;
  };
  missionSummary: {
    inProgress: number;
    completed: number;
    failed: number;
  } | null;
  weeklyVoice: Array<{
    date: string;
    totalSec: number;
  }>;
}

// ─── API 함수 ────────────────────────────────────────────────────────────────

import { apiClient } from './api-client';

/** 서버 개요 데이터 조회 */
export async function fetchOverview(guildId: string): Promise<OverviewData> {
  return apiClient<OverviewData>(`/api/guilds/${guildId}/overview`);
}

// ─── 유틸리티 ────────────────────────────────────────────────────────────────

export { formatDurationSec, formatShortDate } from './format-utils';
