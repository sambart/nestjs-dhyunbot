# Unit 9: Status Prefix 웹 설정 페이지 — 구현 계획

## 개요

| 항목 | 내용 |
|------|------|
| 관련 PRD | F-WEB-STATUS-PREFIX-001 (`/docs/specs/prd/status-prefix.md` § F-WEB-STATUS-PREFIX-001) |
| 구현 단위 | 9 |
| 선행 조건 | 백엔드에서 `GET/POST /api/guilds/:guildId/status-prefix/config` 엔드포인트가 가동 중이어야 함 |
| 확정 경로 | `apps/web/app/settings/status-prefix/` |

### 경로 선택 근거

PRD는 `/dashboard/servers/{guildId}/settings/status-prefix`를 명시하지만, 기존 `apps/web/app/settings/auto-channel/`와 `apps/web/app/settings/newbie/` 패턴을 따라 `apps/web/app/settings/status-prefix/`에 구현한다. guildId는 URL 파라미터 없이 `SettingsContext`에서 `selectedGuildId`로 주입받는다.

---

## 1. 생성/수정 파일 전체 목록

### 1-1. 신규 생성 파일

```
apps/web/app/settings/status-prefix/
  page.tsx                        ← 메인 페이지 (설정 로드, 상태 관리, 저장 오케스트레이션)

apps/web/app/lib/
  status-prefix-api.ts            ← Status Prefix API 호출 함수 및 타입 정의
```

### 1-2. 기존 수정 파일

```
apps/web/app/components/SettingsSidebar.tsx   ← 게임방 상태 설정 메뉴 항목 추가
```

---

## 2. 타입 및 API 유틸리티 설계

### 2-1. `apps/web/app/lib/status-prefix-api.ts`

백엔드 응답 스키마 및 요청 DTO와 1:1 대응하는 타입을 정의하고 API 호출 함수를 제공한다. 기존 `newbie-api.ts`와 `discord-api.ts`의 패턴을 그대로 따른다: `API_BASE` 상수, `credentials: 'include'`, HTTP 상태코드 기반 오류 처리.

#### 타입 정의

```typescript
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

// ─── 타입 정의 ──────────────────────────────────────────────────────────────

/** 버튼 타입 — PRD StatusPrefixButton.type enum과 일치 */
export type StatusPrefixButtonType = 'PREFIX' | 'RESET';

/**
 * 버튼 항목 타입.
 * - id: 기존 DB 항목은 양의 정수, 신규 항목(아직 미저장)은 음의 정수 임시 키 사용
 * - prefix: type === 'RESET'일 때 null
 */
export interface StatusPrefixButton {
  id: number;
  label: string;
  emoji: string | null;
  prefix: string | null;
  type: StatusPrefixButtonType;
  sortOrder: number;
}

/** 설정 전체 (GET 응답 및 POST 요청 바디) */
export interface StatusPrefixConfig {
  enabled: boolean;
  channelId: string | null;
  embedTitle: string | null;
  embedDescription: string | null;
  embedColor: string | null;
  prefixTemplate: string;
  buttons: StatusPrefixButton[];
}
```

#### API 함수

```typescript
/**
 * 현재 서버의 Status Prefix 설정을 조회한다.
 * 설정이 없으면 null을 반환한다 (백엔드가 404를 반환하는 경우 처리).
 */
export async function fetchStatusPrefixConfig(
  guildId: string,
): Promise<StatusPrefixConfig | null> {
  const res = await fetch(
    `${API_BASE}/api/guilds/${guildId}/status-prefix/config`,
    { credentials: 'include' },
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`설정 조회 실패: ${res.status}`);
  return res.json() as Promise<StatusPrefixConfig>;
}

/**
 * Status Prefix 설정을 저장한다.
 * 버튼 목록 전체를 배열로 일괄 전송한다.
 * 성공 시 undefined, 실패 시 Error throw.
 */
export async function saveStatusPrefixConfig(
  guildId: string,
  config: StatusPrefixConfig,
): Promise<void> {
  const res = await fetch(
    `${API_BASE}/api/guilds/${guildId}/status-prefix/config`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(config),
    },
  );
  if (!res.ok) throw new Error(`설정 저장 실패: ${res.status}`);
}
```

