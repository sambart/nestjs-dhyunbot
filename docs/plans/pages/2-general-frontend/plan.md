# Unit 2: General 프론트엔드 — 구현 계획

> 작성일: 2026-03-08
> 범위: F-GENERAL-003 — 일반설정 페이지 슬래시 커맨드 목록 동적 렌더링

---

## 개요

| 항목 | 내용 |
|------|------|
| 관련 PRD | F-GENERAL-003 (`/docs/specs/prd/general.md` § F-GENERAL-003) |
| 구현 단위 | 2-general-frontend |
| 선행 조건 | 백엔드 `GET /api/guilds/:guildId/commands` 엔드포인트 가동 중 (F-GENERAL-002) |
| 수정 경로 | `apps/web/app/settings/guild/[guildId]/page.tsx`, `apps/web/app/lib/discord-api.ts` |

**현재 문제**: `apps/web/app/settings/guild/[guildId]/page.tsx` 상단에 7개 커맨드가 하드코딩된 `commands` 배열로 존재한다. 실제 Discord에 등록된 커맨드 목록과 불일치할 수 있으며, 커맨드가 추가/삭제되어도 UI가 자동으로 반영되지 않는다.

---

## 1. 생성/수정 파일 전체 목록

### 1-1. 기존 수정 파일

```
apps/web/app/lib/discord-api.ts                        ← SlashCommand 인터페이스 + fetchGuildCommands 추가
apps/web/app/settings/guild/[guildId]/page.tsx          ← 하드코딩 제거, 동적 렌더링으로 교체
```

신규 파일 생성 없음. 두 파일 모두 기존 수정이다.

---

## 2. API 클라이언트 설계

### 2-1. `apps/web/app/lib/discord-api.ts` 추가 내용

기존 `fetchGuildChannels`, `fetchGuildRoles`, `fetchGuildEmojis` 함수 패턴을 그대로 따른다.

**추가할 인터페이스 및 함수**:

```typescript
export interface SlashCommand {
  id: string;
  name: string;
  description: string;
}

export async function fetchGuildCommands(
  guildId: string,
): Promise<SlashCommand[]> {
  try {
    const res = await fetch(`/api/guilds/${guildId}/commands`);
    if (!res.ok) return [];
    return res.json() as Promise<SlashCommand[]>;
  } catch {
    return [];
  }
}
```

**설계 근거**:
- `refresh` 파라미터가 없는 이유: 커맨드 목록은 Discord 봇 재시작 시에만 변경되며, 실시간 갱신 요구사항이 없다. 기존 `fetchGuildEmojis`와 달리 `?refresh=true` 지원이 PRD에 명시되지 않았으므로 단순하게 유지한다.
- `try/catch` + 빈 배열 fallback 패턴은 기존 세 함수와 동일하다. API 오류 시 페이지 자체가 깨지지 않도록 방어한다.
- URL 패턴 `/api/guilds/${guildId}/commands`는 Next.js 프록시 라우트 `apps/web/app/api/guilds/[...path]/route.ts`가 그대로 백엔드로 전달한다.

**파일 내 삽입 위치**: `formatEmojiString` 함수 아래 (파일 끝)에 추가한다.

---

## 3. 페이지 컴포넌트 설계

### 3-1. `apps/web/app/settings/guild/[guildId]/page.tsx` 전면 교체

현재 파일은 Server Component (최상단에 `"use client"` 없음)이며 `commands` 배열을 하드코딩하고 있다. `useEffect`와 `useState`를 사용해야 하므로 **Client Component로 전환**해야 한다.

**import 목록**:

```typescript
'use client';

import { Bot, Hash, Loader2, Mic, Music } from 'lucide-react';
import { useEffect, useState } from 'react';

import { fetchGuildCommands } from '../../../lib/discord-api';
import type { SlashCommand } from '../../../lib/discord-api';
import { useSettings } from '../../SettingsContext';
```

`Loader2`는 기존 `9-status-prefix-web` 등에서 로딩 스피너로 사용 중인 lucide-react 아이콘이다.

### 3-2. 아이콘 매핑 함수

```typescript
function getCommandIcon(name: string): React.ElementType {
  if (['play', 'stop', 'skip'].includes(name)) return Music;
  if (name.startsWith('voice-') || name === 'my-voice-stats') return Mic;
  if (name === 'community-health') return Bot;
  return Hash;
}
```

