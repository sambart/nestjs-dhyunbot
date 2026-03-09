# F-WEB-007 유저 상세 페이지 프론트엔드 구현 계획

## 개요

음성 대시보드에서 특정 유저를 선택하거나 검색창으로 직접 접근했을 때 보여주는 유저별 음성 활동 상세 페이지를 구현한다.

- 경로: `/dashboard/guild/{guildId}/user/{userId}`
- 관련 PRD: F-WEB-007 (web.md), F-VOICE-018 ~ F-VOICE-020 (voice.md)
- 의존 백엔드: J-user-detail-backend (API 3종)

---

## 기존 코드베이스 파악

### Next.js API 프록시

`apps/web/app/api/guilds/[...path]/route.ts` — 와일드카드 catch-all 라우트로 `/api/guilds/**` 경로를 백엔드로 프록시한다. 신규 API 엔드포인트(`members/search`, `voice/daily?userId=`, `voice/history/:userId`)는 별도 라우트 파일 없이 기존 프록시가 자동으로 처리한다.

### 기존 공유 자원 (재사용 대상)

| 파일 | 재사용할 항목 |
|------|--------------|
| `apps/web/app/lib/voice-dashboard-api.ts` | `VoiceDailyRecord`, `formatDuration()`, `formatDate()`, `computeChannelStats()` |
| `apps/web/app/dashboard/guild/[guildId]/voice/components/MicDistributionChart.tsx` | 재사용 불가 (props 타입이 `VoiceSummary`에 종속) — 별도 컴포넌트 신규 작성 |
| `apps/web/app/dashboard/guild/[guildId]/voice/components/DailyTrendChart.tsx` | 참고용 — 기존은 AreaChart, 유저 상세는 BarChart로 구현 |

### 차트 라이브러리

기존 코드베이스는 `recharts` + shadcn/ui `ChartContainer`, `ChartTooltip`, `ChartTooltipContent`, `ChartLegend`, `ChartLegendContent`를 사용한다. 동일하게 사용한다.

### UI 컴포넌트

기존 대시보드가 사용하는 shadcn/ui: `Card`, `CardContent`, `CardHeader`, `CardTitle`, `Badge`, select 관련 컴포넌트 (`Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue`).

### UserRankingTable 수정 대상

`apps/web/app/dashboard/guild/[guildId]/voice/components/UserRankingTable.tsx` — 현재 행 클릭 이벤트 없음. `guildId`를 props로 받아 행 클릭 시 라우팅을 추가해야 한다.

---

## 구현 단계

### 1단계: API 클라이언트 (`apps/web/app/lib/user-detail-api.ts`)

신규 파일로 생성한다. `VoiceDailyRecord`, `formatDuration`, `formatDate`는 `voice-dashboard-api.ts`에서 import하여 재사용하고, 이 파일에서 중복 정의하지 않는다.

#### 타입 정의

```typescript
// F-VOICE-019 응답 타입
export interface MemberSearchResult {
  userId: string;
  userName: string;
}

// F-VOICE-020 응답 아이템 타입
export interface VoiceHistoryItem {
  id: number;
  channelId: string;
  channelName: string;
  joinAt: string;       // ISO 8601
  leftAt: string | null; // null = 접속 중
  durationSec: number | null;
}

// F-VOICE-020 응답 페이지 타입
export interface VoiceHistoryPage {
  total: number;
  page: number;
  limit: number;
  items: VoiceHistoryItem[];
}
```

#### API 함수 3종

```typescript
// F-VOICE-019: 멤버 닉네임/ID 검색
export async function searchMembers(
  guildId: string,
  query: string,
): Promise<MemberSearchResult[]>

// F-VOICE-018: 유저별 음성 일별 통계 (userId 파라미터 추가)
export async function fetchUserVoiceDaily(
  guildId: string,
  userId: string,
  from: string,
  to: string,
): Promise<VoiceDailyRecord[]>

// F-VOICE-020: 유저 입퇴장 이력 페이지네이션
export async function fetchUserVoiceHistory(
  guildId: string,
  userId: string,
  params: { from?: string; to?: string; page?: number; limit?: number },
): Promise<VoiceHistoryPage>
```

