# 웹 대시보드 사생활 설정 + 길드 Co-Presence 토글 페이지 구현 계획

> 작성일: 2026-05-04
> 상위 문서:
> - PRD: `docs/specs/prd/voice-co-presence.md` F-COPRESENCE-015 / F-COPRESENCE-017
> - DB 스키마: `docs/specs/database/_index.md` (UserPrivacyConfig, GuildCoPresenceConfig)
> - 공통 모듈: `docs/specs/common-modules.md` Part D (D-2 / D-3)
> - 선행 plan: `docs/plans/user-privacy-module.md` (백엔드 API 단독 plan)

---

## 1. 작업 목적

Voice Co-Presence Phase 5에서 도입되는 두 가지 사생활/공개 정책을 웹 대시보드에서 제어할 수 있는 신규 설정 페이지 2종을 추가한다.

| 페이지 | 대상 | DB 테이블 | API |
|--------|------|-----------|-----|
| 사용자 사생활 설정 | 본인 (1명) | `user_privacy_config` | `GET/PUT /api/users/me/privacy?guildId=` |
| 길드 Co-Presence 토글 | 길드 관리자 | `guild_co_presence_config` | `GET/PUT /api/guilds/:guildId/co-presence-config` |

본 plan은 **`apps/web` 도메인 단독 작업**만 다룬다. 백엔드 API 컨트롤러는 다음 두 plan에서 별도 처리한다.

- 사용자 사생활: `docs/plans/user-privacy-module.md` (이미 작성됨)
- 길드 토글 컨트롤러: 본 plan §10 후속 작업으로 신규 plan 분리 예정 (가칭 `guild-co-presence-config-api.md`)

---

## 2. 변경 대상 파일 목록

### 2.1. 신규 파일

| # | 파일 경로 | 역할 |
|---|-----------|------|
| 1 | `apps/web/app/settings/me/layout.tsx` | `settings/me/*` 영역의 layout (인증 체크 + Header 통일) |
| 2 | `apps/web/app/settings/me/privacy/page.tsx` | 사생활 설정 페이지 (단일 토글) |
| 3 | `apps/web/app/settings/guild/[guildId]/co-presence/page.tsx` | 길드 Co-Presence 토글 설정 페이지 |
| 4 | `apps/web/app/lib/user-privacy-api.ts` | 사용자 사생활 API 클라이언트 (fetch/save) |
| 5 | `apps/web/app/lib/guild-co-presence-config-api.ts` | 길드 Co-Presence 설정 API 클라이언트 |
| 6 | `apps/web/app/settings/guild/[guildId]/co-presence/__tests__/CoPresenceConfigPage.test.tsx` | 통합 테스트 (Testing Trophy) |
| 7 | `apps/web/app/settings/me/privacy/__tests__/PrivacyPage.test.tsx` | 통합 테스트 |

### 2.2. 수정 파일

| # | 파일 경로 | 변경 내용 |
|---|-----------|-----------|
| 8 | `apps/web/app/components/SettingsSidebar.tsx` | "회원 관리" 그룹에 "Co-Presence" 메뉴 추가, 신규 그룹 "개인 설정" 추가 + "사생활" 메뉴 |
| 9 | `libs/i18n/locales/ko/web/settings.json` | `coPresence`, `privacy` 신규 섹션 추가 |
| 10 | `libs/i18n/locales/en/web/settings.json` | 동일 (영문 키) |
| 11 | `libs/i18n/locales/ko/web/common.json` | `sidebar.settingsGroup.personal`, `settings.coPresence`, `settings.privacy` 추가 |
| 12 | `libs/i18n/locales/en/web/common.json` | 동일 (영문 키) |

`apps/web/app/settings/SettingsContext.tsx`는 변경하지 않는다 — `settings/me/*`는 길드 컨텍스트가 필요하지만 query string으로 처리한다 (§4.1 참고).

---

## 3. 디렉터리 구조

