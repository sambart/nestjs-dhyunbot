# 신입미션 플레이횟수 카운팅 옵션 — 프론트엔드 구현 계획

## 개요

| 항목 | 내용 |
|------|------|
| 관련 PRD | F-WEB-NEWBIE-001 탭 2 미션 설정 (F-NEWBIE-002 플레이횟수 카운팅 옵션) |
| 관련 기능 | `NewbieConfig`에 `playCountMinDurationMin`, `playCountIntervalMin` 두 필드 추가 |
| 대상 서비스 | `apps/web/` (Next.js 프론트엔드) |

### 현재 구현 상태 분석

`apps/web/app/lib/newbie-api.ts`의 `NewbieConfig` 인터페이스에는 두 필드가 존재하지 않는다.

`apps/web/app/settings/guild/[guildId]/newbie/components/MissionTab.tsx`는 현재 아래 필드만 처리한다.
- `missionEnabled` (토글)
- `missionDurationDays` (숫자 입력)
- `missionTargetPlaytimeHours` (숫자 입력)
- `missionNotifyChannelId` (채널 선택 드롭다운)
- `MissionTemplateSection` 마운트 (별도 저장 흐름)

두 신규 필드 (`playCountMinDurationMin`, `playCountIntervalMin`)를 위한 UI가 없다.

`page.tsx`의 `DEFAULT_CONFIG`와 `handleSave`는 `NewbieConfig` 타입을 그대로 사용하므로, 타입에 필드를 추가하면 `DEFAULT_CONFIG`에도 초기값을 추가해야 한다.

---

## 수정 파일 목록

```
apps/web/app/lib/newbie-api.ts
  → NewbieConfig 인터페이스에 두 필드 추가

apps/web/app/settings/guild/[guildId]/newbie/page.tsx
  → DEFAULT_CONFIG에 두 필드 초기값 추가

apps/web/app/settings/guild/[guildId]/newbie/components/MissionTab.tsx
  → 두 필드 UI 추가 (숫자 입력 + 체크박스)
```

신규 생성 파일 없음.

---

## 1. `newbie-api.ts` 수정

### 1-1. `NewbieConfig` 인터페이스에 필드 추가

```typescript
// 미션
missionEnabled: boolean;
missionDurationDays: number | null;
missionTargetPlaytimeHours: number | null;
playCountMinDurationMin: number | null;   // 신규
playCountIntervalMin: number | null;       // 신규
missionNotifyChannelId: string | null;
```

- `playCountMinDurationMin`: 플레이횟수 카운팅 시 유효 세션으로 인정하는 최소 참여시간(분). NULL이면 비활성화.
- `playCountIntervalMin`: 플레이횟수 카운팅 시 동일 1회로 병합하는 세션 간격 기준(분). NULL이면 비활성화.
- 두 필드 모두 PRD 데이터 모델의 `playCountMinDurationMin`, `playCountIntervalMin` 컬럼과 1:1 대응.
- 기존 인터페이스의 필드 순서를 따라 `missionTargetPlaytimeHours` 바로 다음, `missionNotifyChannelId` 바로 앞에 삽입한다.

---

## 2. `page.tsx` 수정

### 2-1. `DEFAULT_CONFIG`에 초기값 추가

```typescript
const DEFAULT_CONFIG: NewbieConfig = {
  // 기존 필드 유지
  missionEnabled: false,
  missionDurationDays: null,
  missionTargetPlaytimeHours: null,
  playCountMinDurationMin: 30,    // 신규 — PRD 기본값 30
  playCountIntervalMin: 30,       // 신규 — PRD 기본값 30
  missionNotifyChannelId: null,
  // 나머지 기존 필드 유지
};
```

- PRD 명세에서 두 필드의 기본값은 30분이다. 초기 렌더링 시 사용자에게 기본값이 표시되도록 `DEFAULT_CONFIG`에 `30`으로 설정한다.
- `handleSave`는 `NewbieConfig` 전체를 전송하는 구조이므로 별도 수정 불필요. 두 필드가 타입에 추가되면 자동으로 포함된다.

---

## 3. `MissionTab.tsx` 수정

### 3-1. UI 추가 위치

PRD 탭 2 명세 순서에 따라 "목표 플레이타임" 입력 섹션 바로 다음, "알림 채널 선택" 섹션 바로 앞에 두 섹션을 삽입한다.

