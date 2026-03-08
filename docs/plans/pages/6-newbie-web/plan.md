# Unit F: 신입 관리 웹 대시보드 — 구현 계획

## 개요

| 항목 | 내용 |
|------|------|
| 관련 PRD | F-WEB-NEWBIE-001 (`/docs/specs/prd/newbie.md` § F-WEB-NEWBIE-001) |
| 구현 단위 | F (공통 모듈 문서 4절) |
| 선행 조건 | Unit A (백엔드 코어)가 완성되어 `GET/POST /api/guilds/:guildId/newbie/config` 엔드포인트가 가동 중이어야 함 |
| 확정 경로 | `apps/web/app/settings/newbie/` (공통 모듈 문서 5절 기준) |

### 경로 선택 근거

PRD는 `/dashboard/servers/{guildId}/settings/newbie`를 명시하지만, 공통 모듈 설계 문서(5절)에서 `apps/web/app/settings/newbie/`로 확정하였다.
기존 자동방 설정 페이지(`apps/web/app/settings/auto-channel/page.tsx`)도 guildId 없이 `/settings/auto-channel`로 구현되어 있으며, 현재 대시보드 라우팅 구조 전체가 guildId 파라미터를 갖추지 않은 상태이다. 따라서 기존 패턴을 그대로 따라 `apps/web/app/settings/newbie/`에 구현한다.

---

## 1. 생성/수정 파일 전체 목록

### 1-1. 신규 생성 파일

```
apps/web/app/settings/newbie/
  page.tsx                        ← 메인 페이지 (탭 컨테이너, 설정 로드, 저장 오케스트레이션)
  components/
    WelcomeTab.tsx                ← 탭 1: 환영인사 설정
    MissionTab.tsx                ← 탭 2: 미션 설정
    MocoTab.tsx                   ← 탭 3: 모코코 사냥 설정
    RoleTab.tsx                   ← 탭 4: 신입기간 설정
    EmbedPreview.tsx              ← WelcomeTab 내부 Embed 미리보기 패널

apps/web/app/lib/
  newbie-api.ts                   ← 신입 관리 API 호출 함수 및 타입 정의
  discord-api.ts                  ← Discord 채널/역할 목록 조회 API 호출 함수
```

### 1-2. 기존 수정 파일

```
apps/web/app/components/SettingsSidebar.tsx   ← 신입 관리 메뉴 항목 추가
```

---

## 2. 타입 및 API 유틸리티 설계

### 2-1. `apps/web/app/lib/newbie-api.ts`

백엔드 `NewbieConfigSaveDto`와 1:1 대응하는 타입을 정의하고 API 호출 함수를 제공한다.
API URL은 `process.env.NEXT_PUBLIC_API_URL`을 사용하며, 인증 쿠키는 브라우저가 자동으로 전송하므로 별도 처리 없이 `credentials: 'include'`만 추가한다.

```typescript
// apps/web/app/lib/newbie-api.ts

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

// ─── 타입 정의 ──────────────────────────────────────────────────────────────

export interface NewbieConfig {
  // 환영인사
  welcomeEnabled: boolean;
  welcomeChannelId: string | null;
  welcomeEmbedTitle: string | null;
  welcomeEmbedDescription: string | null;
  welcomeEmbedColor: string | null;
  welcomeEmbedThumbnailUrl: string | null;

  // 미션
  missionEnabled: boolean;
  missionDurationDays: number | null;
  missionTargetPlaytimeHours: number | null;
  missionNotifyChannelId: string | null;

  // 모코코 사냥
  mocoEnabled: boolean;
  mocoRankChannelId: string | null;
  mocoAutoRefreshMinutes: number | null;

  // 신입기간 역할
  roleEnabled: boolean;
  roleDurationDays: number | null;
  newbieRoleId: string | null;
}

// ─── API 함수 ────────────────────────────────────────────────────────────────

/**
 * 현재 서버의 신입 관리 설정을 조회한다.
 * 설정이 없으면 null을 반환한다 (백엔드가 404 또는 빈 객체를 반환하는 경우 처리).
 */
export async function fetchNewbieConfig(
  guildId: string,
): Promise<NewbieConfig | null> {
  const res = await fetch(
    `${API_BASE}/api/guilds/${guildId}/newbie/config`,
    { credentials: 'include' },
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to fetch newbie config: ${res.status}`);
  return res.json() as Promise<NewbieConfig>;
}