```
apps/web/app/
├── settings/
│   ├── guild/[guildId]/
│   │   ├── co-presence/                       (신규)
│   │   │   ├── page.tsx
│   │   │   └── __tests__/CoPresenceConfigPage.test.tsx
│   │   └── ...(기존)
│   └── me/                                     (신규 영역)
│       ├── layout.tsx
│       └── privacy/
│           ├── page.tsx
│           └── __tests__/PrivacyPage.test.tsx
├── components/
│   └── SettingsSidebar.tsx                     (수정)
└── lib/
    ├── user-privacy-api.ts                     (신규)
    └── guild-co-presence-config-api.ts         (신규)
```

`settings/me/layout.tsx`는 길드 layout(`settings/guild/[guildId]/layout.tsx`)과 달리 `SettingsSidebar`를 렌더하지 않는다 — 사이드바는 길드 컨텍스트(selectedGuildId)에 종속되므로, `settings/me/*` 진입 시 사용자가 선호하는 길드를 페이지 내부 dropdown에서 직접 선택한다 (§4.1 결정 사항).

---

## 4. 핵심 의사 결정

### 4.1. `settings/me/privacy` 페이지에서 길드 선택 방식

**문제**: `UserPrivacyConfig`는 `(guildId, userId)` 복합키이며, API는 `?guildId=...` query string을 필수로 받는다 (`docs/plans/user-privacy-module.md` §5.1). 사용자는 다중 길드에 가입할 수 있으므로 페이지 진입 시 어떤 길드의 설정을 표시할지 결정해야 한다.

**결정**: 페이지 상단에 **길드 선택 드롭다운**을 배치하고, 드롭다운 변경 시 해당 길드의 현재 설정을 fetch한다. localStorage `selectedGuildId`를 초기 기본값으로 사용한다 (Header.tsx 패턴 답습). 토글 변경 후 저장 시 현재 선택된 길드의 설정만 갱신한다.

근거:
- 사용자별로 길드마다 다른 정책을 원할 수 있음 (예: 개인 서버는 공개, 외부 서버는 비공개).
- 향후 "전체 길드 일괄 적용" 버튼을 옵션으로 추가 가능 (본 plan 범위 외).

### 4.2. 사이드바 메뉴 구조 변경

**현재 SettingsSidebar 구조**: `serverSettings`, `voiceChannel`, `memberManagement`, `analytics` 4개 그룹 모두 길드 컨텍스트 필요.

**변경**: 신규 그룹 `personal`("개인 설정")을 사이드바 최하단에 추가하고, 그 안에 "사생활" 항목을 둔다. 링크는 `/settings/me/privacy` (path에 guildId 없음). 또한 기존 `memberManagement` 그룹에 "Co-Presence" 항목을 추가한다 (`/settings/guild/${selectedGuildId}/co-presence`).

근거:
- 기존 SettingsSidebar는 `selectedGuildId` prop을 받아 길드 단위 메뉴를 렌더링한다. `personal` 그룹은 guildId와 무관한 path로 분기하여 일관된 UX 유지.
- `settings/me/*` 영역에서도 동일한 SettingsSidebar가 노출되어야 사용자가 길드 설정으로 이동할 때 컨텍스트를 잃지 않는다 (settings/me/layout이 SettingsSidebar를 재사용하는 것이 아니라, 별도 사이드바를 두지 않고 컴팩트한 단일 페이지로 처리).

**대안 고려 (기각)**: settings/me 전용 별도 사이드바 신설 — 페이지가 1개뿐이라 과도한 분리.

### 4.3. GuildCoPresenceConfig 페이지 위치

PRD `common-modules.md` D-3에서는 `apps/web/app/dashboard/guild/[guildId]/co-presence/` 페이지 내부에 토글을 두라고 권고하지만, 본 plan은 사용자 명시 요청에 따라 **`settings/guild/[guildId]/co-presence/` 별도 페이지**로 분리한다.

