'use client';

import { BarChart3, Heart, Loader2, Server } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import type { GuildCoPresenceConfigSaveDto } from '../../../../lib/guild-co-presence-config-api';
import {
  fetchGuildCoPresenceConfig,
  saveGuildCoPresenceConfig,
} from '../../../../lib/guild-co-presence-config-api';
import { useSettings } from '../../../SettingsContext';

/** toast 자동 소멸 대기 시간(ms) */
const SAVE_SUCCESS_TOAST_MS = 3_000;

export default function CoPresenceConfigPage() {
  const { selectedGuildId } = useSettings();
  const t = useTranslations('settings');
  const tc = useTranslations('common');

  const [allowPublicAffinityQuery, setAllowPublicAffinityQuery] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // ─── 초기 데이터 로드 ─────────────────────────────────────────────────────

  useEffect(() => {
    if (!selectedGuildId) return;

    setIsLoading(true);
    setSaveError(null);

    fetchGuildCoPresenceConfig(selectedGuildId)
      .then((config) => {
        setAllowPublicAffinityQuery(config.allowPublicAffinityQuery);
      })
      .catch((err: unknown) => {
        console.error('Co-Presence 설정 조회 실패:', err);
        setAllowPublicAffinityQuery(false);
      })
      .finally(() => setIsLoading(false));
  }, [selectedGuildId]);

  // ─── 토글 변경 핸들러 ─────────────────────────────────────────────────────

  const handleToggleChange = () => {
    setAllowPublicAffinityQuery((prev) => !prev);
  };

  // ─── 저장 핸들러 ──────────────────────────────────────────────────────────

  const handleSaveClick = async () => {
    if (!selectedGuildId || isSaving) return;

    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    const dto: GuildCoPresenceConfigSaveDto = { allowPublicAffinityQuery };

    try {
      await saveGuildCoPresenceConfig(selectedGuildId, dto);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), SAVE_SUCCESS_TOAST_MS);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : t('common.saveError'));
    } finally {
      setIsSaving(false);
    }
  };

  // ─── 토글 렌더 헬퍼 ───────────────────────────────────────────────────────

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
        <h1 className="text-2xl font-bold text-gray-900 mb-6">{t('coPresence.title')}</h1>
        <section className="bg-white rounded-xl border border-gray-200 p-8">
          <div className="flex flex-col items-center text-center py-8">
            <Server className="w-12 h-12 text-gray-300 mb-4" />
            <p className="text-sm text-gray-500">{t('common.selectServer')}</p>
          </div>
        </section>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="max-w-3xl">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">{t('coPresence.title')}</h1>
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
        </div>
      </div>
    );
  }

  // ─── 메인 렌더링 ──────────────────────────────────────────────────────────

  return (
    <div className="max-w-3xl">
      {/* 페이지 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <Heart className="w-6 h-6 text-indigo-600" />
          <h1 className="text-2xl font-bold text-gray-900">{t('coPresence.title')}</h1>
        </div>
        <Link
          href={`/dashboard/guild/${selectedGuildId}/co-presence`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-colors"
        >
          <BarChart3 className="w-4 h-4" />
          <span>{tc('sidebar.crosslink.dashboard')}</span>
        </Link>
      </div>

      <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
        {/* /affinity 권한 정책 섹션 */}
        <div>
          <h2 className="text-sm font-semibold text-gray-900 mb-4">
            {t('coPresence.policySection')}
          </h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">
                {t('coPresence.allowPublicAffinityQuery')}
              </p>
              <p className="text-xs text-gray-500 mt-0.5 max-w-md">
                {t('coPresence.allowPublicAffinityQueryDesc')}
              </p>
            </div>
            {renderToggle(allowPublicAffinityQuery, handleToggleChange)}
          </div>
        </div>

        {/* 저장 피드백 + 저장 버튼 */}
        <div className="flex items-center justify-between gap-4 pt-4 border-t border-gray-100">
          <div className="flex-1">
            {saveSuccess && (
              <p className="text-sm text-green-600 font-medium">{t('coPresence.savedToast')}</p>
            )}
            {saveError && <p className="text-sm text-red-600 font-medium">{saveError}</p>}
          </div>
          <button
            type="button"
            onClick={() => {
              void handleSaveClick();
            }}
            disabled={isSaving}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium text-sm"
          >
            {isSaving ? t('common.saving') : t('coPresence.saveButton')}
          </button>
        </div>
      </section>
    </div>
  );
}
