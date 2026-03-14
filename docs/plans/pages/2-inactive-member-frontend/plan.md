# 비활동 회원 관리 프론트엔드 구현 계획

> PRD: `/docs/specs/prd/inactive-member.md`
> 구현 범위: Next.js 웹 대시보드(apps/web) 전용. 백엔드(API)는 별도 계획(`1-inactive-member-backend`)에서 처리.

---

## 목표

- 비활동 회원 대시보드 페이지 (`/dashboard/guild/[guildId]/inactive-member`) 신규 생성
- 비활동 회원 설정 페이지 (`/settings/guild/[guildId]/inactive-member`) 신규 생성
- API 클라이언트 레이어 (`apps/web/app/lib/inactive-member-api.ts`) 신규 생성
- 사이드바 두 곳에 신규 메뉴 항목 추가

---

## 생성 및 수정 파일 목록

### 신규 생성
```
apps/web/app/lib/inactive-member-api.ts
apps/web/app/dashboard/guild/[guildId]/inactive-member/
├── page.tsx
└── components/
    ├── StatsCards.tsx
    ├── ActivityPieChart.tsx
    ├── InactiveTrendChart.tsx
    ├── InactiveMemberTable.tsx
    └── ActionBar.tsx
apps/web/app/settings/guild/[guildId]/inactive-member/
└── page.tsx
```

### 수정
```
apps/web/app/components/DashboardSidebar.tsx
apps/web/app/components/SettingsSidebar.tsx
```

---

## 단계별 구현 계획

### Step 1: API 클라이언트 레이어 (`inactive-member-api.ts`)

**파일**: `apps/web/app/lib/inactive-member-api.ts`

**구현 방침**:
- 기존 `voice-dashboard-api.ts`, `monitoring-api.ts`와 동일한 구조로 작성
- 타입 정의 → 유틸 함수 → API 함수 순서 배치
- 모든 API 함수는 `async/await` + `res.ok` 체크 패턴 사용
- 저장/조치 함수는 에러 응답 body를 파싱해 `message` 필드가 있으면 사용하는 패턴 적용

**타입 정의**:

```typescript
// 등급 enum 상수 (백엔드 Grade enum 미러링)
export type InactiveMemberGrade =
  | 'FULLY_INACTIVE'
  | 'LOW_ACTIVE'
  | 'DECLINING';

// 조치 유형 enum
export type ActionType =
  | 'ACTION_DM'
  | 'ACTION_ROLE_ADD'
  | 'ACTION_ROLE_REMOVE';

// 목록 조회 아이템
export interface InactiveMemberItem {
  userId: string;
  nickName: string;
  grade: InactiveMemberGrade;
  totalMinutes: number;
  lastVoiceDate: string | null; // 'YYYY-MM-DD' 또는 null
  gradeChangedAt: string | null; // ISO 8601
  classifiedAt: string;          // ISO 8601
}

// 목록 조회 응답
export interface InactiveMemberListResponse {
  total: number;
  page: number;
  limit: number;
  items: InactiveMemberItem[];
}

// 목록 조회 쿼리 파라미터
export interface InactiveMemberListQuery {
  grade?: InactiveMemberGrade;
  periodDays?: 7 | 14 | 30;
  search?: string;
  sortBy?: 'lastVoiceDate' | 'totalMinutes';
  sortOrder?: 'ASC' | 'DESC';
  page?: number;
  limit?: number;
}

// 추이 데이터 포인트
export interface InactiveTrendPoint {
  date: string;            // 'YYYY-MM-DD'
  fullyInactive: number;
  lowActive: number;
  declining: number;
}

// 통계 조회 응답
export interface InactiveMemberStats {
  totalMembers: number;
  activeCount: number;
  fullyInactiveCount: number;
  lowActiveCount: number;
  decliningCount: number;
  returnedCount: number;
  trend: InactiveTrendPoint[];
}

// 조치 실행 요청 DTO
export interface ExecuteActionDto {
  actionType: ActionType;
  targetUserIds: string[];
}

// 조치 실행 응답
export interface ExecuteActionResponse {
  actionType: ActionType;
  successCount: number;
  failCount: number;
  logId: number;
}

// 설정 타입 (InactiveMemberConfig 전체 필드)
export interface InactiveMemberConfig {
  id: number;
  guildId: string;
  periodDays: 7 | 14 | 30;
  lowActiveThresholdMin: number;
  decliningPercent: number;
  autoActionEnabled: boolean;
  autoRoleAdd: boolean;
  autoDm: boolean;
  inactiveRoleId: string | null;
  removeRoleId: string | null;
  excludedRoleIds: string[];
  dmEmbedTitle: string | null;
  dmEmbedBody: string | null;
  dmEmbedColor: string | null;
  createdAt: string;
  updatedAt: string;
}

// 설정 저장 DTO (id, guildId, createdAt 제외한 부분 업데이트)
export type InactiveMemberConfigSaveDto = Partial<Omit<
  InactiveMemberConfig,
  'id' | 'guildId' | 'createdAt' | 'updatedAt'
>>;
```

