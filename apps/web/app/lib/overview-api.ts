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

/** 서버 개요 데이터 조회 */
export async function fetchOverview(guildId: string): Promise<OverviewData> {
  const res = await fetch(`/api/guilds/${guildId}/overview`);
  if (!res.ok) {
    throw new Error('서버 개요 데이터를 불러오는데 실패했습니다.');
  }
  return res.json() as Promise<OverviewData>;
}

// ─── 유틸리티 ────────────────────────────────────────────────────────────────

/** 초 → "H시간 M분" 형식 */
export function formatDurationSec(totalSec: number): string {
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  if (hours > 0) return `${hours}시간 ${minutes}분`;
  return `${minutes}분`;
}

/** 'YYYYMMDD' → 'MM/DD' 형식 (차트 X축용) */
export function formatShortDate(dateStr: string): string {
  if (dateStr.length === 8) {
    return `${dateStr.slice(4, 6)}/${dateStr.slice(6, 8)}`;
  }
  const parts = dateStr.split('-');
  if (parts.length < 3) return dateStr;
  return `${parts[1]}/${parts[2]}`;
}