/**
 * 신입 관리 설정을 저장한다.
 * 4개 탭 설정을 하나의 DTO로 일괄 전송한다.
 */
export async function saveNewbieConfig(
  guildId: string,
  config: NewbieConfig,
): Promise<void> {
  const res = await fetch(
    `${API_BASE}/api/guilds/${guildId}/newbie/config`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(config),
    },
  );
  if (!res.ok) throw new Error(`Failed to save newbie config: ${res.status}`);
}
```

### 2-2. `apps/web/app/lib/discord-api.ts`

채널 선택 드롭다운과 역할 선택 드롭다운에서 사용할 Discord 서버 채널/역할 목록 조회 함수를 정의한다.
백엔드 `GET /api/guilds/:guildId/channels`와 `GET /api/guilds/:guildId/roles` 엔드포인트를 호출한다.

> 해당 엔드포인트는 Unit A(백엔드 코어)의 `NewbieController` 또는 별도 공통 컨트롤러에서 제공해야 한다.
> 만약 Unit A 구현 시 이 엔드포인트가 포함되지 않는다면, Unit F 구현 단계에서 백엔드 담당자에게 요청하거나 임시로 하드코딩된 목 데이터로 대체한 뒤 연동한다.

```typescript
// apps/web/app/lib/discord-api.ts

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

export interface DiscordChannel {
  id: string;
  name: string;
  type: number; // 0 = GUILD_TEXT, 2 = GUILD_VOICE, 4 = GUILD_CATEGORY
}

export interface DiscordRole {
  id: string;
  name: string;
  color: number;
}

/**
 * 서버의 텍스트 채널 목록을 조회한다 (type === 0).
 */
export async function fetchGuildTextChannels(
  guildId: string,
): Promise<DiscordChannel[]> {
  const res = await fetch(
    `${API_BASE}/api/guilds/${guildId}/channels`,
    { credentials: 'include' },
  );
  if (!res.ok) throw new Error(`Failed to fetch channels: ${res.status}`);
  const all: DiscordChannel[] = await res.json();
  return all.filter((ch) => ch.type === 0);
}

/**
 * 서버의 역할 목록을 조회한다.
 */
export async function fetchGuildRoles(
  guildId: string,
): Promise<DiscordRole[]> {
  const res = await fetch(
    `${API_BASE}/api/guilds/${guildId}/roles`,
    { credentials: 'include' },
  );
  if (!res.ok) throw new Error(`Failed to fetch roles: ${res.status}`);
  return res.json() as Promise<DiscordRole[]>;
}
```

**참고**: 현재 코드베이스에는 `/api/guilds/:guildId/channels`와 `/api/guilds/:guildId/roles` 엔드포인트가 없다. 이 두 엔드포인트는 백엔드에서 Discord 클라이언트를 통해 길드 채널/역할 목록을 조회하여 반환하는 경량 엔드포인트이다. Unit F 구현 전에 백엔드에 추가 필요 여부를 확인한다. 만약 없다면 채널/역할 선택 드롭다운을 임시로 텍스트 입력 필드로 대체하고, 별도 이슈로 추적한다.

---

## 3. 컴포넌트 설계

### 3-1. 공유 상태 구조 (`page.tsx`가 관리)

`page.tsx`가 최상위 상태를 관리하고, 각 탭 컴포넌트에 슬라이스(slice)와 setter를 Props로 내려준다.
저장은 `page.tsx`에서 단일 `POST` 요청으로 일괄 처리한다.

```typescript
// page.tsx 내부 상태 구조 (개념 표현)
const [config, setConfig] = useState<NewbieConfig>(defaultConfig);
const [activeTab, setActiveTab] = useState<TabId>('welcome');
const [isSaving, setIsSaving] = useState(false);
const [saveError, setSaveError] = useState<string | null>(null);
const [saveSuccess, setSaveSuccess] = useState(false);
const [channels, setChannels] = useState<DiscordChannel[]>([]);
const [roles, setRoles] = useState<DiscordRole[]>([]);
const [isLoading, setIsLoading] = useState(true);