```
기능 활성화 토글
미션 기간 (일수) 입력
목표 플레이타임 (시간) 입력
─────────── [신규] ───────────
플레이횟수 최소 참여시간 입력 (숫자 + 체크박스)
플레이횟수 시간 간격 입력 (숫자 + 체크박스)
─────────── [기존] ───────────
알림 채널 선택
<hr />
MissionTemplateSection
```

### 3-2. 체크박스 + 숫자 입력 패턴

두 필드의 동작 규칙은 동일하다.
- 체크박스 OFF → 해당 필드를 `null`로 `onChange` 호출
- 체크박스 ON → 직전에 입력했던 숫자값(또는 기본값 30)으로 `onChange` 호출
- 숫자 입력 → `parseInt` 후 `NaN`이면 기본값 30 사용, 정상값이면 그대로 사용
- `min={1}`, `max={9999}` 제한 (PRD: 최솟값 1, 0 허용 안 함)
- 기능 비활성화(`!isEnabled`) 시 숫자 입력과 체크박스 모두 `disabled`

체크박스 체크 상태는 `config.playCountMinDurationMin !== null` (또는 `playCountIntervalMin !== null`)로 직접 파생한다. 별도 로컬 상태 없이 `config` 값만으로 결정한다.

체크박스 OFF 시 숫자 입력 필드를 빈 값으로 표시하지 않기 위해, 입력 필드의 `value`는 `config.playCountMinDurationMin ?? 30`으로 표시한다. 단, 체크박스 OFF 상태에서는 입력 필드가 `disabled` 처리되어 편집 불가하다.

### 3-3. `playCountMinDurationMin` 섹션 JSX 설계

```tsx
{/* 플레이횟수 최소 참여시간 */}
<div>
  <div className="flex items-center gap-2 mb-1">
    <input
      id="play-count-min-duration-enabled"
      type="checkbox"
      checked={config.playCountMinDurationMin !== null}
      onChange={(e) => {
        if (e.target.checked) {
          onChange({ playCountMinDurationMin: 30 });
        } else {
          onChange({ playCountMinDurationMin: null });
        }
      }}
      disabled={!isEnabled}
      className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 disabled:cursor-not-allowed"
    />
    <label
      htmlFor="play-count-min-duration-enabled"
      className="text-sm font-medium text-gray-700"
    >
      플레이횟수 최소 참여시간 (분)
    </label>
  </div>
  <input
    id="play-count-min-duration"
    type="number"
    min={1}
    max={9999}
    value={config.playCountMinDurationMin ?? 30}
    onChange={(e) => {
      const val = parseInt(e.target.value, 10);
      onChange({ playCountMinDurationMin: isNaN(val) || val < 1 ? 30 : val });
    }}
    disabled={!isEnabled || config.playCountMinDurationMin === null}
    className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed"
  />
  <p className="text-xs text-gray-400 mt-1">
    세션의 총 참여시간이 N분 이상인 세션만 유효한 1회로 인정합니다. 체크 해제 시 비활성화 (모든 세션 인정).
  </p>
</div>
```

### 3-4. `playCountIntervalMin` 섹션 JSX 설계

`playCountMinDurationMin` 섹션과 완전히 동일한 패턴이다. 필드명과 레이블, 안내 문구만 다르다.

```tsx
{/* 플레이횟수 시간 간격 */}
<div>
  <div className="flex items-center gap-2 mb-1">
    <input
      id="play-count-interval-enabled"
      type="checkbox"
      checked={config.playCountIntervalMin !== null}
      onChange={(e) => {
        if (e.target.checked) {
          onChange({ playCountIntervalMin: 30 });
        } else {
          onChange({ playCountIntervalMin: null });
        }
      }}
      disabled={!isEnabled}
      className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 disabled:cursor-not-allowed"
    />
    <label
      htmlFor="play-count-interval-enabled"
      className="text-sm font-medium text-gray-700"
    >
      플레이횟수 시간 간격 (분)
    </label>
  </div>
  <input
    id="play-count-interval"
    type="number"
    min={1}
    max={9999}
    value={config.playCountIntervalMin ?? 30}
    onChange={(e) => {
      const val = parseInt(e.target.value, 10);
      onChange({ playCountIntervalMin: isNaN(val) || val < 1 ? 30 : val });
    }}
    disabled={!isEnabled || config.playCountIntervalMin === null}
    className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed"
  />
  <p className="text-xs text-gray-400 mt-1">
    이전 유효 세션 시작 후 N분 이내에 재입장한 세션은 동일 1회로 병합합니다. 체크 해제 시 비활성화 (독립 카운트).
  </p>
</div>
```

