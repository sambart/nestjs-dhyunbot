"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  fetchVoiceDaily,
  computeSummary,
  computeDailyTrends,
  computeChannelStats,
  computeUserStats,
  type VoiceDailyRecord,
  type VoiceSummary,
  type VoiceDailyTrend,
  type VoiceChannelStat,
  type VoiceUserStat,
} from "@/app/lib/voice-dashboard-api";

import SummaryCards from "./components/SummaryCards";
import DailyTrendChart from "./components/DailyTrendChart";
import ChannelBarChart from "./components/ChannelBarChart";
import UserRankingTable from "./components/UserRankingTable";
import MicDistributionChart from "./components/MicDistributionChart";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Period = "7d" | "14d" | "30d";

function getDateRange(period: Period): { from: string; to: string } {
  const now = new Date();
  const to = formatYmd(now);
  const days = period === "7d" ? 7 : period === "14d" ? 14 : 30;
  const fromDate = new Date(now);
  fromDate.setDate(fromDate.getDate() - days);
  const from = formatYmd(fromDate);
  return { from, to };
}

function formatYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

export default function VoiceDashboardPage() {
  const params = useParams();
  const guildId = params.guildId as string;

  const [period, setPeriod] = useState<Period>("7d");
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<VoiceDailyRecord[]>([]);

  const [summary, setSummary] = useState<VoiceSummary | null>(null);
  const [trends, setTrends] = useState<VoiceDailyTrend[]>([]);
  const [channelStats, setChannelStats] = useState<VoiceChannelStat[]>([]);
  const [userStats, setUserStats] = useState<VoiceUserStat[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    const { from, to } = getDateRange(period);
    const data = await fetchVoiceDaily(guildId, from, to);
    setRecords(data);
    setSummary(computeSummary(data));
    setTrends(computeDailyTrends(data));
    setChannelStats(computeChannelStats(data));
    setUserStats(computeUserStats(data));
    setLoading(false);
  }, [guildId, period]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div className="space-y-6 p-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">음성 활동 대시보드</h1>
        <Select
          value={period}
          onValueChange={(v) => setPeriod(v as Period)}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">최근 7일</SelectItem>
            <SelectItem value="14d">최근 14일</SelectItem>
            <SelectItem value="30d">최근 30일</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-muted-foreground">데이터 로딩 중...</div>
        </div>
      ) : (
        <>
          {/* 요약 카드 */}
          {summary && <SummaryCards summary={summary} />}

          {/* 일별 추이 + 마이크 분포 */}
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <DailyTrendChart data={trends} />
            </div>
            <div>
              {summary && <MicDistributionChart summary={summary} />}
            </div>
          </div>

          {/* 채널별 통계 + 유저 랭킹 */}
          <div className="grid gap-6 lg:grid-cols-2">
            <ChannelBarChart data={channelStats} />
            <UserRankingTable data={userStats} />
          </div>
        </>
      )}
    </div>
  );
}