**PRD 명세 대비 구현 결정**:
- PRD는 `voice-stats`, `my-voice-stats`, `voice-leaderboard`를 `Mic`으로 지정한다. `voice-stats`와 `voice-leaderboard` 모두 `voice-`로 시작하므로 `name.startsWith('voice-')` 조건으로 커버된다.
- `my-voice-stats`는 `voice-`로 시작하지 않으므로 별도 `=== 'my-voice-stats'` 조건을 추가한다.
- 향후 voice 관련 신규 커맨드가 추가되면 `voice-` prefix 규칙을 따르는 한 자동으로 `Mic` 아이콘이 적용된다.
- 이 함수는 컴포넌트 외부에 순수 함수로 정의하여 매 렌더링마다 재생성되지 않도록 한다.

### 3-3. 상태 구조

```typescript
export default function SettingsPage() {
  const { selectedGuildId } = useSettings();

  const [commands, setCommands] = useState<SlashCommand[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ...
}
```

`useSettings()`로 `selectedGuildId`를 주입받는다. 페이지 파일이 `[guildId]` 동적 세그먼트 아래에 있어 URL 파라미터에서 직접 읽을 수도 있으나, 기존 설정 페이지들이 모두 `useSettings()` 패턴을 사용하므로 동일하게 따른다.

### 3-4. 데이터 로드

```typescript
useEffect(() => {
  if (!selectedGuildId) {
    setCommands([]);
    return;
  }

  setIsLoading(true);
  setError(null);

  fetchGuildCommands(selectedGuildId)
    .then((data) => {
      setCommands(data);
    })
    .catch(() => {
      setError('커맨드 목록을 불러오지 못했습니다.');
      setCommands([]);
    })
    .finally(() => {
      setIsLoading(false);
    });
}, [selectedGuildId]);
```

**설계 근거**:
- `fetchGuildCommands`는 내부적으로 `catch`로 빈 배열을 반환하므로 `.catch` 분기에 도달하는 경우는 예상치 못한 예외뿐이다. 그러나 에러 상태를 분리해 두는 이유는 PRD가 "에러 시 빈 목록 + 에러 메시지" 표시를 명시적으로 요구하기 때문이다. API 함수가 빈 배열을 반환하더라도 응답 상태코드가 비정상이었다면 에러 메시지를 함께 표시해야 한다.
- 따라서 `fetchGuildCommands` 내부 구현을 수정하여 `!res.ok` 시 예외를 throw하거나, 페이지에서 별도 fetch를 수행하는 두 가지 방법이 있다. `discord-api.ts`의 기존 세 함수 모두 빈 배열을 반환하는 silent-fail 패턴이므로, **이 패턴을 깨지 않기 위해** `fetchGuildCommands`는 동일하게 빈 배열을 반환한다. 에러 메시지는 `commands.length === 0 && !isLoading` 조건으로 표시한다.

### 3-5. 전체 JSX 구조

```
<div className="max-w-3xl">
  <h1>일반 설정</h1>

  {/* 섹션 1: 봇 정보 */}
  <section className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
    <h2>봇 정보</h2>
    <div>
      {/* 커맨드 프리픽스 행 (기존 유지) */}
      {/* 등록된 명령어 카운트 — commands.length로 동적 표시 */}
    </div>
  </section>

  {/* 섹션 2: 슬래시 커맨드 목록 */}
  <section className="bg-white rounded-xl border border-gray-200 p-6">
    <h2>슬래시 커맨드</h2>
    {/* 로딩 중 */}
    {/* 에러 메시지 (빈 목록일 때) */}
    {/* 커맨드 목록 */}
  </section>
</div>
```

### 3-6. 로딩 상태 렌더링

섹션 2 내부에 인라인으로 처리한다. 섹션 전체를 대체하지 않고 목록 영역만 교체한다.

```tsx
{isLoading ? (
  <div className="flex items-center justify-center py-8">
    <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
  </div>
) : commands.length === 0 ? (
  <div className="text-center py-8">
    <p className="text-sm text-gray-400">등록된 슬래시 커맨드가 없습니다.</p>
  </div>
) : (
  <div className="space-y-2">
    {commands.map((cmd) => {
      const Icon = getCommandIcon(cmd.name);
      return (
        <div
          key={cmd.id}
          className="flex items-center space-x-3 px-4 py-3 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <Icon className="w-4 h-4 text-indigo-500" />
          <span className="text-sm font-mono font-medium text-gray-900">
            /{cmd.name}
          </span>
          <span className="text-sm text-gray-500">{cmd.description}</span>
        </div>
      );
    })}
  </div>
)}
```