**유틸 함수**:

```typescript
// totalMinutes → "N시간 M분" 또는 "M분" 형식
export function formatMinutes(totalMinutes: number): string

// 'YYYY-MM-DD' → 'MM/DD' 형식 (차트 X축용)
export function formatTrendDate(isoDate: string): string

// 등급 → 한국어 레이블
export function gradeLabel(grade: InactiveMemberGrade): string
// 'FULLY_INACTIVE' → '완전 비활동', 'LOW_ACTIVE' → '저활동', 'DECLINING' → '활동 감소'

// 등급 → Badge 색상 클래스 (Tailwind)
export function gradeBadgeClass(grade: InactiveMemberGrade): string
// 'FULLY_INACTIVE' → 'bg-red-100 text-red-700'
// 'LOW_ACTIVE'     → 'bg-yellow-100 text-yellow-700'
// 'DECLINING'      → 'bg-orange-100 text-orange-700'
```

**API 함수**:

```typescript
// 비활동 회원 목록 조회
export async function fetchInactiveMembers(
  guildId: string,
  query?: InactiveMemberListQuery,
): Promise<InactiveMemberListResponse>
// → GET /api/guilds/:guildId/inactive-members?{querystring}

// 통계 조회
export async function fetchInactiveMemberStats(
  guildId: string,
): Promise<InactiveMemberStats>
// → GET /api/guilds/:guildId/inactive-members/stats

// 조치 실행
export async function executeInactiveMemberAction(
  guildId: string,
  dto: ExecuteActionDto,
): Promise<ExecuteActionResponse>
// → POST /api/guilds/:guildId/inactive-members/actions
// 실패 응답 body.message 파싱 패턴 적용

// 설정 조회
export async function fetchInactiveMemberConfig(
  guildId: string,
): Promise<InactiveMemberConfig>
// → GET /api/guilds/:guildId/inactive-member-config

// 설정 저장
export async function saveInactiveMemberConfig(
  guildId: string,
  dto: InactiveMemberConfigSaveDto,
): Promise<InactiveMemberConfig>
// → PUT /api/guilds/:guildId/inactive-member-config
// 실패 응답 body.message 파싱 패턴 적용
```

**충돌 여부**: 기존 lib 파일들(`voice-dashboard-api.ts`, `monitoring-api.ts` 등)과 파일명·함수명·타입명 중복 없음. 독립적으로 추가 가능.

---

### Step 2: 대시보드 서브 컴포넌트

#### Step 2-1: StatsCards

**파일**: `apps/web/app/dashboard/guild/[guildId]/inactive-member/components/StatsCards.tsx`

**Props 인터페이스**:
```typescript
interface Props {
  stats: InactiveMemberStats;
}
```

**구현 방침**:
- `'use client'` 선언
- 기존 `SummaryCards.tsx`와 동일한 구조로 작성 (`Card`, `CardHeader`, `CardTitle`, `CardContent` 사용)
- 4개 카드: 활동 멤버(`activeCount`), 완전 비활동(`fullyInactiveCount`), 저활동(`lowActiveCount`), 활동 감소(`decliningCount`)
- lucide-react 아이콘: `Users`, `UserX`, `TrendingDown`, `BarChart2`
- 카드 그리드: `grid grid-cols-2 gap-4 md:grid-cols-4`

**충돌 여부**: 기존 `SummaryCards.tsx`는 `voice/components/` 하위에 있으며, 이 파일은 `inactive-member/components/` 하위. 경로 분리로 충돌 없음.

---

#### Step 2-2: ActivityPieChart

**파일**: `apps/web/app/dashboard/guild/[guildId]/inactive-member/components/ActivityPieChart.tsx`

