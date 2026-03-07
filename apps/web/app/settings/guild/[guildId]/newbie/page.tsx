'use client';

import { Loader2, Server } from 'lucide-react';
import { useEffect, useState } from 'react';

import type { DiscordChannel, DiscordRole } from '../../../../lib/discord-api';
import { fetchGuildTextChannels, fetchGuildRoles } from '../../../../lib/discord-api';
import type { NewbieConfig } from '../../../../lib/newbie-api';
import { fetchNewbieConfig, saveNewbieConfig } from '../../../../lib/newbie-api';
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
  missionEmbedTitle: null,
  missionEmbedDescription: null,
  missionEmbedColor: '#57F287',
  missionEmbedThumbnailUrl: null,
  mocoEnabled: false,
  mocoRankChannelId: null,
  mocoAutoRefreshMinutes: null,
  mocoEmbedTitle: null,
  mocoEmbedDescription: null,
  mocoEmbedColor: '#5865F2',
  mocoEmbedThumbnailUrl: null,
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
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!selectedGuildId) return;

    setIsLoading(true);
    setConfig(DEFAULT_CONFIG);

    Promise.all([
      fetchNewbieConfig(selectedGuildId).catch(() => null),
      fetchGuildTextChannels(selectedGuildId).catch(
        (): DiscordChannel[] => [],
      ),
      fetchGuildRoles(selectedGuildId).catch((): DiscordRole[] => []),
    ])
      .then(([cfg, chs, rls]) => {
        if (cfg) setConfig(cfg);
        setChannels(chs);
        setRoles(rls);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [selectedGuildId]);

  const updateConfig = (partial: Partial<NewbieConfig>) => {
    setConfig((prev) => ({ ...prev, ...partial }));
  };

  const handleSave = async () => {
    if (!selectedGuildId || isSaving) return;

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
            onChange={updateConfig}
          />
        );
      case 'mission':
        return (
          <MissionTab
            config={config}
            channels={channels}
            onChange={updateConfig}
          />
        );
      case 'moco':
        return (
          <MocoTab
            config={config}
            channels={channels}
            onChange={updateConfig}
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
      <h1 className="text-2xl font-bold text-gray-900 mb-6">신입 관리 설정</h1>

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
          disabled={isSaving || !selectedGuildId}
          className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
        >
          {isSaving ? '저장 중...' : '저장'}
        </button>
      </div>
    </div>
  );
}