근거:
- 분석 대시보드(`dashboard/...`)는 데이터 시각화 영역이고, 설정 토글은 관리자 액션 성격이라 도메인 분리 명확함.
- `inactive-member`, `sticky-message` 등 기존 패턴도 dashboard/settings 분리.

---

## 5. UI 와이어프레임

### 5.1. 사용자 사생활 설정 (`/settings/me/privacy`)

```
┌────────────────────────────────────────────────────────────┐
│  🔒 사생활 설정                                             │
│                                                            │
│  ┌─ 적용 대상 서버 ─────────────────────────────────────┐  │
│  │ [▼ 서버 선택 드롭다운]                                │  │
│  │   - Onyu 메인 (기본 선택)                             │  │
│  │   - 친구 서버                                         │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                            │
│  ┌─ 친밀도 / 베스트 프렌드 노출 ─────────────────────────┐  │
│  │  공개 여부                                       [●─] │  │
│  │  OFF로 변경하면 다른 사용자가 /best-friend, /affinity│  │
│  │  명령어로 당신의 정보를 조회할 때 ???로 익명화됩니다.│  │
│  └──────────────────────────────────────────────────────┘  │
│                                                            │
│  ┌──────────────────────────────────────┬──────────────┐   │
│  │ 저장 성공 메시지 (3초 후 자동 사라짐) │   [저장]     │   │
│  └──────────────────────────────────────┴──────────────┘   │
└────────────────────────────────────────────────────────────┘
```

상태:
- 미인증 시: 로그인 페이지 리다이렉트 (`/auth/discord?returnTo=...`)
- 길드 1개도 가입되지 않은 경우: "Onyu 봇이 설치된 서버가 없습니다" 빈 상태 카드 + select-guild 링크
- API 401: 로그인 페이지 리다이렉트
- API 4xx/5xx: `saveError` 영역에 한국어 메시지 표시

### 5.2. 길드 Co-Presence 토글 (`/settings/guild/[guildId]/co-presence`)

```
┌────────────────────────────────────────────────────────────┐
│  🤝 Co-Presence 설정                  [📊 대시보드에서 보기]│
│                                                            │
│  ┌─ /affinity 권한 정책 ─────────────────────────────────┐  │
│  │  타인↔타인 친밀도 조회 허용                       [○─]│  │
│  │  이 설정을 켜면 일반 사용자도 /affinity 명령어로 자신│  │
│  │  이 포함되지 않은 페어의 친밀도를 조회할 수 있습니다.│  │
│  │  OFF인 경우 ManageGuild 권한자만 가능합니다.         │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                            │
│  ┌──────────────────────────────────────┬──────────────┐   │
│  │ 저장 성공 메시지                     │   [저장]     │   │
│  └──────────────────────────────────────┴──────────────┘   │
└────────────────────────────────────────────────────────────┘
```

기존 길드 설정 layout(`settings/guild/[guildId]/layout.tsx`)이 이미 `SettingsSidebar` + 인증 체크 + 길드 멤버십 검증을 처리하므로, page.tsx는 본문만 렌더하면 된다.

---

## 6. API 호출 흐름

### 6.1. `/settings/me/privacy` 페이지

```
[Mount]
  │
  ├─ fetch /auth/me ──► user.guilds 목록 획득
  ├─ localStorage selectedGuildId ──► 초기 길드 결정
  │
  ▼
[길드 선택됨]
  │
  ├─ fetchUserPrivacy(guildId) ──► GET /api/users/me/privacy?guildId=...
  │     응답: { guildId, userId, disableRelationshipShare }
  │
  ▼
[토글 변경 + 저장 클릭]
  │
  ├─ saveUserPrivacy(guildId, { disableRelationshipShare })
  │     PUT /api/users/me/privacy?guildId=...
  │     body: { guildId, disableRelationshipShare }
  │
  ▼
[성공 → 토스트 3초]
  실패 → saveError 표시
```