// guildId는 현재 구조상 하드코딩 또는 URL 파라미터로 주입
// 현재 /settings/newbie 경로에서는 guildId를 URL에서 읽을 수 없으므로
// 임시로 환경 변수 NEXT_PUBLIC_GUILD_ID 또는 고정값을 사용하며
// 추후 대시보드 라우팅 개선 시 searchParams 또는 동적 경로로 교체한다.
```

**guildId 처리 전략**: 기존 `auto-channel` 페이지와 동일하게 guildId를 URL 파라미터 없이 구현한다. 현재 웹 앱은 단일 서버 관리 구조이며, 멀티 서버 선택은 미구현 상태이다. `page.tsx`에서 `process.env.NEXT_PUBLIC_GUILD_ID`로 guildId를 읽거나, 백엔드가 JWT에서 guildId를 추론하는 구조를 따른다.

### 3-2. 탭 ID 타입

```typescript
type TabId = 'welcome' | 'mission' | 'moco' | 'role';

const TABS: { id: TabId; label: string }[] = [
  { id: 'welcome', label: '환영인사 설정' },
  { id: 'mission', label: '미션 설정' },
  { id: 'moco', label: '모코코 사냥 설정' },
  { id: 'role', label: '신입기간 설정' },
];
```

### 3-3. 기본값 (`defaultConfig`)

```typescript
const defaultConfig: NewbieConfig = {
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
```

---

## 4. 파일별 상세 구현

### 4-1. `apps/web/app/settings/newbie/page.tsx`

**역할**: 탭 컨테이너, 설정 로드, 저장 오케스트레이션, 토스트 알림

```typescript
'use client';

import { useEffect, useState } from 'react';
import { Users } from 'lucide-react';

import { fetchNewbieConfig, saveNewbieConfig, NewbieConfig } from '../../lib/newbie-api';
import { fetchGuildTextChannels, fetchGuildRoles, DiscordChannel, DiscordRole } from '../../lib/discord-api';
import WelcomeTab from './components/WelcomeTab';
import MissionTab from './components/MissionTab';
import MocoTab from './components/MocoTab';
import RoleTab from './components/RoleTab';

type TabId = 'welcome' | 'mission' | 'moco' | 'role';

const TABS: { id: TabId; label: string }[] = [
  { id: 'welcome', label: '환영인사 설정' },
  { id: 'mission', label: '미션 설정' },
  { id: 'moco', label: '모코코 사냥 설정' },
  { id: 'role', label: '신입기간 설정' },
];

const defaultConfig: NewbieConfig = {
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

// guildId를 환경 변수에서 읽는다. 미구현 상태에서 임시 처리.
const GUILD_ID = process.env.NEXT_PUBLIC_GUILD_ID ?? '';

export default function NewbieSettingsPage() {
  const [config, setConfig] = useState<NewbieConfig>(defaultConfig);
  const [activeTab, setActiveTab] = useState<TabId>('welcome');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [channels, setChannels] = useState<DiscordChannel[]>([]);
  const [roles, setRoles] = useState<DiscordRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 초기 데이터 로드
  useEffect(() => {
    if (!GUILD_ID) {
      setIsLoading(false);
      return;
    }

    Promise.all([
      fetchNewbieConfig(GUILD_ID).catch(() => null),
      fetchGuildTextChannels(GUILD_ID).catch(() => [] as DiscordChannel[]),
      fetchGuildRoles(GUILD_ID).catch(() => [] as DiscordRole[]),
    ]).then(([cfg, chs, rls]) => {
      if (cfg) setConfig(cfg);
      setChannels(chs);
      setRoles(rls);
    }).finally(() => setIsLoading(false));
  }, []);

  // 저장 핸들러: 현재 config 전체를 POST
  const handleSave = async () => {
    if (!GUILD_ID || isSaving) return;
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      await saveNewbieConfig(GUILD_ID, config);
      setSaveSuccess(true);
      // 3초 후 성공 메시지 자동 소멸
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : '저장에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  // config의 특정 필드를 partial update하는 헬퍼
  const updateConfig = (partial: Partial<NewbieConfig>) => {
    setConfig((prev) => ({ ...prev, ...partial }));
  };

  if (isLoading) {
    // 스켈레톤 로딩 UI
    return (
      <div className="max-w-3xl">
        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse mb-6" />
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
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
    }
  };

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">신입 관리 설정</h1>

      {/* 탭 네비게이션 */}
      <div className="flex border-b border-gray-200 mb-6">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
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
      <div className="flex items-center justify-between">
        <div>
          {saveSuccess && (
            <p className="text-sm text-green-600 font-medium">저장되었습니다.</p>
          )}
          {saveError && (
            <p className="text-sm text-red-600 font-medium">{saveError}</p>
          )}
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving || !GUILD_ID}
          className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
        >
          {isSaving ? '저장 중...' : '저장'}
        </button>
      </div>
    </div>
  );
}
```

**설계 근거**:
- `"use client"` 지시어: 상태(`useState`, `useEffect`)를 사용하므로 클라이언트 컴포넌트로 선언한다.
- 탭 컴포넌트에 `config` 전체와 `onChange` 헬퍼를 내려준다. 각 탭은 필요한 필드만 사용한다. 이는 저장 시 단일 `POST` 요청으로 4개 탭을 일괄 전송할 수 있게 한다.
- 채널/역할 목록을 `page.tsx`에서 한 번만 fetch하고 각 탭에 내려준다. 탭마다 fetch하면 불필요한 중복 호출이 발생한다.
- `Promise.all`로 초기 3개 fetch를 병렬 수행하여 로딩 시간을 최소화한다.
- 각 fetch는 `.catch(() => fallback)`으로 감싸 부분 실패 시에도 페이지가 렌더링된다.

### 4-2. `apps/web/app/settings/newbie/components/WelcomeTab.tsx`

**역할**: 환영인사 설정 UI (F-NEWBIE-001 대응)

```typescript
'use client';

import { DiscordChannel } from '../../../lib/discord-api';
import { NewbieConfig } from '../../../lib/newbie-api';
import EmbedPreview from './EmbedPreview';

interface WelcomeTabProps {
  config: NewbieConfig;
  channels: DiscordChannel[];
  onChange: (partial: Partial<NewbieConfig>) => void;
}

export default function WelcomeTab({ config, channels, onChange }: WelcomeTabProps) {
  return (
    <div className="space-y-6">
      {/* 기능 활성화 토글 */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-900">환영인사 기능</p>
          <p className="text-xs text-gray-500 mt-0.5">신규 멤버 가입 시 환영 메시지를 자동으로 전송합니다.</p>
        </div>
        <button
          role="switch"
          aria-checked={config.welcomeEnabled}
          onClick={() => onChange({ welcomeEnabled: !config.welcomeEnabled })}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            config.welcomeEnabled ? 'bg-indigo-600' : 'bg-gray-200'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              config.welcomeEnabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {/* 채널 선택 — 토글이 켜진 경우에만 활성화 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          환영 메시지 채널
        </label>
        <select
          value={config.welcomeChannelId ?? ''}
          onChange={(e) => onChange({ welcomeChannelId: e.target.value || null })}
          disabled={!config.welcomeEnabled}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-400"
        >
          <option value="">채널을 선택하세요</option>
          {channels.map((ch) => (
            <option key={ch.id} value={ch.id}>
              # {ch.name}
            </option>
          ))}
        </select>
      </div>

      {/* Embed 제목 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Embed 제목
        </label>
        <input
          type="text"
          value={config.welcomeEmbedTitle ?? ''}
          onChange={(e) => onChange({ welcomeEmbedTitle: e.target.value || null })}
          disabled={!config.welcomeEnabled}
          placeholder="예: {serverName}에 오신 것을 환영합니다!"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-400"
        />
      </div>

      {/* Embed 설명 (멀티라인) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Embed 설명
        </label>
        <textarea
          value={config.welcomeEmbedDescription ?? ''}
          onChange={(e) => onChange({ welcomeEmbedDescription: e.target.value || null })}
          disabled={!config.welcomeEnabled}
          placeholder="예: 안녕하세요, {username}님! 현재 서버에는 {memberCount}명이 함께하고 있어요."
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-400 resize-none"
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
            value={config.welcomeEmbedColor ?? '#5865F2'}
            onChange={(e) => onChange({ welcomeEmbedColor: e.target.value })}
            disabled={!config.welcomeEnabled}
            className="h-9 w-16 border border-gray-300 rounded cursor-pointer disabled:opacity-50"
          />
          <input
            type="text"
            value={config.welcomeEmbedColor ?? '#5865F2'}
            onChange={(e) => {
              const val = e.target.value;
              if (/^#[0-9A-Fa-f]{0,6}$/.test(val)) {
                onChange({ welcomeEmbedColor: val });
              }
            }}
            disabled={!config.welcomeEnabled}
            maxLength={7}
            placeholder="#5865F2"
            className="w-28 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-400"
          />
        </div>
      </div>

      {/* 썸네일 이미지 URL */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          썸네일 이미지 URL
        </label>
        <input
          type="url"
          value={config.welcomeEmbedThumbnailUrl ?? ''}
          onChange={(e) => onChange({ welcomeEmbedThumbnailUrl: e.target.value || null })}
          disabled={!config.welcomeEnabled}
          placeholder="https://example.com/image.png"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-400"
        />
      </div>

      {/* 템플릿 변수 안내 */}
      <div className="bg-indigo-50 rounded-lg p-4">
        <p className="text-xs font-semibold text-indigo-700 mb-2">사용 가능한 템플릿 변수</p>
        <dl className="space-y-1">
          {[
            { var: '{username}', desc: '신규 멤버의 닉네임' },
            { var: '{memberCount}', desc: '현재 서버 전체 멤버 수' },
            { var: '{serverName}', desc: '서버 이름' },
          ].map((item) => (
            <div key={item.var} className="flex items-center space-x-2">
              <code className="text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-mono">
                {item.var}
              </code>
              <span className="text-xs text-indigo-600">{item.desc}</span>
            </div>
          ))}
        </dl>
      </div>

      {/* Embed 미리보기 */}
      <EmbedPreview
        title={config.welcomeEmbedTitle}
        description={config.welcomeEmbedDescription}
        color={config.welcomeEmbedColor}
        thumbnailUrl={config.welcomeEmbedThumbnailUrl}
      />
    </div>
  );
}
```

### 4-3. `apps/web/app/settings/newbie/components/EmbedPreview.tsx`

**역할**: Discord Embed 스타일 미리보기

```typescript
'use client';

interface EmbedPreviewProps {
  title: string | null;
  description: string | null;
  color: string | null;
  thumbnailUrl: string | null;
}

export default function EmbedPreview({
  title,
  description,
  color,
  thumbnailUrl,
}: EmbedPreviewProps) {
  const borderColor = color ?? '#5865F2';
  const displayTitle = title || '(제목 없음)';
  const displayDesc = description || '(설명 없음)';

  return (
    <div>
      <p className="text-sm font-medium text-gray-700 mb-2">미리보기</p>
      <div className="bg-[#2B2D31] rounded-lg p-4">
        <div
          className="bg-[#313338] rounded-md overflow-hidden flex"
          style={{ borderLeft: `4px solid ${borderColor}` }}
        >
          <div className="flex-1 p-4">
            <p className="text-white font-semibold text-sm mb-1">{displayTitle}</p>
            <p className="text-gray-300 text-xs whitespace-pre-wrap">{displayDesc}</p>
          </div>
          {thumbnailUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumbnailUrl}
              alt="썸네일"
              className="w-16 h-16 object-cover m-4 rounded"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
```

**설계 근거**:
- Discord 실제 UI(배경 `#2B2D31`, 카드 `#313338`)를 모방하여 실제 Embed 외관에 가깝게 표현한다.
- `thumbnailUrl`이 잘못된 URL이면 `onError`로 이미지 숨김 처리한다.
- `whitespace-pre-wrap`으로 설명 텍스트의 줄바꿈을 보존한다.

### 4-4. `apps/web/app/settings/newbie/components/MissionTab.tsx`

**역할**: 미션 설정 UI (F-NEWBIE-002 대응)

```typescript
'use client';

import { DiscordChannel } from '../../../lib/discord-api';
import { NewbieConfig } from '../../../lib/newbie-api';

interface MissionTabProps {
  config: NewbieConfig;
  channels: DiscordChannel[];
  onChange: (partial: Partial<NewbieConfig>) => void;
}

export default function MissionTab({ config, channels, onChange }: MissionTabProps) {
  return (
    <div className="space-y-6">
      {/* 기능 활성화 토글 */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-900">미션 기능</p>
          <p className="text-xs text-gray-500 mt-0.5">신규 멤버에게 음성 채널 플레이타임 미션을 부여합니다.</p>
        </div>
        <button
          role="switch"
          aria-checked={config.missionEnabled}
          onClick={() => onChange({ missionEnabled: !config.missionEnabled })}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            config.missionEnabled ? 'bg-indigo-600' : 'bg-gray-200'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              config.missionEnabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {/* 미션 기간 (일수) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          미션 기간 (일)
        </label>
        <input
          type="number"
          min={1}
          max={365}
          value={config.missionDurationDays ?? ''}
          onChange={(e) => {
            const val = parseInt(e.target.value, 10);
            onChange({ missionDurationDays: isNaN(val) ? null : val });
          }}
          disabled={!config.missionEnabled}
          placeholder="예: 7"
          className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-400"
        />
        <p className="text-xs text-gray-400 mt-1">신규 멤버 가입 후 미션 기간(일수)</p>
      </div>

      {/* 목표 플레이타임 (시간) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          목표 플레이타임 (시간)
        </label>
        <input
          type="number"
          min={1}
          max={9999}
          value={config.missionTargetPlaytimeHours ?? ''}
          onChange={(e) => {
            const val = parseInt(e.target.value, 10);
            onChange({ missionTargetPlaytimeHours: isNaN(val) ? null : val });
          }}
          disabled={!config.missionEnabled}
          placeholder="예: 10"
          className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-400"
        />
        <p className="text-xs text-gray-400 mt-1">미션 완료 기준 음성 채널 최소 플레이타임(시간)</p>
      </div>

      {/* 알림 채널 선택 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          미션 현황 알림 채널
        </label>
        <select
          value={config.missionNotifyChannelId ?? ''}
          onChange={(e) => onChange({ missionNotifyChannelId: e.target.value || null })}
          disabled={!config.missionEnabled}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-400"
        >
          <option value="">채널을 선택하세요</option>
          {channels.map((ch) => (
            <option key={ch.id} value={ch.id}>
              # {ch.name}
            </option>
          ))}
        </select>
        <p className="text-xs text-gray-400 mt-1">미션 현황 Embed 메시지를 표시할 채널</p>
      </div>
    </div>
  );
}
```

### 4-5. `apps/web/app/settings/newbie/components/MocoTab.tsx`

**역할**: 모코코 사냥 설정 UI (F-NEWBIE-003 대응)

```typescript
'use client';

import { DiscordChannel } from '../../../lib/discord-api';
import { NewbieConfig } from '../../../lib/newbie-api';

interface MocoTabProps {
  config: NewbieConfig;
  channels: DiscordChannel[];
  onChange: (partial: Partial<NewbieConfig>) => void;
}

export default function MocoTab({ config, channels, onChange }: MocoTabProps) {
  return (
    <div className="space-y-6">
      {/* 기능 활성화 토글 */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-900">모코코 사냥 기능</p>
          <p className="text-xs text-gray-500 mt-0.5">기존 멤버가 신입과 함께 음성 채널에서 보낸 시간을 집계합니다.</p>
        </div>
        <button
          role="switch"
          aria-checked={config.mocoEnabled}
          onClick={() => onChange({ mocoEnabled: !config.mocoEnabled })}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            config.mocoEnabled ? 'bg-indigo-600' : 'bg-gray-200'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              config.mocoEnabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {/* 순위 표시 채널 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          순위 표시 채널
        </label>
        <select
          value={config.mocoRankChannelId ?? ''}
          onChange={(e) => onChange({ mocoRankChannelId: e.target.value || null })}
          disabled={!config.mocoEnabled}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-400"
        >
          <option value="">채널을 선택하세요</option>
          {channels.map((ch) => (
            <option key={ch.id} value={ch.id}>
              # {ch.name}
            </option>
          ))}
        </select>
        <p className="text-xs text-gray-400 mt-1">모코코 사냥 TOP N 순위 Embed를 표시할 채널</p>
      </div>

      {/* 자동 갱신 간격 (분) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          자동 갱신 간격 (분)
        </label>
        <input
          type="number"
          min={1}
          max={1440}
          value={config.mocoAutoRefreshMinutes ?? ''}
          onChange={(e) => {
            const val = parseInt(e.target.value, 10);
            onChange({ mocoAutoRefreshMinutes: isNaN(val) ? null : val });
          }}
          disabled={!config.mocoEnabled}
          placeholder="예: 30"
          className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-400"
        />
        <p className="text-xs text-gray-400 mt-1">순위 Embed를 자동으로 갱신하는 주기(분)</p>
      </div>
    </div>
  );
}
```

### 4-6. `apps/web/app/settings/newbie/components/RoleTab.tsx`

**역할**: 신입기간 역할 자동관리 설정 UI (F-NEWBIE-004 대응)

```typescript
'use client';

import { DiscordRole } from '../../../lib/discord-api';
import { NewbieConfig } from '../../../lib/newbie-api';

interface RoleTabProps {
  config: NewbieConfig;
  roles: DiscordRole[];
  onChange: (partial: Partial<NewbieConfig>) => void;
}

export default function RoleTab({ config, roles, onChange }: RoleTabProps) {
  return (
    <div className="space-y-6">
      {/* 기능 활성화 토글 */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-900">신입기간 역할 자동관리</p>
          <p className="text-xs text-gray-500 mt-0.5">신규 멤버에게 신입기간 역할을 자동으로 부여하고 만료 시 제거합니다.</p>
        </div>
        <button
          role="switch"
          aria-checked={config.roleEnabled}
          onClick={() => onChange({ roleEnabled: !config.roleEnabled })}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            config.roleEnabled ? 'bg-indigo-600' : 'bg-gray-200'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              config.roleEnabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {/* 신입기간 (일수) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          신입기간 (일)
        </label>
        <input
          type="number"
          min={1}
          max={365}
          value={config.roleDurationDays ?? ''}
          onChange={(e) => {
            const val = parseInt(e.target.value, 10);
            onChange({ roleDurationDays: isNaN(val) ? null : val });
          }}
          disabled={!config.roleEnabled}
          placeholder="예: 30"
          className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-400"
        />
        <p className="text-xs text-gray-400 mt-1">역할이 자동으로 제거될 때까지의 기간(일수)</p>
      </div>

      {/* 역할 선택 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          신입 역할
        </label>
        <select
          value={config.newbieRoleId ?? ''}
          onChange={(e) => onChange({ newbieRoleId: e.target.value || null })}
          disabled={!config.roleEnabled}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-400"
        >
          <option value="">역할을 선택하세요</option>
          {roles.map((role) => (
            <option key={role.id} value={role.id}>
              {role.name}
            </option>
          ))}
        </select>
        <p className="text-xs text-gray-400 mt-1">신규 멤버에게 자동으로 부여할 Discord 역할</p>
      </div>
    </div>
  );
}
```

### 4-7. `apps/web/app/components/SettingsSidebar.tsx` 수정

기존 `menuItems` 배열에 신입 관리 항목을 추가한다.

```typescript
// 기존 코드 (수정 전)
import { Radio, Settings } from "lucide-react";

const menuItems = [
  { href: "/settings", label: "일반 설정", icon: Settings },
  { href: "/settings/auto-channel", label: "자동방 설정", icon: Radio },
];

// 수정 후: Users 아이콘 추가, menuItems에 신입 관리 항목 추가
import { Radio, Settings, Users } from "lucide-react";

const menuItems = [
  { href: "/settings", label: "일반 설정", icon: Settings },
  { href: "/settings/auto-channel", label: "자동방 설정", icon: Radio },
  { href: "/settings/newbie", label: "신입 관리", icon: Users },
];
```

---

## 5. 구현 단계 순서

다음 순서로 구현한다. 파일 간 의존 관계를 고려하여 순차적으로 진행한다.

| 순서 | 파일 | 이유 |
|------|------|------|
| 1 | `apps/web/app/lib/newbie-api.ts` | 타입 정의가 모든 컴포넌트의 선행 조건 |
| 2 | `apps/web/app/lib/discord-api.ts` | 채널/역할 타입이 탭 컴포넌트의 Props 타입에 필요 |
| 3 | `apps/web/app/settings/newbie/components/EmbedPreview.tsx` | WelcomeTab이 의존 |
| 4 | `apps/web/app/settings/newbie/components/WelcomeTab.tsx` | EmbedPreview 의존 |
| 5 | `apps/web/app/settings/newbie/components/MissionTab.tsx` | 독립 |
| 6 | `apps/web/app/settings/newbie/components/MocoTab.tsx` | 독립 |
| 7 | `apps/web/app/settings/newbie/components/RoleTab.tsx` | 독립 |
| 8 | `apps/web/app/settings/newbie/page.tsx` | 모든 컴포넌트 + lib 완성 후 |
| 9 | `apps/web/app/components/SettingsSidebar.tsx` | page.tsx 완성 후 사이드바 연결 |

---

## 6. 기존 코드베이스 충돌 검토

| 항목 | 판단 | 근거 |
|------|------|------|
| `SettingsSidebar.tsx` 수정 | 충돌 없음 | `menuItems` 배열에 항목 추가만. `Users` 아이콘은 `lucide-react`에서 바로 import 가능 |
| `apps/web/app/lib/` 디렉토리 | 충돌 없음 | 현재 완전히 비어 있음. `newbie-api.ts`, `discord-api.ts` 신규 생성만 |
| `apps/web/app/settings/newbie/` 디렉토리 | 충돌 없음 | 현재 존재하지 않음. 신규 생성 |
| Tailwind CSS 클래스 | 충돌 없음 | 기존 `globals.css`, `tailwind.config` 변경 불필요. 기존 컴포넌트와 동일한 클래스 패턴 사용 |
| `process.env.NEXT_PUBLIC_API_URL` | 충돌 없음 | `apps/web/app/auth/discord/route.ts`에서 이미 사용 중인 환경 변수 |
| `credentials: 'include'` | 충돌 없음 | JWT를 쿠키로 처리하는 기존 인증 방식과 일치 |
| `"use client"` 지시어 | 충돌 없음 | 기존 `Header.tsx`, `SettingsSidebar.tsx`와 동일한 패턴 |
| `lucide-react` `Users` 아이콘 | 충돌 없음 | 이미 의존성에 포함된 패키지 (`"lucide-react": "^0.562.0"`) |
| 토글 버튼 구현 (`role="switch"`) | 충돌 없음 | 기존 프로젝트에 별도 UI 라이브러리(shadcn, radix 등) 없으므로 인라인 Tailwind로 구현 |
| `EmbedPreview` 내 인라인 스타일 | 충돌 없음 | Discord 배경색(`#2B2D31`)은 Tailwind 기본 팔레트 밖이므로 hex 리터럴 사용. Tailwind v3에서 `style` prop과 Tailwind 클래스 혼용 허용 |

---

## 7. 백엔드 의존성 확인 사항

Unit F를 완성하려면 백엔드에서 다음 엔드포인트가 준비되어 있어야 한다.

| 엔드포인트 | 선행 단위 | 설명 |
|-----------|-----------|------|
| `GET /api/guilds/:guildId/newbie/config` | Unit A | 설정 조회 |
| `POST /api/guilds/:guildId/newbie/config` | Unit A | 설정 저장 |
| `GET /api/guilds/:guildId/channels` | 미정 | 서버 텍스트 채널 목록 |
| `GET /api/guilds/:guildId/roles` | 미정 | 서버 역할 목록 |

`/api/guilds/:guildId/channels`와 `/api/guilds/:guildId/roles`는 현재 코드베이스에 없다. 두 엔드포인트가 없을 경우 다음 임시 처리를 적용한다.

- `discord-api.ts`의 함수가 빈 배열을 반환하도록 fallback 처리: `catch(() => [])`
- 채널/역할 드롭다운이 비어 있는 상태로 렌더링되며, 사용자는 직접 ID를 입력할 수 없음
- 이 제한은 별도 이슈로 추적하고, 백엔드 엔드포인트 추가 후 연동한다

---

## 8. 최종 파일 목록 요약

| 파일 | 분류 | 설명 |
|------|------|------|
| `apps/web/app/lib/newbie-api.ts` | 신규 | `NewbieConfig` 타입, `fetchNewbieConfig`, `saveNewbieConfig` |
| `apps/web/app/lib/discord-api.ts` | 신규 | `DiscordChannel`, `DiscordRole` 타입, 채널/역할 fetch 함수 |
| `apps/web/app/settings/newbie/page.tsx` | 신규 | 탭 컨테이너, 상태 관리, 저장 오케스트레이션 |
| `apps/web/app/settings/newbie/components/WelcomeTab.tsx` | 신규 | 환영인사 설정 탭 UI |
| `apps/web/app/settings/newbie/components/MissionTab.tsx` | 신규 | 미션 설정 탭 UI |
| `apps/web/app/settings/newbie/components/MocoTab.tsx` | 신규 | 모코코 사냥 설정 탭 UI |
| `apps/web/app/settings/newbie/components/RoleTab.tsx` | 신규 | 신입기간 역할 설정 탭 UI |
| `apps/web/app/settings/newbie/components/EmbedPreview.tsx` | 신규 | Discord Embed 스타일 미리보기 패널 |
| `apps/web/app/components/SettingsSidebar.tsx` | 수정 | `Users` 아이콘 import 추가, `menuItems`에 신입 관리 항목 추가 |
