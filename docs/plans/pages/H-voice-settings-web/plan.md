# H-voice-settings-web 구현 계획

## 개요

`/settings/guild/{guildId}/voice` 음성 설정 페이지 프론트엔드 구현 계획.
PRD F-WEB-006 및 공통 모듈 설계 VEC-2-5, VEC-3-4를 기반으로 한다.

---

## 참조 문서

- `docs/specs/prd/web.md` — F-WEB-006 음성 설정 페이지
- `docs/specs/common-modules.md` — VEC-2-5 웹 API 클라이언트, VEC-3-4 SettingsSidebar 수정
- 기존 패턴 참조:
  - `apps/web/app/lib/sticky-message-api.ts` — API 클라이언트 패턴
  - `apps/web/app/settings/guild/[guildId]/sticky-message/page.tsx` — 단일 폼 설정 페이지 패턴
  - `apps/web/app/components/SettingsSidebar.tsx` — 사이드바 메뉴 구조
  - `apps/web/app/lib/discord-api.ts` — `fetchGuildChannels`, `DiscordChannel` 인터페이스 재사용
  - `apps/web/app/settings/SettingsContext.tsx` — `useSettings` 훅 (selectedGuildId)

---

## 현황 파악

### 백엔드 상태

- `apps/api/src/channel/voice/domain/voice-excluded-channel.entity.ts` — 존재
- `apps/api/src/channel/voice/presentation/voice-excluded-channel.controller.ts` — G-voice-excluded-channel-backend 단위에서 구현 예정
- API 엔드포인트:
  - `GET /api/guilds/{guildId}/voice/excluded-channels` → `{ excludedChannelIds: string[] }`
  - `POST /api/guilds/{guildId}/voice/excluded-channels` → 전체 교체, 요청 바디: `{ excludedChannelIds: string[] }`

> 본 계획은 프론트엔드 구현만 다룬다. 백엔드 API가 준비되지 않으면 API 호출은 오류를 반환한다. 프론트엔드는 오류를 graceful하게 처리한다.

### 프론트엔드 상태

- `apps/web/app/settings/guild/[guildId]/voice/page.tsx` — 미존재 (신규 생성)
- `apps/web/app/lib/voice-api.ts` — 미존재 (신규 생성)
- `apps/web/app/components/SettingsSidebar.tsx` — "음성 설정" 메뉴 항목 없음 (수정 필요)
- `apps/web/app/api/guilds/[...path]/route.ts` — 와일드카드 프록시 라우트가 이미 존재하므로 추가 파일 불필요

---

## 구현 단계 및 개발 항목

### 단계 1: API 클라이언트 — `apps/web/app/lib/voice-api.ts` (신규)

VEC-2-5에서 인터페이스와 함수 시그니처가 사전 확정되었다. 그대로 구현한다.

#### 1-1. 타입 인터페이스 정의

```typescript
/** GET /api/guilds/{guildId}/voice/excluded-channels 응답 형식 */
export interface VoiceExcludedChannelsResponse {
  excludedChannelIds: string[];
}

/** POST /api/guilds/{guildId}/voice/excluded-channels 요청 바디 */
export interface VoiceExcludedChannelsSaveDto {
  excludedChannelIds: string[];
}
```

#### 1-2. API 함수

```typescript
/**
 * 제외 채널 목록 조회 (F-VOICE-013).
 * 실패 시 빈 배열 반환 (초기 로드 중단 방지).
 */
export async function fetchVoiceExcludedChannels(
  guildId: string,
): Promise<string[]>
  // GET /api/guilds/{guildId}/voice/excluded-channels
  // 성공: response.excludedChannelIds (string[])
  // 실패: [] 반환 (throw 안 함 — 초기 로드에서 catch 생략 가능하게)

/**
 * 제외 채널 목록 저장 — 전체 교체 방식 (F-WEB-006).
 * 실패 시 Error throw.
 */
export async function saveVoiceExcludedChannels(
  guildId: string,
  excludedChannelIds: string[],
): Promise<void>
  // POST /api/guilds/{guildId}/voice/excluded-channels
  // 요청 바디: { excludedChannelIds }
  // 성공: void
  // 실패: Error throw (백엔드 오류 메시지 포함)
```

**오류 처리 패턴**:
- `fetchVoiceExcludedChannels`: `res.ok`가 false이거나 예외 발생 시 `[]` 반환. `sticky-message-api.ts`의 `fetchStickyMessages`와 달리 throw하지 않는다. 초기 로드 시 `Promise.all` 내부에서 `.catch((): string[] => [])` 생략을 가능하게 한다.
- `saveVoiceExcludedChannels`: `res.ok`가 false이면 응답 바디에서 `message` 추출 후 `Error` throw. `sticky-message-api.ts`의 `saveStickyMessage` 패턴 동일 적용.