**설계 근거**:
- `id`에 음의 정수 임시 키를 사용하는 이유: 버튼 추가 시 React 배열 렌더링에 `key` prop이 필요하다. DB에서 받은 항목은 양의 정수 id를 유지하고, 새로 추가된(미저장) 항목은 `-(Date.now())`와 같이 음의 정수를 부여한다. 저장 요청 시에는 id 값과 무관하게 전체 버튼 배열을 전송한다.
- `messageId` 필드는 GET 응답에 포함될 수 있으나 POST 요청에 포함하지 않는다. 백엔드가 messageId를 자체적으로 관리하기 때문이다. PRD F-STATUS-PREFIX-002 참조.

---

## 3. 컴포넌트 설계

### 3-1. 페이지 상태 구조

`page.tsx`가 모든 상태를 관리하며, 단일 컴포넌트로 구현한다. newbie 페이지와 달리 탭이 없으므로 단일 파일로 충분하다.

```typescript
// page.tsx 내부 상태 구조

// --- 서버/로딩 상태 ---
const { selectedGuildId } = useSettings();        // SettingsContext에서 guildId 주입
const [isLoading, setIsLoading] = useState(false);

// --- 설정 상태 ---
const [config, setConfig] = useState<StatusPrefixConfig>(DEFAULT_CONFIG);

// --- 채널 목록 (드롭다운용) ---
const [channels, setChannels] = useState<DiscordChannel[]>([]);

// --- 저장 상태 ---
const [isSaving, setIsSaving] = useState(false);
const [saveError, setSaveError] = useState<string | null>(null);
const [saveSuccess, setSaveSuccess] = useState(false);
```

### 3-2. 기본값 (`DEFAULT_CONFIG`)

```typescript
const DEFAULT_CONFIG: StatusPrefixConfig = {
  enabled: false,
  channelId: null,
  embedTitle: '게임방 상태 설정 시스템',
  embedDescription: '아래 버튼을 클릭하여 닉네임 접두사를 변경할 수 있습니다.',
  embedColor: '#5865F2',
  prefixTemplate: '[{prefix}] {nickname}',
  buttons: [],
};
```

**설계 근거**: PRD F-STATUS-PREFIX-001 응답 예시의 값을 기본값으로 사용한다. `prefixTemplate`은 DB 스키마 DEFAULT와 동일하게 `[{prefix}] {nickname}`으로 설정한다.

### 3-3. 버튼 상태 관리 헬퍼

버튼 목록 조작은 페이지 컴포넌트 내부에 함수로 정의한다.

```typescript
/** config.buttons 배열을 교체하는 헬퍼 */
const updateButtons = (buttons: StatusPrefixButton[]) => {
  setConfig((prev) => ({ ...prev, buttons }));
};

/** 버튼 추가: 임시 음의 정수 id 부여, sortOrder는 현재 최대+1 */
const addButton = () => {
  const maxOrder = config.buttons.reduce((m, b) => Math.max(m, b.sortOrder), -1);
  const newButton: StatusPrefixButton = {
    id: -Date.now(),
    label: '',
    emoji: null,
    prefix: null,
    type: 'PREFIX',
    sortOrder: maxOrder + 1,
  };
  updateButtons([...config.buttons, newButton]);
};

/** 버튼 삭제: id로 필터링 후 sortOrder 재부여 */
const removeButton = (id: number) => {
  const filtered = config.buttons
    .filter((b) => b.id !== id)
    .map((b, idx) => ({ ...b, sortOrder: idx }));
  updateButtons(filtered);
};

/** 버튼 필드 수정: id로 찾아 부분 갱신 */
const updateButton = (id: number, patch: Partial<StatusPrefixButton>) => {
  updateButtons(
    config.buttons.map((b) => (b.id === id ? { ...b, ...patch } : b)),
  );
};

/** 버튼 순서 이동: 인접 항목과 sortOrder를 교환 */
const moveButton = (id: number, direction: 'up' | 'down') => {
  const sorted = [...config.buttons].sort((a, b) => a.sortOrder - b.sortOrder);
  const idx = sorted.findIndex((b) => b.id === id);
  const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= sorted.length) return;
  const newSorted = [...sorted];
  [newSorted[idx].sortOrder, newSorted[swapIdx].sortOrder] = [
    newSorted[swapIdx].sortOrder,
    newSorted[idx].sortOrder,
  ];
  updateButtons(newSorted);
};
```

