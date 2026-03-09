"use client";

import type { VoiceHistoryPage } from "@/app/lib/user-detail-api";
import { formatDuration } from "@/app/lib/voice-dashboard-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
  data: VoiceHistoryPage | null;
  loading: boolean;
  currentPage: number;
  onPageChange: (page: number) => void;
}

export default function UserHistoryTable({
  data,
  loading,
  currentPage,
  onPageChange,
}: Props) {
  const totalPages = data ? Math.ceil(data.total / data.limit) : 1;

  return (
    <Card>
      <CardHeader>
        <CardTitle>입퇴장 이력</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <p className="text-muted-foreground">데이터 로딩 중...</p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {/* 헤더 */}
              <div className="grid grid-cols-4 gap-2 border-b pb-2 text-sm font-medium text-muted-foreground">
                <span>채널</span>
                <span>입장 시각</span>
                <span>퇴장 시각</span>
                <span>체류 시간</span>
              </div>

              {/* 데이터 행 */}
              {data && data.items.length > 0 ? (
                data.items.map((item) => (
                  <div
                    key={item.id}
                    className="grid grid-cols-4 gap-2 items-center text-sm py-1"
                  >
                    <span className="truncate font-medium">
                      {item.channelName}
                    </span>
                    <span className="text-muted-foreground">
                      {new Date(item.joinAt).toLocaleString("ko-KR")}
                    </span>
                    <span className="text-muted-foreground">
                      {item.leftAt === null ? (
                        <Badge variant="secondary">접속 중</Badge>
                      ) : (
                        new Date(item.leftAt).toLocaleString("ko-KR")
                      )}
                    </span>
                    <span>
                      {item.durationSec === null
                        ? "-"
                        : formatDuration(item.durationSec)}
                    </span>
                  </div>
                ))
              ) : (
                <p className="py-8 text-center text-muted-foreground">
                  데이터가 없습니다
                </p>
              )}
            </div>

            {/* 페이지네이션 */}
            {data && data.total > 0 && (
              <div className="mt-4 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {currentPage} / {totalPages} 페이지 (총 {data.total}건)
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage <= 1}
                    onClick={() => onPageChange(currentPage - 1)}
                  >
                    이전
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage >= totalPages}
                    onClick={() => onPageChange(currentPage + 1)}
                  >
                    다음
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
