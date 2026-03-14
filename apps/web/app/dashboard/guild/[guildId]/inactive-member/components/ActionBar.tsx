"use client";

import { LogOut, MessageSquare, UserMinus, UserPlus } from "lucide-react";
import { useCallback, useState } from "react";

import type { ActionType } from "@/app/lib/inactive-member-api";

interface Props {
  selectedCount: number;
  isActing: boolean;
  actionResult: { successCount: number; failCount: number } | null;
  actionError: string | null;
  onAction: (actionType: ActionType) => void;
}

const KICK_CONFIRM_TEXT = "강제퇴장";

export default function ActionBar({
  selectedCount,
  isActing,
  actionResult,
  actionError,
  onAction,
}: Props) {
  const isDisabled = selectedCount === 0 || isActing;

  const [isKickModalOpen, setIsKickModalOpen] = useState(false);
  const [kickConfirmInput, setKickConfirmInput] = useState("");

  const handleKickClick = useCallback(() => {
    setIsKickModalOpen(true);
    setKickConfirmInput("");
  }, []);

  const handleKickConfirm = useCallback(() => {
    if (kickConfirmInput !== KICK_CONFIRM_TEXT) return;
    setIsKickModalOpen(false);
    setKickConfirmInput("");
    onAction("ACTION_KICK");
  }, [kickConfirmInput, onAction]);

  const handleKickCancel = useCallback(() => {
    setIsKickModalOpen(false);
    setKickConfirmInput("");
  }, []);

  return (
    <>
      <div className="rounded-lg border bg-card p-3 flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-muted-foreground">
          {selectedCount > 0 ? (
            <span className="font-medium text-foreground">{selectedCount}명</span>
          ) : (
            '0명'
          )}{' '}
          선택됨
        </span>

        <div className="flex items-center gap-2 flex-wrap">
          {actionResult && (
            <span className="text-sm text-green-600 font-medium">
              성공 {actionResult.successCount}명 / 실패 {actionResult.failCount}명
            </span>
          )}
          {actionError && (
            <span className="text-sm text-red-600 font-medium">{actionError}</span>
          )}

          <button
            type="button"
            onClick={() => onAction('ACTION_DM')}
            disabled={isDisabled}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <MessageSquare className="w-4 h-4" />
            DM 전송
          </button>

          <button
            type="button"
            onClick={() => onAction('ACTION_ROLE_ADD')}
            disabled={isDisabled}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            역할 부여
          </button>

          <button
            type="button"
            onClick={() => onAction('ACTION_ROLE_REMOVE')}
            disabled={isDisabled}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <UserMinus className="w-4 h-4" />
            역할 제거
          </button>

          <button
            type="button"
            onClick={handleKickClick}
            disabled={isDisabled}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-800 text-white text-sm font-medium hover:bg-red-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <LogOut className="w-4 h-4" />
            강제퇴장
          </button>
        </div>
      </div>

      {/* 강제퇴장 확인 모달 */}
      {isKickModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-gray-900">
            <h2 className="text-lg font-bold text-red-700 dark:text-red-400">
              강제퇴장 확인
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              선택된 <span className="font-semibold text-foreground">{selectedCount}명</span>을
              서버에서 강제퇴장합니다.
              이 작업은 되돌릴 수 없습니다.
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              계속하려면 아래에{" "}
              <span className="font-mono font-semibold text-red-600 dark:text-red-400">
                {KICK_CONFIRM_TEXT}
              </span>
              을 입력하세요.
            </p>
            <input
              type="text"
              value={kickConfirmInput}
              onChange={(e) => setKickConfirmInput(e.target.value)}
              placeholder={KICK_CONFIRM_TEXT}
              className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 dark:border-gray-700 dark:bg-gray-800"
              autoFocus
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={handleKickCancel}
                className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800 transition-colors"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleKickConfirm}
                disabled={kickConfirmInput !== KICK_CONFIRM_TEXT}
                className="px-4 py-2 rounded-lg bg-red-700 text-white text-sm font-medium hover:bg-red-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                강제퇴장 실행
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