**설계 근거**:
- 드래그 앤 드롭 라이브러리 없이 위/아래 이동 버튼으로 순서를 변경한다. 외부 라이브러리 의존성을 추가하지 않아 기존 코드베이스와 충돌이 없다.
- sortOrder는 `removeButton` 시 인덱스 기반으로 재정규화한다. 이로써 DB 저장 후 sortOrder 값이 연속 정수임이 보장된다.

---

## 4. 파일별 상세 구현

### 4-1. `apps/web/app/lib/status-prefix-api.ts`

위 섹션 2-1의 타입 정의와 API 함수 전체. 파일 구조는 `newbie-api.ts`와 동일하다.

**의존성**: 없음 (순수 fetch 유틸).

---

### 4-2. `apps/web/app/settings/status-prefix/page.tsx`

**역할**: 설정 조회, 상태 관리, 버튼 목록 CRUD, 저장 오케스트레이션.

**import 목록**:
```typescript
'use client';

import { Loader2, Server, Tag } from 'lucide-react';
import { useEffect, useState } from 'react';

import { fetchGuildTextChannels } from '../../lib/discord-api';
import type { DiscordChannel } from '../../lib/discord-api';
import {
  fetchStatusPrefixConfig,
  saveStatusPrefixConfig,
} from '../../lib/status-prefix-api';
import type {
  StatusPrefixButton,
  StatusPrefixConfig,
} from '../../lib/status-prefix-api';
import { useSettings } from '../SettingsContext';
```

**아이콘 선택 근거**: `Tag` (lucide-react)는 접두사(태그) 기능을 시각적으로 잘 표현한다. `Server` 아이콘은 서버 미선택 상태에서 기존 패턴과 동일하게 사용한다.

#### 전체 JSX 구조

```
<div className="max-w-3xl">
  <h1>게임방 상태 설정</h1>

  {/* 섹션 1: 기본 설정 */}
  <section className="bg-white rounded-xl border ...">
    <h2>기본 설정</h2>
    {/* 기능 활성화 토글 */}
    {/* 안내 채널 선택 */}
    {/* 접두사 형식 템플릿 */}
    {/* 템플릿 변수 안내 */}
  </section>

  {/* 섹션 2: Embed 설정 */}
  <section className="bg-white rounded-xl border ...">
    <h2>Embed 설정</h2>
    {/* Embed 제목 */}
    {/* Embed 설명 (멀티라인) */}
    {/* Embed 색상 (color picker + HEX input) */}
    {/* Embed 미리보기 */}
  </section>

  {/* 섹션 3: 버튼 목록 */}
  <section className="bg-white rounded-xl border ...">
    <h2>버튼 목록</h2>
    {/* 버튼 카드 목록 */}
    {/* 버튼 추가 버튼 */}
  </section>

  {/* 저장 버튼 + 피드백 */}
  <div>
    {saveSuccess && <p>저장되었습니다.</p>}
    {saveError && <p>{saveError}</p>}
    <button>저장</button>
  </div>
</div>
```

#### 초기 데이터 로드

