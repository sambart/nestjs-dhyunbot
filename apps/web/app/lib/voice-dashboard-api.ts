// ─── 타입 정의 ──────────────────────────────────────────────────────────────

/** voice_daily 테이블의 일별 집계 레코드 */
export interface VoiceDailyRecord {
  guildId: string;
  userId: string;
  date: string; // YYYYMMDD
  channelId: string; // 'GLOBAL' 또는 실제 채널 ID
  channelName: string;
  userName: string;
  categoryId: string | null;
  categoryName: string | null;
  channelDurationSec: number;
  micOnSec: number;
  micOffSec: number;
  aloneSec: number;
}

/** 대시보드 요약 카드용 통계 */
export interface VoiceSummary {
  totalDurationSec: number;
  totalMicOnSec: number;
  totalMicOffSec: number;
  totalAloneSec: number;
  uniqueUsers: number;
  uniqueChannels: number;
}

/** 일별 추이 데이터 */
export interface VoiceDailyTrend {
  date: string;
  channelDurationSec: number;
  micOnSec: number;
  micOffSec: number;
  aloneSec: number;
}

/** 채널별 통계 */
export interface VoiceChannelStat {
  channelId: string;
  channelName: string;
  totalDurationSec: number;
  micOnSec: number;
  micOffSec: number;
  aloneSec: number;
}

/** 카테고리별 통계 */
export interface VoiceCategoryStat {
  categoryId: string | null;
  categoryName: string;
  totalDurationSec: number;
  micOnSec: number;
  micOffSec: number;
  aloneSec: number;
}

/** 유저별 통계 */
export interface VoiceUserStat {
  userId: string;
  userName: string;
  totalDurationSec: number;
  micOnSec: number;
  micOffSec: number;
  aloneSec: number;
}

// ─── 유틸리티 ────────────────────────────────────────────────────────────────

/** 초를 "HH시간 MM분" 형식으로 변환 */
export function formatDuration(totalSec: number): string {
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  if (hours > 0) return `${hours}시간 ${minutes}분`;
  return `${minutes}분`;
}

/** YYYYMMDD → MM/DD 형식 */
export function formatDate(yyyymmdd: string): string {
  return `${yyyymmdd.slice(4, 6)}/${yyyymmdd.slice(6, 8)}`;
}

// ─── API 함수 ────────────────────────────────────────────────────────────────

/**
 * 음성 일별 집계 데이터를 조회한다.
 * @param guildId 서버 ID
 * @param from 시작일 (YYYYMMDD)
 * @param to 종료일 (YYYYMMDD)
 */
export async function fetchVoiceDaily(
  guildId: string,
  from: string,
  to: string,
): Promise<VoiceDailyRecord[]> {
  const res = await fetch(
    `/api/guilds/${guildId}/voice/daily?from=${from}&to=${to}`,
  );
  if (!res.ok) return [];
  return res.json();
}

// ─── 클라이언트 집계 함수 ─────────────────────────────────────────────────────

/** 요약 통계 계산 */
export function computeSummary(records: VoiceDailyRecord[]): VoiceSummary {
  const globalRecords = records.filter((r) => r.channelId === 'GLOBAL');
  const channelRecords = records.filter((r) => r.channelId !== 'GLOBAL');

  const userIds = new Set(globalRecords.map((r) => r.userId));
  const channelIds = new Set(channelRecords.map((r) => r.channelId));

  return {
    totalDurationSec: channelRecords.reduce(
      (sum, r) => sum + r.channelDurationSec,
      0,
    ),
    totalMicOnSec: globalRecords.reduce((sum, r) => sum + r.micOnSec, 0),
    totalMicOffSec: globalRecords.reduce((sum, r) => sum + r.micOffSec, 0),
    totalAloneSec: globalRecords.reduce((sum, r) => sum + r.aloneSec, 0),
    uniqueUsers: userIds.size,
    uniqueChannels: channelIds.size,
  };
}

