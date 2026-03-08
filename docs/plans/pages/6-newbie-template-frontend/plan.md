# 신입 미션/모코코 Embed 템플릿 커스터마이징 — 프론트엔드 구현 계획

## 개요

| 항목 | 내용 |
|------|------|
| 관련 PRD | F-WEB-NEWBIE-001 탭 2 템플릿 설정 섹션, 탭 3 템플릿 설정 섹션 |
| 관련 기능 | F-NEWBIE-002-TMPL (미션 Embed 템플릿), F-NEWBIE-003-TMPL (모코코 Embed 템플릿) |
| 선행 조건 | 5-newbie-template-backend (백엔드 템플릿 API) — `GET/POST /api/guilds/:guildId/newbie/mission-template`, `GET/POST /api/guilds/:guildId/newbie/moco-template` 가동 중 |
| 대상 서비스 | `apps/web/` (Next.js 프론트엔드) |

### 현재 구현 상태 분석

기존 `MissionTab.tsx`와 `MocoTab.tsx`는 이미 존재하며 기본 설정(활성화 토글, 채널 선택, Embed 제목/설명/색상/썸네일 URL)을 처리한다. 그러나 PRD의 **템플릿 시스템**(별도 `NewbieMissionTemplate` / `NewbieMocoTemplate` DB 테이블)은 아직 구현되지 않았다.

현재 `MissionTab.tsx`가 다루는 `missionEmbedTitle`, `missionEmbedDescription` 등의 필드는 `NewbieConfig` 테이블 컬럼으로서, PRD 최종 데이터 모델에는 없는 구 설계의 잔재다. PRD 확정 데이터 모델에서 미션/모코코 Embed 형식은 각각 `NewbieMissionTemplate`, `NewbieMocoTemplate` 별도 테이블이 담당한다.

따라서 이번 작업의 범위는 다음과 같다.

1. `newbie-api.ts`에 `MissionTemplate`, `MocoTemplate` 타입 및 API 함수 추가
2. 템플릿 변수 유효성 검사 유틸 신규 생성
3. `MissionTab.tsx` — 기존 레거시 Embed 필드 제거, 템플릿 설정 섹션(별도 저장 흐름) 추가
4. `MocoTab.tsx` — 기존 레거시 Embed 필드 제거, 템플릿 설정 섹션(별도 저장 흐름) 추가
5. `EmbedPreview.tsx` — 미션/모코코 전용 미리보기를 위한 props 확장 또는 별도 컴포넌트 분리
6. `page.tsx` — 템플릿 조회/저장 로직 추가, 저장 버튼 분리 처리

---

## 1. 생성/수정 파일 전체 목록

### 1-1. 신규 생성 파일

```
apps/web/app/lib/
  newbie-template-utils.ts          ← 템플릿 변수 유효성 검사 유틸

apps/web/app/settings/guild/[guildId]/newbie/components/
  MissionTemplateSection.tsx        ← 탭 2 내 템플릿 설정 섹션 (분리된 sub-컴포넌트)
  MocoTemplateSection.tsx           ← 탭 3 내 템플릿 설정 섹션 (분리된 sub-컴포넌트)
  MissionEmbedPreview.tsx           ← 미션 Embed 전용 미리보기 (footer 표시 포함)
  MocoEmbedPreview.tsx              ← 모코코 Embed 전용 미리보기 (footer 표시 포함)
```

### 1-2. 기존 수정 파일

```
apps/web/app/lib/newbie-api.ts
  → MissionTemplate 인터페이스 추가
  → MocoTemplate 인터페이스 추가
  → fetchMissionTemplate() 함수 추가
  → saveMissionTemplate() 함수 추가
  → fetchMocoTemplate() 함수 추가
  → saveMocoTemplate() 함수 추가
  → NewbieConfig 인터페이스에서 레거시 mission/moco Embed 필드 제거

apps/web/app/settings/guild/[guildId]/newbie/page.tsx
  → missionTemplate, mocoTemplate 상태 추가
  → 초기 로드 시 fetchMissionTemplate / fetchMocoTemplate 병렬 호출
  → handleSaveMissionTemplate / handleSaveMocoTemplate 핸들러 추가

apps/web/app/settings/guild/[guildId]/newbie/components/MissionTab.tsx
  → 레거시 Embed 필드 제거 (missionEmbedTitle, missionEmbedDescription, missionEmbedColor, missionEmbedThumbnailUrl)
  → MissionTemplateSection 컴포넌트 추가

apps/web/app/settings/guild/[guildId]/newbie/components/MocoTab.tsx
  → 레거시 Embed 필드 제거 (mocoEmbedTitle, mocoEmbedDescription, mocoEmbedColor, mocoEmbedThumbnailUrl)
  → MocoTemplateSection 컴포넌트 추가
```

> 기존 `EmbedPreview.tsx`는 탭 1(환영인사)에서 계속 사용하므로 유지한다.
> 미션/모코코는 footer가 있고 미리보기 렌더링 방식이 달라 별도 컴포넌트로 분리한다.

---

## 2. 타입 및 API 설계

### 2-1. `apps/web/app/lib/newbie-api.ts` 수정

#### 제거 대상 (레거시 필드)

`NewbieConfig` 인터페이스에서 아래 필드를 제거한다. 이 필드들은 PRD 확정 데이터 모델(`NewbieConfig` DB 스키마)에 존재하지 않는다.

