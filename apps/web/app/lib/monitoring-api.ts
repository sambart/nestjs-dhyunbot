// ─── 타입 정의 ──────────────────────────────────────────────────────────────

export interface BotStatus {
  online: boolean;
  uptimeMs: number;
  startedAt: string | null;
  pingMs: number;
  guildCount: number;
  memoryUsage: {
    heapUsedMb: number;
    heapTotalMb: number;
  };
  voiceUserCount: number;
}

export interface MetricPoint {
  timestamp: string;
  online: boolean;
  pingMs: number;
  heapUsedMb: number;
  heapTotalMb: number;
  voiceUserCount: number;
  guildCount: number;
}

export interface MetricsResponse {
  interval: string;
  availabilityPercent: number;
  data: MetricPoint[];
}

// ─── API 호출 ────────────────────────────────────────────────────────────────

import { apiGet } from './api-client';

const EMPTY_STATUS: BotStatus = {
  online: false,
  uptimeMs: 0,
  startedAt: null,
  pingMs: 0,
  guildCount: 0,
  memoryUsage: { heapUsedMb: 0, heapTotalMb: 0 },
  voiceUserCount: 0,
};

/** 봇의 현재 상태 정보를 조회한다 */
export async function fetchBotStatus(guildId: string): Promise<BotStatus> {
  return apiGet<BotStatus>(`/api/guilds/${guildId}/bot/status`, EMPTY_STATUS);
}

/** 봇 메트릭 시계열 데이터를 조회한다 */
export async function fetchBotMetrics(
  guildId: string,
  from: string,
  to: string,
  interval: string,
): Promise<MetricsResponse> {
  return apiGet<MetricsResponse>(
    `/api/guilds/${guildId}/bot/metrics?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&interval=${interval}`,
    { interval, availabilityPercent: 0, data: [] },
  );
}

// ─── 유틸리티 ────────────────────────────────────────────────────────────────

/** 밀리초를 사람이 읽기 쉬운 가동 시간 문자열로 변환한다 */
export function formatUptime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}일`);
  if (hours > 0) parts.push(`${hours}시간`);
  parts.push(`${minutes}분`);
  return parts.join(" ");
}

/** 시간대별(0~23시) 평균 접속자 수 집계 */
export function computeHourlyAverage(
  data: MetricPoint[],
): Array<{ hour: number; avgUsers: number }> {
  const buckets: Record<number, number[]> = {};
  for (let h = 0; h < 24; h++) buckets[h] = [];

  for (const point of data) {
    const hour = new Date(point.timestamp).getHours();
    buckets[hour].push(point.voiceUserCount);
  }

  return Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    avgUsers:
      buckets[h].length > 0
        ? parseFloat(
            (buckets[h].reduce((a, b) => a + b, 0) / buckets[h].length).toFixed(
              1,
            ),
          )
        : 0,
  }));
}