```typescript
useEffect(() => {
  if (!selectedGuildId) return;

  setIsLoading(true);
  setConfig(DEFAULT_CONFIG);

  Promise.all([
    fetchStatusPrefixConfig(selectedGuildId).catch(() => null),
    fetchGuildTextChannels(selectedGuildId).catch((): DiscordChannel[] => []),
  ])
    .then(([cfg, chs]) => {
      if (cfg) setConfig(cfg);
      setChannels(chs);
    })
    .catch(() => {})
    .finally(() => setIsLoading(false));
}, [selectedGuildId]);
```

**설계 근거**: `selectedGuildId` 변경 시 상태를 `DEFAULT_CONFIG`로 초기화한 후 새 guildId 데이터를 로드한다. 이는 서버 전환 시 이전 서버 데이터가 잠시 표시되는 문제를 방지한다.

#### 저장 핸들러

```typescript
const handleSave = async () => {
  if (!selectedGuildId || isSaving) return;

  setIsSaving(true);
  setSaveError(null);
  setSaveSuccess(false);

  // 저장 전 sortOrder 재정규화 (정렬 순서대로 0부터 부여)
  const sorted = [...config.buttons].sort((a, b) => a.sortOrder - b.sortOrder);
  const normalizedButtons = sorted.map((b, idx) => ({ ...b, sortOrder: idx }));
  const payload: StatusPrefixConfig = { ...config, buttons: normalizedButtons };

  try {
    await saveStatusPrefixConfig(selectedGuildId, payload);
    setConfig(payload); // 정규화된 상태로 로컬 갱신
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  } catch (err) {
    setSaveError(err instanceof Error ? err.message : '저장에 실패했습니다.');
  } finally {
    setIsSaving(false);
  }
};
```

#### 서버 미선택 상태 렌더링

```typescript
if (!selectedGuildId) {
  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">게임방 상태 설정</h1>
      <section className="bg-white rounded-xl border border-gray-200 p-8">
        <div className="flex flex-col items-center text-center py-8">
          <Server className="w-12 h-12 text-gray-300 mb-4" />
          <p className="text-sm text-gray-500">사이드바에서 서버를 선택하세요.</p>
        </div>
      </section>
    </div>
  );
}
```

#### 로딩 상태 렌더링

```typescript
if (isLoading) {
  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">게임방 상태 설정</h1>
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
      </div>
    </div>
  );
}
```

#### 섹션 1: 기본 설정 상세

```tsx
<section className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
  <h2 className="text-base font-semibold text-gray-900 mb-4">기본 설정</h2>
  <div className="space-y-6">

    {/* 기능 활성화 토글 */}
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-900">기능 활성화</p>
        <p className="text-xs text-gray-500 mt-0.5">
          활성화 시 저장 즉시 지정 채널에 Embed + 버튼 메시지가 전송/갱신됩니다.
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={config.enabled}
        onClick={() => setConfig((prev) => ({ ...prev, enabled: !prev.enabled }))}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
          config.enabled ? 'bg-indigo-600' : 'bg-gray-200'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
            config.enabled ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>

    {/* 안내 채널 선택 */}
    <div>
      <label htmlFor="sp-channel" className="block text-sm font-medium text-gray-700 mb-1">
        안내 채널
      </label>
      <select
        id="sp-channel"
        value={config.channelId ?? ''}
        onChange={(e) =>
          setConfig((prev) => ({ ...prev, channelId: e.target.value || null }))
        }
        disabled={!config.enabled}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed"
      >
        <option value="">채널을 선택하세요</option>
        {channels.map((ch) => (
          <option key={ch.id} value={ch.id}>
            # {ch.name}
          </option>
        ))}
      </select>
      {channels.length === 0 && (
        <p className="text-xs text-gray-400 mt-1">
          채널 목록을 불러올 수 없습니다. 백엔드 연동 후 사용 가능합니다.
        </p>
      )}
      <p className="text-xs text-gray-400 mt-1">
        Embed + 버튼 메시지를 표시할 텍스트 채널
      </p>
    </div>

    {/* 접두사 형식 템플릿 */}
    <div>
      <label htmlFor="sp-template" className="block text-sm font-medium text-gray-700 mb-1">
        접두사 형식 템플릿
      </label>
      <input
        id="sp-template"
        type="text"
        value={config.prefixTemplate}
        onChange={(e) =>
          setConfig((prev) => ({ ...prev, prefixTemplate: e.target.value }))
        }
        disabled={!config.enabled}
        placeholder="예: [{prefix}] {nickname}"
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed"
      />
      <p className="text-xs text-gray-400 mt-1">
        닉네임 변환에 사용될 템플릿. 예: <code>[관전] 동현</code>
      </p>
    </div>

    {/* 템플릿 변수 안내 */}
    <div className="bg-indigo-50 rounded-lg p-4">
      <p className="text-xs font-semibold text-indigo-700 mb-2">사용 가능한 템플릿 변수</p>
      <dl className="space-y-1.5">
        {[
          { variable: '{prefix}', description: '버튼에 설정된 접두사 텍스트' },
          { variable: '{nickname}', description: '원래 닉네임 (접두사 적용 전)' },
        ].map((item) => (
          <div key={item.variable} className="flex items-center space-x-2">
            <code className="text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-mono">
              {item.variable}
            </code>
            <span className="text-xs text-indigo-600">{item.description}</span>
          </div>
        ))}
      </dl>
    </div>

  </div>
</section>
```