**충돌 여부**: 신규 파일이므로 충돌 없음. `fetchVoiceDaily`와 `fetchUserVoiceDaily`는 다른 파일에 각각 존재하며 이름이 달라 혼동 없음.

---

### 2단계: 유저 상세 페이지 컴포넌트 파일 구조

```
apps/web/app/dashboard/guild/[guildId]/user/[userId]/
├── page.tsx                          # 메인 페이지 (신규)
└── components/
    ├── UserInfoSection.tsx           # 유저 기본 정보 (신규)
    ├── UserSummaryCards.tsx          # 음성 통계 요약 4카드 (신규)
    ├── UserDailyBarChart.tsx         # 일별 음성 바 차트 (신규)
    ├── UserChannelPieChart.tsx       # 채널별 사용 비율 도넛 차트 (신규)
    ├── UserMicPieChart.tsx           # 마이크 ON/OFF 도넛 차트 (신규)
    ├── UserHistoryTable.tsx          # 입퇴장 이력 테이블 + 페이지네이션 (신규)
    └── UserSearchDropdown.tsx        # 검색창 + 드롭다운 (신규)
```

---

### 3단계: 유틸리티 함수 (page.tsx 내 또는 별도 파일)

페이지 내에서 필요한 집계 함수는 `voice-dashboard-api.ts`의 `computeChannelStats()`를 재사용한다. 유저 상세에서만 필요한 집계는 `page.tsx`에 로컬 함수로 작성한다.

```typescript
// page.tsx 내 로컬 유틸
function getDateRange(period: '7d' | '14d' | '30d'): { from: string; to: string }
// → 기존 voice/page.tsx의 getDateRange와 동일 로직, 공용 lib으로 분리하지 않고 각 페이지에 로컬로 둔다
// (현재 공용 유틸 파일 없고, 단순 함수라 DRY 위반 최소)

function formatYmd(date: Date): string
// → 동일하게 로컬 복사

// 유저 일별 통계에서 요약 집계
function computeUserSummary(records: VoiceDailyRecord[]): {
  totalDurationSec: number;
  totalMicOnSec: number;
  totalMicOffSec: number;
  totalAloneSec: number;
}
// GLOBAL channelId 기준: micOnSec, micOffSec, aloneSec
// 채널별 레코드 기준: channelDurationSec 합계 (GLOBAL 제외)
```

---

### 4단계: 메인 페이지 (`page.tsx`) 상태 설계

```typescript
'use client';

type Period = '7d' | '14d' | '30d';

// State
const [period, setPeriod] = useState<Period>('7d');
const [dailyRecords, setDailyRecords] = useState<VoiceDailyRecord[]>([]);
const [loading, setLoading] = useState(true);
const [historyPage, setHistoryPage] = useState(1);
const [historyData, setHistoryData] = useState<VoiceHistoryPage | null>(null);
const [historyLoading, setHistoryLoading] = useState(true);
const [searchQuery, setSearchQuery] = useState('');
const [searchResults, setSearchResults] = useState<MemberSearchResult[]>([]);
const [searchOpen, setSearchOpen] = useState(false);
```

**데이터 로드 전략**:

- `period` 변경 시 → `fetchUserVoiceDaily` + `fetchUserVoiceHistory(page=1)` 동시 호출
- `historyPage` 변경 시 → `fetchUserVoiceHistory(page=historyPage)` 단독 호출
- `searchQuery` debounce 300ms → `searchMembers` 호출 (빈 문자열이면 호출 안 함)

**params 추출**:
```typescript
const params = useParams();
const guildId = params.guildId as string;
const userId = params.userId as string;
```