### 6.2. `/settings/guild/[guildId]/co-presence` 페이지

```
[Mount]
  │
  ▼
[selectedGuildId from useSettings()]
  │
  ├─ fetchGuildCoPresenceConfig(guildId) ──► GET /api/guilds/:guildId/co-presence-config
  │     응답: { guildId, allowPublicAffinityQuery, updatedAt }
  │
  ▼
[토글 변경 + 저장 클릭]
  │
  ├─ saveGuildCoPresenceConfig(guildId, { allowPublicAffinityQuery })
  │     PUT /api/guilds/:guildId/co-presence-config
  │     body: { allowPublicAffinityQuery }
  │
  ▼
[성공 → 토스트 3초]
```

---

## 7. API 클라이언트 시그니처

### 7.1. `apps/web/app/lib/user-privacy-api.ts`

```typescript
import { apiClient } from './api-client';

/** GET /api/users/me/privacy 응답 */
export interface UserPrivacyConfig {
  guildId: string;
  userId: string;
  disableRelationshipShare: boolean;
}

/** PUT /api/users/me/privacy 요청 본문 */
export interface UserPrivacySaveDto {
  guildId: string;
  disableRelationshipShare: boolean;
}

/** 사용자 본인의 사생활 설정 조회 (특정 길드 기준). */
export async function fetchUserPrivacy(guildId: string): Promise<UserPrivacyConfig> {
  return apiClient<UserPrivacyConfig>(
    `/api/users/me/privacy?guildId=${encodeURIComponent(guildId)}`,
  );
}

/** 사용자 본인의 사생활 설정 저장. */
export async function saveUserPrivacy(
  guildId: string,
  dto: UserPrivacySaveDto,
): Promise<UserPrivacyConfig> {
  return apiClient<UserPrivacyConfig>(
    `/api/users/me/privacy?guildId=${encodeURIComponent(guildId)}`,
    { method: 'PUT', body: dto },
  );
}
```

### 7.2. `apps/web/app/lib/guild-co-presence-config-api.ts`

```typescript
import { apiClient } from './api-client';

/** GET /api/guilds/:guildId/co-presence-config 응답 */
export interface GuildCoPresenceConfig {
  guildId: string;
  allowPublicAffinityQuery: boolean;
  updatedAt: string;
}

/** PUT 요청 본문 */
export interface GuildCoPresenceConfigSaveDto {
  allowPublicAffinityQuery: boolean;
}

/** 길드의 Co-Presence 토글 설정 조회. */
export async function fetchGuildCoPresenceConfig(
  guildId: string,
): Promise<GuildCoPresenceConfig> {
  return apiClient<GuildCoPresenceConfig>(`/api/guilds/${guildId}/co-presence-config`);
}

/** 길드의 Co-Presence 토글 설정 저장. */
export async function saveGuildCoPresenceConfig(
  guildId: string,
  dto: GuildCoPresenceConfigSaveDto,
): Promise<GuildCoPresenceConfig> {
  return apiClient<GuildCoPresenceConfig>(`/api/guilds/${guildId}/co-presence-config`, {
    method: 'PUT',
    body: dto,
  });
}
```

---

## 8. 사이드바 메뉴 추가 위치

### 8.1. `SettingsSidebar.tsx` 변경 (의사 코드)

```typescript
import { Lock, Heart } from 'lucide-react';
// ...

const menuGroups: MenuGroup[] = [
  // ...(serverSettings, voiceChannel 그대로)
  {
    label: t('sidebar.settingsGroup.memberManagement'),
    items: [
      // ...(기존 newbie, inactiveMember, statusPrefix, stickyMessage)
      {
        href: `/settings/guild/${selectedGuildId}/co-presence`,
        label: t('settings.coPresence'),
        icon: Heart,
      },
    ],
  },
  // ...(analytics 그대로)
  {
    label: t('sidebar.settingsGroup.personal'),  // 신규 그룹
    items: [
      {
        href: `/settings/me/privacy`,            // guildId 없음
        label: t('settings.privacy'),
        icon: Lock,
      },
    ],
  },
];
```