#### 섹션 2: Embed 설정 상세

```tsx
<section className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
  <h2 className="text-base font-semibold text-gray-900 mb-4">Embed 설정</h2>
  <div className="space-y-6">

    {/* Embed 제목 */}
    <div>
      <label htmlFor="sp-embed-title" className="block text-sm font-medium text-gray-700 mb-1">
        Embed 제목
      </label>
      <input
        id="sp-embed-title"
        type="text"
        value={config.embedTitle ?? ''}
        onChange={(e) =>
          setConfig((prev) => ({ ...prev, embedTitle: e.target.value || null }))
        }
        disabled={!config.enabled}
        placeholder="예: 게임방 상태 설정 시스템"
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed"
      />
    </div>

    {/* Embed 설명 (멀티라인) */}
    <div>
      <label htmlFor="sp-embed-desc" className="block text-sm font-medium text-gray-700 mb-1">
        Embed 설명
      </label>
      <textarea
        id="sp-embed-desc"
        value={config.embedDescription ?? ''}
        onChange={(e) =>
          setConfig((prev) => ({ ...prev, embedDescription: e.target.value || null }))
        }
        disabled={!config.enabled}
        placeholder="예: 아래 버튼을 클릭하여 닉네임 접두사를 변경할 수 있습니다."
        rows={4}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed resize-none"
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
          value={config.embedColor ?? '#5865F2'}
          onChange={(e) =>
            setConfig((prev) => ({ ...prev, embedColor: e.target.value }))
          }
          disabled={!config.enabled}
          aria-label="Embed 색상 피커"
          className="h-9 w-16 border border-gray-300 rounded cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed p-1"
        />
        <input
          type="text"
          value={config.embedColor ?? '#5865F2'}
          onChange={(e) => {
            const val = e.target.value;
            if (/^#[0-9A-Fa-f]{0,6}$/.test(val)) {
              setConfig((prev) => ({ ...prev, embedColor: val }));
            }
          }}
          disabled={!config.enabled}
          maxLength={7}
          placeholder="#5865F2"
          aria-label="Embed 색상 HEX 코드"
          className="w-28 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed"
        />
      </div>
    </div>

    {/* Embed 미리보기 */}
    <div>
      <p className="text-sm font-medium text-gray-700 mb-2">미리보기</p>
      <div className="bg-[#2B2D31] rounded-lg p-4">
        <div
          className="bg-[#313338] rounded-md overflow-hidden"
          style={{ borderLeft: `4px solid ${config.embedColor ?? '#5865F2'}` }}
        >
          <div className="p-4">
            <p className="text-white font-semibold text-sm mb-1 break-words">
              {config.embedTitle || '(제목 없음)'}
            </p>
            <p className="text-gray-300 text-xs whitespace-pre-wrap break-words">
              {config.embedDescription || '(설명 없음)'}
            </p>
            {/* 버튼 미리보기 */}
            {config.buttons.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {[...config.buttons]
                  .sort((a, b) => a.sortOrder - b.sortOrder)
                  .map((btn) => (
                    <span
                      key={btn.id}
                      className="px-3 py-1 bg-indigo-500 text-white text-xs rounded font-medium"
                    >
                      {btn.emoji ? `${btn.emoji} ` : ''}
                      {btn.label || '(라벨 없음)'}
                    </span>
                  ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>

  </div>
</section>
```