유저 기본 정보(닉네임, userId)는 별도 API 없이 `dailyRecords`의 첫 번째 GLOBAL 레코드에서 `userName`을 추출한다. PRD에서 아바타 이미지를 언급하지만 Discord CDN URL 구성에 별도 API가 없으므로, 아바타는 구현하지 않고 이니셜 아바타(텍스트 기반)로 대체한다.

---

### 5단계: 개별 컴포넌트 상세 설계

#### `UserInfoSection.tsx`

```typescript
interface Props {
  userName: string;
  userId: string;
}
```

- 원형 이니셜 아바타 (userName 첫 글자, 배경색 고정)
- 닉네임 (`userName`)
- 디스코드 ID (`userId`)

#### `UserSummaryCards.tsx`

```typescript
interface Props {
  totalDurationSec: number;
  totalMicOnSec: number;
  totalMicOffSec: number;
  totalAloneSec: number;
}
```

기존 `SummaryCards.tsx`와 동일한 카드 레이아웃 패턴으로 4개 카드 렌더링. Lucide 아이콘: `Clock`, `Mic`, `MicOff`, `UserX`.

#### `UserDailyBarChart.tsx`

```typescript
interface Props {
  data: VoiceDailyTrend[]; // voice-dashboard-api.ts의 타입 재사용
}
```

기존 `DailyTrendChart.tsx`를 참고하되 `BarChart`(수직 막대)로 변경. X축: `formatDate(date)`, Y축: 분 단위. `channelDurationMin`만 단일 Bar로 표시. recharts `Bar` + `BarChart` 사용.

```typescript
// chartConfig
const chartConfig = {
  channelDurationMin: {
    label: '체류 시간(분)',
    color: 'var(--chart-1)',
  },
} satisfies ChartConfig;
```

#### `UserChannelPieChart.tsx`

```typescript
interface Props {
  data: VoiceChannelStat[]; // voice-dashboard-api.ts의 타입 재사용
}
```

기존 `MicDistributionChart.tsx`와 동일한 `PieChart` + `Cell` + `innerRadius` 도넛 패턴. `computeChannelStats()`로 집계된 채널별 `totalDurationSec` 비율 시각화. 채널이 7개 초과면 상위 6개 + "기타"로 묶는다.

```typescript
const chartConfig = {
  // 채널 수에 따라 동적 생성: 채널명을 key로 사용
} satisfies ChartConfig;
```

chartConfig를 동적으로 생성하는 방식은 recharts 패턴에서 지원하므로, `data` prop으로부터 런타임에 색상을 `var(--chart-1)` ~ `var(--chart-6)` 순환 할당한다.

#### `UserMicPieChart.tsx`

```typescript
interface Props {
  micOnSec: number;
  micOffSec: number;
}
```

기존 `MicDistributionChart.tsx`에서 `aloneSec`을 제거하고 마이크 ON/OFF 2항목만 표시. `VoiceSummary` 전체를 받지 않고 필요한 값만 props로 받는다.

```typescript
const chartConfig = {
  micOn: { label: '마이크 ON', color: 'var(--chart-2)' },
  micOff: { label: '마이크 OFF', color: 'var(--chart-3)' },
} satisfies ChartConfig;
```

#### `UserHistoryTable.tsx`

```typescript
interface Props {
  data: VoiceHistoryPage | null;
  loading: boolean;
  currentPage: number;
  onPageChange: (page: number) => void;
}
```

테이블 컬럼: 채널명, 입장 시각, 퇴장 시각, 체류 시간.

- 입장/퇴장 시각: `new Date(joinAt).toLocaleString('ko-KR')` 포맷
- `leftAt === null`: "접속 중" 뱃지 표시
- `durationSec`: `formatDuration()` 재사용 (null이면 "-")
- 페이지네이션: 이전/다음 버튼 + 현재 페이지/전체 페이지 표시. 총 페이지 = `Math.ceil(total / limit)`