`settings/me/*` 페이지에서도 SettingsSidebar를 렌더하려면 layout이 필요하므로 `settings/me/layout.tsx`를 신설한다 (§9 참조).

### 8.2. `settings/me/layout.tsx` (신규)

```typescript
'use client';

// settings/guild/[guildId]/layout.tsx와 거의 동일하지만 guildId 검증 부분 제거
// SettingsSidebar는 selectedGuildId가 필수이므로 localStorage 기반 fallback 사용

export default function MeSettingsLayout({ children }: { children: React.ReactNode }) {
  // 1. /auth/me로 로그인 + 길드 목록 조회
  // 2. localStorage.selectedGuildId 또는 첫번째 길드를 선택
  // 3. SettingsProvider로 context 주입
  // 4. SettingsSidebar 렌더 (selectedGuildId 전달)
}
```

이렇게 해야 `settings/me/privacy`에서도 사이드바를 통해 길드 설정 페이지로 자연스럽게 이동 가능.

---

## 9. i18n 키 추가

### 9.1. `libs/i18n/locales/ko/web/common.json`

`sidebar.settingsGroup`에 추가:
```json
"settingsGroup": {
  ...,
  "personal": "개인 설정"
}
```

`settings`에 추가:
```json
"settings": {
  ...,
  "coPresence": "Co-Presence 설정",
  "privacy": "사생활 설정"
}
```

### 9.2. `libs/i18n/locales/ko/web/settings.json` 신규 섹션

```json
"coPresence": {
  "title": "Co-Presence 설정",
  "policySection": "/affinity 권한 정책",
  "allowPublicAffinityQuery": "타인↔타인 친밀도 조회 허용",
  "allowPublicAffinityQueryDesc": "이 설정을 켜면 일반 사용자도 /affinity 명령어로 자신이 포함되지 않은 페어의 친밀도를 조회할 수 있습니다. OFF인 경우 ManageGuild 권한자만 가능합니다."
},
"privacy": {
  "title": "사생활 설정",
  "guildSelectLabel": "적용 대상 서버",
  "guildSelectDesc": "선택한 서버에서의 노출 정책만 변경됩니다.",
  "noGuilds": "Onyu 봇이 설치된 서버가 없습니다.",
  "relationshipShareSection": "친밀도 / 베스트 프렌드 노출",
  "disableRelationshipShare": "공개 여부",
  "disableRelationshipShareDesc": "OFF로 변경하면 다른 사용자가 /best-friend, /affinity 명령어로 당신의 정보를 조회할 때 ???로 익명화됩니다.",
  "publicLabel": "공개",
  "privateLabel": "비공개"
}
```

### 9.3. 영문 (en) 키

동일 구조의 영문 번역을 `en/web/*.json`에도 동시 추가한다. `__tests__/landing-i18n.test.ts` 같은 i18n 누락 검증 테스트가 존재하므로 ko/en 양쪽 동기화 필수.

---

## 10. 의존 컴포넌트 (기존 재사용)

| 컴포넌트 | 출처 | 용도 |
|----------|------|------|
| 토글 스위치 (인라인 `<button role="switch">`) | `inactive-member/page.tsx`의 `renderToggle()` 패턴 | 두 페이지 모두 |
| 저장 버튼 + 피드백 영역 | `inactive-member/page.tsx`의 footer 패턴 | 두 페이지 모두 |
| 빈 상태 카드 (`Server` 아이콘 + 메시지) | `inactive-member/page.tsx`의 `if (!selectedGuildId)` 분기 | privacy 페이지 (길드 없음) / co-presence (길드 미선택) |
| `Loader2 animate-spin` | 모든 settings 페이지 공통 | isLoading 상태 |
| `apiClient<T>()` | `apps/web/app/lib/api-client.ts` | API 호출 |
| `useSettings()` Context | `apps/web/app/settings/SettingsContext.tsx` | co-presence 페이지에서 selectedGuildId 획득 |
| `useTranslations('settings')` / `('common')` | next-intl | i18n |

