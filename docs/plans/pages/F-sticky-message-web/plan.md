# F-sticky-message-web 구현 계획

## 개요

`/settings/guild/{guildId}/sticky-message` 고정메세지 설정 페이지 프론트엔드 구현 계획.
PRD F-WEB-005, F-STICKY-001~003을 기반으로 한다.

---

## 참조 문서

- `/docs/specs/prd/web.md` — F-WEB-005 고정메세지 설정 페이지
- `/docs/specs/prd/sticky-message.md` — F-STICKY-001~003 API 스펙, 데이터 모델
- 기존 패턴 참조:
  - `apps/web/app/lib/status-prefix-api.ts` — API 클라이언트 패턴
  - `apps/web/app/settings/guild/[guildId]/status-prefix/page.tsx` — Embed 설정 + 저장/삭제 단일 설정 패턴
  - `apps/web/app/settings/guild/[guildId]/auto-channel/page.tsx` — 다중 카드 관리 패턴 (tabStates Map, 카드별 독립 저장 상태)
  - `apps/web/app/components/SettingsSidebar.tsx` — 사이드바 메뉴 구조
  - `apps/web/app/lib/discord-api.ts` — `fetchGuildTextChannels`, `fetchGuildEmojis` 재사용
  - `apps/web/app/api/guilds/[...path]/route.ts` — 프록시 라우트 (추가 파일 불필요)

---

## 현황 파악

### 백엔드 상태

- `apps/api/src/sticky-message/domain/sticky-message-config.entity.ts` — 엔티티만 존재
- 컨트롤러, 서비스, 저장소 미구현 (백엔드 구현은 본 계획 범위 외)

> **주의**: 본 계획은 프론트엔드 구현만 다룬다. 백엔드 API가 준비되지 않으면 API 호출은 오류를 반환한다. 프론트엔드는 오류를 graceful하게 처리해야 한다.

### 프론트엔드 상태

- `apps/web/app/settings/guild/[guildId]/sticky-message/page.tsx` — 미존재 (신규 생성)
- `apps/web/app/lib/sticky-message-api.ts` — 미존재 (신규 생성)
- `apps/web/app/components/SettingsSidebar.tsx` — `sticky-message` 메뉴 항목 없음 (수정 필요)
- `apps/web/app/api/guilds/[...path]/route.ts` — 와일드카드 프록시 라우트가 이미 존재하므로 추가 파일 불필요

---

## 구현 단계 및 개발 항목

### 단계 1: API 클라이언트 — `apps/web/app/lib/sticky-message-api.ts` (신규)

#### 1-1. 타입 인터페이스 정의

```typescript
/** GET /api/guilds/{guildId}/sticky-message 응답 항목 */
export interface StickyMessageConfig {
  id: number;
  channelId: string;
  channelName?: string;       // 백엔드가 채널명을 포함하는 경우 (PRD 응답 예시 참고)
  embedTitle: string | null;
  embedDescription: string | null;
  embedColor: string | null;
  messageId: string | null;
  enabled: boolean;
  sortOrder: number;
}

/** POST /api/guilds/{guildId}/sticky-message 요청 바디 */
export interface StickyMessageSaveDto {
  id: number | null;          // null이면 신규 생성, 양의 정수이면 수정
  channelId: string;
  embedTitle: string | null;
  embedDescription: string | null;
  embedColor: string | null;
  enabled: boolean;
  sortOrder: number;
}
```

#### 1-2. API 함수

