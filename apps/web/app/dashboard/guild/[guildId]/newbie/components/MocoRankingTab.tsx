'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';

import type { NewbieConfig } from '../../../../../lib/newbie-api';
import type { MocoRankItem, MocoRankResponse } from '../../../../../lib/newbie-dashboard-api';
import { fetchMocoRanking } from '../../../../../lib/newbie-dashboard-api';
import { fetchMemberProfiles } from '../../../../../lib/user-detail-api';
import DisabledBanner from './DisabledBanner';
import MocoRankingTable from './MocoRankingTable';
import MocoTopCards from './MocoTopCards';

interface MemberProfile {
  userName: string;
  avatarUrl: string | null;
}

interface MocoRankingTabProps {
  guildId: string;
  config: NewbieConfig;
  isEnabled: boolean;
  settingsUrl: string;
}

const DEFAULT_PAGE_SIZE = 10;

/** yyyymmdd 형식을 "YYYY년 M월 D일" 형식으로 변환 */
function formatPeriodDate(yyyymmdd: string): string {
  const year = yyyymmdd.slice(0, 4);
  const month = String(parseInt(yyyymmdd.slice(4, 6), 10));
  const day = String(parseInt(yyyymmdd.slice(6, 8), 10));
  return `${year}년 ${month}월 ${day}일`;
}

/** 기간 표시 문자열 생성 */
function buildPeriodLabel(config: NewbieConfig, noneLabel: string): string {
  const period = config.mocoResetPeriod ?? 'NONE';

  if (period === 'NONE') {
    return noneLabel;
  }

  if (period === 'MONTHLY') {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const lastDay = new Date(year, month, 0).getDate();
    return `${year}년 ${month}월 1일 ~ ${year}년 ${month}월 ${lastDay}일`;
  }

  if (period === 'CUSTOM' && config.mocoCurrentPeriodStart && config.mocoResetIntervalDays) {
    const startStr = config.mocoCurrentPeriodStart;
    const startYear = parseInt(startStr.slice(0, 4), 10);
    const startMonth = parseInt(startStr.slice(4, 6), 10) - 1;
    const startDay = parseInt(startStr.slice(6, 8), 10);
    const startDate = new Date(startYear, startMonth, startDay);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + config.mocoResetIntervalDays - 1);

    const pad = (n: number) => String(n).padStart(2, '0');
    const endStr = `${endDate.getFullYear()}${pad(endDate.getMonth() + 1)}${pad(endDate.getDate())}`;
    return `${formatPeriodDate(startStr)} ~ ${formatPeriodDate(endStr)}`;
  }

  return noneLabel;
}

export default function MocoRankingTab({ guildId, config, isEnabled, settingsUrl }: MocoRankingTabProps) {
  const t = useTranslations('dashboard');
  const [rankData, setRankData] = useState<MocoRankResponse | null>(null);
  const [profiles, setProfiles] = useState<Record<string, MemberProfile>>({});
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRanking = useCallback(async (targetPage: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchMocoRanking(guildId, targetPage, DEFAULT_PAGE_SIZE);
      setRankData(data);

      if (data.items.length > 0) {
        const hunterIds = data.items.map((item) => item.hunterId);
        const profileMap = await fetchMemberProfiles(guildId, hunterIds);
        setProfiles(profileMap);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.loadFailed'));
    } finally {
      setIsLoading(false);
    }
  }, [guildId, t]);

  useEffect(() => {
    void loadRanking(page);
  }, [loadRanking, page]);

  // 첫 페이지의 상위 3명용 프로필 (페이지가 바뀌어도 top3는 page=1 기준)
  const [topItems, setTopItems] = useState<MocoRankItem[]>([]);
  const [topProfiles, setTopProfiles] = useState<Record<string, MemberProfile>>({});

  useEffect(() => {
    let cancelled = false;
    async function loadTop() {
      try {
        const data = await fetchMocoRanking(guildId, 1, 3);
        if (cancelled) return;
        setTopItems(data.items);
        if (data.items.length > 0) {
          const ids = data.items.map((i) => i.hunterId);
          const profileMap = await fetchMemberProfiles(guildId, ids);
          if (!cancelled) setTopProfiles(profileMap);
        }
      } catch {
        // 상위 카드 로드 실패는 무시
      }
    }
    void loadTop();
    return () => { cancelled = true; };
  }, [guildId]);

  function handlePageChange(newPage: number) {
    setPage(newPage);
  }

  const periodNoneLabel = t('newbie.moco.periodNone');
  const periodLabel = buildPeriodLabel(config, periodNoneLabel);
  const hasData = (rankData?.total ?? 0) > 0;

  // 비활성 + 데이터 없음
  if (!isEnabled && !isLoading && !hasData) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <p className="text-gray-500">{t('newbie.mocoDisabled')}</p>
        <Link
          href={settingsUrl}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          {t('newbie.goToSettings')}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 비활성 배너 */}
      {!isEnabled && hasData && (
        <DisabledBanner featureName={t('newbie.mocoTab')} settingsUrl={settingsUrl} />
      )}

      {/* 기간 표시 */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {t('newbie.moco.period', { period: periodLabel })}
        </p>
        <button
          type="button"
          onClick={() => void loadRanking(page)}
          className="text-xs text-indigo-600 hover:text-indigo-800"
        >
          {t('common.refresh')}
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-gray-400">{t('common.loading')}</div>
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : (
        <>
          {/* 상위 3명 카드 */}
          {topItems.length > 0 && (
            <MocoTopCards
              items={topItems}
              profiles={topProfiles}
              total={rankData?.total ?? 0}
            />
          )}

          {/* 순위 테이블 */}
          {rankData && (
            <MocoRankingTable
              guildId={guildId}
              items={rankData.items}
              profiles={profiles}
              page={rankData.page}
              pageSize={rankData.pageSize}
              total={rankData.total}
              onPageChange={handlePageChange}
            />
          )}
        </>
      )}
    </div>
  );
}