#### `UserSearchDropdown.tsx`

```typescript
interface Props {
  guildId: string;
  currentUserId: string;
}
```

- `<input>` 요소로 검색 입력 필드 구현 (shadcn/ui `Input` 컴포넌트 사용)
- `useEffect` 내 `setTimeout` + `clearTimeout` 패턴으로 debounce 300ms 구현
- 검색 결과 드롭다운: `position: absolute`로 input 하단에 오버레이 표시
- 드롭다운 항목 클릭: `useRouter().push(\`/dashboard/guild/${guildId}/user/${result.userId}\`)`
- `searchQuery`가 빈 문자열이면 API 호출하지 않고 드롭다운 닫음
- 외부 클릭 시 드롭다운 닫기: `useEffect` + `document.addEventListener('click', ...)` 패턴

---

### 6단계: `UserRankingTable.tsx` 수정

기존 파일: `apps/web/app/dashboard/guild/[guildId]/voice/components/UserRankingTable.tsx`

변경사항:
1. `Props` 인터페이스에 `guildId: string` 추가
2. 각 유저 행 `<div>`에 `onClick` 핸들러 추가 + cursor-pointer 스타일
3. `useRouter` import 추가

```typescript
// 변경 전
interface Props {
  data: VoiceUserStat[];
}

// 변경 후
interface Props {
  data: VoiceUserStat[];
  guildId: string;
}
```

```typescript
// 행 클릭 핸들러 추가
const router = useRouter();

// 각 행 div에 추가
onClick={() => router.push(`/dashboard/guild/${guildId}/user/${user.userId}`)}
className="grid grid-cols-6 gap-2 items-center text-sm py-1 cursor-pointer hover:bg-muted/50 rounded-sm transition-colors"
```

호출 측 (`voice/page.tsx`) 수정: `<UserRankingTable data={userStats} guildId={guildId} />`

---

### 7단계: 페이지 레이아웃 조합 (`page.tsx`)

```tsx
return (
  <div className="space-y-6 p-6">
    {/* 헤더: 유저 검색창 */}
    <div className="flex items-center justify-between">
      <h1 className="text-2xl font-bold">유저 음성 활동</h1>
      <UserSearchDropdown guildId={guildId} currentUserId={userId} />
    </div>

    {/* 유저 기본 정보 + 기간 선택 */}
    <div className="flex items-center justify-between">
      <UserInfoSection userName={userName} userId={userId} />
      {/* 기간 프리셋 버튼 3종 */}
      <div className="flex gap-2">
        {(['7d', '14d', '30d'] as Period[]).map((p) => (
          <button key={p} onClick={() => setPeriod(p)}
            className={period === p ? 'bg-primary text-primary-foreground ...' : '...'}>
            {p === '7d' ? '7일' : p === '14d' ? '14일' : '30일'}
          </button>
        ))}
      </div>
    </div>

    {loading ? (
      <LoadingState />
    ) : (
      <>
        {/* 요약 카드 */}
        <UserSummaryCards ... />

        {/* 일별 트렌드 + 마이크 분포 */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <UserDailyBarChart data={trends} />
          </div>
          <div>
            <UserMicPieChart micOnSec={summary.totalMicOnSec} micOffSec={summary.totalMicOffSec} />
          </div>
        </div>

        {/* 채널별 파이 차트 */}
        <UserChannelPieChart data={channelStats} />

        {/* 입퇴장 이력 테이블 */}
        <UserHistoryTable
          data={historyData}
          loading={historyLoading}
          currentPage={historyPage}
          onPageChange={setHistoryPage}
        />
      </>
    )}
  </div>
);
```

기간 프리셋 버튼은 `voice/page.tsx`의 `<Select>` 드롭다운 대신 인라인 토글 버튼 3개로 구현한다 (PRD 명세: "7일 / 14일 / 30일 선택 버튼"). 스타일은 shadcn/ui `Button` 컴포넌트의 `variant="outline"` / `variant="default"` 전환으로 구현한다.