**설계 근거**:
- `key={cmd.id}`: Discord Application Command ID는 안정적인 고유 식별자이므로 `key`로 적합하다. 기존 하드코딩에서는 `key={cmd.name}`을 사용했으나 API 응답에 `id`가 포함되므로 변경한다.
- `/{cmd.name}`: PRD 명세에 따라 `name` 필드(슬래시 제외) 앞에 `/`를 붙여 표시한다.
- 에러 시 별도 에러 메시지 컴포넌트를 추가하지 않고 빈 목록 상태에서 안내 문구로 처리한다. API가 silent-fail 패턴이므로 `isLoading === false && commands.length === 0`이면 에러 또는 빈 상태 모두 동일하게 표시된다.

### 3-7. "등록된 명령어" 카운트 동적 갱신

섹션 1의 카운트 표시를 `commands.length`로 변경한다.

```tsx
{/* 기존 */}
<span className="text-sm text-gray-500">{commands.length}개</span>

{/* 로딩 중일 때 */}
<span className="text-sm text-gray-500">
  {isLoading ? '—' : `${commands.length}개`}
</span>
```

로딩 중에는 `—`(em dash)를 표시하여 빈 값과 구분한다.

---

## 4. 파일별 상세 구현

### 4-1. `apps/web/app/lib/discord-api.ts`

파일 끝에 두 항목을 추가한다.

**추가 위치**: `formatEmojiString` 함수(77번째 줄) 다음.

**추가 내용**:
```typescript
export interface SlashCommand {
  id: string;
  name: string;
  description: string;
}

export async function fetchGuildCommands(
  guildId: string,
): Promise<SlashCommand[]> {
  try {
    const res = await fetch(`/api/guilds/${guildId}/commands`);
    if (!res.ok) return [];
    return res.json() as Promise<SlashCommand[]>;
  } catch {
    return [];
  }
}
```

**기존 코드 변경 없음**: 기존 4개 인터페이스/함수는 그대로 유지된다.

---

### 4-2. `apps/web/app/settings/guild/[guildId]/page.tsx`

파일 전체를 아래 구조로 교체한다.

```typescript
'use client';

import { Bot, Hash, Loader2, Mic, Music } from 'lucide-react';
import { useEffect, useState } from 'react';

import { fetchGuildCommands } from '../../../lib/discord-api';
import type { SlashCommand } from '../../../lib/discord-api';
import { useSettings } from '../../SettingsContext';

function getCommandIcon(name: string): React.ElementType {
  if (['play', 'stop', 'skip'].includes(name)) return Music;
  if (name.startsWith('voice-') || name === 'my-voice-stats') return Mic;
  if (name === 'community-health') return Bot;
  return Hash;
}

export default function SettingsPage() {
  const { selectedGuildId } = useSettings();
  const [commands, setCommands] = useState<SlashCommand[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!selectedGuildId) {
      setCommands([]);
      return;
    }

    setIsLoading(true);
    fetchGuildCommands(selectedGuildId)
      .then(setCommands)
      .finally(() => setIsLoading(false));
  }, [selectedGuildId]);

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">일반 설정</h1>

      {/* 봇 정보 */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">봇 정보</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between py-3 border-b border-gray-100">
            <div className="flex items-center space-x-3">
              <Hash className="w-5 h-5 text-gray-400" />
              <span className="text-sm text-gray-700">커맨드 프리픽스</span>
            </div>
            <span className="text-sm font-mono bg-gray-100 px-3 py-1 rounded">
              !
            </span>
          </div>
          <div className="flex items-center justify-between py-3">
            <div className="flex items-center space-x-3">
              <Bot className="w-5 h-5 text-gray-400" />
              <span className="text-sm text-gray-700">등록된 명령어</span>
            </div>
            <span className="text-sm text-gray-500">
              {isLoading ? '—' : `${commands.length}개`}
            </span>
          </div>
        </div>
      </section>

      {/* 슬래시 커맨드 목록 */}
      <section className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          슬래시 커맨드
        </h2>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
          </div>
        ) : commands.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-gray-400">등록된 슬래시 커맨드가 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {commands.map((cmd) => {
              const Icon = getCommandIcon(cmd.name);
              return (
                <div
                  key={cmd.id}
                  className="flex items-center space-x-3 px-4 py-3 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <Icon className="w-4 h-4 text-indigo-500" />
                  <span className="text-sm font-mono font-medium text-gray-900">
                    /{cmd.name}
                  </span>
                  <span className="text-sm text-gray-500">{cmd.description}</span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
```