**Props 인터페이스**:
```typescript
interface Props {
  stats: InactiveMemberStats;
}
```

**구현 방침**:
- `'use client'` 선언
- `Card`, `CardHeader`, `CardTitle`, `CardContent` + `ChartContainer`, `ChartTooltip`, `ChartTooltipContent`, `ChartLegend`, `ChartLegendContent` 사용 (기존 `MicDistributionChart.tsx` 패턴 동일)
- Recharts `PieChart` + `Pie` + `Cell` 구성
- 데이터: `activeCount`, `fullyInactiveCount`, `lowActiveCount`, `decliningCount` 4개 슬라이스
- 색상: CSS 변수 `var(--chart-1)` ~ `var(--chart-4)` 사용 (기존 차트 색상과 일관성 유지)
- `chartConfig` 객체로 레이블과 색상 정의 → `satisfies ChartConfig` 타입 단언

**충돌 여부**: 없음.

---

#### Step 2-3: InactiveTrendChart

**파일**: `apps/web/app/dashboard/guild/[guildId]/inactive-member/components/InactiveTrendChart.tsx`

**Props 인터페이스**:
```typescript
interface Props {
  trend: InactiveTrendPoint[];
}
```

**구현 방침**:
- `'use client'` 선언
- 기존 `DailyTrendChart.tsx` 패턴과 동일한 구조
- Recharts `LineChart` + `Line` × 3 (등급별)
- X축: `formatTrendDate(point.date)`, Y축: 비활동 회원 수
- `chartConfig` 3개 키: `fullyInactive`, `lowActive`, `declining`
- 색상: `var(--chart-1)` ~ `var(--chart-3)`
- `ChartContainer` className: `h-[300px] w-full`

**충돌 여부**: 없음.

---

#### Step 2-4: InactiveMemberTable

**파일**: `apps/web/app/dashboard/guild/[guildId]/inactive-member/components/InactiveMemberTable.tsx`

**Props 인터페이스**:
```typescript
interface Props {
  items: InactiveMemberItem[];
  selectedIds: Set<string>;
  onToggleSelect: (userId: string) => void;
  onToggleAll: (checked: boolean) => void;
}
```

**구현 방침**:
- `'use client'` 선언
- `Card`, `CardContent` 감싸기
- `<table>` 기반 HTML 테이블 (기존 `UserRankingTable.tsx` 패턴 참고)
- 헤더: 전체선택 체크박스, 닉네임, 등급, 마지막 접속일, 접속 시간, 등급 변경일
- 등급 셀: `gradeLabel()` + `gradeBadgeClass()`로 인라인 뱃지 렌더링 (Badge 컴포넌트 대신 `<span>` + Tailwind 클래스 직접 적용 — Badge 컴포넌트는 `base-ui` 기반이며 `variant` 명세가 색상 커스텀에 불편함)
- `lastVoiceDate`: null이면 '없음'
- `gradeChangedAt`: ISO 8601 → `YYYY-MM-DD` 포맷
- `totalMinutes`: `formatMinutes()` 유틸 사용
- 전체선택 체크박스: `items.every(item => selectedIds.has(item.userId))`로 checked 상태 계산

**충돌 여부**: 없음.

---

#### Step 2-5: ActionBar

**파일**: `apps/web/app/dashboard/guild/[guildId]/inactive-member/components/ActionBar.tsx`

**Props 인터페이스**:
```typescript
interface Props {
  selectedCount: number;
  isActing: boolean;
  actionResult: { successCount: number; failCount: number } | null;
  actionError: string | null;
  onAction: (actionType: ActionType) => void;
}
```

**구현 방침**:
- `'use client'` 선언
- `div` + Tailwind 카드 스타일 (`rounded-lg border bg-card p-3`)
- 좌측: `{selectedCount}명 선택됨` 텍스트
- 우측: 버튼 3개 (DM 전송, 역할 부여, 역할 제거)
- 버튼 disabled 조건: `selectedCount === 0 || isActing`
- `actionResult` 표시: 성공/실패 수 인라인 텍스트 (3초 후 소멸은 page.tsx에서 관리)
- `actionError` 표시: 에러 메시지 인라인 텍스트
- 버튼 내 아이콘: `MessageSquare` (DM), `UserPlus` (역할 부여), `UserMinus` (역할 제거) — lucide-react

**충돌 여부**: 없음.

---

### Step 3: 대시보드 페이지