**기존 코드베이스 충돌 검토**: 없음. `discord-api.ts`, `sticky-message-api.ts`와 네임스페이스 충돌 없다. 프록시 라우트 `apps/web/app/api/guilds/[...path]/route.ts`가 `/api/guilds/{guildId}/voice/excluded-channels`를 자동으로 처리한다.

---

### 단계 2: 사이드바 메뉴 추가 — `apps/web/app/components/SettingsSidebar.tsx` (수정)

VEC-3-4에서 수정 내용이 사전 확정되었다.

#### 2-1. import 수정

현재 import:
```typescript
import { ArrowLeftRight, Pin, Radio, Settings, Tag, Users } from "lucide-react";
```

`Mic` 아이콘 추가:
```typescript
import { ArrowLeftRight, Mic, Pin, Radio, Settings, Tag, Users } from "lucide-react";
```

#### 2-2. menuItems 배열에 항목 추가

현재 `menuItems` 배열 마지막에 추가:
```typescript
{ href: `/settings/guild/${selectedGuildId}/voice`, label: "음성 설정", icon: Mic },
```

최종 `menuItems` 배열:
```typescript
const menuItems = [
  { href: `/settings/guild/${selectedGuildId}`, label: "일반 설정", icon: Settings },
  { href: `/settings/guild/${selectedGuildId}/auto-channel`, label: "자동방 설정", icon: Radio },
  { href: `/settings/guild/${selectedGuildId}/newbie`, label: "신입 관리", icon: Users },
  { href: `/settings/guild/${selectedGuildId}/status-prefix`, label: "게임방 상태 설정", icon: Tag },
  { href: `/settings/guild/${selectedGuildId}/sticky-message`, label: "고정메세지", icon: Pin },
  { href: `/settings/guild/${selectedGuildId}/voice`, label: "음성 설정", icon: Mic },
];
```

**기존 코드베이스 충돌 검토**: `menuItems` 배열은 `.map()` 렌더링이므로 항목 추가는 기존 메뉴에 영향을 주지 않는다. `Mic` 아이콘은 `lucide-react`에 존재하며 현재 사용 중인 아이콘(`ArrowLeftRight`, `Pin`, `Radio`, `Settings`, `Tag`, `Users`)과 중복되지 않는다.

---

### 단계 3: 음성 설정 페이지 — `apps/web/app/settings/guild/[guildId]/voice/page.tsx` (신규)

#### 3-1. 컴포넌트 상태

```typescript
/** 멀티 셀렉트 드롭다운의 옵션 항목 */
interface ChannelOption {
  id: string;
  name: string;
  type: 2 | 4; // 2 = GUILD_VOICE, 4 = GUILD_CATEGORY
}

// 상태 변수
const [selectedIds, setSelectedIds] = useState<string[]>([]);
const [channelOptions, setChannelOptions] = useState<ChannelOption[]>([]);
const [isLoading, setIsLoading] = useState(false);
const [isRefreshing, setIsRefreshing] = useState(false);
const [isDropdownOpen, setIsDropdownOpen] = useState(false);
const [isSaving, setIsSaving] = useState(false);
const [saveSuccess, setSaveSuccess] = useState(false);
const [saveError, setSaveError] = useState<string | null>(null);
```

**설계 근거**:
- `selectedIds`: 선택된 채널/카테고리 ID 배열. PRD 저장 요청 바디 `{ excludedChannelIds: string[] }`와 1:1 대응.
- `channelOptions`: type 2(음성 채널)와 type 4(카테고리)만 필터링하여 보관. `DiscordChannel` 인터페이스를 직접 사용하지 않고 필요한 필드만 추출한 로컬 타입 사용.
- `isDropdownOpen`: 멀티 셀렉트 드롭다운 열림/닫힘 상태. 커스텀 드롭다운으로 구현 (native `<select multiple>` 대신 — 태그/칩 표시가 native에서 불가능하므로).
- 단일 저장 상태 (`isSaving`, `saveSuccess`, `saveError`): 카드별 독립 저장 상태가 아닌 페이지 단위 단일 저장 폼이므로 Map 불필요.

#### 3-2. 초기 데이터 로드

`useEffect([selectedGuildId])` 내부에서 `Promise.all`로 병렬 조회:

```typescript
useEffect(() => {
  if (!selectedGuildId) return;

  setIsLoading(true);
  setSelectedIds([]);

  Promise.all([
    fetchVoiceExcludedChannels(selectedGuildId),   // 실패 시 [] 반환
    fetchGuildChannels(selectedGuildId),            // 실패 시 [] 반환
  ])
    .then(([excludedIds, allChannels]) => {
      const options: ChannelOption[] = allChannels
        .filter((ch) => ch.type === 2 || ch.type === 4)
        .map((ch) => ({ id: ch.id, name: ch.name, type: ch.type as 2 | 4 }));
      setChannelOptions(options);
      setSelectedIds(excludedIds);
    })
    .catch(() => {})
    .finally(() => setIsLoading(false));
}, [selectedGuildId]);
```

**PRD 근거 (F-WEB-006 초기 로드)**:
1. `GET /api/guilds/{guildId}/voice/excluded-channels` → 현재 제외 채널 ID 배열
2. 음성 채널 + 카테고리 목록 조회 (`fetchGuildChannels` → `type === 2 || type === 4` 필터)
3. 기존 제외 채널 목록을 드롭다운 선택 상태에 반영

**`fetchGuildChannels` 재사용 근거**: `discord-api.ts`에 이미 정의된 `fetchGuildChannels`는 전체 채널을 반환하므로 클라이언트 측에서 `type === 2 || type === 4` 필터링만 하면 된다. `fetchGuildTextChannels`는 `type === 0`만 반환하므로 이 페이지에서는 사용하지 않는다.

#### 3-3. 채널 새로고침 핸들러

```typescript
const refreshChannels = async () => {
  if (!selectedGuildId || isRefreshing) return;
  setIsRefreshing(true);
  try {
    const allChannels = await fetchGuildChannels(selectedGuildId, true).catch(
      (): DiscordChannel[] => [],
    );
    const options: ChannelOption[] = allChannels
      .filter((ch) => ch.type === 2 || ch.type === 4)
      .map((ch) => ({ id: ch.id, name: ch.name, type: ch.type as 2 | 4 }));
    setChannelOptions(options);
  } finally {
    setIsRefreshing(false);
  }
};
```

`sticky-message/page.tsx`의 `refreshChannels`와 동일한 패턴. `fetchGuildChannels(guildId, true)` — `refresh=true` 플래그로 캐시 무효화.

#### 3-4. 멀티 셀렉트 드롭다운 핸들러

```typescript
/** 항목 선택 토글 */
const toggleSelect = (id: string) => {
  setSelectedIds((prev) =>
    prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
  );
};

/** 선택된 태그 제거 */
const removeSelected = (id: string) => {
  setSelectedIds((prev) => prev.filter((x) => x !== id));
};
```

#### 3-5. 저장 핸들러

```typescript
const handleSave = async () => {
  if (!selectedGuildId || isSaving) return;

  setIsSaving(true);
  setSaveError(null);
  setSaveSuccess(false);

  try {
    await saveVoiceExcludedChannels(selectedGuildId, selectedIds);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  } catch (err) {
    setSaveError(err instanceof Error ? err.message : '저장에 실패했습니다.');
  } finally {
    setIsSaving(false);
  }
};
```

**PRD 근거 (F-WEB-006 저장 동작)**:
1. 별도 필수 항목 없음 — `selectedIds`가 빈 배열이어도 저장 가능 (제외 채널 전체 해제)
2. `POST /api/guilds/{guildId}/voice/excluded-channels` 호출, 바디: `{ excludedChannelIds: selectedIds }`
3. 성공 시 "저장되었습니다." 인라인 메시지 3초 후 자동 소멸
4. 실패 시 오류 인라인 메시지

#### 3-6. 드롭다운 외부 클릭 닫기

드롭다운이 열린 상태에서 외부를 클릭하면 닫혀야 한다. `useRef`와 `useEffect`로 구현:

```typescript
const dropdownRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  const handleClickOutside = (e: MouseEvent) => {
    if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
      setIsDropdownOpen(false);
    }
  };
  document.addEventListener('mousedown', handleClickOutside);
  return () => document.removeEventListener('mousedown', handleClickOutside);
}, []);
```

#### 3-7. 파생 데이터 (useMemo 없이 인라인 계산)

```typescript
// 선택된 항목 객체 목록 (태그 렌더링용)
const selectedOptions = channelOptions.filter((o) => selectedIds.includes(o.id));

// 카테고리가 하나라도 선택되었는지 (안내 문구 표시 조건)
const hasCategorySelected = selectedOptions.some((o) => o.type === 4);
```