```typescript
/** 길드의 고정메세지 설정 목록 조회 */
export async function fetchStickyMessages(guildId: string): Promise<StickyMessageConfig[]>
  // GET /api/guilds/{guildId}/sticky-message
  // 성공: StickyMessageConfig[]
  // 실패: Error throw
  // 빈 배열이면 [] 반환 (404 아님, 빈 배열 응답이 정상)

/** 고정메세지 설정 저장 (신규/수정 upsert) */
export async function saveStickyMessage(
  guildId: string,
  data: StickyMessageSaveDto,
): Promise<StickyMessageConfig>
  // POST /api/guilds/{guildId}/sticky-message
  // 응답: 저장된 StickyMessageConfig (id, messageId 포함)
  // 실패: Error throw (채널 없음, 권한 부족 등 백엔드 오류 메시지 포함)

/** 고정메세지 설정 삭제 */
export async function deleteStickyMessage(guildId: string, id: number): Promise<void>
  // DELETE /api/guilds/{guildId}/sticky-message/{id}
  // 성공: void
  // 실패: Error throw
```

**패턴 근거**: `apps/web/app/lib/status-prefix-api.ts`와 동일한 구조. fetch 직접 호출, 오류 시 `Error` throw. 프록시 라우트 `/api/guilds/[...path]/route.ts`가 `/api/guilds/{guildId}/sticky-message` 경로를 자동으로 처리한다.

**기존 코드베이스 충돌 검토**: 없음. 신규 파일이며 기존 `discord-api.ts`, `status-prefix-api.ts`, `newbie-api.ts`와 네임스페이스 충돌이 없다.

---

### 단계 2: 사이드바 메뉴 추가 — `apps/web/app/components/SettingsSidebar.tsx` (수정)

#### 2-1. import 추가

`lucide-react`에서 `Pin` 아이콘을 추가한다. 현재 사용 중인 아이콘: `ArrowLeftRight`, `Radio`, `Settings`, `Tag`, `Users`.

```typescript
import { ArrowLeftRight, Pin, Radio, Settings, Tag, Users } from "lucide-react";
```

#### 2-2. menuItems 배열에 항목 추가

```typescript
const menuItems = [
  { href: `/settings/guild/${selectedGuildId}`, label: "일반 설정", icon: Settings },
  { href: `/settings/guild/${selectedGuildId}/auto-channel`, label: "자동방 설정", icon: Radio },
  { href: `/settings/guild/${selectedGuildId}/newbie`, label: "신입 관리", icon: Users },
  { href: `/settings/guild/${selectedGuildId}/status-prefix`, label: "게임방 상태 설정", icon: Tag },
  { href: `/settings/guild/${selectedGuildId}/sticky-message`, label: "고정메세지", icon: Pin }, // 추가
];
```

**기존 코드베이스 충돌 검토**: `menuItems` 배열은 단순 데이터 구조이며 렌더링 로직은 `.map()`으로 처리된다. 항목 추가는 기존 메뉴에 영향을 주지 않는다. `Pin` 아이콘은 `lucide-react`에 존재하며 다른 아이콘과 중복되지 않는다.

---

### 단계 3: 고정메세지 설정 페이지 — `apps/web/app/settings/guild/[guildId]/sticky-message/page.tsx` (신규)

#### 3-1. 로컬 타입 정의

페이지 내부에서만 사용하는 폼 상태 타입. API 타입 `StickyMessageConfig`와 분리한다.

```typescript
/** 클라이언트 폼 상태 — 미저장 카드도 표현 가능 */
interface CardForm {
  /** DB ID. null이면 아직 저장되지 않은 신규 카드 */
  id: number | null;
  /** 임시 클라이언트 키 (React key용). 항상 존재 */
  clientKey: number;
  channelId: string;
  embedTitle: string;
  embedDescription: string;
  embedColor: string;
  enabled: boolean;
  sortOrder: number;
}

/** 카드별 저장/삭제 상태 */
interface CardState {
  isSaving: boolean;
  isDeleting: boolean;
  saveSuccess: boolean;
  saveError: string | null;
}
```

**설계 근거**: `auto-channel/page.tsx`의 `ConfigForm` + `TabState` 패턴을 준용한다. 단, 탭이 아닌 카드(수직 목록)이므로 activeTabIndex는 없다. 카드별 상태는 `Map<number, CardState>` (키: `clientKey`)로 관리한다.

#### 3-2. 컴포넌트 상태