**파일**: `apps/web/app/dashboard/guild/[guildId]/inactive-member/page.tsx`

**구현 방침**:
- `'use client'` 선언
- `useParams()`로 `guildId` 추출 (`params.guildId as string`)
- `useRef(mountedRef)` 패턴으로 언마운트 후 setState 방지 (기존 `monitoring/page.tsx` 패턴)
- `useCallback` + `useEffect`로 초기 데이터 로드

**상태 목록**:
```typescript
const [stats, setStats] = useState<InactiveMemberStats | null>(null);
const [items, setItems] = useState<InactiveMemberItem[]>([]);
const [total, setTotal] = useState(0);
const [page, setPage] = useState(1);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);

// 필터 상태
const [gradeFilter, setGradeFilter] = useState<InactiveMemberGrade | ''>('');
const [sortBy, setSortBy] = useState<'lastVoiceDate' | 'totalMinutes'>('lastVoiceDate');
const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('ASC');
const [searchInput, setSearchInput] = useState('');      // 입력 즉시 반영
const [searchQuery, setSearchQuery] = useState('');      // debounce 300ms 반영

// 선택 상태
const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

// 조치 상태
const [isActing, setIsActing] = useState(false);
const [actionResult, setActionResult] = useState<{
  successCount: number; failCount: number;
} | null>(null);
const [actionError, setActionError] = useState<string | null>(null);
```

**데이터 로딩 흐름**:
1. `loadStats()` → `fetchInactiveMemberStats(guildId)` → `setStats()`
2. `loadItems()` → `fetchInactiveMembers(guildId, { grade, search, sortBy, sortOrder, page, limit: 20 })` → `setItems()`, `setTotal()`
3. 초기 마운트: `useEffect`에서 `loadStats()` + `loadItems()` 병렬 호출
4. 필터/정렬/검색/페이지 변경 시: `loadItems()` 재호출 (page=1 리셋 포함)

**debounce 구현**:
```typescript
// searchInput 변경 시 300ms debounce → searchQuery 갱신
useEffect(() => {
  const timer = setTimeout(() => {
    setSearchQuery(searchInput);
    setPage(1);
  }, 300);
  return () => clearTimeout(timer);
}, [searchInput]);
```

**조치 핸들러**:
```typescript
const handleAction = useCallback(async (actionType: ActionType) => {
  if (selectedIds.size === 0 || isActing) return;
  setIsActing(true);
  setActionResult(null);
  setActionError(null);
  try {
    const result = await executeInactiveMemberAction(guildId, {
      actionType,
      targetUserIds: Array.from(selectedIds),
    });
    setActionResult({ successCount: result.successCount, failCount: result.failCount });
    setTimeout(() => setActionResult(null), 3000);
  } catch (err) {
    setActionError(err instanceof Error ? err.message : '조치 실행에 실패했습니다.');
  } finally {
    setIsActing(false);
  }
}, [guildId, selectedIds, isActing]);
```

**선택 핸들러**:
```typescript
const handleToggleSelect = (userId: string) => {
  setSelectedIds((prev) => {
    const next = new Set(prev);
    if (next.has(userId)) {
      next.delete(userId);
    } else {
      next.add(userId);
    }
    return next;
  });
};

const handleToggleAll = (checked: boolean) => {
  if (checked) {
    setSelectedIds(new Set(items.map((item) => item.userId)));
  } else {
    setSelectedIds(new Set());
  }
};
```

**페이지네이션**:
- 한 페이지당 20명 (`LIMIT = 20` 상수)
- `totalPages = Math.ceil(total / LIMIT)`
- 이전/다음 버튼 + `{page} / {totalPages}` 텍스트

