'use client';

import { Loader2, RefreshCw, Server } from 'lucide-react';
import { useEffect, useState } from 'react';

import type { DiscordChannel, DiscordEmoji, DiscordRole } from '../../../../lib/discord-api';
import { fetchGuildEmojis, fetchGuildRoles, fetchGuildTextChannels } from '../../../../lib/discord-api';
import type { MissionTemplate, MocoTemplate, NewbieConfig } from '../../../../lib/newbie-api';
import {
  DEFAULT_MISSION_TEMPLATE,
  DEFAULT_MOCO_TEMPLATE,
  fetchMissionTemplate,
  fetchMocoTemplate,
  fetchNewbieConfig,
  saveMissionTemplate,
  saveMocoTemplate,
  saveNewbieConfig,
} from '../../../../lib/newbie-api';
import { validateMissionTemplate, validateMocoTemplate } from '../../../../lib/newbie-template-utils';
import { useSettings } from '../../../SettingsContext';
import MissionTab from './components/MissionTab';
import MocoTab from './components/MocoTab';
import RoleTab from './components/RoleTab';
import WelcomeTab from './components/WelcomeTab';

type TabId = 'welcome' | 'mission' | 'moco' | 'role';

const TABS: { id: TabId; label: string }[] = [
  { id: 'welcome', label: '환영인사 설정' },
  { id: 'mission', label: '미션 설정' },
  { id: 'moco', label: '모코코 사냥 설정' },
  { id: 'role', label: '신입기간 설정' },
];

const DEFAULT_CONFIG: NewbieConfig = {
  welcomeEnabled: false,
  welcomeChannelId: null,
  welcomeEmbedTitle: null,
  welcomeEmbedDescription: null,
  welcomeEmbedColor: '#5865F2',
  welcomeEmbedThumbnailUrl: null,
  missionEnabled: false,
  missionDurationDays: null,
  missionTargetPlaytimeHours: null,
  missionNotifyChannelId: null,
  mocoEnabled: false,
  mocoRankChannelId: null,
  mocoAutoRefreshMinutes: null,
  roleEnabled: false,
  roleDurationDays: null,
  newbieRoleId: null,
};

