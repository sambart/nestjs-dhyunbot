'use client';

import { useCallback, useEffect, useState } from 'react';

import type { DiscordRole } from '../../../../../lib/discord-api';
import type {
  MissionHistoryResponse,
  MissionItem,
  MissionStatusType,
} from '../../../../../lib/newbie-api';
import {
  completeMission,
  failMission,
  fetchActiveMissions,
  fetchMissionHistory,
  hideMission,
} from '../../../../../lib/newbie-api';

interface MissionManageTabProps {
  guildId: string;
  roles: DiscordRole[];
}

// ─── 성공 처리 모달 ──────────────────────────────────────────────────────────

interface CompleteModalProps {
  mission: MissionItem;
  roles: DiscordRole[];
  guildId: string;
  onClose: () => void;
  onDone: () => void;
}

function CompleteModal({ mission, roles, guildId, onClose, onDone }: CompleteModalProps) {
  const [roleId, setRoleId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await completeMission(guildId, mission.id, roleId || null);
      if (result.warning) {
        setError(result.warning);
        setTimeout(() => { onDone(); onClose(); }, 2000);
      } else {
        onDone();
        onClose();
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">성공 처리</h3>
        <p className="text-sm text-gray-600 mb-4">
          멤버 <span className="font-mono text-indigo-600">{mission.memberId}</span>의 미션을 성공 처리합니다.
        </p>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            역할 부여 (옵션)
          </label>
          <select
            value={roleId}
            onChange={(e) => setRoleId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">역할 부여 안함</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>

        {error && <p className="text-sm text-amber-600 mb-3">{error}</p>}

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-4 py-2 text-sm text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? '처리 중...' : '성공 처리'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 실패 처리 모달 ──────────────────────────────────────────────────────────

interface FailModalProps {
  mission: MissionItem;
  guildId: string;
  onClose: () => void;
  onDone: () => void;
}

function FailModal({ mission, guildId, onClose, onDone }: FailModalProps) {
  const [kick, setKick] = useState(false);
  const [dmReason, setDmReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await failMission(guildId, mission.id, kick, dmReason || null);
      if (result.warning) {
        setError(result.warning);
        setTimeout(() => { onDone(); onClose(); }, 2000);
      } else {
        onDone();
        onClose();
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">실패 처리</h3>
        <p className="text-sm text-gray-600 mb-4">
          멤버 <span className="font-mono text-indigo-600">{mission.memberId}</span>의 미션을 실패 처리합니다.
        </p>

        <div className="mb-4">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={kick}
              onChange={(e) => setKick(e.target.checked)}
              className="rounded border-gray-300 text-red-600 focus:ring-red-500"
            />
            서버에서 강퇴
          </label>
        </div>

        {kick && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              DM 사유 메시지 (옵션)
            </label>
            <textarea
              value={dmReason}
              onChange={(e) => setDmReason(e.target.value)}
              placeholder="강퇴 전 멤버에게 보낼 메시지"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
            />
          </div>
        )}

        {error && <p className="text-sm text-amber-600 mb-3">{error}</p>}

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-4 py-2 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? '처리 중...' : '실패 처리'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 상태 뱃지 ───────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: MissionStatusType }) {
  const styles: Record<MissionStatusType, string> = {
    IN_PROGRESS: 'bg-yellow-100 text-yellow-800',
    COMPLETED: 'bg-green-100 text-green-800',
    FAILED: 'bg-red-100 text-red-800',
    LEFT: 'bg-gray-100 text-gray-800',
  };
  const labels: Record<MissionStatusType, string> = {
    IN_PROGRESS: '진행중',
    COMPLETED: '완료',
    FAILED: '실패',
    LEFT: '퇴장',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

// ─── 날짜 포맷 ───────────────────────────────────────────────────────────────

function formatDate(yyyymmdd: string): string {
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
}

function formatPlaytime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (m === 0) return `${h}시간`;
  return `${h}시간 ${m}분`;
}

// ─── 미션 행 ─────────────────────────────────────────────────────────────────

interface MissionRowProps {
  mission: MissionItem;
  guildId: string;
  roles: DiscordRole[];
  onRefresh: () => void;
  showActions: boolean;
  showEmbed: boolean;
}

function MissionRow({ mission, guildId, roles, onRefresh, showActions, showEmbed }: MissionRowProps) {
  const [completeModal, setCompleteModal] = useState(false);
  const [failModal, setFailModal] = useState(false);
  const [hiding, setHiding] = useState(false);

  const handleHide = async () => {
    setHiding(true);
    try {
      await hideMission(guildId, mission.id);
      onRefresh();
    } catch {
      // silently fail
    } finally {
      setHiding(false);
    }
  };

  return (
    <>
      <tr className="border-b border-gray-100 hover:bg-gray-50">
        <td className="px-4 py-3 text-sm font-mono text-gray-700">{mission.memberId}</td>
        <td className="px-4 py-3 text-sm text-gray-600">{formatDate(mission.startDate)}</td>
        <td className="px-4 py-3 text-sm text-gray-600">{formatDate(mission.endDate)}</td>
        <td className="px-4 py-3 text-sm text-gray-600">{formatPlaytime(mission.targetPlaytimeSec)}</td>
        <td className="px-4 py-3"><StatusBadge status={mission.status} /></td>
        {showEmbed && (
          <td className="px-4 py-3 text-sm text-gray-500">
            {mission.hiddenFromEmbed ? '숨김' : '-'}
          </td>
        )}
        {showActions && (
          <td className="px-4 py-3">
            <div className="flex gap-1">
              {mission.status === 'IN_PROGRESS' && (
                <>
                  <button
                    onClick={() => setCompleteModal(true)}
                    className="px-2 py-1 text-xs text-green-700 bg-green-50 rounded hover:bg-green-100"
                  >
                    성공
                  </button>
                  <button
                    onClick={() => setFailModal(true)}
                    className="px-2 py-1 text-xs text-red-700 bg-red-50 rounded hover:bg-red-100"
                  >
                    실패
                  </button>
                </>
              )}
              {!mission.hiddenFromEmbed && mission.status !== 'LEFT' && (
                <button
                  onClick={handleHide}
                  disabled={hiding}
                  className="px-2 py-1 text-xs text-gray-700 bg-gray-50 rounded hover:bg-gray-100 disabled:opacity-50"
                >
                  숨김
                </button>
              )}
            </div>
          </td>
        )}
      </tr>

      {completeModal && (
        <CompleteModal
          mission={mission}
          roles={roles}
          guildId={guildId}
          onClose={() => setCompleteModal(false)}
          onDone={onRefresh}
        />
      )}
      {failModal && (
        <FailModal
          mission={mission}
          guildId={guildId}
          onClose={() => setFailModal(false)}
          onDone={onRefresh}
        />
      )}
    </>
  );
}

// ─── 메인 컴포넌트 ───────────────────────────────────────────────────────────

export default function MissionManageTab({ guildId, roles }: MissionManageTabProps) {
  // 섹션 1: 진행 중 미션
  const [activeMissions, setActiveMissions] = useState<MissionItem[]>([]);
  const [activeLoading, setActiveLoading] = useState(true);

  // 섹션 2: 전체 이력
  const [history, setHistory] = useState<MissionHistoryResponse | null>(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<MissionStatusType | ''>('');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const loadActive = useCallback(async () => {
    setActiveLoading(true);
    const missions = await fetchActiveMissions(guildId);
    setActiveMissions(missions);
    setActiveLoading(false);
  }, [guildId]);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const data = await fetchMissionHistory(
        guildId,
        statusFilter || undefined,
        page,
        pageSize,
      );
      setHistory(data);
    } catch {
      setHistory(null);
    }
    setHistoryLoading(false);
  }, [guildId, statusFilter, page]);

  useEffect(() => { loadActive(); }, [loadActive]);
  useEffect(() => { loadHistory(); }, [loadHistory]);

  const handleRefresh = () => {
    loadActive();
    loadHistory();
  };

  const totalPages = history ? Math.max(1, Math.ceil(history.total / pageSize)) : 1;

  return (
    <div className="space-y-8">
      {/* ───── 섹션 1: 진행 중 미션 ───── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900">
            진행 중 미션
            {!activeLoading && (
              <span className="ml-1 text-gray-400 font-normal">({activeMissions.length})</span>
            )}
          </h3>
          <button
            onClick={handleRefresh}
            className="text-xs text-indigo-600 hover:text-indigo-800"
          >
            새로고침
          </button>
        </div>

        {activeLoading ? (
          <p className="text-sm text-gray-400">불러오는 중...</p>
        ) : activeMissions.length === 0 ? (
          <p className="text-sm text-gray-400">진행 중인 미션이 없습니다.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">멤버 ID</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">시작일</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">마감일</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">목표</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">상태</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">액션</th>
                </tr>
              </thead>
              <tbody>
                {activeMissions.map((m) => (
                  <MissionRow
                    key={m.id}
                    mission={m}
                    guildId={guildId}
                    roles={roles}
                    onRefresh={handleRefresh}
                    showActions
                    showEmbed={false}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ───── 섹션 2: 전체 이력 ───── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900">전체 이력</h3>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as MissionStatusType | '');
              setPage(1);
            }}
            className="text-sm px-3 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">전체</option>
            <option value="IN_PROGRESS">진행중</option>
            <option value="COMPLETED">완료</option>
            <option value="FAILED">실패</option>
            <option value="LEFT">퇴장</option>
          </select>
        </div>

        {historyLoading ? (
          <p className="text-sm text-gray-400">불러오는 중...</p>
        ) : !history || history.items.length === 0 ? (
          <p className="text-sm text-gray-400">미션 이력이 없습니다.</p>
        ) : (
          <>
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">멤버 ID</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">시작일</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">마감일</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">목표</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">상태</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Embed</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">액션</th>
                  </tr>
                </thead>
                <tbody>
                  {history.items.map((m) => (
                    <MissionRow
                      key={m.id}
                      mission={m}
                      guildId={guildId}
                      roles={roles}
                      onRefresh={handleRefresh}
                      showActions
                      showEmbed
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {/* 페이지네이션 */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-4">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  이전
                </button>
                <span className="text-sm text-gray-600">
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  다음
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