/** 일별 추이 데이터 생성 */
export function computeDailyTrends(
  records: VoiceDailyRecord[],
): VoiceDailyTrend[] {
  const byDate = new Map<string, VoiceDailyTrend>();

  // 채널 레코드에서 channelDurationSec 집계
  const channelRecords = records.filter((r) => r.channelId !== 'GLOBAL');
  for (const r of channelRecords) {
    const existing = byDate.get(r.date);
    if (existing) {
      existing.channelDurationSec += r.channelDurationSec;
    } else {
      byDate.set(r.date, {
        date: r.date,
        channelDurationSec: r.channelDurationSec,
        micOnSec: 0,
        micOffSec: 0,
        aloneSec: 0,
      });
    }
  }

  // GLOBAL 레코드에서 마이크/혼자 시간 병합
  const globalRecords = records.filter((r) => r.channelId === 'GLOBAL');
  for (const r of globalRecords) {
    const existing = byDate.get(r.date);
    if (existing) {
      existing.micOnSec += r.micOnSec;
      existing.micOffSec += r.micOffSec;
      existing.aloneSec += r.aloneSec;
    } else {
      byDate.set(r.date, {
        date: r.date,
        channelDurationSec: 0,
        micOnSec: r.micOnSec,
        micOffSec: r.micOffSec,
        aloneSec: r.aloneSec,
      });
    }
  }

  return Array.from(byDate.values()).sort((a, b) =>
    a.date.localeCompare(b.date),
  );
}

/** 채널별 통계 집계 */
export function computeChannelStats(
  records: VoiceDailyRecord[],
): VoiceChannelStat[] {
  const channelRecords = records.filter((r) => r.channelId !== 'GLOBAL');
  const byChannel = new Map<string, VoiceChannelStat>();

  for (const r of channelRecords) {
    const existing = byChannel.get(r.channelId);
    if (existing) {
      existing.totalDurationSec += r.channelDurationSec;
      existing.micOnSec += r.micOnSec;
      existing.micOffSec += r.micOffSec;
      existing.aloneSec += r.aloneSec;
    } else {
      byChannel.set(r.channelId, {
        channelId: r.channelId,
        channelName: r.channelName,
        totalDurationSec: r.channelDurationSec,
        micOnSec: r.micOnSec,
        micOffSec: r.micOffSec,
        aloneSec: r.aloneSec,
      });
    }
  }

  return Array.from(byChannel.values()).sort(
    (a, b) => b.totalDurationSec - a.totalDurationSec,
  );
}

/** 카테고리별 통계 집계 */
export function computeCategoryStats(
  records: VoiceDailyRecord[],
): VoiceCategoryStat[] {
  const channelRecords = records.filter((r) => r.channelId !== 'GLOBAL');
  const byCategory = new Map<string, VoiceCategoryStat>();

  for (const r of channelRecords) {
    const key = r.categoryId ?? '__null__';
    const existing = byCategory.get(key);
    if (existing) {
      existing.totalDurationSec += r.channelDurationSec;
      existing.micOnSec += r.micOnSec;
      existing.micOffSec += r.micOffSec;
      existing.aloneSec += r.aloneSec;
    } else {
      byCategory.set(key, {
        categoryId: r.categoryId,
        categoryName: r.categoryName ?? '미분류',
        totalDurationSec: r.channelDurationSec,
        micOnSec: r.micOnSec,
        micOffSec: r.micOffSec,
        aloneSec: r.aloneSec,
      });
    }
  }

  return Array.from(byCategory.values()).sort(
    (a, b) => b.totalDurationSec - a.totalDurationSec,
  );
}

/** 유저별 통계 집계 */
export function computeUserStats(
  records: VoiceDailyRecord[],
): VoiceUserStat[] {
  const byUser = new Map<string, VoiceUserStat>();

  // 개별 채널 레코드에서 userName과 channelDurationSec를 집계
  const channelRecords = records.filter((r) => r.channelId !== 'GLOBAL');
  for (const r of channelRecords) {
    const existing = byUser.get(r.userId);
    if (existing) {
      existing.totalDurationSec += r.channelDurationSec;
      if (!existing.userName && r.userName) existing.userName = r.userName;
    } else {
      byUser.set(r.userId, {
        userId: r.userId,
        userName: r.userName,
        totalDurationSec: r.channelDurationSec,
        micOnSec: 0,
        micOffSec: 0,
        aloneSec: 0,
      });
    }
  }

  // GLOBAL 레코드에서 마이크/혼자 시간을 병합
  const globalRecords = records.filter((r) => r.channelId === 'GLOBAL');
  for (const r of globalRecords) {
    const existing = byUser.get(r.userId);
    if (existing) {
      existing.micOnSec += r.micOnSec;
      existing.micOffSec += r.micOffSec;
      existing.aloneSec += r.aloneSec;
      if (!existing.userName && r.userName) existing.userName = r.userName;
    } else {
      byUser.set(r.userId, {
        userId: r.userId,
        userName: r.userName,
        totalDurationSec: 0,
        micOnSec: r.micOnSec,
        micOffSec: r.micOffSec,
        aloneSec: r.aloneSec,
      });
    }
  }

  return Array.from(byUser.values()).sort(
    (a, b) => b.totalDurationSec - a.totalDurationSec,
  );
}