**설계 근거**: Embed 미리보기에서 버튼 목록도 함께 시각화한다. 이를 통해 버튼 순서와 라벨을 설정하면서 실제 Discord Embed 화면을 미리 확인할 수 있다. `EmbedPreview`를 별도 파일로 분리하지 않는 이유는 status-prefix 전용 미리보기에 버튼 렌더링이 추가되어 기존 `EmbedPreview` 컴포넌트와 props 인터페이스가 달라지기 때문이다. 단일 파일 내 인라인으로 구현하여 props drilling을 줄인다.

#### 섹션 3: 버튼 목록 상세

버튼 카드는 `config.buttons`를 `sortOrder` 순으로 정렬하여 렌더링한다.

```tsx
<section className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
  <div className="flex items-center justify-between mb-4">
    <div>
      <h2 className="text-base font-semibold text-gray-900">버튼 목록</h2>
      <p className="text-xs text-gray-500 mt-0.5">
        Discord에 최대 25개까지 등록할 수 있습니다.
      </p>
    </div>
    <button
      type="button"
      onClick={addButton}
      disabled={!config.enabled || config.buttons.length >= 25}
      className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      + 버튼 추가
    </button>
  </div>

  {config.buttons.length === 0 ? (
    <div className="text-center py-8 text-gray-400 text-sm">
      등록된 버튼이 없습니다. 버튼을 추가하세요.
    </div>
  ) : (
    <div className="space-y-3">
      {[...config.buttons]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((btn, idx, arr) => (
          <div
            key={btn.id}
            className="border border-gray-200 rounded-lg p-4"
          >
            {/* 버튼 카드 헤더: 순서 이동 + 타입 배지 + 삭제 */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => moveButton(btn.id, 'up')}
                  disabled={idx === 0}
                  aria-label="위로 이동"
                  className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  ▲
                </button>
                <button
                  type="button"
                  onClick={() => moveButton(btn.id, 'down')}
                  disabled={idx === arr.length - 1}
                  aria-label="아래로 이동"
                  className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  ▼
                </button>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    btn.type === 'PREFIX'
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'bg-orange-100 text-orange-700'
                  }`}
                >
                  {btn.type === 'PREFIX' ? '접두사' : '원래대로'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => removeButton(btn.id)}
                aria-label="버튼 삭제"
                className="text-xs text-red-500 hover:text-red-700 transition-colors"
              >
                삭제
              </button>
            </div>

            {/* 버튼 카드 바디: 필드 그리드 */}
            <div className="grid grid-cols-2 gap-3">

              {/* 버튼 타입 선택 */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">타입</label>
                <select
                  value={btn.type}
                  onChange={(e) =>
                    updateButton(btn.id, {
                      type: e.target.value as StatusPrefixButtonType,
                      // RESET 타입으로 변경 시 prefix를 null로 초기화
                      prefix: e.target.value === 'RESET' ? null : btn.prefix,
                    })
                  }
                  className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="PREFIX">PREFIX (접두사 적용)</option>
                  <option value="RESET">RESET (원래대로)</option>
                </select>
              </div>

              {/* 버튼 라벨 */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  라벨 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={btn.label}
                  onChange={(e) => updateButton(btn.id, { label: e.target.value })}
                  placeholder="예: 관전 적용"
                  className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* 이모지 */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">이모지 (선택)</label>
                <input
                  type="text"
                  value={btn.emoji ?? ''}
                  onChange={(e) =>
                    updateButton(btn.id, { emoji: e.target.value || null })
                  }
                  placeholder="예: 👁"
                  className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* 접두사 텍스트 — PREFIX 타입일 때만 활성화 */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  접두사 텍스트
                  {btn.type === 'PREFIX' && <span className="text-red-500"> *</span>}
                </label>
                <input
                  type="text"
                  value={btn.prefix ?? ''}
                  onChange={(e) =>
                    updateButton(btn.id, { prefix: e.target.value || null })
                  }
                  disabled={btn.type === 'RESET'}
                  placeholder="예: 관전"
                  className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed"
                />
                {btn.type === 'RESET' && (
                  <p className="text-xs text-gray-400 mt-1">RESET 타입은 접두사가 없습니다.</p>
                )}
              </div>

            </div>
          </div>
        ))}
    </div>
  )}
