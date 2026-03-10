"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  type BotStatus,
  computeHourlyAverage,
  fetchBotMetrics,
  fetchBotStatus,
  type MetricPoint,
} from "@/app/lib/monitoring-api";

import MemoryChart from "./components/MemoryChart";
import PingChart from "./components/PingChart";
import StatusCards from "./components/StatusCards";
import UptimeChart from "./components/UptimeChart";
import VoiceUserChart from "./components/VoiceUserChart";

type Period = "24h" | "7d" | "30d";

function getPeriodConfig(period: Period) {
  const to = new Date();
  const from = new Date(to);

  switch (period) {
    case "24h":
      from.setHours(from.getHours() - 24);
      return { from, to, interval: "1m" as const };
    case "7d":
      from.setDate(from.getDate() - 7);
      return { from, to, interval: "5m" as const };
    case "30d":
      from.setDate(from.getDate() - 30);
      return { from, to, interval: "1h" as const };
  }
}

export default function MonitoringPage() {
  const params = useParams();
  const guildId = params.guildId as string;

  const [period, setPeriod] = useState<Period>("24h");
  const [status, setStatus] = useState<BotStatus | null>(null);
  const [metricsData, setMetricsData] = useState<MetricPoint[]>([]);
  const [availability, setAvailability] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  // Status polling (10s)
  const loadStatus = useCallback(async () => {
    try {
      const data = await fetchBotStatus(guildId);
      if (mountedRef.current) setStatus(data);
    } catch {
      // 상태 폴링 실패는 무시 — 다음 주기에 재시도
    }
  }, [guildId]);

  // Metrics loading
  const loadMetrics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const config = getPeriodConfig(period);
      const res = await fetchBotMetrics(
        guildId,
        config.from.toISOString(),
        config.to.toISOString(),
        config.interval,
      );
      if (mountedRef.current) {
        setMetricsData(res.data);
        setAvailability(res.availabilityPercent);
      }
    } catch {
      if (mountedRef.current) {
        setError("메트릭 데이터를 불러오는데 실패했습니다.");
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [guildId, period]);

  // Unmount tracking
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Initial load
  useEffect(() => {
    loadStatus();
    loadMetrics();
  }, [loadStatus, loadMetrics]);

  // Status polling
  useEffect(() => {
    intervalRef.current = setInterval(loadStatus, 10_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [loadStatus]);

  const hourlyData = computeHourlyAverage(metricsData);

  const periods: { key: Period; label: string }[] = [
    { key: "24h", label: "24시간" },
    { key: "7d", label: "7일" },
    { key: "30d", label: "30일" },
  ];

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">모니터링</h1>
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          {periods.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                period === p.key
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* 상태 카드 */}
      {status && <StatusCards status={status} />}

      {/* 에러 표시 */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* 차트 영역 */}
      {loading ? (
        <div className="flex h-[400px] items-center justify-center">
          <div className="text-muted-foreground">데이터 로딩 중...</div>
        </div>
      ) : metricsData.length === 0 && !error ? (
        <div className="flex h-[400px] items-center justify-center">
          <div className="text-muted-foreground">
            해당 기간의 메트릭 데이터가 없습니다.
          </div>
        </div>
      ) : metricsData.length > 0 ? (
        <>
          {/* 업타임 히스토리 — 전체 너비 */}
          <UptimeChart
            data={metricsData}
            availabilityPercent={availability}
          />

          {/* 핑 + 메모리 — 1/2 너비 */}
          <div className="grid gap-6 md:grid-cols-2">
            <PingChart data={metricsData} />
            <MemoryChart data={metricsData} />
          </div>

          {/* 시간대별 음성 접속자 — 전체 너비 */}
          <VoiceUserChart data={hourlyData} />
        </>
      ) : null}
    </div>
  );
}