---

## 기존 코드와의 충돌 검토

| 항목 | 충돌 여부 | 근거 |
|------|-----------|------|
| `user-detail-api.ts` 신규 생성 | 없음 | 신규 파일, 기존 파일과 이름 다름 |
| `fetchUserVoiceDaily` vs `fetchVoiceDaily` | 없음 | 다른 파일, 다른 이름, `userId` 파라미터 추가된 별개 함수 |
| Next.js API 프록시 | 없음 | 와일드카드 프록시가 `/api/guilds/**` 전체를 처리함. 신규 엔드포인트 자동 지원 |
| `UserRankingTable.tsx` 수정 | 없음 | props 추가(선택적으로 처리 불가 — 필수로 추가), 호출 측도 동시 수정 |
| 유저 상세 페이지 디렉토리 | 없음 | 신규 경로 `/user/[userId]/` — 기존 voice 라우트와 분리됨 |
| `computeChannelStats()` 재사용 | 없음 | 이미 export되어 있음, 전체 서버 기준이 아닌 단일 유저 레코드를 넣어도 동일하게 동작 |
| `VoiceDailyRecord` 타입 재사용 | 없음 | 이미 export됨, F-VOICE-018 응답 스키마가 F-VOICE-017과 동일 |

---

## 구현 순서 권고

1. `apps/web/app/lib/user-detail-api.ts` 작성
2. `UserRankingTable.tsx` 수정 + `voice/page.tsx` 호출부 수정
3. 유저 상세 페이지 디렉토리 생성 + 컴포넌트 순서대로 작성:
   - `UserInfoSection.tsx`
   - `UserSummaryCards.tsx`
   - `UserDailyBarChart.tsx`
   - `UserMicPieChart.tsx`
   - `UserChannelPieChart.tsx`
   - `UserHistoryTable.tsx`
   - `UserSearchDropdown.tsx`
4. `page.tsx` 작성 (모든 컴포넌트 조합)

---

## 파일별 변경 요약

| 파일 | 유형 | 설명 |
|------|------|------|
| `apps/web/app/lib/user-detail-api.ts` | 신규 | 타입 3종 + API 함수 3종 |
| `apps/web/app/dashboard/guild/[guildId]/user/[userId]/page.tsx` | 신규 | 메인 페이지 |
| `apps/web/app/dashboard/guild/[guildId]/user/[userId]/components/UserInfoSection.tsx` | 신규 | 유저 기본 정보 |
| `apps/web/app/dashboard/guild/[guildId]/user/[userId]/components/UserSummaryCards.tsx` | 신규 | 요약 카드 4개 |
| `apps/web/app/dashboard/guild/[guildId]/user/[userId]/components/UserDailyBarChart.tsx` | 신규 | 일별 바 차트 |
| `apps/web/app/dashboard/guild/[guildId]/user/[userId]/components/UserChannelPieChart.tsx` | 신규 | 채널 도넛 차트 |
| `apps/web/app/dashboard/guild/[guildId]/user/[userId]/components/UserMicPieChart.tsx` | 신규 | 마이크 ON/OFF 도넛 차트 |
| `apps/web/app/dashboard/guild/[guildId]/user/[userId]/components/UserHistoryTable.tsx` | 신규 | 입퇴장 이력 테이블 + 페이지네이션 |
| `apps/web/app/dashboard/guild/[guildId]/user/[userId]/components/UserSearchDropdown.tsx` | 신규 | 검색창 + 드롭다운 |
| `apps/web/app/dashboard/guild/[guildId]/voice/components/UserRankingTable.tsx` | 수정 | guildId props 추가 + 행 클릭 라우팅 |
| `apps/web/app/dashboard/guild/[guildId]/voice/page.tsx` | 수정 | UserRankingTable에 guildId prop 전달 |