**레이아웃 구조**:
```
<div className="space-y-6 p-6">
  <h1>비활동 회원 관리</h1>

  {loading → 스피너}
  {error → 에러 배너}
  {!loading && stats && (
    // 상단: StatsCards (4개 카드)
    <StatsCards stats={stats} />

    // 중간: ActivityPieChart + InactiveTrendChart (2열 그리드)
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-1"><ActivityPieChart stats={stats} /></div>
      <div className="lg:col-span-2"><InactiveTrendChart trend={stats.trend} /></div>
    </div>

    // 필터바
    <div className="flex flex-wrap gap-3 items-center">
      {등급 Select}
      {닉네임 Input (searchInput 바인딩)}
      {정렬기준 Select}
      {정렬방향 Select}
    </div>

    // ActionBar
    <ActionBar
      selectedCount={selectedIds.size}
      isActing={isActing}
      actionResult={actionResult}
      actionError={actionError}
      onAction={handleAction}
    />

    // 테이블
    <InactiveMemberTable
      items={items}
      selectedIds={selectedIds}
      onToggleSelect={handleToggleSelect}
      onToggleAll={handleToggleAll}
    />

    // 페이지네이션
    <div className="flex items-center justify-between">
      <span>{page} / {totalPages} 페이지</span>
      <div className="flex gap-2">
        <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>이전</button>
        <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>다음</button>
      </div>
    </div>
  )}
</div>
```

**필터바 UI 컴포넌트**:
- 등급 필터: `<select>` 네이티브 또는 `Select` / `SelectTrigger` / `SelectContent` / `SelectItem` (기존 `voice/page.tsx` 패턴)
- 검색 Input: 네이티브 `<input type="text" />`
- 정렬 기준/방향: `<select>` 네이티브

> voice/page.tsx는 `Select` shadcn 컴포넌트를 사용하고, 설정 페이지들은 네이티브 `<select>`를 사용한다. 대시보드 페이지이므로 `Select` shadcn 컴포넌트를 일관되게 사용한다.

**충돌 여부**: 기존 대시보드 레이아웃(`layout.tsx`)에 `DashboardSidebar`가 이미 주입되어 있으므로, page.tsx는 메인 콘텐츠 영역만 담당. 경로 충돌 없음.

---

### Step 4: 설정 페이지

**파일**: `apps/web/app/settings/guild/[guildId]/inactive-member/page.tsx`

**구현 방침**:
- `'use client'` 선언
- `useSettings()` 컨텍스트에서 `selectedGuildId` 획득 (기존 설정 페이지 패턴과 동일)
- 데이터 로드: `useEffect`에서 `Promise.all([fetchInactiveMemberConfig, fetchGuildRoles])` 병렬 처리
- 폼 상태는 `useState`로 단일 객체 관리
- 저장: 섹션별 개별 저장 (각 섹션마다 저장 버튼 + 로딩/성공/실패 상태)
- 성공 메시지 3초 타임아웃: `setTimeout(() => setSaveSuccess(false), 3000)`

**상태 목록**:
```typescript
// 설정 폼 상태
const [form, setForm] = useState<InactiveMemberConfigSaveDto>({
  periodDays: 30,
  lowActiveThresholdMin: 30,
  decliningPercent: 50,
  autoActionEnabled: false,
  autoRoleAdd: false,
  autoDm: false,
  inactiveRoleId: null,
  removeRoleId: null,
  excludedRoleIds: [],
  dmEmbedTitle: null,
  dmEmbedBody: null,
  dmEmbedColor: '#5865F2',
});

// 역할 목록 (Discord API)
const [roles, setRoles] = useState<DiscordRole[]>([]);

// 제외 역할 멀티셀렉트 드롭다운 열림 여부
const [isExcludeDropdownOpen, setIsExcludeDropdownOpen] = useState(false);

// 로딩/저장 상태
const [isLoading, setIsLoading] = useState(false);
const [isSaving, setIsSaving] = useState(false);
const [saveSuccess, setSaveSuccess] = useState(false);
const [saveError, setSaveError] = useState<string | null>(null);
```

**폼 헬퍼**:
```typescript
// 단일 필드 업데이트 헬퍼
const updateForm = <K extends keyof InactiveMemberConfigSaveDto>(
  key: K,
  value: InactiveMemberConfigSaveDto[K],
) => {
  setForm((prev) => ({ ...prev, [key]: value }));
};
```

**저장 핸들러**:
```typescript
const handleSave = async () => {
  if (!selectedGuildId || isSaving) return;
  setIsSaving(true);
  setSaveError(null);
  setSaveSuccess(false);
  try {
    await saveInactiveMemberConfig(selectedGuildId, form);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  } catch (err) {
    setSaveError(err instanceof Error ? err.message : '저장에 실패했습니다.');
  } finally {
    setIsSaving(false);
  }
};
```

**역할 새로고침**:
```typescript
const refreshRoles = async () => {
  if (!selectedGuildId || isRefreshing) return;
  setIsRefreshing(true);
  try {
    const freshRoles = await fetchGuildRoles(selectedGuildId, true).catch(
      (): DiscordRole[] => [],
    );
    setRoles(freshRoles);
  } finally {
    setIsRefreshing(false);
  }
};
```