```typescript
const [cards, setCards] = useState<CardForm[]>([]);
const [cardStates, setCardStates] = useState<Map<number, CardState>>(new Map());
const [channels, setChannels] = useState<DiscordChannel[]>([]);
const [emojis, setEmojis] = useState<DiscordEmoji[]>([]);
const [isLoading, setIsLoading] = useState(false);
const [isRefreshing, setIsRefreshing] = useState(false);
/** 각 카드의 embedDescription textarea ref — clientKey → ref */
const embedDescRefs = useRef<Map<number, HTMLTextAreaElement>>(new Map());
```

#### 3-3. 초기 데이터 로드

`useEffect([selectedGuildId])` 내부에서 `Promise.all`로 병렬 조회:

```typescript
Promise.all([
  fetchStickyMessages(selectedGuildId).catch((): StickyMessageConfig[] => []),
  fetchGuildTextChannels(selectedGuildId).catch((): DiscordChannel[] => []),
  fetchGuildEmojis(selectedGuildId).catch((): DiscordEmoji[] => []),
]).then(([configs, chs, ems]) => {
  const loaded: CardForm[] = configs.map((c) => ({
    id: c.id,
    clientKey: c.id,          // DB ID를 그대로 clientKey로 사용
    channelId: c.channelId,
    embedTitle: c.embedTitle ?? '',
    embedDescription: c.embedDescription ?? '',
    embedColor: c.embedColor ?? '#5865F2',
    enabled: c.enabled,
    sortOrder: c.sortOrder,
  }));
  setCards(loaded);
  setChannels(chs);
  setEmojis(ems);
});
```

**PRD 근거**: 초기 로드 시 설정 없으면 빈 배열 → 카드 없음, 추가 버튼만 표시. 설정이 있으면 sortOrder 오름차순(백엔드가 정렬하여 반환).

#### 3-4. 새 카드 추가

```typescript
const addCard = () => {
  const clientKey = -Date.now(); // 음의 타임스탬프 (미저장 신규 카드 식별)
  const maxOrder = cards.reduce((m, c) => Math.max(m, c.sortOrder), -1);
  const newCard: CardForm = {
    id: null,
    clientKey,
    channelId: '',
    embedTitle: '',
    embedDescription: '',
    embedColor: '#5865F2',
    enabled: true,
    sortOrder: maxOrder + 1,
  };
  setCards((prev) => [...prev, newCard]);
};
```

**패턴 근거**: `status-prefix/page.tsx`의 `addButton`에서 `id: -Date.now()` 패턴 준용.

#### 3-5. 카드 필드 업데이트

```typescript
const updateCard = (clientKey: number, patch: Partial<CardForm>) => {
  setCards((prev) =>
    prev.map((c) => (c.clientKey === clientKey ? { ...c, ...patch } : c)),
  );
};
```

#### 3-6. 이모지 삽입 (커서 위치)

`status-prefix/page.tsx`의 `insertAtCursor` 패턴 준용. 단, 카드가 여러 개이므로 `embedDescRefs` Map에서 `clientKey`로 ref를 조회한다.

```typescript
const insertEmojiAtCursor = (clientKey: number, insertText: string) => {
  const textarea = embedDescRefs.current.get(clientKey);
  const card = cards.find((c) => c.clientKey === clientKey);
  if (!card) return;
  const currentValue = card.embedDescription;
  if (textarea) {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newValue = currentValue.substring(0, start) + insertText + currentValue.substring(end);
    updateCard(clientKey, { embedDescription: newValue });
    requestAnimationFrame(() => {
      textarea.focus();
      const pos = start + insertText.length;
      textarea.setSelectionRange(pos, pos);
    });
  } else {
    updateCard(clientKey, { embedDescription: currentValue + insertText });
  }
};
```

#### 3-7. 카드별 저장 핸들러

