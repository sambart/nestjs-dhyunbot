'use client';

import { HeartPulse, Loader2, Server } from 'lucide-react';
import { useEffect, useState } from 'react';

import type { VoiceHealthConfig } from '../../../../lib/voice-health-api';
import { fetchVoiceHealthConfig, saveVoiceHealthConfig } from '../../../../lib/voice-health-api';
import { useSettings } from '../../../SettingsContext';

const DEFAULT_CONFIG: VoiceHealthConfig = {
  isEnabled: false,
  analysisDays: 30,
  isCooldownEnabled: true,
  cooldownHours: 24,
  isLlmSummaryEnabled: false,
  minActivityMinutes: 600,
  minActiveDaysRatio: 0.5,
  hhiThreshold: 0.3,
  minPeerCount: 3,
  badgeActivityTopPercent: 10,
  badgeSocialHhiMax: 0.25,
  badgeSocialMinPeers: 5,
  badgeHunterTopPercent: 10,
  badgeConsistentMinRatio: 0.8,
  badgeMicMinRate: 0.7,
};

export default function VoiceHealthSettingsPage() {
  const { selectedGuildId } = useSettings();

  const [form, setForm] = useState<VoiceHealthConfig>(DEFAULT_CONFIG);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // ─── 초기 데이터 로드 ─────────────────────────────────────────────────────

  useEffect(() => {
    if (!selectedGuildId) return;

    setIsLoading(true);
    fetchVoiceHealthConfig(selectedGuildId)
      .then((config) => setForm({
        ...config,
        minActiveDaysRatio: Number(config.minActiveDaysRatio),
        hhiThreshold: Number(config.hhiThreshold),
        badgeSocialHhiMax: Number(config.badgeSocialHhiMax),
        badgeConsistentMinRatio: Number(config.badgeConsistentMinRatio),
        badgeMicMinRate: Number(config.badgeMicMinRate),
      }))
      .catch(() => setForm(DEFAULT_CONFIG))
      .finally(() => setIsLoading(false));
  }, [selectedGuildId]);

  // ─── 폼 헬퍼 ────────────────────────────────────────────────────────────

  const updateForm = <K extends keyof VoiceHealthConfig>(
    key: K,
    value: VoiceHealthConfig[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  // ─── 저장 핸들러 ──────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!selectedGuildId || isSaving) return;
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      await saveVoiceHealthConfig(selectedGuildId, form);
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
        <h1 className="text-2xl font-bold text-gray-900 mb-6">자가진단 설정</h1>
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
        <h1 className="text-2xl font-bold text-gray-900 mb-6">자가진단 설정</h1>
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
      <div className="flex items-center space-x-3 mb-6">
        <HeartPulse className="w-6 h-6 text-indigo-600" />
        <h1 className="text-2xl font-bold text-gray-900">자가진단 설정</h1>
      </div>

      <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-8">

        {/* 섹션 1: 기본 설정 */}
        <div>
          <h2 className="text-sm font-semibold text-gray-900 mb-4">기본 설정</h2>
          <div className="space-y-4">

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">기능 활성화</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  자가진단 기능을 활성화합니다.
                </p>
              </div>
              {renderToggle(form.isEnabled, () => updateForm('isEnabled', !form.isEnabled))}
            </div>

            <div>
              <label
                htmlFor="analysis-days"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                분석 기간 (일)
              </label>
              <p className="text-xs text-gray-500 mb-1">
                음성 활동을 분석할 기간입니다. (7~90일)
              </p>
              <input
                id="analysis-days"
                type="number"
                min={7}
                max={90}
                value={form.analysisDays}
                onChange={(e) => updateForm('analysisDays', Number(e.target.value))}
                className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">쿨다운 활성화</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  동일 사용자의 연속 진단을 제한합니다.
                </p>
              </div>
              {renderToggle(
                form.isCooldownEnabled,
                () => updateForm('isCooldownEnabled', !form.isCooldownEnabled),
              )}
            </div>

            {form.isCooldownEnabled && (
              <div>
                <label
                  htmlFor="cooldown-hours"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  쿨다운 시간 (시간)
                </label>
                <p className="text-xs text-gray-500 mb-1">
                  자가진단을 다시 실행하기까지 대기 시간입니다. (1~168시간)
                </p>
                <input
                  id="cooldown-hours"
                  type="number"
                  min={1}
                  max={168}
                  value={form.cooldownHours}
                  onChange={(e) => updateForm('cooldownHours', Number(e.target.value))}
                  className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            )}

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">AI 요약 활성화</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  LLM을 사용하여 자가진단 결과 요약 메시지를 생성합니다.
                </p>
              </div>
              {renderToggle(
                form.isLlmSummaryEnabled,
                () => updateForm('isLlmSummaryEnabled', !form.isLlmSummaryEnabled),
              )}
            </div>
          </div>
        </div>

        <hr className="border-gray-100" />

        {/* 섹션 2: 정책 기준 */}
        <div>
          <h2 className="text-sm font-semibold text-gray-900 mb-4">정책 기준</h2>
          <div className="space-y-4">

            <div>
              <label
                htmlFor="min-activity-minutes"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                최소 활동 시간 (분)
              </label>
              <p className="text-xs text-gray-500 mb-1">
                분석 기간 내 최소 음성 활동 시간입니다.
              </p>
              <input
                id="min-activity-minutes"
                type="number"
                min={1}
                value={form.minActivityMinutes}
                onChange={(e) => updateForm('minActivityMinutes', Number(e.target.value))}
                className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                최소 활동일 비율:{' '}
                <span className="text-indigo-600 font-semibold">
                  {Math.round(form.minActiveDaysRatio * 100)}%
                </span>
              </label>
              <p className="text-xs text-gray-500 mb-1">
                분석 기간 중 최소 활동일 비율입니다.
              </p>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={Math.round(form.minActiveDaysRatio * 100)}
                onChange={(e) =>
                  updateForm('minActiveDaysRatio', Number(e.target.value) / 100)
                }
                className="w-full accent-indigo-600"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                HHI 임계값:{' '}
                <span className="text-indigo-600 font-semibold">
                  {form.hhiThreshold.toFixed(2)}
                </span>
              </label>
              <p className="text-xs text-gray-500 mb-1">
                허핀달-허쉬만 지수(채널 집중도) 임계값입니다. (0.00~1.00)
              </p>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={Math.round(form.hhiThreshold * 100)}
                onChange={(e) =>
                  updateForm('hhiThreshold', Number(e.target.value) / 100)
                }
                className="w-full accent-indigo-600"
              />
            </div>

            <div>
              <label
                htmlFor="min-peer-count"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                최소 교류 인원
              </label>
              <p className="text-xs text-gray-500 mb-1">
                사회성 판정에 필요한 최소 교류 인원입니다.
              </p>
              <input
                id="min-peer-count"
                type="number"
                min={1}
                value={form.minPeerCount}
                onChange={(e) => updateForm('minPeerCount', Number(e.target.value))}
                className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        <hr className="border-gray-100" />

        {/* 섹션 3: 뱃지 기준 */}
        <div>
          <h2 className="text-sm font-semibold text-gray-900 mb-4">뱃지 기준</h2>
          <div className="space-y-4">

            <div>
              <label
                htmlFor="badge-activity-top-percent"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                활동왕 기준 상위 (%)
              </label>
              <p className="text-xs text-gray-500 mb-1">
                전체 사용자 중 상위 N%에 해당하면 활동왕 뱃지를 부여합니다. (1~100)
              </p>
              <input
                id="badge-activity-top-percent"
                type="number"
                min={1}
                max={100}
                value={form.badgeActivityTopPercent}
                onChange={(e) => updateForm('badgeActivityTopPercent', Number(e.target.value))}
                className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                사교왕 HHI 상한:{' '}
                <span className="text-indigo-600 font-semibold">
                  {form.badgeSocialHhiMax.toFixed(2)}
                </span>
              </label>
              <p className="text-xs text-gray-500 mb-1">
                HHI가 이 값 이하일 때 사교왕 뱃지 조건을 충족합니다. (0.00~1.00)
              </p>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={Math.round(form.badgeSocialHhiMax * 100)}
                onChange={(e) =>
                  updateForm('badgeSocialHhiMax', Number(e.target.value) / 100)
                }
                className="w-full accent-indigo-600"
              />
            </div>

            <div>
              <label
                htmlFor="badge-social-min-peers"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                사교왕 최소 교류 인원
              </label>
              <p className="text-xs text-gray-500 mb-1">
                사교왕 뱃지 부여에 필요한 최소 교류 인원입니다.
              </p>
              <input
                id="badge-social-min-peers"
                type="number"
                min={1}
                value={form.badgeSocialMinPeers}
                onChange={(e) => updateForm('badgeSocialMinPeers', Number(e.target.value))}
                className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label
                htmlFor="badge-hunter-top-percent"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                헌터 기준 상위 (%)
              </label>
              <p className="text-xs text-gray-500 mb-1">
                채널 탐험 수 기준 상위 N%에 해당하면 헌터 뱃지를 부여합니다. (1~100)
              </p>
              <input
                id="badge-hunter-top-percent"
                type="number"
                min={1}
                max={100}
                value={form.badgeHunterTopPercent}
                onChange={(e) => updateForm('badgeHunterTopPercent', Number(e.target.value))}
                className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                꾸준러 최소 활동일 비율:{' '}
                <span className="text-indigo-600 font-semibold">
                  {Math.round(form.badgeConsistentMinRatio * 100)}%
                </span>
              </label>
              <p className="text-xs text-gray-500 mb-1">
                이 비율 이상 활동일을 채우면 꾸준러 뱃지를 부여합니다.
              </p>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={Math.round(form.badgeConsistentMinRatio * 100)}
                onChange={(e) =>
                  updateForm('badgeConsistentMinRatio', Number(e.target.value) / 100)
                }
                className="w-full accent-indigo-600"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                소통러 최소 마이크 사용률:{' '}
                <span className="text-indigo-600 font-semibold">
                  {Math.round(form.badgeMicMinRate * 100)}%
                </span>
              </label>
              <p className="text-xs text-gray-500 mb-1">
                이 비율 이상 마이크를 켜면 소통러 뱃지를 부여합니다.
              </p>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={Math.round(form.badgeMicMinRate * 100)}
                onChange={(e) =>
                  updateForm('badgeMicMinRate', Number(e.target.value) / 100)
                }
                className="w-full accent-indigo-600"
              />
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
            onClick={() => { void handleSave(); }}
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