</section>
```

#### 저장 버튼 영역

```tsx
<div className="flex items-center justify-between gap-4">
  <div className="flex-1">
    {saveSuccess && (
      <p className="text-sm text-green-600 font-medium">설정이 저장되었습니다.</p>
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
```

---

### 4-3. `apps/web/app/components/SettingsSidebar.tsx` 수정

기존 `menuItems` 배열에 게임방 상태 설정 항목을 추가한다.

**수정 위치**: 파일 상단 import 블록 및 `menuItems` 배열.

**현재 코드 (수정 전)**:
```typescript
import { ChevronDown, Radio, Settings, Users } from "lucide-react";

const menuItems = [
  { href: "/settings", label: "일반 설정", icon: Settings },
  { href: "/settings/auto-channel", label: "자동방 설정", icon: Radio },
  { href: "/settings/newbie", label: "신입 관리", icon: Users },
];
```

**수정 후**:
```typescript
import { ChevronDown, Radio, Settings, Tag, Users } from "lucide-react";

const menuItems = [
  { href: "/settings", label: "일반 설정", icon: Settings },
  { href: "/settings/auto-channel", label: "자동방 설정", icon: Radio },
  { href: "/settings/newbie", label: "신입 관리", icon: Users },
  { href: "/settings/status-prefix", label: "게임방 상태 설정", icon: Tag },
];
```

**설계 근거**:
- `Tag` 아이콘은 lucide-react에 포함된 아이콘이며 접두사/태그 기능을 직관적으로 표현한다.
- `menuItems` 배열 끝에 추가하므로 기존 항목의 렌더링에 영향이 없다.
- 배열을 `map`으로 렌더링하는 기존 방식이 그대로 유지된다.

---

## 5. 구현 단계 순서

파일 간 의존 관계를 고려하여 다음 순서로 구현한다.

| 순서 | 파일 | 이유 |
|------|------|------|
| 1 | `apps/web/app/lib/status-prefix-api.ts` | 타입 정의가 page.tsx의 선행 조건 |
| 2 | `apps/web/app/settings/status-prefix/page.tsx` | lib 완성 후 구현. `discord-api.ts`는 기존 파일 재사용 |
| 3 | `apps/web/app/components/SettingsSidebar.tsx` | page.tsx 경로 확정 후 사이드바 연결 |

---

## 6. 기존 코드베이스 충돌 검토

| 항목 | 판단 | 근거 |
|------|------|------|
| `SettingsSidebar.tsx` 수정 | 충돌 없음 | `menuItems` 배열 끝에 항목 추가. `Tag` 아이콘은 `lucide-react`에서 import 가능 (기존 패키지에 포함) |
| `apps/web/app/lib/status-prefix-api.ts` 신규 | 충돌 없음 | 같은 디렉토리의 `newbie-api.ts`, `discord-api.ts`와 독립적 파일. 기존 파일 수정 없음 |
| `apps/web/app/lib/discord-api.ts` 재사용 | 충돌 없음 | `fetchGuildTextChannels` 함수를 import만 하므로 기존 파일을 수정하지 않음 |
| `apps/web/app/settings/status-prefix/page.tsx` 신규 | 충돌 없음 | 새 디렉토리 신규 생성. `apps/web/app/settings/` 하위에 기존 `auto-channel/`, `newbie/` 와 동일한 위치 패턴 |
| `useSettings()` hook 사용 | 충돌 없음 | `SettingsContext`의 `useSettings`는 newbie page.tsx에서 이미 동일하게 사용 중 |
| `process.env.NEXT_PUBLIC_API_URL` | 충돌 없음 | 기존 `newbie-api.ts`, `discord-api.ts`에서 동일한 환경 변수 사용 |
| `credentials: 'include'` | 충돌 없음 | JWT를 쿠키로 처리하는 기존 인증 방식과 일치 |
| `"use client"` 지시어 | 충돌 없음 | `useSettings`, `useState`, `useEffect` 사용으로 클라이언트 컴포넌트 필수. 기존 newbie page.tsx와 동일 패턴 |
| Embed 미리보기 인라인 구현 | 충돌 없음 | 기존 `EmbedPreview.tsx`를 재사용하지 않고 인라인 구현. 기존 컴포넌트는 newbie/WelcomeTab.tsx에서만 사용하므로 영향 없음 |
| 버튼 순서 이동 (▲▼ 버튼) | 충돌 없음 | 외부 드래그 라이브러리 불필요. 기존 의존성 변경 없음 |
| Tailwind CSS 클래스 | 충돌 없음 | 기존 `globals.css`, `tailwind.config` 변경 불필요. 기존 컴포넌트와 동일한 클래스 패턴 사용 |
| `lucide-react` `Tag` 아이콘 | 충돌 없음 | 기존 `lucide-react` 패키지 버전(`^0.562.0`)에 포함된 아이콘 |
| 버튼 25개 제한 | 충돌 없음 | PRD F-STATUS-PREFIX-002 제약 사항을 UI에서 `disabled` 처리로 반영. 별도 유효성 검사 라이브러리 불필요 |

---

## 7. 백엔드 의존성 확인 사항

Unit 9를 완성하려면 백엔드에서 다음 엔드포인트가 준비되어 있어야 한다.

| 엔드포인트 | 설명 |
|-----------|------|
| `GET /api/guilds/:guildId/status-prefix/config` | 설정 조회 (F-STATUS-PREFIX-001) |
| `POST /api/guilds/:guildId/status-prefix/config` | 설정 저장 (F-STATUS-PREFIX-002) |
| `GET /api/guilds/:guildId/channels` | 서버 텍스트 채널 목록 (기존 `discord-api.ts` 사용) |

`GET /api/guilds/:guildId/channels`는 `discord-api.ts`에서 이미 구현된 함수(`fetchGuildTextChannels`)를 그대로 사용한다. 이 엔드포인트가 없을 경우 채널 드롭다운이 빈 상태로 표시되며, `discord-api.ts`의 `catch(() => [])` fallback이 동작한다.

---

## 8. 최종 파일 목록 요약

| 파일 | 분류 | 설명 |
|------|------|------|
| `apps/web/app/lib/status-prefix-api.ts` | 신규 | `StatusPrefixConfig`, `StatusPrefixButton` 타입, `fetchStatusPrefixConfig`, `saveStatusPrefixConfig` |
| `apps/web/app/settings/status-prefix/page.tsx` | 신규 | 설정 전체 UI (기본 설정, Embed 설정, 버튼 목록, 저장) |
| `apps/web/app/components/SettingsSidebar.tsx` | 수정 | `Tag` 아이콘 import 추가, `menuItems`에 게임방 상태 설정 항목 추가 |