```typescript
const handleSave = async (clientKey: number) => {
  const card = cards.find((c) => c.clientKey === clientKey);
  if (!card || !selectedGuildId) return;
  const state = getCardState(clientKey);
  if (state.isSaving) return;

  // 유효성 검사: channelId 필수
  if (!card.channelId) {
    setCardState(clientKey, { saveError: '채널을 선택해주세요.' });
    return;
  }

  setCardState(clientKey, { isSaving: true, saveError: null, saveSuccess: false });

  try {
    const saved = await saveStickyMessage(selectedGuildId, {
      id: card.id,
      channelId: card.channelId,
      embedTitle: card.embedTitle || null,
      embedDescription: card.embedDescription || null,
      embedColor: card.embedColor,
      enabled: card.enabled,
      sortOrder: card.sortOrder,
    });
    // 저장 후 id를 DB id로 갱신 (신규 카드의 경우 id가 null → 실제 id로 교체)
    setCards((prev) =>
      prev.map((c) =>
        c.clientKey === clientKey ? { ...c, id: saved.id } : c,
      ),
    );
    setCardState(clientKey, { isSaving: false, saveSuccess: true });
    setTimeout(() => setCardState(clientKey, { saveSuccess: false }), 3000);
  } catch (err) {
    setCardState(clientKey, {
      isSaving: false,
      saveError: err instanceof Error ? err.message : '저장에 실패했습니다.',
    });
  }
};
```

**PRD 근거 (F-WEB-005 저장 동작)**:
1. 채널 미선택 시 오류 표시
2. `POST /api/guilds/{guildId}/sticky-message`로 전송
3. 백엔드가 upsert + enabled이면 Discord 메시지 전송/갱신
4. 저장 성공 시 "저장되었습니다." 3초 후 소멸
5. 실패 시 오류 메시지 표시

#### 3-8. 카드별 삭제 핸들러

```typescript
const handleDelete = async (clientKey: number) => {
  const card = cards.find((c) => c.clientKey === clientKey);
  if (!card || !selectedGuildId) return;

  // 미저장 카드(id === null)는 API 호출 없이 바로 제거
  if (card.id === null) {
    setCards((prev) => prev.filter((c) => c.clientKey !== clientKey));
    return;
  }

  // 확인 모달 표시 (window.confirm 사용 — 기존 패턴 확인 필요, 없으면 인라인 confirm 버튼)
  const confirmed = window.confirm(
    '이 고정메세지를 삭제하면 채널에서도 즉시 제거됩니다. 삭제하시겠습니까?',
  );
  if (!confirmed) return;

  setCardState(clientKey, { isDeleting: true });

  try {
    await deleteStickyMessage(selectedGuildId, card.id);
    setCards((prev) => prev.filter((c) => c.clientKey !== clientKey));
    // 삭제 성공 시 카드 상태도 정리
    setCardStates((prev) => {
      const next = new Map(prev);
      next.delete(clientKey);
      return next;
    });
  } catch (err) {
    setCardState(clientKey, {
      isDeleting: false,
      saveError: err instanceof Error ? err.message : '삭제에 실패했습니다.',
    });
  }
};
```

**PRD 근거 (F-WEB-005 삭제 동작)**: 확인 모달 → DELETE API → 카드 제거. 미저장 카드는 API 호출 불필요.

> **확인 모달 패턴**: `auto-channel/page.tsx`에서 삭제 확인 모달을 어떻게 구현했는지 확인이 필요하다. 기존 코드가 `window.confirm`을 사용한다면 동일하게 사용한다. 별도 컴포넌트가 있다면 해당 컴포넌트를 재사용한다.

#### 3-9. 채널 새로고침 핸들러

```typescript
const refreshChannels = async () => {
  if (!selectedGuildId || isRefreshing) return;
  setIsRefreshing(true);
  try {
    const [chs, ems] = await Promise.all([
      fetchGuildTextChannels(selectedGuildId, true).catch((): DiscordChannel[] => []),
      fetchGuildEmojis(selectedGuildId, true).catch((): DiscordEmoji[] => []),
    ]);
    setChannels(chs);
    setEmojis(ems);
  } finally {
    setIsRefreshing(false);
  }
};
```

