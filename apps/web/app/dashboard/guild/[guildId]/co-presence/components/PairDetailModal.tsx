"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";

import type { PairDetail } from "@/app/lib/co-presence-api";
import { fetchPairDetail, formatMinutes, formatShortDate } from "@/app/lib/co-presence-api";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

type Days = 7 | 30 | 90;

const chartConfig = {
  minutes: {
    label: "동시접속(분)",
    color: "#6366F1",
  },
} satisfies ChartConfig;

interface PairDetailModalProps {
  guildId: string;
  days: Days;
  userA: string;
  userB: string;
  userAName: string;
  userBName: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function PairDetailModal({
  guildId,
  days,
  userA,
  userB,
  userAName,
  userBName,
  isOpen,
  onClose,
}: PairDetailModalProps) {
  const [detail, setDetail] = useState<PairDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    setDetail(null);
    setLoading(true);
    setError(null);

    async function loadDetail() {
      try {
        const result = await fetchPairDetail({ guildId, userA, userB, days });
        if (!cancelled) setDetail(result);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : '상세 데이터를 불러오는데 실패했습니다.',
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadDetail();
    return () => {
      cancelled = true;
    };
  }, [isOpen, guildId, userA, userB, days]);

  // ESC 키로 닫기
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const chartData = detail?.dailyData.map((d) => ({
    date: formatShortDate(d.date),
    minutes: d.minutes,
  })) ?? [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl rounded-xl bg-background p-6 shadow-xl mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 닫기 버튼 */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground hover:bg-muted transition-colors"
          aria-label="닫기"
        >
          <X className="h-5 w-5" />
        </button>

        {/* 헤더 */}
        <div className="mb-6 pr-8">
          <h2 className="text-xl font-bold">
            {userAName} ↔ {userBName}
          </h2>
          {detail && (
            <p className="mt-1 text-sm text-muted-foreground">
              {days}일 기간 내 총 {formatMinutes(detail.totalMinutes)}
            </p>
          )}
        </div>

        {/* 에러 */}
        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* 로딩 */}
        {loading ? (
          <div className="flex h-[250px] items-center justify-center">
            <div className="text-muted-foreground">데이터 로딩 중...</div>
          </div>
        ) : detail ? (
          chartData.length === 0 ? (
            <div className="flex h-[250px] items-center justify-center">
              <p className="text-sm text-muted-foreground">
                기간 내 동시접속 데이터가 없습니다.
              </p>
            </div>
          ) : (
            <ChartContainer config={chartConfig} className="h-[250px] w-full">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tickLine={false} axisLine={false} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => `${v}분`}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value) => [
                        formatMinutes(value as number),
                        "동시접속 시간",
                      ]}
                    />
                  }
                />
                <Bar
                  dataKey="minutes"
                  fill="#6366F1"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ChartContainer>
          )
        ) : null}
      </div>
    </div>
  );
}
