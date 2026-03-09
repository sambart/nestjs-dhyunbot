"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import type { MemberProfile, VoiceHistoryPage } from "@/app/lib/user-detail-api";
import {
  fetchMemberProfile,
  fetchUserVoiceDaily,
  fetchUserVoiceHistory,
} from "@/app/lib/user-detail-api";
import {
  computeChannelStats,
  computeDailyTrends,
  type VoiceChannelStat,
  type VoiceDailyRecord,
  type VoiceDailyTrend,
} from "@/app/lib/voice-dashboard-api";
import { Button } from "@/components/ui/button";

import UserChannelPieChart from "./components/UserChannelPieChart";
import UserDailyBarChart from "./components/UserDailyBarChart";
import UserHistoryTable from "./components/UserHistoryTable";
import UserInfoSection from "./components/UserInfoSection";
import UserMicPieChart from "./components/UserMicPieChart";
import UserSearchDropdown from "./components/UserSearchDropdown";
import UserSummaryCards from "./components/UserSummaryCards";

type Period = "7d" | "14d" | "30d";

function formatYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

function getDateRange(period: Period): { from: string; to: string } {
  const now = new Date();
  const to = formatYmd(now);
  const days = period === "7d" ? 7 : period === "14d" ? 14 : 30;
  const fromDate = new Date(now);
  fromDate.setDate(fromDate.getDate() - days);
  const from = formatYmd(fromDate);
  return { from, to };
}

function computeUserSummary(records: VoiceDailyRecord[]): {
  totalDurationSec: number;
  totalMicOnSec: number;
  totalMicOffSec: number;
  totalAloneSec: number;
} {
  const globalRecords = records.filter((r) => r.channelId === "GLOBAL");
  const channelRecords = records.filter((r) => r.channelId !== "GLOBAL");

  return {
    totalDurationSec: channelRecords.reduce(
      (sum, r) => sum + r.channelDurationSec,
      0,
    ),
    totalMicOnSec: globalRecords.reduce((sum, r) => sum + r.micOnSec, 0),
    totalMicOffSec: globalRecords.reduce((sum, r) => sum + r.micOffSec, 0),
    totalAloneSec: globalRecords.reduce((sum, r) => sum + r.aloneSec, 0),
  };
}

const HISTORY_LIMIT = 20;

const PERIOD_LABELS: Record<Period, string> = {
  "7d": "7일",
  "14d": "14일",
  "30d": "30일",
};

export default function UserDetailPage() {
  const params = useParams();
  const guildId = params.guildId as string;
  const userId = params.userId as string;

  const [period, setPeriod] = useState<Period>("7d");
  const [dailyRecords, setDailyRecords] = useState<VoiceDailyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyData, setHistoryData] = useState<VoiceHistoryPage | null>(
    null,
  );
  const [historyLoading, setHistoryLoading] = useState(true);
  const [profile, setProfile] = useState<MemberProfile | null>(null);

  // 프로필 한 번만 로드 (userId 변경 시)
  useEffect(() => {
    let cancelled = false;
    fetchMemberProfile(guildId, userId).then((p) => {
      if (!cancelled) setProfile(p);
    });
    return () => { cancelled = true; };
  }, [guildId, userId]);

  // period 변경 시 일별 데이터 + 이력 첫 페이지 동시 로드
  useEffect(() => {
    let cancelled = false;

    async function loadAll() {
      setLoading(true);
      setHistoryLoading(true);
      setHistoryPage(1);

      const { from, to } = getDateRange(period);

      const [records, history] = await Promise.all([
        fetchUserVoiceDaily(guildId, userId, from, to),
        fetchUserVoiceHistory(guildId, userId, {
          from,
          to,
          page: 1,
          limit: HISTORY_LIMIT,
        }),
      ]);

      if (cancelled) return;

      setDailyRecords(records);
      setHistoryData(history);
      setLoading(false);
      setHistoryLoading(false);
    }

    loadAll();
    return () => {
      cancelled = true;
    };
  }, [guildId, userId, period]);

  // historyPage 변경 시 이력만 재로드
  useEffect(() => {
    if (historyPage === 1) return; // 첫 페이지는 위 effect에서 처리

    let cancelled = false;

    async function loadHistory() {
      setHistoryLoading(true);
      const { from, to } = getDateRange(period);
      const history = await fetchUserVoiceHistory(guildId, userId, {
        from,
        to,
        page: historyPage,
        limit: HISTORY_LIMIT,
      });
      if (cancelled) return;
      setHistoryData(history);
      setHistoryLoading(false);
    }

    loadHistory();
    return () => {
      cancelled = true;
    };
    // period는 의존성에서 제외 — period 변경은 위 effect가 처리
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guildId, userId, historyPage]);

  const summary = computeUserSummary(dailyRecords);
  const trends: VoiceDailyTrend[] = computeDailyTrends(dailyRecords);
  const channelStats: VoiceChannelStat[] = computeChannelStats(dailyRecords);

  const userName =
    profile?.userName ??
    dailyRecords.find((r) => r.channelId === "GLOBAL")?.userName ??
    dailyRecords[0]?.userName ??
    userId;
  const avatarUrl = profile?.avatarUrl ?? null;

  return (
    <div className="space-y-6 p-6">
      {/* 헤더: 타이틀 + 유저 검색창 */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">유저 음성 활동</h1>
        <UserSearchDropdown guildId={guildId} currentUserId={userId} />
      </div>

      {/* 유저 기본 정보 + 기간 선택 버튼 */}
      <div className="flex items-center justify-between">
        <UserInfoSection userName={userName} userId={userId} avatarUrl={avatarUrl} />
        <div className="flex gap-2">
          {(["7d", "14d", "30d"] as Period[]).map((p) => (
            <Button
              key={p}
              variant={period === p ? "default" : "outline"}
              size="sm"
              onClick={() => setPeriod(p)}
            >
              {PERIOD_LABELS[p]}
            </Button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <p className="text-muted-foreground">데이터 로딩 중...</p>
        </div>
      ) : (
        <>
          {/* 요약 카드 4개 */}
          <UserSummaryCards
            totalDurationSec={summary.totalDurationSec}
            totalMicOnSec={summary.totalMicOnSec}
            totalMicOffSec={summary.totalMicOffSec}
            totalAloneSec={summary.totalAloneSec}
          />

          {/* 일별 바 차트 + 마이크 도넛 차트 */}
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <UserDailyBarChart data={trends} />
            </div>
            <div>
              <UserMicPieChart
                micOnSec={summary.totalMicOnSec}
                micOffSec={summary.totalMicOffSec}
              />
            </div>
          </div>

          {/* 채널별 도넛 차트 */}
          <UserChannelPieChart data={channelStats} />

          {/* 입퇴장 이력 테이블 */}
          <UserHistoryTable
            data={historyData}
            loading={historyLoading}
            currentPage={historyPage}
            onPageChange={setHistoryPage}
          />
        </>
      )}
    </div>
  );
}