```typescript
// 제거
missionEmbedTitle: string | null;
missionEmbedDescription: string | null;
missionEmbedColor: string | null;
missionEmbedThumbnailUrl: string | null;
mocoEmbedTitle: string | null;
mocoEmbedDescription: string | null;
mocoEmbedColor: string | null;
mocoEmbedThumbnailUrl: string | null;
```

> `page.tsx`의 `DEFAULT_CONFIG`에서도 동일 필드를 제거한다.

#### 추가 타입 및 함수

```typescript
// ─── 미션 템플릿 ─────────────────────────────────────────────────────────────

export interface MissionStatusEntry {
  emoji: string;
  text: string;
}

export interface MissionStatusMapping {
  IN_PROGRESS: MissionStatusEntry;
  COMPLETED: MissionStatusEntry;
  FAILED: MissionStatusEntry;
}

/**
 * NewbieMissionTemplate 테이블 대응 타입.
 * null 필드는 백엔드가 기본값을 사용한다는 의미.
 */
export interface MissionTemplate {
  titleTemplate: string | null;
  headerTemplate: string | null;
  itemTemplate: string | null;
  footerTemplate: string | null;
  statusMapping: MissionStatusMapping | null;
}

export const DEFAULT_MISSION_TEMPLATE: MissionTemplate = {
  titleTemplate: '🧑‍🌾 신입 미션 체크',
  headerTemplate: '🧑‍🌾 뉴비 멤버 (총 인원: {totalCount}명)',
  itemTemplate: '{mention} 🌱\n{startDate} ~ {endDate}\n{statusEmoji} {statusText} | 플레이타임: {playtime} | 플레이횟수: {playCount}회',
  footerTemplate: '마지막 갱신: {updatedAt}',
  statusMapping: {
    IN_PROGRESS: { emoji: '🟡', text: '진행중' },
    COMPLETED: { emoji: '✅', text: '완료' },
    FAILED: { emoji: '❌', text: '실패' },
  },
};

/**
 * 미션 템플릿을 조회한다.
 * 백엔드에 레코드가 없으면 null을 반환하고, 프론트는 DEFAULT_MISSION_TEMPLATE을 표시한다.
 */
export async function fetchMissionTemplate(
  guildId: string,
): Promise<MissionTemplate | null> {
  const res = await fetch(`/api/guilds/${guildId}/newbie/mission-template`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to fetch mission template: ${res.status}`);
  return res.json() as Promise<MissionTemplate>;
}

/**
 * 미션 템플릿을 저장한다.
 * 백엔드 유효성 검사 실패 시 { field, allowedVariables } 구조의 오류 응답이 온다.
 */
export async function saveMissionTemplate(
  guildId: string,
  template: MissionTemplate,
): Promise<void> {
  const res = await fetch(`/api/guilds/${guildId}/newbie/mission-template`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(template),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      (body as { message?: string }).message ?? `Failed to save mission template: ${res.status}`,
    );
  }
}

// ─── 모코코 템플릿 ────────────────────────────────────────────────────────────

/**
 * NewbieMocoTemplate 테이블 대응 타입.
 */
export interface MocoTemplate {
  titleTemplate: string | null;
  bodyTemplate: string | null;
  itemTemplate: string | null;
  footerTemplate: string | null;
}

export const DEFAULT_MOCO_TEMPLATE: MocoTemplate = {
  titleTemplate: '모코코 사냥 TOP {rank} — {hunterName} 🌱',
  bodyTemplate: '총 모코코 사냥 시간: {totalMinutes}분\n\n도움을 받은 모코코들:\n{mocoList}',
  itemTemplate: '– {newbieName} 🌱: {minutes}분',
  footerTemplate: '페이지 {currentPage}/{totalPages} | 자동 갱신 {interval}분',
};