항목 수가 적으므로 `useMemo` 없이 렌더링마다 계산해도 성능 문제 없다. 기존 페이지들이 동일하게 처리한다.

#### 3-8. 조건부 렌더링

`sticky-message/page.tsx` 패턴 준용:

1. `!selectedGuildId` → "서버를 선택하세요." (`Server` 아이콘)
2. `isLoading` → `<Loader2 className="animate-spin" />`
3. 정상 → 메인 렌더링

#### 3-9. 메인 UI 구조

```
<div className="max-w-3xl">
  {/* 페이지 헤더: 제목 + 채널 새로고침 버튼 */}
  <div className="flex items-center justify-between mb-6">
    <div className="flex items-center space-x-3">
      <Mic className="w-6 h-6 text-indigo-600" />
      <h1 className="text-2xl font-bold text-gray-900">음성 설정</h1>
    </div>
    <button onClick={refreshChannels} disabled={isRefreshing}>
      <RefreshCw />
      채널 새로고침
    </button>
  </div>

  {/* 설정 섹션 */}
  <section className="bg-white rounded-xl border border-gray-200 p-6">
    <h2 className="text-sm font-semibold text-gray-900 mb-4">음성 시간 제외 채널</h2>

    {/* 선택된 태그 목록 */}
    {selectedOptions.length > 0 && (
      <div className="flex flex-wrap gap-2 mb-3">
        {selectedOptions.map((opt) => (
          <span key={opt.id} className="태그 스타일">
            {opt.type === 4 ? '📁' : '🔊'} {opt.name}
            <button onClick={() => removeSelected(opt.id)}>×</button>
          </span>
        ))}
      </div>
    )}

    {/* 멀티 셀렉트 드롭다운 */}
    <div ref={dropdownRef} className="relative">
      <button onClick={() => setIsDropdownOpen((v) => !v)} className="드롭다운 트리거">
        채널 또는 카테고리 선택...
        <ChevronDown />
      </button>

      {isDropdownOpen && (
        <ul className="드롭다운 목록 (absolute, z-10, bg-white, border, shadow)">
          {channelOptions.length === 0 ? (
            <li>채널 목록을 불러올 수 없습니다.</li>
          ) : (
            channelOptions.map((opt) => (
              <li key={opt.id} onClick={() => toggleSelect(opt.id)}>
                <span>{opt.type === 4 ? '📁' : '🔊'}</span>
                <span>{opt.name}</span>
                {selectedIds.includes(opt.id) && <Check className="체크 아이콘" />}
              </li>
            ))
          )}
        </ul>
      )}
    </div>

    {/* 카테고리 선택 안내 문구 */}
    {hasCategorySelected && (
      <p className="text-xs text-amber-600 mt-2">
        카테고리 선택 시 하위 음성 채널 전체가 제외됩니다.
      </p>
    )}

    {/* 저장 피드백 + 저장 버튼 */}
    <div className="flex items-center justify-between gap-4 mt-6 pt-4 border-t border-gray-100">
      <div className="flex-1">
        {saveSuccess && (
          <p className="text-sm text-green-600 font-medium">저장되었습니다.</p>
        )}
        {saveError && (
          <p className="text-sm text-red-600 font-medium">{saveError}</p>
        )}
      </div>
      <button
        onClick={handleSave}
        disabled={isSaving}
        className="px-6 py-2 bg-indigo-600 text-white rounded-lg ..."
      >
        {isSaving ? '저장 중...' : '저장'}
      </button>
    </div>
  </section>
</div>
```

#### 3-10. 드롭다운 스타일 상세

| 요소 | 클래스 |
|------|--------|
| 드롭다운 트리거 버튼 | `w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-left flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-indigo-500` |
| 드롭다운 목록 컨테이너 | `absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto` |
| 드롭다운 목록 항목 (기본) | `flex items-center px-3 py-2 text-sm cursor-pointer hover:bg-gray-50` |
| 드롭다운 목록 항목 (선택됨) | `bg-indigo-50 text-indigo-700` |
| 태그(칩) | `inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-medium` |
| 태그 제거 버튼 | `ml-1 text-indigo-400 hover:text-indigo-700` |

#### 3-11. import 목록

```typescript
'use client';

import { Check, ChevronDown, Loader2, Mic, RefreshCw, Server } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import type { DiscordChannel } from '../../../../lib/discord-api';
import { fetchGuildChannels } from '../../../../lib/discord-api';
import { fetchVoiceExcludedChannels, saveVoiceExcludedChannels } from '../../../../lib/voice-api';
import { useSettings } from '../../../SettingsContext';
```