**레이아웃 구조** (섹션 순서):

```
<div className="max-w-3xl">
  <div className="flex items-center justify-between mb-6">
    <div className="flex items-center space-x-3">
      <UserX icon />
      <h1>비활동 회원 설정</h1>
    </div>
    <button type="button" onClick={refreshRoles}>역할 새로고침</button>
  </div>

  {isLoading → 스피너}
  {!isLoading && (
    <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-8">

      {/* 섹션 1: 비활동 판정 기준 */}
      <div>
        <h2>비활동 판정 기준</h2>
        <div className="space-y-4">
          {/* 판단 기간 — 라디오 버튼 3개 (7일/14일/30일) */}
          <div>
            <label>판단 기간</label>
            <div className="flex gap-4">
              {[7, 14, 30].map(day => (
                <label key={day}>
                  <input
                    type="radio"
                    name="periodDays"
                    value={day}
                    checked={form.periodDays === day}
                    onChange={() => updateForm('periodDays', day as 7 | 14 | 30)}
                  />
                  {day}일
                </label>
              ))}
            </div>
          </div>

          {/* 저활동 임계값 — 숫자 입력 */}
          <div>
            <label>저활동 임계값 (분)</label>
            <input type="number" min={0} value={form.lowActiveThresholdMin ?? 30}
              onChange={e => updateForm('lowActiveThresholdMin', Number(e.target.value))} />
          </div>

          {/* 활동 감소 비율 — 숫자 입력 */}
          <div>
            <label>활동 감소 판정 비율 (%)</label>
            <input type="number" min={0} max={100} value={form.decliningPercent ?? 50}
              onChange={e => updateForm('decliningPercent', Number(e.target.value))} />
          </div>
        </div>
      </div>

      <hr className="border-gray-100" />

      {/* 섹션 2: 자동 조치 설정 */}
      <div>
        <h2>자동 조치 설정</h2>
        <div className="space-y-4">
          {/* 토글 3개 (inline-flex 스타일, sticky-message 토글 패턴 동일) */}
          {/* autoActionEnabled, autoRoleAdd, autoDm */}
        </div>
      </div>

      <hr className="border-gray-100" />

      {/* 섹션 3: 역할 설정 */}
      <div>
        <h2>역할 설정</h2>
        <div className="space-y-4">
          {/* 비활동 역할 선택 — <select> 드롭다운 */}
          <div>
            <label>비활동 역할 (부여할 역할)</label>
            <select value={form.inactiveRoleId ?? ''} onChange={...}>
              <option value="">선택 안함</option>
              {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          {/* 제거할 역할 선택 — <select> 드롭다운 */}
        </div>
      </div>

      <hr className="border-gray-100" />

      {/* 섹션 4: 제외 역할 */}
      <div>
        <h2>제외 역할</h2>
        {/* 멀티셀렉트 드롭다운 — voice/page.tsx 패턴과 동일 구조 */}
        {/* 선택된 역할 태그 목록 + 드롭다운 */}
      </div>

      <hr className="border-gray-100" />

      {/* 섹션 5: DM 템플릿 */}
      <div>
        <h2>DM 템플릿</h2>
        <div className="space-y-4">
          {/* 제목 Input */}
          <div>
            <label>Embed 제목</label>
            <input type="text" value={form.dmEmbedTitle ?? ''}
              onChange={e => updateForm('dmEmbedTitle', e.target.value || null)} />
          </div>
          {/* 본문 Textarea */}
          <div>
            <label>Embed 본문</label>
            <p className="text-xs text-gray-500">
              사용 가능한 변수: {'{nickName}'}, {'{serverName}'}, {'{periodDays}'}, {'{totalMinutes}'}
            </p>
            <textarea rows={4} value={form.dmEmbedBody ?? ''}
              onChange={e => updateForm('dmEmbedBody', e.target.value || null)} />
          </div>
          {/* 색상 피커 — sticky-message/page.tsx 패턴과 동일 (color input + text input 조합) */}
          <div>
            <label>Embed 색상</label>
            <div className="flex items-center space-x-3">
              <input type="color" value={form.dmEmbedColor ?? '#5865F2'}
                onChange={e => updateForm('dmEmbedColor', e.target.value)} />
              <input type="text" value={form.dmEmbedColor ?? '#5865F2'}
                onChange={e => {
                  if (/^#[0-9A-Fa-f]{0,6}$/.test(e.target.value))
                    updateForm('dmEmbedColor', e.target.value);
                }} maxLength={7} />
            </div>
          </div>
          {/* Embed 미리보기 — sticky-message/page.tsx 패턴과 동일 */}
          <div>
            <p>미리보기</p>
            <div className="bg-[#2B2D31] rounded-lg p-4">
              <div style={{ borderLeft: `4px solid ${form.dmEmbedColor ?? '#5865F2'}` }}
                className="bg-[#313338] rounded-md overflow-hidden p-4">
                <p className="text-white font-semibold text-sm mb-1">
                  {form.dmEmbedTitle || '(제목 없음)'}
                </p>
                <p className="text-gray-300 text-xs whitespace-pre-wrap">
                  {/* 더미 데이터로 변수 치환 미리보기 */}
                  {(form.dmEmbedBody ?? '(본문 없음)')
                    .replace('{nickName}', '홍길동')
                    .replace('{serverName}', '테스트 서버')
                    .replace('{periodDays}', String(form.periodDays ?? 30))
                    .replace('{totalMinutes}', '0')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 저장 피드백 + 저장 버튼 */}
      <div className="flex items-center justify-between gap-4 pt-4 border-t border-gray-100">
        <div>
          {saveSuccess && <p className="text-sm text-green-600 font-medium">저장되었습니다.</p>}
          {saveError && <p className="text-sm text-red-600 font-medium">{saveError}</p>}
        </div>
        <button type="button" onClick={handleSave} disabled={isSaving}>
          {isSaving ? '저장 중...' : '저장'}
        </button>
      </div>
    </section>
  )}
</div>
```