신규 컴포넌트 추출은 하지 않는다 — 토글 1~2개짜리 단순 페이지이므로 인라인으로 충분하며, react-hook-form/zod 도입은 과한 결정 (사용자 입력에 명시).

---

## 11. 테스트 케이스 (Testing Trophy: 통합 테스트 위주)

기존 `apps/web/app/settings/guild/[guildId]/auto-channel/__tests__/AutoChannelPage.test.tsx` 패턴을 따른다 — `@testing-library/react` + `vi.mock`으로 API 클라이언트 mock.

### 11.1. `__tests__/PrivacyPage.test.tsx`

| # | 케이스 | 검증 |
|---|--------|------|
| W-1 | 페이지 mount → 로딩 스피너 → 토글 노출 | `Loader2` 표시 후 토글이 렌더되는지 |
| W-2 | 길드 드롭다운에 user.guilds 목록 표시 | option 개수와 라벨 검증 |
| W-3 | 길드 변경 → fetchUserPrivacy 재호출 | mock 호출 인자 = 새 guildId |
| W-4 | 토글 클릭 → checked 상태 반전 | aria-checked 속성 변경 |
| W-5 | 저장 클릭 → saveUserPrivacy 호출, 성공 메시지 노출 | 페이로드 검증 |
| W-6 | 저장 실패 → saveError 메시지 노출 | API 에러 메시지 노출 |
| W-7 | 길드 0개인 사용자 → "Onyu 봇이 설치된 서버가 없습니다" 빈 상태 | 빈 상태 카드 가시성 |
| W-8 | 미인증 사용자 → 로그인 페이지로 리다이렉트 | `window.location.href` 변경 검증 |

### 11.2. `__tests__/CoPresenceConfigPage.test.tsx`

| # | 케이스 | 검증 |
|---|--------|------|
| C-1 | 페이지 mount → fetchGuildCoPresenceConfig 호출 | mock 호출 인자 = 현재 guildId |
| C-2 | 토글 OFF → ON → 저장 | saveGuildCoPresenceConfig payload `{ allowPublicAffinityQuery: true }` |
| C-3 | 저장 성공 → 토스트 3초 후 사라짐 | `vi.useFakeTimers` |
| C-4 | 저장 실패 (4xx) → 에러 메시지 노출 | ApiError 메시지 노출 |
| C-5 | guildId 미선택 (`selectedGuildId === ''`) → 빈 상태 | "서버를 선택해주세요" 카드 |
| C-6 | "대시보드에서 보기" 링크 href 검증 | `/dashboard/guild/{guildId}/co-presence` |

### 11.3. 통합 검증

- `pnpm --filter @nexus/web lint` 통과 — `any` 0건, floating-promise 0건.
- `pnpm --filter @nexus/web test` 위 테스트 14건 전부 통과.
- 수동: `next dev` 실행 후 두 페이지 진입 → 토글 변경 → 새로고침 후 값 유지 확인.

---

## 12. 코드 스타일 (CLAUDE.md / code-style-guide.md 준수)

- React 컴포넌트는 `function` 선언식 (예: `export default function PrivacyPage() {}`) — ESLint 자동 강제.
- Boolean 변수명: `isSaving`, `isLoading`, `isPrivate`, `hasGuilds`, `disableRelationshipShare` 등 prefix 적용.
- 이벤트 핸들러: `handleSaveClick`, `handleToggleChange`, `handleGuildSelect`.
- `as` 단언 회피 — 부득이한 경우 (예: `e.target as Node` 외부클릭 감지) 한국어 주석으로 사유 명시.
- `import type { ... }` 분리 (auto-fix 적용).
- catch 블록은 `error instanceof Error` 가드 후 message 추출.
- 매직 넘버 회피 — `SAVE_SUCCESS_TOAST_MS = 3000` 같은 상수화.
- 함수 50줄 초과 회피 — 토글 영역, 저장 핸들러는 별도 함수로 분리.
- `// TODO(이름 YYYY-MM-DD): 내용 — #이슈` 포맷.
- 한국어 코드 주석 (CLAUDE.md 따라 한국어 우선).
- API 클라이언트의 공용 함수 (`fetchUserPrivacy`, `saveUserPrivacy`)에 JSDoc 작성.