---

## 파일별 구현 목록 요약

| 파일 | 작업 | 주요 내용 |
|------|------|-----------|
| `apps/web/app/lib/voice-api.ts` | 신규 생성 | `VoiceExcludedChannelsResponse`, `VoiceExcludedChannelsSaveDto` 인터페이스, `fetchVoiceExcludedChannels`, `saveVoiceExcludedChannels` 함수 |
| `apps/web/app/components/SettingsSidebar.tsx` | 수정 | `Mic` 아이콘 import 추가, `menuItems`에 `{ href: .../voice, label: '음성 설정', icon: Mic }` 추가 |
| `apps/web/app/settings/guild/[guildId]/voice/page.tsx` | 신규 생성 | `'use client'` 페이지 컴포넌트, 멀티 셀렉트 드롭다운, 태그 표시, 카테고리 안내 문구, 채널 새로고침, 저장 버튼 + 인라인 피드백 |

---

## 기존 코드베이스 충돌 검토

| 항목 | 충돌 여부 | 근거 |
|------|-----------|------|
| 프록시 라우트 | 없음 | `apps/web/app/api/guilds/[...path]/route.ts`가 와일드카드로 `/api/guilds/**` 전체 처리. 추가 불필요 |
| `discord-api.ts` | 없음 | `fetchGuildChannels`, `DiscordChannel` 그대로 재사용. 함수 시그니처 변경 없음 |
| `SettingsSidebar.tsx` | 없음 | `menuItems` 배열 항목 추가만이며 기존 `.map()` 렌더링 로직 변경 없음 |
| `useSettings` 훅 | 없음 | `selectedGuildId` 제공, 기존 컨텍스트 그대로 사용 |
| `lucide-react` Mic 아이콘 | 없음 | `lucide-react`에 `Mic` 아이콘 존재. 기존 사용 아이콘(`ArrowLeftRight`, `Pin`, `Radio`, `Settings`, `Tag`, `Users`)과 중복 없음 |
| `voice-api.ts` 네임스페이스 | 없음 | 기존 lib 파일(`discord-api.ts`, `sticky-message-api.ts`, `newbie-api.ts`, `status-prefix-api.ts`)과 파일명/export명 중복 없음 |
| 페이지 라우트 경로 | 없음 | `voice/page.tsx` 디렉터리 신규 생성. 기존 `auto-channel`, `newbie`, `status-prefix`, `sticky-message` 라우트와 충돌 없음 |

---

## DRY 준수 사항

| 재사용 대상 | 위치 | 사용 방식 |
|-------------|------|-----------|
| `fetchGuildChannels` | `apps/web/app/lib/discord-api.ts` | 음성 채널 + 카테고리 목록 조회 후 `type === 2 \|\| type === 4` 필터링 |
| `DiscordChannel` 인터페이스 | `apps/web/app/lib/discord-api.ts` | `id`, `name`, `type` 필드 참조 |
| `useSettings` | `apps/web/app/settings/SettingsContext.tsx` | `selectedGuildId` 획득 |
| 조건부 렌더링 패턴 | `sticky-message/page.tsx` 참조 | `!selectedGuildId` → Server 아이콘, `isLoading` → Loader2 animate-spin |
| 채널 새로고침 패턴 | `sticky-message/page.tsx` 참조 | `refresh=true` 플래그, `isRefreshing` 상태, finally 블록 |
| 저장 피드백 패턴 | `sticky-message/page.tsx` 참조 | `saveSuccess` 3초 자동 소멸, `saveError` 인라인 표시 |
| 페이지 헤더 레이아웃 | `sticky-message/page.tsx` 참조 | 제목(아이콘 + 텍스트) + 우측 새로고침 버튼의 `flex justify-between` 구조 |

> 멀티 셀렉트 드롭다운은 이 페이지에서만 사용하는 신규 UI 패턴이며 기존 페이지에 없다. 별도 공통 컴포넌트로 분리하지 않고 페이지 내 인라인으로 구현한다. 기존 페이지들이 Embed 미리보기, 토글 등 고유 UI를 모두 인라인 처리하는 패턴과 동일하다.

---

## 구현 순서

```
단계 1: voice-api.ts 생성         (의존성 없음)
단계 2: SettingsSidebar.tsx 수정  (의존성 없음)
단계 3: voice/page.tsx 생성       (단계 1에 의존)
```

단계 1, 2는 병렬 진행 가능. 단계 3은 단계 1 완료 후 진행한다.
