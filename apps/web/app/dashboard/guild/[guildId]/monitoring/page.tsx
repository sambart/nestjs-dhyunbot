"use client";

import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("dashboard");
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
        setError(t("monitoring.loadFailed"));
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [guildId, period, t]);

  // Unmount tracking
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Initial load
  useEffect(() => {
    void loadStatus();
    void loadMetrics();
  }, [loadStatus, loadMetrics]);

  // Status polling
  useEffect(() => {
    intervalRef.current = setInterval(() => { void loadStatus(); }, 10_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [loadStatus]);

  const hourlyData = computeHourlyAverage(metricsData);

  const periodKeys: Period[] = ["24h", "7d", "30d"];

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("monitoring.title")}</h1>
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          {periodKeys.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setPeriod(key)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                period === key
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t(`monitoring.period.${key}`)}
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
          <div className="text-muted-foreground">{t("common.loading")}</div>
        </div>
      ) : metricsData.length === 0 && !error ? (
        <div className="flex h-[400px] items-center justify-center">
          <div className="text-muted-foreground">
            {t("monitoring.noMetrics")}
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