---

## 13. 의존 작업 (선후 관계)

본 plan의 페이지들이 정상 동작하려면 백엔드 API가 먼저 구현되어야 한다.

| 의존 | 상태 | plan |
|------|------|------|
| `GET/PUT /api/users/me/privacy` | 미구현 | `docs/plans/user-privacy-module.md` (작성 완료) |
| `GET/PUT /api/guilds/:guildId/co-presence-config` | 미구현 | 신규 plan 필요 (가칭 `guild-co-presence-config-api.md`) — §14 참조 |

**작업 순서 권장**:
1. user-privacy-module.md 백엔드 구현 → API 가용
2. guild-co-presence-config-api.md (신규 작성 + 백엔드 구현) → API 가용
3. 본 plan 프론트엔드 구현 (mock으로 먼저 시작 가능)

---

## 14. 향후 작업 (본 plan 범위 외)

### 14.1. `guild-co-presence-config-api.md` 신규 plan 필요 항목

- `apps/api/src/channel/voice/co-presence/presentation/guild-co-presence-config.controller.ts` 신규
  - `@Controller('api/guilds/:guildId/co-presence-config')`
  - `GET` / `PUT` 엔드포인트
  - `JwtAuthGuard` + `GuildMembershipGuard` (또는 `ManageGuildGuard`)
- `apps/api/src/channel/voice/co-presence/application/guild-co-presence-config.service.ts` 신규 — `getOrCreate(guildId)`, `update(guildId, dto)`
- `apps/api/src/channel/voice/co-presence/infrastructure/guild-co-presence-config.repository.ts` 신규
- `apps/api/src/channel/voice/co-presence/co-presence.module.ts` 변경 — 신규 컨트롤러/서비스 등록
- DTO: `UpdateGuildCoPresenceConfigDto { allowPublicAffinityQuery: boolean }`

### 14.2. 후속 plan 후보

- 사용자 사생활 페이지 모바일 반응형 개선
- 길드 Co-Presence 페이지에 "현재 적용 중인 정책" 요약 카드 추가
- "이 설정 변경 후 캐시 무효화 시간(30분)" 안내 배너 추가 (Redis TTL 명시)

---

## 15. 검증 체크리스트

- [ ] 신규 페이지 2개 생성 (privacy, co-presence)
- [ ] 신규 API 클라이언트 2개 생성 (user-privacy-api, guild-co-presence-config-api)
- [ ] settings/me/layout.tsx 신규 (인증 + SettingsSidebar 통합)
- [ ] SettingsSidebar.tsx에 "Co-Presence" 메뉴 추가 + "개인 설정" 그룹 + "사생활" 메뉴 추가
- [ ] i18n ko/en 양쪽 동기화 (common.json sidebar/settings 키 + settings.json privacy/coPresence 섹션)
- [ ] 통합 테스트 14건 전부 통과
- [ ] `pnpm --filter @nexus/web lint` 통과
- [ ] `pnpm --filter @nexus/web build` 성공
- [ ] 한국어 텍스트 typo 없음
- [ ] 길드 0개 사용자 빈 상태 처리
- [ ] 저장 성공/실패 토스트 3초 동작
- [ ] 모바일(`md:` 미만) 사이드바 토글 정상
- [ ] CLAUDE.md 코드 스타일 준수 (boolean prefix, function 선언식, JSDoc, 매직 넘버 상수화)