### 3-5. props 타입 변경 없음

`MissionTabProps`는 `config: NewbieConfig`를 받는다. `NewbieConfig` 타입에 두 필드를 추가하는 것만으로 `MissionTab`이 새 필드에 접근할 수 있다. `MissionTabProps` 인터페이스 자체를 수정할 필요 없다.

---

## 4. 기존 코드베이스 충돌 검토

| 항목 | 충돌 여부 | 근거 및 처리 방법 |
|------|-----------|-------------------|
| `newbie-api.ts` 타입 추가 | 없음 | 기존 필드를 제거하지 않고 추가만 하므로 기존 코드가 깨지지 않는다 |
| `page.tsx` `DEFAULT_CONFIG` 수정 | **필요** | TypeScript 타입 체크 시 `NewbieConfig`에 필드 추가 후 `DEFAULT_CONFIG` 객체에 해당 필드가 없으면 컴파일 오류 발생. 반드시 동시에 수정해야 한다 |
| `handleSave` 로직 | 없음 | `saveNewbieConfig(selectedGuildId, config)` 형태로 전체 config 객체를 전송하므로 별도 수정 불필요 |
| `MissionTab.tsx` `MissionTabProps` | 없음 | `config: NewbieConfig` 타입을 통해 필드에 접근하므로 props 인터페이스 수정 불필요 |
| `MissionTemplateSection.tsx` | 없음 | `NewbieConfig` 필드를 참조하지 않음 |
| `WelcomeTab.tsx`, `MocoTab.tsx`, `RoleTab.tsx` | 없음 | `playCountMinDurationMin`, `playCountIntervalMin`를 사용하지 않음 |
| `MissionEmbedPreview.tsx` | 없음 | `MissionTemplate` 타입만 사용하며 `NewbieConfig`와 무관 |

---

## 5. 구현 순서

| 순서 | 파일 | 작업 |
|------|------|------|
| 1 | `apps/web/app/lib/newbie-api.ts` | `NewbieConfig` 인터페이스에 `playCountMinDurationMin`, `playCountIntervalMin` 추가 |
| 2 | `apps/web/app/settings/guild/[guildId]/newbie/page.tsx` | `DEFAULT_CONFIG`에 `playCountMinDurationMin: 30`, `playCountIntervalMin: 30` 추가 |
| 3 | `apps/web/app/settings/guild/[guildId]/newbie/components/MissionTab.tsx` | 두 필드 UI 섹션 추가 |

1번과 2번은 TypeScript 컴파일 오류 방지를 위해 하나의 커밋으로 묶어 처리한다.

---

## 6. UX 상세

### 6-1. 체크박스 초기 상태

- 서버에서 로드한 `config.playCountMinDurationMin`이 `null`이면 체크박스 OFF, 숫자 입력 disabled.
- `null`이 아닌 숫자값이면 체크박스 ON, 숫자 입력 활성화 + 해당 값 표시.
- 서버에 설정이 없어 `DEFAULT_CONFIG`를 사용하는 경우 두 필드 모두 `30`으로 초기화되므로 체크박스 ON 상태로 시작한다.

### 6-2. 체크박스 OFF → ON 전환 시 값 복원

체크박스를 OFF 했다가 다시 ON으로 전환하면 하드코딩된 기본값 `30`이 입력된다. PRD 기본값과 동일하며 사용자가 이전에 입력한 값을 별도로 보존하지 않는다. 별도 로컬 상태(이전 값 저장)가 필요한 경우 복잡도가 증가하므로 PRD 기본값 30으로 단순하게 처리한다.

### 6-3. 미션 기능 비활성화 연동

`!isEnabled` 시 기존 필드들과 동일하게 두 필드의 체크박스와 숫자 입력을 모두 `disabled` 처리한다.

### 6-4. 저장 흐름

두 필드는 기존 `NewbieConfig` 저장 흐름(하단 "저장" 버튼 → `POST /api/guilds/:guildId/newbie/config`)에 자연스럽게 포함된다. 별도 저장 버튼이나 핸들러 추가가 필요 없다.