`status-prefix/page.tsx`의 `refreshChannels`와 동일한 패턴. `fetchGuildTextChannels(guildId, true)` — `refresh=true` 플래그로 캐시 무효화.

#### 3-10. 조건부 렌더링

`status-prefix/page.tsx` 패턴 준용:

1. `!selectedGuildId` → "서버를 선택하세요." (Server 아이콘)
2. `isLoading` → `<Loader2 className="animate-spin" />`
3. 정상 → 메인 렌더링

#### 3-11. 메인 UI 구조

```
<div className="max-w-3xl">
  {/* 페이지 헤더: 제목 + 채널 새로고침 버튼 */}
  <div className="flex items-center justify-between mb-6">
    <div className="flex items-center space-x-3">
      <Pin className="w-6 h-6 text-indigo-600" />
      <h1 className="text-2xl font-bold text-gray-900">고정메세지 설정</h1>
    </div>
    <button onClick={refreshChannels}>채널 새로고침</button>
  </div>

  {/* 카드 목록 */}
  {cards.length === 0 ? (
    /* 빈 상태: 안내 문구 */
    <section className="bg-white rounded-xl border border-gray-200 p-8">
      <div className="flex flex-col items-center text-center py-8">
        <Pin className="w-12 h-12 text-gray-300 mb-4" />
        <p className="text-sm text-gray-500">
          등록된 고정메세지가 없습니다. 아래 버튼으로 추가하세요.
        </p>
      </div>
    </section>
  ) : (
    <div className="space-y-6">
      {cards.map((card) => (
        <StickyMessageCard key={card.clientKey} card={card} ... />
      ))}
    </div>
  )}

  {/* 추가 버튼 */}
  <button onClick={addCard} className="mt-6 ...">
    + 고정메세지 추가
  </button>
</div>
```

#### 3-12. 카드 내부 UI (인라인 또는 별도 컴포넌트)

각 카드는 `<section className="bg-white rounded-xl border border-gray-200 p-6">` 구조:

```
카드 헤더
  - 카드 번호 배지 (#{n})
  - 삭제 버튼 (Trash2 아이콘)

섹션: 채널 설정
  - 텍스트 채널 선택 드롭다운 (필수*)
  - 기능 활성화 토글

섹션: Embed 설정
  - Embed 제목 입력 필드 (선택)
  - Embed 설명 textarea (선택, 멀티라인)
    - GuildEmojiPicker (커서 위치 삽입)
  - Embed 색상 (color 피커 + HEX 텍스트 입력)
  - 실시간 미리보기 (Discord 다크모드 스타일)

카드 푸터
  - 저장 성공 메시지 ("저장되었습니다.", 3초 소멸)
  - 저장 오류 메시지
  - 저장 버튼
```

**Embed 미리보기 스타일**: `status-prefix/page.tsx`와 동일한 디스코드 다크모드 패턴:
```jsx
<div className="bg-[#2B2D31] rounded-lg p-4">
  <div
    className="bg-[#313338] rounded-md overflow-hidden"
    style={{ borderLeft: `4px solid ${card.embedColor ?? '#5865F2'}` }}
  >
    <div className="p-4">
      <p className="text-white font-semibold text-sm mb-1 break-words">
        {card.embedTitle || '(제목 없음)'}
      </p>
      <p className="text-gray-300 text-xs whitespace-pre-wrap break-words">
        {card.embedDescription || '(설명 없음)'}
      </p>
    </div>
  </div>
</div>
```

**기능 활성화 토글**: `status-prefix/page.tsx`의 토글 버튼 패턴 완전 동일 적용 (`role="switch"`, `aria-checked`, `bg-indigo-600` / `bg-gray-200`).

---

## 파일별 구현 목록 요약