export default function NewbieSettingsPage() {
  const { selectedGuildId } = useSettings();
  const [config, setConfig] = useState<NewbieConfig>(DEFAULT_CONFIG);
  const [activeTab, setActiveTab] = useState<TabId>('welcome');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [channels, setChannels] = useState<DiscordChannel[]>([]);
  const [roles, setRoles] = useState<DiscordRole[]>([]);
  const [emojis, setEmojis] = useState<DiscordEmoji[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // 미션 템플릿 상태
  const [missionTemplate, setMissionTemplate] = useState<MissionTemplate>(DEFAULT_MISSION_TEMPLATE);
  const [isSavingMissionTemplate, setIsSavingMissionTemplate] = useState(false);
  const [missionTemplateSaveError, setMissionTemplateSaveError] = useState<string | null>(null);
  const [missionTemplateSaveSuccess, setMissionTemplateSaveSuccess] = useState(false);

  // 모코코 템플릿 상태
  const [mocoTemplate, setMocoTemplate] = useState<MocoTemplate>(DEFAULT_MOCO_TEMPLATE);
  const [isSavingMocoTemplate, setIsSavingMocoTemplate] = useState(false);
  const [mocoTemplateSaveError, setMocoTemplateSaveError] = useState<string | null>(null);
  const [mocoTemplateSaveSuccess, setMocoTemplateSaveSuccess] = useState(false);

  useEffect(() => {
    if (!selectedGuildId) return;

    setIsLoading(true);
    setConfigLoaded(false);
    setConfig(DEFAULT_CONFIG);
    setMissionTemplate(DEFAULT_MISSION_TEMPLATE);
    setMocoTemplate(DEFAULT_MOCO_TEMPLATE);

    Promise.all([
      fetchNewbieConfig(selectedGuildId).catch(() => null),
      fetchGuildTextChannels(selectedGuildId).catch(
        (): DiscordChannel[] => [],
      ),
      fetchGuildRoles(selectedGuildId).catch((): DiscordRole[] => []),
      fetchGuildEmojis(selectedGuildId).catch((): DiscordEmoji[] => []),
      fetchMissionTemplate(selectedGuildId).catch(() => null),
      fetchMocoTemplate(selectedGuildId).catch(() => null),
    ])
      .then(([cfg, chs, rls, ems, mTmpl, mocoTmpl]) => {
        if (cfg) setConfig(cfg);
        setChannels(chs);
        setRoles(rls);
        setEmojis(ems);
        if (mTmpl) setMissionTemplate(mTmpl);
        if (mocoTmpl) setMocoTemplate(mocoTmpl);
        setConfigLoaded(true);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [selectedGuildId]);

  const refreshChannels = async () => {
    if (!selectedGuildId || isRefreshing) return;
    setIsRefreshing(true);
    try {
      const [chs, rls, ems] = await Promise.all([
        fetchGuildTextChannels(selectedGuildId, true).catch((): DiscordChannel[] => []),
        fetchGuildRoles(selectedGuildId, true).catch((): DiscordRole[] => []),
        fetchGuildEmojis(selectedGuildId, true).catch((): DiscordEmoji[] => []),
      ]);
      setChannels(chs);
      setRoles(rls);
      setEmojis(ems);
    } finally {
      setIsRefreshing(false);
    }
  };

  const updateConfig = (partial: Partial<NewbieConfig>) => {
    setConfig((prev) => ({ ...prev, ...partial }));
  };

  const handleSave = async () => {
    if (!selectedGuildId || isSaving) return;

    // 채널 필수값 유효성 검사
    const errors: string[] = [];
    if (config.welcomeEnabled && !config.welcomeChannelId) {
      errors.push('환영인사 채널을 선택해주세요.');
    }
    if (config.missionEnabled && !config.missionNotifyChannelId) {
      errors.push('미션 알림 채널을 선택해주세요.');
    }
    if (config.mocoEnabled && !config.mocoRankChannelId) {
      errors.push('모코코 순위 채널을 선택해주세요.');
    }
    if (errors.length > 0) {
      setSaveError(errors.join(' '));
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      await saveNewbieConfig(selectedGuildId, config);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : '저장에 실패했습니다.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveMissionTemplate = async () => {
    if (!selectedGuildId || isSavingMissionTemplate) return;

    // 프론트엔드 유효성 검사
    const errors = validateMissionTemplate(missionTemplate);
    if (errors.size > 0) {
      const msgs = [...errors.entries()].map(
        ([field, vars]) => `${field}: 허용되지 않는 변수 ${vars.join(', ')}`,
      );
      setMissionTemplateSaveError(msgs.join('\n'));
      return;
    }

    setIsSavingMissionTemplate(true);
    setMissionTemplateSaveError(null);
    setMissionTemplateSaveSuccess(false);

    try {
      await saveMissionTemplate(selectedGuildId, missionTemplate);
      setMissionTemplateSaveSuccess(true);
      setTimeout(() => setMissionTemplateSaveSuccess(false), 3000);
    } catch (err) {
      setMissionTemplateSaveError(
        err instanceof Error ? err.message : '저장에 실패했습니다.',
      );
    } finally {
      setIsSavingMissionTemplate(false);
    }
  };

  const handleSaveMocoTemplate = async () => {
    if (!selectedGuildId || isSavingMocoTemplate) return;

    // 프론트엔드 유효성 검사
    const errors = validateMocoTemplate(mocoTemplate);
    if (errors.size > 0) {
      const msgs = [...errors.entries()].map(
        ([field, vars]) => `${field}: 허용되지 않는 변수 ${vars.join(', ')}`,
      );
      setMocoTemplateSaveError(msgs.join('\n'));
      return;
    }

    setIsSavingMocoTemplate(true);
    setMocoTemplateSaveError(null);
    setMocoTemplateSaveSuccess(false);

    try {
      await saveMocoTemplate(selectedGuildId, mocoTemplate);
      setMocoTemplateSaveSuccess(true);
      setTimeout(() => setMocoTemplateSaveSuccess(false), 3000);
    } catch (err) {
      setMocoTemplateSaveError(
        err instanceof Error ? err.message : '저장에 실패했습니다.',
      );
    } finally {
      setIsSavingMocoTemplate(false);
    }
  };

  if (!selectedGuildId) {
    return (
      <div className="max-w-3xl">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">신입 관리 설정</h1>
        <section className="bg-white rounded-xl border border-gray-200 p-8">
          <div className="flex flex-col items-center text-center py-8">
            <Server className="w-12 h-12 text-gray-300 mb-4" />
            <p className="text-sm text-gray-500">
              사이드바에서 서버를 선택하세요.
            </p>
          </div>
        </section>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="max-w-3xl">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">신입 관리 설정</h1>
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
        </div>
      </div>
    );
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'welcome':
        return (
          <WelcomeTab
            config={config}
            channels={channels}
            emojis={emojis}
            onChange={updateConfig}
          />
        );
      case 'mission':
        return (
          <MissionTab
            config={config}
            channels={channels}
            emojis={emojis}
            onChange={updateConfig}
            missionTemplate={missionTemplate}
            onMissionTemplateChange={setMissionTemplate}
            onSaveMissionTemplate={handleSaveMissionTemplate}
            isSavingMissionTemplate={isSavingMissionTemplate}
            missionTemplateSaveError={missionTemplateSaveError}
            missionTemplateSaveSuccess={missionTemplateSaveSuccess}
          />
        );
      case 'moco':
        return (
          <MocoTab
            config={config}
            channels={channels}
            emojis={emojis}
            onChange={updateConfig}
            mocoTemplate={mocoTemplate}
            onMocoTemplateChange={setMocoTemplate}
            onSaveMocoTemplate={handleSaveMocoTemplate}
            isSavingMocoTemplate={isSavingMocoTemplate}
            mocoTemplateSaveError={mocoTemplateSaveError}
            mocoTemplateSaveSuccess={mocoTemplateSaveSuccess}
          />
        );
      case 'role':
        return (
          <RoleTab
            config={config}
            roles={roles}
            onChange={updateConfig}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">신입 관리 설정</h1>
        <button
          type="button"
          onClick={refreshChannels}
          disabled={isRefreshing}
          title="채널/역할 목록 새로고침"
          className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span>채널 새로고침</span>
        </button>
      </div>

      {/* 탭 네비게이션 */}
      <div className="flex border-b border-gray-200 mb-6 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 탭 콘텐츠 */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        {renderTabContent()}
      </div>

      {/* 저장 버튼 + 피드백 */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1">
          {saveSuccess && (
            <p className="text-sm text-green-600 font-medium">
              저장되었습니다.
            </p>
          )}
          {saveError && (
            <p className="text-sm text-red-600 font-medium">{saveError}</p>
          )}
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving || !selectedGuildId || !configLoaded}
          className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
        >
          {isSaving ? '저장 중...' : '저장'}
        </button>
      </div>
    </div>
  );
}
