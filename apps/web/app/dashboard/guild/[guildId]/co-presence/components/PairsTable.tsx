"use client";

import { ChevronDown, ChevronsUpDown, ChevronUp } from "lucide-react";
import { type ChangeEvent, useCallback, useEffect, useRef, useState } from "react";

import type { PairItem, PairsResponse } from "@/app/lib/co-presence-api";
import { fetchPairs, formatMinutes } from "@/app/lib/co-presence-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import PairDetailModal from "./PairDetailModal";

type Days = 7 | 30 | 90;
type SortBy = "totalMinutes" | "sessionCount" | "lastDate";
type SortOrder = "DESC" | "ASC";

const TABLE_LIMIT = 20;

interface PairsTableProps {
  guildId: string;
  days: Days;
}

interface SortIconProps {
  column: SortBy;
  currentSortBy: SortBy;
  currentSortOrder: SortOrder;
}

function SortIcon({ column, currentSortBy, currentSortOrder }: SortIconProps) {
  if (currentSortBy !== column) {
    return <ChevronsUpDown className="ml-1 h-3.5 w-3.5 text-muted-foreground" />;
  }
  if (currentSortOrder === "DESC") {
    return <ChevronDown className="ml-1 h-3.5 w-3.5 text-indigo-600" />;
  }
  return <ChevronUp className="ml-1 h-3.5 w-3.5 text-indigo-600" />;
}

export default function PairsTable({ guildId, days }: PairsTableProps) {
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<SortBy>("totalMinutes");
  const [sortOrder, setSortOrder] = useState<SortOrder>("DESC");
  const [data, setData] = useState<PairsResponse | null>(null);
  const [tableLoading, setTableLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPair, setSelectedPair] = useState<{
    userA: string;
    userB: string;
    userAName: string;
    userBName: string;
  } | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadPairs = useCallback(async () => {
    if (!mountedRef.current) return;
    setTableLoading(true);
    setError(null);
    try {
      const result = await fetchPairs({
        guildId,
        days,
        search,
        page,
        limit: TABLE_LIMIT,
        sortBy,
        sortOrder,
      });
      if (mountedRef.current) setData(result);
    } catch (err) {
      if (mountedRef.current) {
        setError(
          err instanceof Error ? err.message : '관계 데이터를 불러오는데 실패했습니다.',
        );
      }
    } finally {
      if (mountedRef.current) setTableLoading(false);
    }
  }, [guildId, days, search, page, sortBy, sortOrder]);

  useEffect(() => {
    void loadPairs();
  }, [loadPairs]);

  // 검색 debounce 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // 기간(days) 변경 시 페이지 리셋
  useEffect(() => {
    setPage(1);
  }, [days]);

  const handleSortClick = (column: SortBy) => {
    if (sortBy === column) {
      setSortOrder((prev) => (prev === "DESC" ? "ASC" : "DESC"));
    } else {
      setSortBy(column);
      setSortOrder("DESC");
    }
    setPage(1);
  };

  const handleRowClick = (item: PairItem) => {
    setSelectedPair({
      userA: item.userA.userId,
      userB: item.userB.userId,
      userAName: item.userA.userName,
      userBName: item.userB.userName,
    });
  };

  const handleModalClose = () => {
    setSelectedPair(null);
  };

  const handleSearchInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    setSearchInput(e.target.value);
  };

  const totalPages = data ? Math.max(1, Math.ceil(data.total / TABLE_LIMIT)) : 1;

  const thClass =
    "pb-3 text-left font-medium text-muted-foreground select-none";
  const thSortClass =
    "pb-3 font-medium text-muted-foreground select-none cursor-pointer hover:text-foreground";

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle>관계 상세 테이블</CardTitle>
            <input
              type="text"
              value={searchInput}
              onChange={handleSearchInputChange}
              placeholder="닉네임으로 검색..."
              className="w-[220px] px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {tableLoading ? (
            <div className="flex items-center justify-center py-10">
              <div className="text-muted-foreground">목록 로딩 중...</div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className={thClass}>유저A</th>
                    <th className={thClass}>유저B</th>
                    <th
                      className={`${thSortClass} text-right`}
                      onClick={() => handleSortClick("totalMinutes")}
                    >
                      <span className="inline-flex items-center justify-end w-full">
                        총 동시접속 시간
                        <SortIcon
                          column="totalMinutes"
                          currentSortBy={sortBy}
                          currentSortOrder={sortOrder}
                        />
                      </span>
                    </th>
                    <th
                      className={`${thSortClass} text-right`}
                      onClick={() => handleSortClick("sessionCount")}
                    >
                      <span className="inline-flex items-center justify-end w-full">
                        세션 수
                        <SortIcon
                          column="sessionCount"
                          currentSortBy={sortBy}
                          currentSortOrder={sortOrder}
                        />
                      </span>
                    </th>
                    <th
                      className={`${thSortClass} text-right`}
                      onClick={() => handleSortClick("lastDate")}
                    >
                      <span className="inline-flex items-center justify-end w-full">
                        마지막 함께한 날짜
                        <SortIcon
                          column="lastDate"
                          currentSortBy={sortBy}
                          currentSortOrder={sortOrder}
                        />
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data?.items.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="py-10 text-center text-muted-foreground"
                      >
                        검색 결과가 없습니다.
                      </td>
                    </tr>
                  ) : (
                    data?.items.map((item, index) => (
                      <tr
                        key={`${item.userA.userId}-${item.userB.userId}-${index}`}
                        className="hover:bg-muted/50 cursor-pointer"
                        onClick={() => handleRowClick(item)}
                      >
                        <td className="py-3 font-medium">
                          {item.userA.userName}
                        </td>
                        <td className="py-3 font-medium">
                          {item.userB.userName}
                        </td>
                        <td className="py-3 text-right text-muted-foreground">
                          {formatMinutes(item.totalMinutes)}
                        </td>
                        <td className="py-3 text-right text-muted-foreground">
                          {item.sessionCount}
                        </td>
                        <td className="py-3 text-right text-muted-foreground">
                          {item.lastDate}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* 페이지네이션 */}
          <div className="mt-4 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {page} / {totalPages} 페이지 (총 {data?.total ?? 0}쌍)
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1.5 rounded-lg border border-input text-sm font-medium hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                이전
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 rounded-lg border border-input text-sm font-medium hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                다음
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedPair && (
        <PairDetailModal
          guildId={guildId}
          days={days}
          userA={selectedPair.userA}
          userB={selectedPair.userB}
          userAName={selectedPair.userAName}
          userBName={selectedPair.userBName}
          isOpen={selectedPair !== null}
          onClose={handleModalClose}
        />
      )}
    </>
  );
}