| 파일 | 작업 | 주요 내용 |
|------|------|-----------|
| `apps/web/app/lib/sticky-message-api.ts` | 신규 생성 | `StickyMessageConfig`, `StickyMessageSaveDto` 인터페이스, `fetchStickyMessages`, `saveStickyMessage`, `deleteStickyMessage` 함수 |
| `apps/web/app/components/SettingsSidebar.tsx` | 수정 | `Pin` 아이콘 import 추가, `menuItems`에 `{ href: .../sticky-message, label: '고정메세지', icon: Pin }` 추가 |
| `apps/web/app/settings/guild/[guildId]/sticky-message/page.tsx` | 신규 생성 | `'use client'` 페이지 컴포넌트, 카드 목록 UI, 카드별 저장/삭제, 채널 선택, 활성화 토글, Embed 설정 + 미리보기 |

---

## 기존 코드베이스 충돌 검토

| 항목 | 충돌 여부 | 근거 |
|------|-----------|------|
| 프록시 라우트 | 없음 | `apps/web/app/api/guilds/[...path]/route.ts`가 와일드카드로 모든 `/api/guilds/**` 경로를 처리. 신규 엔드포인트 추가 불필요 |
| `discord-api.ts` | 없음 | `fetchGuildTextChannels`, `fetchGuildEmojis` 그대로 재사용. 함수 시그니처 변경 없음 |
| `SettingsSidebar.tsx` | 없음 | 배열 항목 추가만이며 기존 렌더링 로직(`map`) 변경 없음 |
| `GuildEmojiPicker` 컴포넌트 | 없음 | 기존 컴포넌트(`apps/web/app/components/GuildEmojiPicker.tsx`) 재사용, 시그니처 변경 없음 |
| `useSettings` 훅 | 없음 | `selectedGuildId` 제공, 기존 컨텍스트 그대로 사용 |
| `lucide-react` Pin 아이콘 | 없음 | `lucide-react` 패키지에 `Pin` 아이콘 존재, 기존 사용 아이콘과 중복 없음 |

---

## DRY 준수 사항

| 재사용 대상 | 위치 | 사용 방식 |
|-------------|------|-----------|
| `fetchGuildTextChannels` | `apps/web/app/lib/discord-api.ts` | 텍스트 채널 목록 조회 |
| `fetchGuildEmojis` | `apps/web/app/lib/discord-api.ts` | 길드 이모지 목록 조회 |
| `GuildEmojiPicker` | `apps/web/app/components/GuildEmojiPicker.tsx` | 이모지 피커 UI |
| `useSettings` | `apps/web/app/settings/SettingsContext.tsx` | selectedGuildId |
| 토글 버튼 패턴 | `status-prefix/page.tsx` 참조 | 활성화 토글 UI (복사 아님, 동일 구조 적용) |
| Embed 미리보기 패턴 | `status-prefix/page.tsx` 참조 | Discord 다크모드 스타일 미리보기 (복사 아님, 동일 구조 적용) |
| 채널 새로고침 패턴 | `status-prefix/page.tsx` 참조 | `refresh=true` 플래그 패턴 |

> 토글, 미리보기, 색상 피커 등 반복되는 UI 블록은 페이지 내에서 별도 내부 컴포넌트로 분리하지 않는다 (다른 기존 페이지와 동일한 방식). 다만 `StickyMessageCard` 카드 단위를 별도 내부 컴포넌트로 추출하면 카드별 ref 관리가 복잡해지므로, 기존 `auto-channel/page.tsx` 패턴처럼 단일 컴포넌트 내 인라인 렌더링으로 처리한다.

---

## 구현 순서 권장

1. `sticky-message-api.ts` 생성 (타입 + API 함수)
2. `SettingsSidebar.tsx` 수정 (메뉴 항목 추가)
3. `sticky-message/page.tsx` 생성 (상태 → 핸들러 → 렌더링 순서)

각 단계는 독립적이므로 병렬 진행 가능하나, `page.tsx`는 `sticky-message-api.ts`에 의존한다.
