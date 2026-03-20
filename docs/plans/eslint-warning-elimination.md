# ESLint Warning 제거 계획

> 작성일: 2026-03-15
> 상태: 계획 수립 완료 (미적용)
> 현재: API 0 errors / 277 warnings, Web 0 errors / 199 warnings

## Warning 유형별 분류

### API (277건)

| 유형 | 건수 | 우선순위 |
|------|------|---------|
| `no-magic-numbers` | 143 | 중 |
| `max-params` (Constructor DI 포함) | 63 | 저 |
| `max-lines-per-function` | 33 | 중 |
| `no-negated-condition` | 14 | 저 |
| `no-non-null-assertion` | 13 | 중 |
| 기타 | 11 | - |

### Web (199건)

| 유형 | 건수 | 우선순위 |
|------|------|---------|
| `max-lines-per-function` (React 컴포넌트) | 96 | 중 |
| `no-magic-numbers` | 48 | 중 |
| `no-non-null-assertion` | 33 | 중 |
| `@next/next/no-img-element` | 9 | 저 |
| `max-params` | 8 | 저 |
| `no-negated-condition` | 5 | 저 |
| 기타 (react hooks deps, unused) | 5 | - |

---

## Phase 1: ESLint 규칙 조정 (즉시 감소 가능)

코드 변경 없이 규칙 설정만 조정하여 false positive를 제거한다.

### 1-1. `max-params` — Constructor DI 제외 (API -35건)

NestJS Constructor DI는 파라미터 수 제한 대상이 아님. ESLint는 constructor를 구분할 수 없으므로 대안:

**방법:** `max-params`를 API에서 `off`로 변경하고, 일반 함수만 커스텀 규칙으로 검사하거나 리뷰 시 수동 확인.

```javascript
// apps/api/eslint.config.mjs
'max-params': 'off', // Constructor DI 때문에 false positive 다수
```

**또는** 전역 `max-params`를 유지하되 `max: 5`로 완화 (DI는 보통 4~5개):

```javascript
'max-params': ['warn', { max: 5 }],
```

**권장:** API에서 `max: 5`로 완화 → -47건 감소 (4개 이하는 통과)

### 1-2. `no-magic-numbers` — 추가 ignore (API -80건, Web -30건)

빈번한 도메인 특수값을 ignore에 추가:

```javascript
ignore: [
  // 기존
  -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 16, 24, 30, 60, 100, 1000, 1024, 3600,
  // 추가
  9, 14, 15, 20, 25, 32, 40, 50, 90,  // 일반 리터럴
  200, 204, 300, 365, 404, 500,         // HTTP 상태코드 + 캘린더
  3000, 5432, 6379,                      // 포트 번호
  60_000, 86_400, 86_400_000,            // 시간 밀리초/초
],
```

### 1-3. `max-lines-per-function` — React 컴포넌트 완화 (Web -96건)

React 컴포넌트는 JSX 반환이 길어지는 것이 자연스러움. Web에서 컴포넌트 파일에 한해 완화:

```javascript
// apps/web/eslint.config.mjs
{
  files: ['app/**/*.tsx', 'components/**/*.tsx'],
  rules: {
    'max-lines-per-function': ['warn', { max: 150, skipBlankLines: true, skipComments: true }],
  },
},
```

### 1-4. `no-negated-condition` — off (API -14건, Web -5건)

이 규칙은 가이드에 명시되지 않았고 코드 가독성에 미치는 영향이 작음:

```javascript
'no-negated-condition': 'off',
```

### Phase 1 예상 효과

| 워크스페이스 | 현재 | 조정 후 |
|---|---|---|
| API | 277 | ~80 |
| Web | 199 | ~55 |

---

## Phase 2: `no-non-null-assertion` 수정 (API 13건, Web 33건)

`!` non-null assertion을 optional chaining 또는 nullish coalescing으로 교체.

### 패턴 A — 프로퍼티 접근

```typescript
// Before
config.channelId!

// After
config.channelId ?? ''
// 또는 guard clause:
if (!config.channelId) throw new DomainException('...');
```

### 패턴 B — 배열/맵 접근

```typescript
// Before
map.get(key)!

// After
const value = map.get(key);
if (!value) throw new Error('...');
```

### 대상
- API: 13건 (grep `!` non-null assertion)
- Web: 33건

---

## Phase 3: `no-magic-numbers` 나머지 수정 (Phase 1 이후 잔존분)

Phase 1 규칙 조정 후에도 남는 매직 넘버를 이름 있는 상수로 추출.

### 패턴

```typescript
// Before
if (declineRatio >= 0.5) { ... }

// After
const DECLINE_THRESHOLD = 0.5;
if (declineRatio >= DECLINE_THRESHOLD) { ... }
```