**충돌 여부**: `useSettings()` 컨텍스트는 `apps/web/app/settings/SettingsContext.tsx`에 정의되어 있으며 기존 설정 페이지 모두 사용 중. 동일 방식으로 임포트하면 충돌 없음. `fetchGuildRoles`는 기존 `discord-api.ts`에 이미 정의되어 있으므로 재사용 가능.

---

### Step 5: 사이드바 메뉴 추가

#### Step 5-1: DashboardSidebar

**파일**: `apps/web/app/components/DashboardSidebar.tsx`

**변경 내용**:
- import 라인에 `UserX` 추가: `import { Activity, ArrowLeftRight, Mic, Search, Settings, UserX } from "lucide-react";`
- `menuItems` 배열에 항목 추가:
  ```typescript
  {
    href: `/dashboard/guild/${selectedGuildId}/inactive-member`,
    label: "비활동 회원",
    icon: UserX,
  },
  ```
- 삽입 위치: `모니터링` 항목 앞 (voice → 비활동 회원 → user → monitoring 순서) 또는 기존 항목 뒤에 추가. 기획서에 순서 명시가 없으므로 `모니터링` 항목 바로 앞에 삽입.

**충돌 여부**: `UserX`는 lucide-react에 존재하는 아이콘. 기존 `menuItems` 배열에 항목만 추가하므로 기존 메뉴 동작에 영향 없음.

#### Step 5-2: SettingsSidebar

**파일**: `apps/web/app/components/SettingsSidebar.tsx`

**변경 내용**:
- import 라인에 `UserX` 추가: 기존 `{ ArrowLeftRight, BarChart3, Mic, Pin, Radio, Settings, Tag, Users, UserX }`
- `menuItems` 배열에 항목 추가:
  ```typescript
  {
    href: `/settings/guild/${selectedGuildId}/inactive-member`,
    label: "비활동 회원 설정",
    icon: UserX,
  },
  ```
- 삽입 위치: `음성 설정` 항목 뒤에 추가.

**충돌 여부**: 동일하게 배열 추가만이므로 충돌 없음.

---

## 구현 시 주의사항

### 1. API URL 경로

PRD와 작업 지시의 엔드포인트 경로를 정확히 확인해야 한다.

