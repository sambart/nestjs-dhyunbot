"use client";

import type { InactiveMemberItem } from "@/app/lib/inactive-member-api";
import {
  formatMinutes,
  gradeBadgeClass,
  gradeLabel,
} from "@/app/lib/inactive-member-api";
import { Card, CardContent } from "@/components/ui/card";

interface Props {
  items: InactiveMemberItem[];
  selectedIds: Set<string>;
  onToggleSelect: (userId: string) => void;
  onToggleAll: (checked: boolean) => void;
}

function formatIsoToDate(iso: string | null): string {
  if (!iso) return '-';
  const date = new Date(iso);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function InactiveMemberTable({
  items,
  selectedIds,
  onToggleSelect,
  onToggleAll,
}: Props) {
  const isAllSelected =
    items.length > 0 && items.every((item) => selectedIds.has(item.userId));

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left w-10">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={(e) => onToggleAll(e.target.checked)}
                    aria-label="전체 선택"
                    className="rounded border-gray-300"
                  />
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  닉네임
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  등급
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  마지막 접속일
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  접속 시간
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  등급 변경일
                </th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-10 text-center text-muted-foreground"
                  >
                    비활동 회원이 없습니다.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr
                    key={item.userId}
                    className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(item.userId)}
                        onChange={() => onToggleSelect(item.userId)}
                        aria-label={`${item.nickName} 선택`}
                        className="rounded border-gray-300"
                      />
                    </td>
                    <td className="px-4 py-3 font-medium">{item.nickName}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${gradeBadgeClass(item.grade)}`}
                      >
                        {gradeLabel(item.grade)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {item.lastVoiceDate ?? '없음'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatMinutes(item.totalMinutes)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatIsoToDate(item.gradeChangedAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
