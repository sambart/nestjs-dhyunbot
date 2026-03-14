'use client';

import { Check, ChevronDown, Loader2, RefreshCw, Server, UserX } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import type { DiscordRole } from '../../../../lib/discord-api';
import { fetchGuildRoles } from '../../../../lib/discord-api';
import type { InactiveMemberConfig, InactiveMemberConfigSaveDto } from '../../../../lib/inactive-member-api';
import {
  fetchInactiveMemberConfig,
  saveInactiveMemberConfig,
} from '../../../../lib/inactive-member-api';
import { useSettings } from '../../../SettingsContext';

const DEFAULT_EMBED_COLOR = '#5865F2';

const PERIOD_DAYS_OPTIONS = [7, 14, 30] as const;

export default function InactiveMemberSettingsPage() {
  const { selectedGuildId } = useSettings();

  const [form, setForm] = useState<InactiveMemberConfigSaveDto>({
    periodDays: 30,
    lowActiveThresholdMin: 30,
    decliningPercent: 50,
    autoActionEnabled: false,
    autoRoleAdd: false,
    autoDm: false,
    inactiveRoleId: null,
    removeRoleId: null,
    excludedRoleIds: [],
    dmEmbedTitle: null,
    dmEmbedBody: null,
    dmEmbedColor: DEFAULT_EMBED_COLOR,
  });

  const [roles, setRoles] = useState<DiscordRole[]>([]);
  const [isExcludeDropdownOpen, setIsExcludeDropdownOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const excludeDropdownRef = useRef<HTMLDivElement>(null);

  // ─── 드롭다운 외부 클릭 닫기 ─────────────────────────────────────────────

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        excludeDropdownRef.current &&
        !excludeDropdownRef.current.contains(e.target as Node)
      ) {
        setIsExcludeDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ─── 초기 데이터 로드 ─────────────────────────────────────────────────────

  useEffect(() => {
    if (!selectedGuildId) return;

    setIsLoading(true);

    Promise.all([
      fetchInactiveMemberConfig(selectedGuildId).catch(
        (): InactiveMemberConfig => ({
          id: 0,
          guildId: selectedGuildId,
          periodDays: 30,
          lowActiveThresholdMin: 30,
          decliningPercent: 50,
          autoActionEnabled: false,
          autoRoleAdd: false,
          autoDm: false,
          inactiveRoleId: null,
          removeRoleId: null,
          excludedRoleIds: [],
          dmEmbedTitle: null,
          dmEmbedBody: null,
          dmEmbedColor: DEFAULT_EMBED_COLOR,
          createdAt: '',
          updatedAt: '',
        }),
      ),
      fetchGuildRoles(selectedGuildId).catch((): DiscordRole[] => []),
    ])
      .then(([config, fetchedRoles]) => {
        setForm({
          periodDays: config.periodDays,
          lowActiveThresholdMin: config.lowActiveThresholdMin,
          decliningPercent: config.decliningPercent,
          autoActionEnabled: config.autoActionEnabled,
          autoRoleAdd: config.autoRoleAdd,
          autoDm: config.autoDm,
          inactiveRoleId: config.inactiveRoleId,
          removeRoleId: config.removeRoleId,
          excludedRoleIds: config.excludedRoleIds,
          dmEmbedTitle: config.dmEmbedTitle,
          dmEmbedBody: config.dmEmbedBody,
          dmEmbedColor: config.dmEmbedColor ?? DEFAULT_EMBED_COLOR,
        });
        setRoles(fetchedRoles);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [selectedGuildId]);

  // ─── 역할 새로고침 ────────────────────────────────────────────────────────

  const refreshRoles = async () => {
    if (!selectedGuildId || isRefreshing) return;
    setIsRefreshing(true);
    try {
      const freshRoles = await fetchGuildRoles(selectedGuildId, true).catch(
        (): DiscordRole[] => [],
      );
      setRoles(freshRoles);
    } finally {
      setIsRefreshing(false);
    }
  };

  // ─── 폼 헬퍼 ────────────────────────────────────────────────────────────

  const updateForm = <K extends keyof InactiveMemberConfigSaveDto>(
    key: K,
    value: InactiveMemberConfigSaveDto[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const toggleExcludedRole = (roleId: string) => {
    const current = form.excludedRoleIds ?? [];
    if (current.includes(roleId)) {
      updateForm('excludedRoleIds', current.filter((id) => id !== roleId));
    } else {
      updateForm('excludedRoleIds', [...current, roleId]);
    }
  };

  // ─── 저장 핸들러 ──────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!selectedGuildId || isSaving) return;
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      await saveInactiveMemberConfig(selectedGuildId, form);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3_000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : '저장에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  // ─── 토글 컴포넌트 (인라인) ────────────────────────────────────────────────

  const renderToggle = (checked: boolean, onToggle: () => void) => (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onToggle}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
        checked ? 'bg-indigo-600' : 'bg-gray-200'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );

  // ─── 조건부 렌더링 ────────────────────────────────────────────────────────

  if (!selectedGuildId) {
    return (
      <div className="max-w-3xl">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">비활동 회원 설정</h1>
        <section className="bg-white rounded-xl border border-gray-200 p-8">
          <div className="flex flex-col items-center text-center py-8">
            <Server className="w-12 h-12 text-gray-300 mb-4" />
            <p className="text-sm text-gray-500">사이드바에서 서버를 선택하세요.</p>
          </div>
        </section>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="max-w-3xl">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">비활동 회원 설정</h1>
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
        </div>
      </div>
    );
  }

  const excludedRoleIds = form.excludedRoleIds ?? [];
  const embedColor = form.dmEmbedColor ?? DEFAULT_EMBED_COLOR;

  // ─── 메인 렌더링 ──────────────────────────────────────────────────────────

  return (
    <div className="max-w-3xl">
      {/* 페이지 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <UserX className="w-6 h-6 text-indigo-600" />
          <h1 className="text-2xl font-bold text-gray-900">비활동 회원 설정</h1>
        </div>
        <button
          type="button"
          onClick={refreshRoles}
          disabled={isRefreshing}
          title="역할 목록 새로고침"
          className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span>역할 새로고침</span>
        </button>
      </div>

      <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-8">

        {/* 섹션 1: 비활동 판정 기준 */}
        <div>
          <h2 className="text-sm font-semibold text-gray-900 mb-4">비활동 판정 기준</h2>
          <div className="space-y-4">

            {/* 판단 기간 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                판단 기간
              </label>
              <div className="flex gap-4">
                {PERIOD_DAYS_OPTIONS.map((day) => (
                  <label key={day} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="periodDays"
                      value={day}
                      checked={form.periodDays === day}
                      onChange={() => updateForm('periodDays', day)}
                      className="accent-indigo-600"
                    />
                    <span className="text-sm text-gray-700">{day}일</span>
                  </label>
                ))}
              </div>
            </div>

            {/* 저활동 임계값 */}
            <div>
              <label
                htmlFor="low-active-threshold"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                저활동 임계값 (분)
              </label>
              <p className="text-xs text-gray-500 mb-1">
                판단 기간 내 총 접속 시간이 이 값 미만이면 저활동으로 분류됩니다.
              </p>
              <input
                id="low-active-threshold"
                type="number"
                min={0}
                value={form.lowActiveThresholdMin ?? 30}
                onChange={(e) =>
                  updateForm('lowActiveThresholdMin', Number(e.target.value))
                }
                className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* 활동 감소 비율 */}
            <div>
              <label
                htmlFor="declining-percent"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                활동 감소 판정 비율 (%)
              </label>
              <p className="text-xs text-gray-500 mb-1">
                이전 동일 기간 대비 접속 시간이 이 비율 이상 감소하면 활동 감소로 분류됩니다.
              </p>
              <input
                id="declining-percent"
                type="number"
                min={0}
                max={100}
                value={form.decliningPercent ?? 50}
                onChange={(e) =>
                  updateForm('decliningPercent', Number(e.target.value))
                }
                className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        <hr className="border-gray-100" />

        {/* 섹션 2: 자동 조치 설정 */}
        <div>
          <h2 className="text-sm font-semibold text-gray-900 mb-4">자동 조치 설정</h2>
          <div className="space-y-4">

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">자동 조치 활성화</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  스케줄러 실행 시 새로 완전 비활동으로 분류된 회원에게 자동 조치를 실행합니다.
                </p>
              </div>
              {renderToggle(
                form.autoActionEnabled ?? false,
                () => updateForm('autoActionEnabled', !(form.autoActionEnabled ?? false)),
              )}
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">자동 역할 부여</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  완전 비활동 판정 시 비활동 역할을 자동으로 부여합니다.
                </p>
              </div>
              {renderToggle(
                form.autoRoleAdd ?? false,
                () => updateForm('autoRoleAdd', !(form.autoRoleAdd ?? false)),
              )}
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">자동 DM 발송</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  완전 비활동 판정 시 DM 템플릿으로 자동 메시지를 발송합니다.
                </p>
              </div>
              {renderToggle(
                form.autoDm ?? false,
                () => updateForm('autoDm', !(form.autoDm ?? false)),
              )}
            </div>
          </div>
        </div>

        <hr className="border-gray-100" />

        {/* 섹션 3: 역할 설정 */}
        <div>
          <h2 className="text-sm font-semibold text-gray-900 mb-4">역할 설정</h2>
          <div className="space-y-4">

            <div>
              <label
                htmlFor="inactive-role"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                비활동 역할 (부여할 역할)
              </label>
              <select
                id="inactive-role"
                value={form.inactiveRoleId ?? ''}
                onChange={(e) =>
                  updateForm('inactiveRoleId', e.target.value || null)
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">선택 안함</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="remove-role"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                제거할 역할
              </label>
              <select
                id="remove-role"
                value={form.removeRoleId ?? ''}
                onChange={(e) =>
                  updateForm('removeRoleId', e.target.value || null)
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">선택 안함</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <hr className="border-gray-100" />

        {/* 섹션 4: 제외 역할 */}
        <div>
          <h2 className="text-sm font-semibold text-gray-900 mb-1">제외 역할</h2>
          <p className="text-xs text-gray-500 mb-4">
            비활동 판정에서 제외할 역할을 선택하세요. (예: 관리자, 봇 역할)
          </p>

          {/* 선택된 역할 태그 */}
          {excludedRoleIds.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {excludedRoleIds.map((roleId) => {
                const role = roles.find((r) => r.id === roleId);
                return (
                  <span
                    key={roleId}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-medium"
                  >
                    {role?.name ?? roleId}
                    <button
                      type="button"
                      onClick={() => toggleExcludedRole(roleId)}
                      aria-label={`${role?.name ?? roleId} 제외 해제`}
                      className="ml-0.5 text-indigo-500 hover:text-indigo-800"
                    >
                      ×
                    </button>
                  </span>
                );
              })}
            </div>
          )}

          {/* 멀티셀렉트 드롭다운 */}
          <div ref={excludeDropdownRef} className="relative">
            <button
              type="button"
              onClick={() => setIsExcludeDropdownOpen((prev) => !prev)}
              className="flex items-center justify-between w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-left focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              <span className="text-gray-500">
                {excludedRoleIds.length > 0
                  ? `${excludedRoleIds.length}개 역할 선택됨`
                  : '역할을 선택하세요'}
              </span>
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </button>

            {isExcludeDropdownOpen && (
              <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {roles.length === 0 ? (
                  <p className="px-3 py-2 text-sm text-gray-400">
                    역할 목록을 불러올 수 없습니다.
                  </p>
                ) : (
                  roles.map((role) => {
                    const isSelected = excludedRoleIds.includes(role.id);
                    return (
                      <button
                        key={role.id}
                        type="button"
                        onClick={() => toggleExcludedRole(role.id)}
                        className="flex items-center justify-between w-full px-3 py-2 text-sm hover:bg-gray-50 transition-colors"
                      >
                        <span className={isSelected ? 'text-indigo-700 font-medium' : 'text-gray-700'}>
                          {role.name}
                        </span>
                        {isSelected && <Check className="w-4 h-4 text-indigo-600" />}
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>

        <hr className="border-gray-100" />

        {/* 섹션 5: DM 템플릿 */}
        <div>
          <h2 className="text-sm font-semibold text-gray-900 mb-4">DM 템플릿</h2>
          <div className="space-y-4">

            {/* Embed 제목 */}
            <div>
              <label
                htmlFor="dm-embed-title"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Embed 제목
              </label>
              <input
                id="dm-embed-title"
                type="text"
                value={form.dmEmbedTitle ?? ''}
                onChange={(e) =>
                  updateForm('dmEmbedTitle', e.target.value || null)
                }
                placeholder="예: 활동 독려 안내"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Embed 본문 */}
            <div>
              <label
                htmlFor="dm-embed-body"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Embed 본문
              </label>
              <p className="text-xs text-gray-500 mb-1">
                사용 가능한 변수:{' '}
                <code className="bg-gray-100 px-1 rounded">{'{nickName}'}</code>,{' '}
                <code className="bg-gray-100 px-1 rounded">{'{serverName}'}</code>,{' '}
                <code className="bg-gray-100 px-1 rounded">{'{periodDays}'}</code>,{' '}
                <code className="bg-gray-100 px-1 rounded">{'{totalMinutes}'}</code>
              </p>
              <textarea
                id="dm-embed-body"
                rows={4}
                value={form.dmEmbedBody ?? ''}
                onChange={(e) =>
                  updateForm('dmEmbedBody', e.target.value || null)
                }
                placeholder="예: 안녕하세요 {nickName}님, {periodDays}일 동안 활동이 없으셨습니다."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
            </div>

            {/* Embed 색상 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Embed 색상
              </label>
              <div className="flex items-center space-x-3">
                <input
                  type="color"
                  value={embedColor}
                  onChange={(e) => updateForm('dmEmbedColor', e.target.value)}
                  aria-label="Embed 색상 피커"
                  className="h-9 w-16 border border-gray-300 rounded cursor-pointer p-1"
                />
                <input
                  type="text"
                  value={embedColor}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (/^#[0-9A-Fa-f]{0,6}$/.test(val)) {
                      updateForm('dmEmbedColor', val);
                    }
                  }}
                  maxLength={7}
                  placeholder="#5865F2"
                  aria-label="Embed 색상 HEX 코드"
                  className="w-28 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Embed 미리보기 */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">미리보기</p>
              <div className="bg-[#2B2D31] rounded-lg p-4">
                <div
                  className="bg-[#313338] rounded-md overflow-hidden"
                  style={{ borderLeft: `4px solid ${embedColor}` }}
                >
                  <div className="p-4">
                    <p className="text-white font-semibold text-sm mb-1 break-words">
                      {form.dmEmbedTitle || '(제목 없음)'}
                    </p>
                    <p className="text-gray-300 text-xs whitespace-pre-wrap break-words">
                      {(form.dmEmbedBody ?? '(본문 없음)')
                        .replace('{nickName}', '홍길동')
                        .replace('{serverName}', '테스트 서버')
                        .replace('{periodDays}', String(form.periodDays ?? 30))
                        .replace('{totalMinutes}', '0')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 저장 피드백 + 저장 버튼 */}
        <div className="flex items-center justify-between gap-4 pt-4 border-t border-gray-100">
          <div className="flex-1">
            {saveSuccess && (
              <p className="text-sm text-green-600 font-medium">저장되었습니다.</p>
            )}
            {saveError && (
              <p className="text-sm text-red-600 font-medium">{saveError}</p>
            )}
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium text-sm"
          >
            {isSaving ? '저장 중...' : '저장'}
          </button>
        </div>
      </section>
    </div>
  );
}