| 기능 | PRD 명시 경로 | 작업 지시 경로 |
|------|--------------|---------------|
| 목록 조회 | `/api/guilds/:guildId/inactive-members` | `/api/guilds/:guildId/inactive-members` |
| 통계 조회 | `/api/guilds/:guildId/inactive-members/stats` | `/api/guilds/:guildId/inactive-members/stats` |
| 조치 실행 | `/api/guilds/:guildId/inactive-members/actions` | `/api/guilds/:guildId/inactive-members/actions` |
| 이력 조회 | `/api/guilds/:guildId/inactive-members/action-logs` | `/api/guilds/:guildId/inactive-members/action-logs` |
| 설정 조회 | `/api/guilds/:guildId/inactive-member-config` | `/api/guilds/:guildId/inactive-members/config` |
| 설정 저장 | `/api/guilds/:guildId/inactive-member-config` | `/api/guilds/:guildId/inactive-members/config` |

**설정 엔드포인트 경로가 불일치한다**: PRD는 `/inactive-member-config`(하이픈 구분, 복수형 아님), 작업 지시는 `/inactive-members/config`(복수형 하위 경로). 백엔드 구현 계획(`1-inactive-member-backend`)이 확정되기 전까지, **PRD 기준인 `/api/guilds/:guildId/inactive-member-config`** 를 사용하고, 백엔드 확정 후 동기화한다.

### 2. 타입 안전성

- `grade` 필드는 `InactiveMemberGrade | null`이 될 수 있다 (PRD: NULL이면 활동 상태). 그러나 비활동 회원 목록 API는 비활동 등급을 가진 회원만 반환하므로, 응답 `items`의 `grade`는 항상 non-null이다. API 타입은 `InactiveMemberGrade`(non-null)로 정의하고, null 케이스는 API 레이어에서 필터링된다고 가정한다.
- `periodDays`: 허용값이 `7 | 14 | 30`으로 제한. 타입에서 union literal 사용.
- `as` 타입 단언 사용 시 — `params.guildId as string`: Next.js `useParams()`는 `string | string[]`를 반환하므로 단언이 필요하며, `[guildId]` 동적 경로 세그먼트는 항상 `string`이다.

### 3. debounce 구현

`useEffect` + `clearTimeout` 패턴으로 외부 debounce 라이브러리 없이 구현한다. 기존 코드베이스에 debounce 유틸이 없으므로 인라인 구현.

### 4. 제외 역할 멀티셀렉트

`voice/page.tsx`의 채널 멀티셀렉트 드롭다운 패턴(`useRef(dropdownRef)` + `document.addEventListener('mousedown', handleClickOutside)`)을 역할 선택에 그대로 재사용한다. 별도 컴포넌트로 추출하지 않고 설정 페이지 내 인라인 구현한다 (설정 페이지 파일이 1개이며, 재사용 수요가 현재로서는 없음).

### 5. 차트 라이브러리

기존 코드베이스에 Recharts + shadcn/ui `ChartContainer` 래퍼 패턴이 확립되어 있다. `ActivityPieChart`와 `InactiveTrendChart` 모두 동일 패턴을 따른다. 기존 `voice/components/MicDistributionChart.tsx`를 참고해 PieChart를, `DailyTrendChart.tsx`를 참고해 LineChart를 구현한다.

### 6. 선택 상태 초기화

필터/정렬/검색 변경 시 `selectedIds`를 초기화하지 않는다. 사용자가 필터를 바꿔도 이미 선택된 회원을 유지하는 편이 UX상 자연스럽다. 단, 페이지 변경 시에도 선택 상태를 유지한다 (오프셋 기반 페이지네이션에서 다른 페이지의 항목도 선택 가능하게 하기 위함).

### 7. 기존 코드와의 충돌 검토

| 수정 대상 | 수정 방법 | 충돌 위험 |
|-----------|---------|---------|
| `DashboardSidebar.tsx` | `menuItems` 배열에 항목 추가 + icon import 추가 | 없음 |
| `SettingsSidebar.tsx` | `menuItems` 배열에 항목 추가 + icon import 추가 | 없음 |
| 신규 파일들 | 신규 경로에 생성 | 없음 |

---

## 구현 순서 권장

1. `inactive-member-api.ts` (의존성 기반)
2. `StatsCards.tsx`, `ActivityPieChart.tsx`, `InactiveTrendChart.tsx` (독립적)
3. `InactiveMemberTable.tsx`, `ActionBar.tsx` (독립적)
4. `dashboard/.../page.tsx` (컴포넌트 조립)
5. `settings/.../page.tsx` (독립적)
6. `DashboardSidebar.tsx`, `SettingsSidebar.tsx` (마지막에 메뉴 추가)