**`'use client'` 추가 근거**: `useEffect`, `useState`, `useSettings` (내부적으로 `useContext` 사용) 모두 React 훅이므로 클라이언트 컴포넌트가 필수다. 기존 파일은 Server Component였으나 동적 데이터 로딩을 위해 전환이 불가피하다.

**에러 상태 분리 미구현 근거**: `fetchGuildCommands`가 예외 시 빈 배열을 반환하고 에러를 전파하지 않는다(`discord-api.ts` 패턴). 별도 `error` 상태를 추가하면 에러 경로가 도달 불가능(unreachable)한 dead code가 된다. "빈 목록 + 안내 문구" 표시가 PRD 요구사항을 충족한다.

---

## 5. 구현 단계 순서

파일 간 의존 관계를 고려한 구현 순서:

| 순서 | 파일 | 이유 |
|------|------|------|
| 1 | `apps/web/app/lib/discord-api.ts` | `SlashCommand` 타입과 `fetchGuildCommands` 함수가 `page.tsx`의 선행 조건 |
| 2 | `apps/web/app/settings/guild/[guildId]/page.tsx` | `discord-api.ts` 완성 후 구현 |

---

## 6. 기존 코드베이스 충돌 검토

| 항목 | 판단 | 근거 |
|------|------|------|
| `discord-api.ts` 기존 코드 | 충돌 없음 | 파일 끝에 추가만 하며 기존 4개 인터페이스/함수를 수정하지 않는다 |
| `page.tsx` Server → Client 전환 | 충돌 없음 | `[guildId]` 레이아웃 파일(`layout.tsx`)이 존재하지 않으므로 부모 경계에 영향 없음. 라우팅은 Next.js App Router가 그대로 처리한다 |
| `useSettings()` 훅 | 충돌 없음 | `SettingsContext`의 `useSettings`는 기존 newbie, status-prefix 페이지에서 동일하게 사용 중 |
| `Loader2` 아이콘 | 충돌 없음 | `lucide-react` 패키지에 포함. 기존 status-prefix 페이지에서 이미 import하여 사용 중 |
| Next.js 프록시 라우트 | 충돌 없음 | `apps/web/app/api/guilds/[...path]/route.ts`는 `/api/guilds/*` 경로를 모두 프록시하므로 `/api/guilds/${guildId}/commands`도 자동으로 처리된다. 프록시 파일 수정 불필요 |
| `"use client"` 지시어 추가 | 충돌 없음 | Next.js App Router에서 클라이언트 컴포넌트는 해당 파일 단위로만 적용된다. 상위 레이아웃(Server Component)에 영향 없음 |
| `getCommandIcon` 함수 컴포넌트 외부 정의 | 충돌 없음 | 순수 함수이므로 모듈 스코프에 정의해도 안전하다. React Context나 상태를 참조하지 않는다 |
| `key={cmd.id}` (기존 `key={cmd.name}` 교체) | 충돌 없음 | Discord Application Command ID는 안정적 고유 식별자. 기존 하드코딩 배열 제거와 함께 자연스럽게 교체 |

---

## 7. 백엔드 의존성 확인 사항

| 엔드포인트 | 설명 |
|-----------|------|
| `GET /api/guilds/:guildId/commands` | Discord에 등록된 슬래시 커맨드 목록 반환 (F-GENERAL-002) |

이 엔드포인트가 없거나 오류를 반환하면 `fetchGuildCommands`의 `if (!res.ok) return []` 분기가 동작하여 빈 목록이 표시된다. 페이지 자체는 정상 렌더링된다.

---

## 8. 최종 파일 목록 요약

| 파일 | 분류 | 변경 내용 |
|------|------|-----------|
| `apps/web/app/lib/discord-api.ts` | 수정 | `SlashCommand` 인터페이스 추가, `fetchGuildCommands` 함수 추가 (기존 코드 변경 없음) |
| `apps/web/app/settings/guild/[guildId]/page.tsx` | 수정 | `'use client'` 추가, 하드코딩 `commands` 배열 제거, `useSettings` + `useState` + `useEffect` 기반 동적 렌더링으로 교체 |