### 대상
- 색상 코드: `0xffa500`, `0x5865f2`, `0x4f46e5` → `DISCORD_BLURPLE`, `WARNING_ORANGE` 등
- 비율: `0.1`, `0.5` → 의미 있는 상수명
- 기타 도메인 특수값

---

## Phase 4: `max-lines-per-function` API 수정 (33건)

50줄 초과 함수를 분리. 가이드: "함수 하나는 한 가지 일만 — 50줄 초과 시 분리"

### 우선순위

**높음 (90줄+, 즉시 분리):**
- `mission.service.ts: processSessionEnded` (92줄) → 알림 전송/상태 업데이트 분리
- `mission.service.ts: buildMissionEmbed` (91줄) → 임베드 빌더 추출
- `co-presence-analytics.service.ts: getList` (95줄) → 쿼리/변환 분리
- `me.command.ts: onMyVoiceStats` (108줄) → 데이터 수집/렌더링 분리

**중간 (60~90줄, 리팩토링 시 분리):**
- `mission.service.ts: buildRankPayload` (69줄)
- `voice-state.dispatcher.ts: dispatch` (80줄)
- `voice-analytics.service.ts: onVoiceStats` (83줄)
- 기타 17건

**낮음 (50~60줄, 자연스러운 분리점 없으면 유지):**
- 14건 — 많은 경우 함수 분리보다 현재 구조가 더 가독성 좋을 수 있음

---

## Phase 5: `max-lines-per-function` Web 수정 (96건 → Phase 1 이후 잔존분)

Phase 1에서 150줄로 완화 후에도 남는 초대형 컴포넌트를 분리.

### 우선순위 (150줄 초과)

| 컴포넌트 | 줄수 | 분리 방안 |
|----------|------|----------|
| `AutoChannelSettingsPage` | 735 | 탭별 하위 컴포넌트 추출 |
| `StatusPrefixSettingsPage` | 627 | 프리뷰/폼/버튼 목록 분리 |
| `InactiveMemberSettingsPage` | 552 | 설정 섹션별 컴포넌트 |
| `StickyMessageSettingsPage` | 481 | 메시지 카드 목록 + 폼 분리 |
| `MocoTab` | 487 | 설정/랭킹/차트 탭별 분리 |
| `CoPresenceGraph` | 400 | D3 로직 → 커스텀 훅 추출 |
| `MissionTab` | 294 | 목록/모달/액션 분리 |
| `NewbieSettingsPage` | 295 | 탭별 분리 |
| `MissionTemplateSection` | 295 | 프리뷰/에디터 분리 |
| `MocoTemplateSection` | 263 | 프리뷰/에디터 분리 |
| `InactiveMemberPage` | 280 | 테이블/차트/액션바 분리 |
| `Header` | 220 | 네비게이션/프로필 분리 |
| `Home` | 219 | 히어로/피처/CTA 섹션 분리 |
| `PairsTable` | 243 | 테이블/페이지네이션 분리 |

---

## Phase 6: 기타 Warning

### `@next/next/no-img-element` (9건)
`<img>` → `<Image>` (next/image) 교체. LCP 최적화.

### React hooks deps (3건)
`useCallback`/`useEffect` deps에 `t` (i18n 함수) 누락 — 안정 참조이므로 eslint-disable 주석 추가.

### unused `_showToast` (1건)
미사용 변수 삭제.

---

## 실행 순서

```
Phase 1 (규칙 조정)     ── ESLint 설정만 변경 ── 1커밋 ── 277+199 → ~135
  │
Phase 2 (non-null 수정) ── 46건 코드 수정   ── 1커밋 ── ~135 → ~89
  │
Phase 3 (매직 넘버)     ── 상수 추출        ── 1커밋 ── ~89 → ~50
  │
Phase 4 (API 함수 분리) ── 리팩토링         ── 모듈별 커밋
  │
Phase 5 (Web 컴포넌트)  ── 대형 리팩토링    ── 컴포넌트별 커밋
  │
Phase 6 (기타)          ── 잡다한 수정      ── 1커밋
```

### 현실적 목표

| 단계 | 목표 Warning | 비고 |
|------|-------------|------|
| Phase 1 완료 | ~135 | 설정 조정만 |
| Phase 2 완료 | ~89 | non-null 제거 |
| Phase 3 완료 | ~50 | 상수 추출 |
| Phase 4+5+6 | ~0 | 대형 리팩토링 (장기) |

Phase 1~3은 즉시 실행 가능. Phase 4~5는 기능 변경과 함께 점진적으로 진행 권장.