export async function fetchMocoTemplate(
  guildId: string,
): Promise<MocoTemplate | null> {
  const res = await fetch(`/api/guilds/${guildId}/newbie/moco-template`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to fetch moco template: ${res.status}`);
  return res.json() as Promise<MocoTemplate>;
}

export async function saveMocoTemplate(
  guildId: string,
  template: MocoTemplate,
): Promise<void> {
  const res = await fetch(`/api/guilds/${guildId}/newbie/moco-template`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(template),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      (body as { message?: string }).message ?? `Failed to save moco template: ${res.status}`,
    );
  }
}
```

---

### 2-2. `apps/web/app/lib/newbie-template-utils.ts` (신규)

템플릿 변수 유효성 검사 및 변수 치환(미리보기용) 유틸.

```typescript
/**
 * 허용 변수 목록 정의. 각 필드별로 허용 변수를 분리하여 관리한다.
 */
export const MISSION_ALLOWED_VARS = {
  titleTemplate: ['{totalCount}'],
  headerTemplate: ['{totalCount}', '{inProgressCount}', '{completedCount}', '{failedCount}'],
  itemTemplate: [
    '{username}', '{mention}', '{startDate}', '{endDate}',
    '{statusEmoji}', '{statusText}',
    '{playtimeHour}', '{playtimeMin}', '{playtimeSec}', '{playtime}',
    '{playCount}', '{targetPlaytime}', '{daysLeft}',
  ],
  footerTemplate: ['{updatedAt}'],
} as const;

export const MOCO_ALLOWED_VARS = {
  titleTemplate: ['{rank}', '{hunterName}'],
  bodyTemplate: ['{totalMinutes}', '{mocoList}'],
  itemTemplate: ['{newbieName}', '{minutes}'],
  footerTemplate: ['{currentPage}', '{totalPages}', '{interval}'],
} as const;

/**
 * 템플릿 문자열에서 {변수명} 패턴을 추출한다.
 */
function extractVars(template: string): string[] {
  return [...template.matchAll(/\{[^}]+\}/g)].map((m) => m[0]);
}

/**
 * 템플릿 문자열에 허용되지 않는 변수가 포함되어 있으면
 * 허용되지 않는 변수 목록을 반환한다. 없으면 빈 배열.
 */
export function findInvalidVars(
  template: string,
  allowedVars: readonly string[],
): string[] {
  const found = extractVars(template);
  return found.filter((v) => !allowedVars.includes(v));
}

/**
 * 미션 템플릿 필드별 유효성 검사.
 * 반환값: 필드명 → 허용되지 않는 변수 목록 맵.
 * 빈 맵이면 모두 유효.
 */
export function validateMissionTemplate(template: {
  titleTemplate: string | null;
  headerTemplate: string | null;
  itemTemplate: string | null;
  footerTemplate: string | null;
}): Map<string, string[]> {
  const errors = new Map<string, string[]>();

  const checks: Array<[string, string | null, readonly string[]]> = [
    ['titleTemplate', template.titleTemplate, MISSION_ALLOWED_VARS.titleTemplate],
    ['headerTemplate', template.headerTemplate, MISSION_ALLOWED_VARS.headerTemplate],
    ['itemTemplate', template.itemTemplate, MISSION_ALLOWED_VARS.itemTemplate],
    ['footerTemplate', template.footerTemplate, MISSION_ALLOWED_VARS.footerTemplate],
  ];

  for (const [field, value, allowed] of checks) {
    if (!value) continue;
    const invalid = findInvalidVars(value, allowed);
    if (invalid.length > 0) errors.set(field, invalid);
  }

  return errors;
}

/**
 * 모코코 템플릿 필드별 유효성 검사.
 */
export function validateMocoTemplate(template: {
  titleTemplate: string | null;
  bodyTemplate: string | null;
  itemTemplate: string | null;
  footerTemplate: string | null;
}): Map<string, string[]> {
  const errors = new Map<string, string[]>();

  const checks: Array<[string, string | null, readonly string[]]> = [
    ['titleTemplate', template.titleTemplate, MOCO_ALLOWED_VARS.titleTemplate],
    ['bodyTemplate', template.bodyTemplate, MOCO_ALLOWED_VARS.bodyTemplate],
    ['itemTemplate', template.itemTemplate, MOCO_ALLOWED_VARS.itemTemplate],
    ['footerTemplate', template.footerTemplate, MOCO_ALLOWED_VARS.footerTemplate],
  ];

  for (const [field, value, allowed] of checks) {
    if (!value) continue;
    const invalid = findInvalidVars(value, allowed);
    if (invalid.length > 0) errors.set(field, invalid);
  }

  return errors;
}

// ─── 미리보기용 더미 데이터 ────────────────────────────────────────────────────

/** 미션 미리보기에 사용할 더미 변수 치환 맵 */
export const MISSION_PREVIEW_DUMMY: Record<string, string> = {
  '{totalCount}': '3',
  '{inProgressCount}': '1',
  '{completedCount}': '1',
  '{failedCount}': '1',
  '{username}': '사용자1',
  '{mention}': '@사용자1',
  '{startDate}': '2025-03-01',
  '{endDate}': '2025-03-08',
  '{statusEmoji}': '🟡',
  '{statusText}': '진행중',
  '{playtimeHour}': '2',
  '{playtimeMin}': '30',
  '{playtimeSec}': '0',
  '{playtime}': '2시간 30분 0초',
  '{playCount}': '5',
  '{targetPlaytime}': '10시간',
  '{daysLeft}': '3',
  '{updatedAt}': '2025-03-08 12:00',
};

/** 모코코 미리보기에 사용할 더미 변수 치환 맵 */
export const MOCO_PREVIEW_DUMMY: Record<string, string> = {
  '{rank}': '1',
  '{hunterName}': '사냥꾼닉네임',
  '{totalMinutes}': '120',
  '{mocoList}': '– 신입1 🌱: 60분\n– 신입2 🌱: 60분',
  '{newbieName}': '신입1',
  '{minutes}': '60',
  '{currentPage}': '1',
  '{totalPages}': '5',
  '{interval}': '30',
};

/**
 * 템플릿 문자열의 모든 변수를 더미 값으로 치환하여 미리보기 문자열을 반환한다.
 */
export function applyDummyVars(
  template: string,
  dummy: Record<string, string>,
): string {
  return template.replace(/\{[^}]+\}/g, (match) => dummy[match] ?? match);
}
```

---

## 3. `page.tsx` 수정 설계

### 3-1. 상태 추가

```typescript
const [missionTemplate, setMissionTemplate] = useState<MissionTemplate>(DEFAULT_MISSION_TEMPLATE);
const [mocoTemplate, setMocoTemplate] = useState<MocoTemplate>(DEFAULT_MOCO_TEMPLATE);
const [isSavingMissionTemplate, setIsSavingMissionTemplate] = useState(false);
const [isSavingMocoTemplate, setIsSavingMocoTemplate] = useState(false);
const [missionTemplateSaveError, setMissionTemplateSaveError] = useState<string | null>(null);
const [missionTemplateSaveSuccess, setMissionTemplateSaveSuccess] = useState(false);
const [mocoTemplateSaveError, setMocoTemplateSaveError] = useState<string | null>(null);
const [mocoTemplateSaveSuccess, setMocoTemplateSaveSuccess] = useState(false);
```

### 3-2. useEffect 수정

초기 로드 시 `fetchMissionTemplate`과 `fetchMocoTemplate`을 기존 `Promise.all`에 추가한다.

```typescript
Promise.all([
  fetchNewbieConfig(selectedGuildId).catch(() => null),
  fetchGuildTextChannels(selectedGuildId).catch((): DiscordChannel[] => []),
  fetchGuildRoles(selectedGuildId).catch((): DiscordRole[] => []),
  fetchGuildEmojis(selectedGuildId).catch((): DiscordEmoji[] => []),
  fetchMissionTemplate(selectedGuildId).catch(() => null),
  fetchMocoTemplate(selectedGuildId).catch(() => null),
]).then(([cfg, chs, rls, ems, mTmpl, mocoTmpl]) => {
  if (cfg) setConfig(cfg);
  setChannels(chs);
  setRoles(rls);
  setEmojis(ems);
  if (mTmpl) setMissionTemplate(mTmpl);
  if (mocoTmpl) setMocoTemplate(mocoTmpl);
  setConfigLoaded(true);
});
```

### 3-3. 템플릿 저장 핸들러

```typescript
const handleSaveMissionTemplate = async () => {
  if (!selectedGuildId || isSavingMissionTemplate) return;

  // 프론트엔드 유효성 검사
  const errors = validateMissionTemplate(missionTemplate);
  if (errors.size > 0) {
    const msgs = [...errors.entries()].map(([field, vars]) =>
      `${field}: 허용되지 않는 변수 ${vars.join(', ')}`
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
  // handleSaveMissionTemplate과 동일 구조, mocoTemplate / validateMocoTemplate 사용
};
```

### 3-4. 탭 콘텐츠 렌더링 수정

`MissionTab`과 `MocoTab`에 각각 템플릿 관련 props를 전달한다.

```typescript
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
```

---

## 4. `MissionTab.tsx` 수정 설계

### 4-1. 레거시 필드 제거

기존 MissionTab에서 다음 섹션을 완전히 제거한다.
- `Embed 제목` 입력 (`missionEmbedTitle`)
- `Embed 설명` textarea + 채널 링크 삽입 + GuildEmojiPicker (`missionEmbedDescription`)
- `Embed 색상` 피커 (`missionEmbedColor`)
- `썸네일 이미지 URL` 입력 (`missionEmbedThumbnailUrl`)
- 기존 `템플릿 변수 안내` 블록 (구 `{count}`, `{missionList}` 안내)
- 기존 `EmbedPreview` 참조

### 4-2. props 타입 수정

```typescript
interface MissionTabProps {
  config: NewbieConfig;
  channels: DiscordChannel[];
  emojis: DiscordEmoji[];
  onChange: (partial: Partial<NewbieConfig>) => void;
  // 신규
  missionTemplate: MissionTemplate;
  onMissionTemplateChange: (template: MissionTemplate) => void;
  onSaveMissionTemplate: () => void;
  isSavingMissionTemplate: boolean;
  missionTemplateSaveError: string | null;
  missionTemplateSaveSuccess: boolean;
}
```

### 4-3. `MissionTemplateSection` 컴포넌트 마운트

기존 필드 제거 후 `MissionTemplateSection`을 마운트한다.

```typescript
// 기존 채널/기간/목표 플레이타임 설정 섹션은 그대로 유지
// 구분선 또는 섹션 헤더 추가
<hr className="border-gray-200" />
<MissionTemplateSection
  template={missionTemplate}
  onChange={onMissionTemplateChange}
  onSave={onSaveMissionTemplate}
  isSaving={isSavingMissionTemplate}
  saveError={missionTemplateSaveError}
  saveSuccess={missionTemplateSaveSuccess}
  isEnabled={isEnabled}
/>
```

---

## 5. `MocoTab.tsx` 수정 설계

### 5-1. 레거시 필드 제거

MissionTab과 동일하게 아래를 제거한다.
- `mocoEmbedTitle`, `mocoEmbedDescription`, `mocoEmbedColor`, `mocoEmbedThumbnailUrl` 관련 UI 전체
- 구 템플릿 변수 안내 (`{rank}`, `{hunterName}`, `{totalMinutes}`, `{rankDetails}`)
- 기존 `EmbedPreview` 참조

### 5-2. props 타입 수정

MissionTab과 동일한 패턴으로 `mocoTemplate`, `onMocoTemplateChange`, `onSaveMocoTemplate`, `isSavingMocoTemplate`, `mocoTemplateSaveError`, `mocoTemplateSaveSuccess` 추가.

### 5-3. `MocoTemplateSection` 컴포넌트 마운트

기존 채널/자동 갱신 설정 섹션 유지, 구분선 후 `MocoTemplateSection` 마운트.

---

## 6. `MissionTemplateSection.tsx` 컴포넌트 설계

```
apps/web/app/settings/guild/[guildId]/newbie/components/MissionTemplateSection.tsx
```

### 6-1. props

```typescript
interface MissionTemplateSectionProps {
  template: MissionTemplate;
  onChange: (template: MissionTemplate) => void;
  onSave: () => void;
  isSaving: boolean;
  saveError: string | null;
  saveSuccess: boolean;
  isEnabled: boolean; // 미션 기능 활성화 여부 — disabled 연동
}
```

### 6-2. 내부 상태

`debounceRef` (`useRef<ReturnType<typeof setTimeout>>`) 하나를 사용하여 입력 변경 시 300ms debounce로 미리보기 업데이트를 처리한다. 단, 실제 `onChange` 호출(상태 업데이트)은 즉시 수행하고, 미리보기용 `previewTemplate` 로컬 상태에만 debounce를 적용한다.

```typescript
const [previewTemplate, setPreviewTemplate] = useState<MissionTemplate>(template);
const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

// template prop 변경 시 previewTemplate 동기화 (탭 전환 복귀 시)
useEffect(() => {
  setPreviewTemplate(template);
}, [template]);

const handleFieldChange = (partial: Partial<MissionTemplate>) => {
  const next = { ...template, ...partial };
  onChange(next); // 상위 상태 즉시 업데이트

  // 미리보기는 300ms debounce
  if (debounceRef.current) clearTimeout(debounceRef.current);
  debounceRef.current = setTimeout(() => {
    setPreviewTemplate(next);
  }, 300);
};
```

### 6-3. 유효성 오류 상태

```typescript
const [validationErrors, setValidationErrors] = useState<Map<string, string[]>>(new Map());
```

필드 변경 시 `validateMissionTemplate`을 실행하여 `validationErrors`를 갱신한다. 오류가 있는 필드의 입력 테두리를 빨간색으로 강조하고, 필드 아래에 허용되지 않는 변수 목록을 표시한다.

### 6-4. UI 레이아웃

```
[섹션 헤더]
  Embed 템플릿 설정
  ─────────────────────────────────────────

[2단 그리드: 왼쪽 입력 / 오른쪽 미리보기 (sticky)]

왼쪽 열:
  ┌─────────────────────────────────┐
  │ 제목 템플릿                      │
  │ <input>                         │
  │ 허용 변수: {totalCount}          │
  │ [오류 시 빨간 텍스트]             │
  └─────────────────────────────────┘

  ┌─────────────────────────────────┐
  │ 헤더 템플릿                      │
  │ <input>                         │
  │ 허용 변수: {totalCount}, ...     │
  └─────────────────────────────────┘

  ┌─────────────────────────────────┐
  │ 항목 템플릿                      │
  │ <textarea rows=5>               │
  │ 허용 변수: {mention}, ...        │
  └─────────────────────────────────┘

  ┌─────────────────────────────────┐
  │ 푸터 템플릿                      │
  │ <input>                         │
  │ 허용 변수: {updatedAt}           │
  └─────────────────────────────────┘

  ┌─────────────────────────────────┐
  │ 상태 매핑                        │
  │ 표 (3행 × 이모지 + 텍스트)        │
  │  진행중  [이모지 input] [텍스트 input] │
  │  완료    [이모지 input] [텍스트 input] │
  │  실패    [이모지 input] [텍스트 input] │
  └─────────────────────────────────┘

  [기본값 복원 버튼]   [템플릿 저장 버튼]
  [저장 성공/오류 피드백]

오른쪽 열 (sticky, top-6):
  MissionEmbedPreview (previewTemplate 기반 실시간 렌더링)
```

**반응형 처리**: `lg:grid lg:grid-cols-2 lg:gap-6` 사용. 모바일에서는 단일 열, 미리보기는 입력 하단에 위치.

### 6-5. 상태 매핑 테이블 UI 상세

```tsx
<table className="w-full text-sm border-collapse">
  <thead>
    <tr className="text-left text-gray-500 text-xs">
      <th className="pb-2 font-medium w-16">상태</th>
      <th className="pb-2 font-medium w-20">이모지</th>
      <th className="pb-2 font-medium">텍스트</th>
    </tr>
  </thead>
  <tbody className="space-y-2">
    {(['IN_PROGRESS', 'COMPLETED', 'FAILED'] as const).map((status) => {
      const labels = { IN_PROGRESS: '진행중', COMPLETED: '완료', FAILED: '실패' };
      return (
        <tr key={status}>
          <td className="pr-2 py-1 text-gray-600 text-xs whitespace-nowrap">{labels[status]}</td>
          <td className="pr-2 py-1">
            <input
              type="text"
              value={template.statusMapping?.[status].emoji ?? ''}
              onChange={(e) => handleStatusMappingChange(status, 'emoji', e.target.value)}
              disabled={!isEnabled}
              maxLength={8}
              className="w-16 px-2 py-1 border border-gray-300 rounded text-sm text-center
                         focus:outline-none focus:ring-2 focus:ring-indigo-500
                         disabled:bg-gray-50 disabled:cursor-not-allowed"
            />
          </td>
          <td className="py-1">
            <input
              type="text"
              value={template.statusMapping?.[status].text ?? ''}
              onChange={(e) => handleStatusMappingChange(status, 'text', e.target.value)}
              disabled={!isEnabled}
              maxLength={20}
              className="w-full px-2 py-1 border border-gray-300 rounded text-sm
                         focus:outline-none focus:ring-2 focus:ring-indigo-500
                         disabled:bg-gray-50 disabled:cursor-not-allowed"
            />
          </td>
        </tr>
      );
    })}
  </tbody>
</table>
```

### 6-6. 기본값 복원 버튼

```tsx
<button
  type="button"
  onClick={() => {
    onChange(DEFAULT_MISSION_TEMPLATE);
    setValidationErrors(new Map());
  }}
  disabled={!isEnabled}
  className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg
             hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
>
  기본값 복원
</button>
```

### 6-7. 저장 버튼 및 피드백

```tsx
<div className="flex items-center gap-3 mt-4">
  <button
    type="button"
    onClick={onSave}
    disabled={isSaving || !isEnabled || validationErrors.size > 0}
    className="px-5 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg
               hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
  >
    {isSaving ? '저장 중...' : '템플릿 저장'}
  </button>
  {saveSuccess && (
    <p className="text-sm text-green-600 font-medium">템플릿이 저장되었습니다.</p>
  )}
  {saveError && (
    <p className="text-sm text-red-600 font-medium">{saveError}</p>
  )}
</div>
```

> 유효성 오류(`validationErrors.size > 0`)가 있으면 저장 버튼을 비활성화한다. 이로써 허용되지 않는 변수 사용 시 저장이 차단된다.

### 6-8. 각 필드 아래 허용 변수 안내 표시 패턴

```tsx
// 예: 제목 템플릿 필드
<div>
  <label htmlFor="mission-title-template" className="block text-sm font-medium text-gray-700 mb-1">
    제목 템플릿
  </label>
  <input
    id="mission-title-template"
    type="text"
    value={template.titleTemplate ?? ''}
    onChange={(e) => handleFieldChange({ titleTemplate: e.target.value || null })}
    disabled={!isEnabled}
    placeholder="🧑‍🌾 신입 미션 체크"
    className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2
      ${validationErrors.has('titleTemplate')
        ? 'border-red-400 focus:ring-red-500'
        : 'border-gray-300 focus:ring-indigo-500'}
      disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed`}
  />
  <div className="flex flex-wrap gap-1 mt-1">
    {MISSION_ALLOWED_VARS.titleTemplate.map((v) => (
      <code key={v} className="text-xs bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded font-mono">
        {v}
      </code>
    ))}
  </div>
  {validationErrors.has('titleTemplate') && (
    <p className="text-xs text-red-500 mt-1">
      허용되지 않는 변수: {validationErrors.get('titleTemplate')!.join(', ')}
    </p>
  )}
</div>
```

---

## 7. `MocoTemplateSection.tsx` 컴포넌트 설계

`MissionTemplateSection.tsx`와 동일한 구조로 구현한다. 다른 점만 열거한다.

### 7-1. props

```typescript
interface MocoTemplateSectionProps {
  template: MocoTemplate;
  onChange: (template: MocoTemplate) => void;
  onSave: () => void;
  isSaving: boolean;
  saveError: string | null;
  saveSuccess: boolean;
  isEnabled: boolean;
}
```

### 7-2. 입력 필드 목록 (MissionTemplateSection과의 차이)

| 필드명 | 종류 | 허용 변수 |
|--------|------|-----------|
| `titleTemplate` | `<input>` | `{rank}`, `{hunterName}` |
| `bodyTemplate` | `<textarea rows=5>` | `{totalMinutes}`, `{mocoList}` |
| `itemTemplate` | `<input>` | `{newbieName}`, `{minutes}` |
| `footerTemplate` | `<input>` | `{currentPage}`, `{totalPages}`, `{interval}` |

`statusMapping` 테이블 없음. `기본값 복원` 버튼은 `DEFAULT_MOCO_TEMPLATE` 기준.

### 7-3. bodyTemplate 안내 문구

`{mocoList}` 위치에 항목 템플릿이 반복 삽입된다는 점을 사용자에게 설명하는 안내 문구를 `bodyTemplate` 필드 아래에 표시한다.

```tsx
<p className="text-xs text-gray-400 mt-1">
  {'{mocoList}'} 위치에 항목 템플릿이 반복 삽입됩니다.
</p>
```

---

## 8. `MissionEmbedPreview.tsx` 컴포넌트 설계

```
apps/web/app/settings/guild/[guildId]/newbie/components/MissionEmbedPreview.tsx
```

기존 `EmbedPreview.tsx`는 `title`, `description`, `color`, `thumbnailUrl`만 받는 간단한 구조다. 미션 템플릿 미리보기는 **footer**가 추가로 필요하고, 더미 데이터 치환 로직이 필요하다. 별도 컴포넌트로 분리한다.

### 8-1. props

```typescript
interface MissionEmbedPreviewProps {
  template: MissionTemplate;
}
```

### 8-2. 렌더링 로직

`applyDummyVars`를 활용하여 각 템플릿 필드를 더미 값으로 치환한다.

```typescript
const title = applyDummyVars(
  template.titleTemplate ?? DEFAULT_MISSION_TEMPLATE.titleTemplate!,
  MISSION_PREVIEW_DUMMY,
);

const statusEmoji = template.statusMapping?.IN_PROGRESS.emoji ?? '🟡';
const statusText = template.statusMapping?.IN_PROGRESS.text ?? '진행중';

// 항목 템플릿 미리보기: 더미 데이터 치환 후 statusEmoji/statusText도 적용
const itemDummy = {
  ...MISSION_PREVIEW_DUMMY,
  '{statusEmoji}': statusEmoji,
  '{statusText}': statusText,
};
const itemRendered = applyDummyVars(
  template.itemTemplate ?? DEFAULT_MISSION_TEMPLATE.itemTemplate!,
  itemDummy,
);

const header = applyDummyVars(
  template.headerTemplate ?? DEFAULT_MISSION_TEMPLATE.headerTemplate!,
  MISSION_PREVIEW_DUMMY,
);

const footer = applyDummyVars(
  template.footerTemplate ?? DEFAULT_MISSION_TEMPLATE.footerTemplate!,
  MISSION_PREVIEW_DUMMY,
);

// description = header + 개행2 + item 렌더링 (1명 예시)
const description = `${header}\n\n${itemRendered}`;
```

### 8-3. UI 구조

기존 `EmbedPreview`와 동일한 Discord 스타일 카드를 사용하되 footer 영역을 추가한다.

```tsx
<div>
  <p className="text-sm font-medium text-gray-700 mb-2">미리보기</p>
  <div className="bg-[#2B2D31] rounded-lg p-4">
    <div
      className="bg-[#313338] rounded-md overflow-hidden"
      style={{ borderLeft: `4px solid #57F287` }}
    >
      <div className="p-4">
        <p className="text-white font-semibold text-sm mb-1">{title}</p>
        <p className="text-gray-300 text-xs whitespace-pre-wrap break-words mb-3">
          {description}
        </p>
        <p className="text-gray-500 text-[10px] border-t border-gray-600 pt-2">
          {footer}
        </p>
      </div>
    </div>
  </div>
</div>
```

색상은 미션 Embed 기본값 `#57F287`로 고정한다 (템플릿에 색상 필드 없음).

---

## 9. `MocoEmbedPreview.tsx` 컴포넌트 설계

`MissionEmbedPreview.tsx`와 동일한 구조. 다른 점만 열거한다.

### 9-1. props

```typescript
interface MocoEmbedPreviewProps {
  template: MocoTemplate;
}
```

### 9-2. 렌더링 로직

```typescript
const title = applyDummyVars(
  template.titleTemplate ?? DEFAULT_MOCO_TEMPLATE.titleTemplate!,
  MOCO_PREVIEW_DUMMY,
);

const itemRendered = applyDummyVars(
  template.itemTemplate ?? DEFAULT_MOCO_TEMPLATE.itemTemplate!,
  MOCO_PREVIEW_DUMMY,
);

// bodyTemplate의 {mocoList}를 itemRendered로 치환
const bodyWithList = (template.bodyTemplate ?? DEFAULT_MOCO_TEMPLATE.bodyTemplate!)
  .replace(/\{mocoList\}/g, itemRendered);

const description = applyDummyVars(bodyWithList, MOCO_PREVIEW_DUMMY);

const footer = applyDummyVars(
  template.footerTemplate ?? DEFAULT_MOCO_TEMPLATE.footerTemplate!,
  MOCO_PREVIEW_DUMMY,
);
```

색상은 모코코 Embed 기본값 `#5865F2`로 고정.

---

## 10. 구현 순서

아래 순서로 구현한다. 각 단계는 앞 단계가 완료된 후 진행한다.

| 순서 | 파일 | 작업 |
|------|------|------|
| 1 | `newbie-template-utils.ts` | 유효성 검사 유틸 + 더미 데이터 상수 신규 작성 |
| 2 | `newbie-api.ts` | `MissionTemplate`, `MocoTemplate` 타입 + API 함수 추가, 레거시 필드 제거 |
| 3 | `MissionEmbedPreview.tsx` | 미션 전용 미리보기 컴포넌트 신규 작성 |
| 4 | `MocoEmbedPreview.tsx` | 모코코 전용 미리보기 컴포넌트 신규 작성 |
| 5 | `MissionTemplateSection.tsx` | 미션 템플릿 섹션 컴포넌트 신규 작성 |
| 6 | `MocoTemplateSection.tsx` | 모코코 템플릿 섹션 컴포넌트 신규 작성 |
| 7 | `MissionTab.tsx` | 레거시 제거 + MissionTemplateSection 마운트 |
| 8 | `MocoTab.tsx` | 레거시 제거 + MocoTemplateSection 마운트 |
| 9 | `page.tsx` | 상태 추가 + useEffect 수정 + 저장 핸들러 추가 + 탭 렌더링 수정 |

---

## 11. 기존 코드베이스 충돌 검토

| 항목 | 충돌 여부 | 근거 |
|------|-----------|------|
| `newbie-api.ts`의 레거시 필드 제거 | **있음** | `MissionTab.tsx`와 `MocoTab.tsx`, `page.tsx`의 `DEFAULT_CONFIG`가 이 필드를 참조. 동시에 수정해야 함 (순서 2, 7, 8, 9를 하나의 커밋으로 처리) |
| `EmbedPreview.tsx` 기존 파일 | 없음 | `WelcomeTab.tsx`가 계속 사용. 수정하지 않음 |
| `page.tsx`의 `handleSave` | 없음 | 기존 `NewbieConfig` 저장 로직은 그대로 유지. 템플릿 저장 핸들러는 별도 함수로 추가 |
| `GuildEmojiPicker` 의존 | 없음 | 템플릿 섹션에서는 이모지 피커 미사용 (이모지는 자유 입력) |
| 탭 구조 (`TABS` 상수, `renderTabContent`) | 없음 | 탭 ID 변경 없음. MissionTab/MocoTab에 props만 추가 |

### 레거시 필드 동시 제거 상세

`newbie-api.ts`에서 `missionEmbedTitle` 등 8개 필드 제거 시, 아래 파일에서 해당 필드 참조를 모두 제거해야 컴파일 오류가 발생하지 않는다.

- `page.tsx` → `DEFAULT_CONFIG` 객체에서 8개 필드 제거
- `MissionTab.tsx` → 컴포넌트 전체 재작성 (레거시 필드 입력 UI 제거)
- `MocoTab.tsx` → 컴포넌트 전체 재작성 (레거시 필드 입력 UI 제거)

TypeScript 타입 체크가 이 연결을 강제하므로, 빌드 전에 3개 파일을 모두 수정해야 한다.

---

## 12. UX 상세 정리

### 12-1. 미리보기 debounce 동작

- 사용자가 입력 필드에 타이핑하면 `onChange`로 상위 상태가 즉시 업데이트된다.
- `previewTemplate` 로컬 상태는 300ms 이후에 갱신되어 `MissionEmbedPreview` / `MocoEmbedPreview`가 재렌더링된다.
- 빠른 연속 타이핑 시 미리보기가 깜빡이지 않는다.

### 12-2. 유효성 검사 UX

- 필드 변경 즉시 (`handleFieldChange` 내부) `validateMissionTemplate` / `validateMocoTemplate`를 실행한다.
- 오류 있는 필드: 입력 테두리 빨간색 (`border-red-400`), 필드 아래 오류 메시지 표시.
- 저장 버튼: `validationErrors.size > 0`이면 `disabled`. 사용자가 오류를 고치기 전까지 저장 불가.
- 서버 응답 오류(400)는 `saveError`로 표시.

### 12-3. 기본값 복원 동작

- "기본값 복원" 버튼 클릭 시 `onChange(DEFAULT_MISSION_TEMPLATE)` / `onChange(DEFAULT_MOCO_TEMPLATE)` 호출.
- `validationErrors`를 빈 Map으로 초기화한다.
- 저장 버튼 클릭 없이는 DB에 반영되지 않는다. (사용자가 직접 "템플릿 저장"을 눌러야 반영)

### 12-4. 기본 설정 저장 vs. 템플릿 저장 분리

- 기존 하단 "저장" 버튼은 `NewbieConfig`(기능 활성화, 채널, 기간 등)를 `POST /api/guilds/:guildId/newbie/config`로 저장한다. 그대로 유지.
- 각 탭의 템플릿 섹션 내부에 "템플릿 저장" 버튼을 별도로 배치한다. 이 버튼은 `POST /api/guilds/:guildId/newbie/mission-template` 또는 `moco-template`로 저장한다.
- 두 버튼의 역할이 다름을 사용자에게 명확히 전달한다. 섹션 헤더에 "이 섹션은 별도 저장됩니다" 안내 문구 추가.

### 12-5. 섹션 헤더 레이블

```tsx
<div className="flex items-center justify-between mb-4">
  <div>
    <p className="text-sm font-semibold text-gray-900">Embed 템플릿 설정</p>
    <p className="text-xs text-gray-500 mt-0.5">
      이 섹션의 설정은 하단 "템플릿 저장" 버튼으로 별도 저장됩니다.
    </p>
  </div>
</div>
```

### 12-6. 초기 로드 시 404 처리

- `fetchMissionTemplate` / `fetchMocoTemplate`가 404를 반환하면 null이 오고, `DEFAULT_MISSION_TEMPLATE` / `DEFAULT_MOCO_TEMPLATE`를 초기 상태로 사용한다.
- 사용자가 "기본값 복원" 후 "템플릿 저장"을 누르면 처음으로 DB에 레코드가 생성된다.

---

## 13. 구현 시 주의사항

1. **`useEffect` cleanup**: `debounceRef.current`를 반환 시 `clearTimeout`으로 정리하여 컴포넌트 언마운트 후 상태 업데이트를 방지한다.

2. **`statusMapping` null 처리**: `template.statusMapping`이 null인 경우 `DEFAULT_MISSION_TEMPLATE.statusMapping`의 기본값으로 폴백 처리한다. 상태 매핑 테이블 렌더링 시 null guard 필수.

3. **타입 일관성**: `MissionTemplate`의 `statusMapping` 필드는 `MissionStatusMapping | null`이다. `handleStatusMappingChange`는 현재 statusMapping이 null인 경우 `DEFAULT_MISSION_TEMPLATE.statusMapping`을 기반으로 새 객체를 생성한 뒤 업데이트한다.

4. **저장 성공 메시지 자동 소멸**: `setTimeout(() => setMissionTemplateSaveSuccess(false), 3000)` — 기존 `handleSave`와 동일한 패턴.

5. **`isEnabled` 연동**: 미션/모코코 기능이 비활성화(`isEnabled = false`)인 경우에도 템플릿 입력 필드를 disabled로 만들어 일관성 있는 UX를 제공한다.
