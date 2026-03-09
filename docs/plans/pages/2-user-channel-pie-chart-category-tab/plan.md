# UserChannelPieChart 카테고리별 탭 전환 구현 계획

## 개요

`UserChannelPieChart` 컴포넌트에 [채널별 | 카테고리별] 탭 전환 기능을 추가한다.
API 변경 없이 부모 페이지에서 이미 보유하고 있는 `VoiceDailyRecord[]` 데이터를
프론트엔드에서 집계하여 카테고리 단위 도넛차트를 표시한다.

---

## 현황 파악

### 데이터 흐름

```
page.tsx
  └── dailyRecords: VoiceDailyRecord[]   (fetchUserVoiceDaily 결과)
        ├── computeChannelStats(dailyRecords) → VoiceChannelStat[]
        │     └── props.data 로 UserChannelPieChart 전달 (현재)
        └── (신규) computeCategoryStats(dailyRecords) → VoiceCategoryStat[]
              └── props.dailyRecords 또는 별도 prop 으로 전달
```

### VoiceDailyRecord 필드 (카테고리 집계에 사용)

- `categoryId: string | null` — 집계 키. null이면 "미분류" 버킷
- `categoryName: string | null` — 표시 레이블. null이면 "미분류"
- `channelDurationSec: number` — 집계 값
- `channelId: string` — GLOBAL 레코드 필터링에 사용

### 현재 UserChannelPieChart Props

```ts
interface Props {
  data: VoiceChannelStat[];
}
```

### 탭 컴포넌트 API (`apps/web/components/ui/tabs.tsx`)

Base UI 기반. 사용 패턴:

```tsx
<Tabs defaultValue="channel">
  <TabsList>
    <TabsTrigger value="channel">채널별</TabsTrigger>
    <TabsTrigger value="category">카테고리별</TabsTrigger>
  </TabsList>
  <TabsContent value="channel">...</TabsContent>
  <TabsContent value="category">...</TabsContent>
</Tabs>
```

---

## 구현 단계

### 1단계: `VoiceCategoryStat` 타입 및 `computeCategoryStats` 함수 추가

**파일:** `apps/web/app/lib/voice-dashboard-api.ts`

#### 1-1. 타입 추가

기존 `VoiceChannelStat`과 동일한 구조로 카테고리 식별자를 가지는 타입을 추가한다.

```ts
/** 카테고리별 통계 */
export interface VoiceCategoryStat {
  categoryId: string;       // null 원본은 "__unclassified__" 로 정규화
  categoryName: string;     // null 원본은 "미분류" 로 정규화
  totalDurationSec: number;
}
```

#### 1-2. 집계 함수 추가

기존 `computeChannelStats`와 동일한 패턴으로 구현한다.

```ts
export function computeCategoryStats(
  records: VoiceDailyRecord[],
): VoiceCategoryStat[] {
  const channelRecords = records.filter((r) => r.channelId !== 'GLOBAL');
  const byCategory = new Map<string, VoiceCategoryStat>();

  for (const r of channelRecords) {
    const key = r.categoryId ?? '__unclassified__';
    const label = r.categoryName ?? '미분류';
    const existing = byCategory.get(key);
    if (existing) {
      existing.totalDurationSec += r.channelDurationSec;
    } else {
      byCategory.set(key, {
        categoryId: key,
        categoryName: label,
        totalDurationSec: r.channelDurationSec,
      });
    }
  }

  return Array.from(byCategory.values()).sort(
    (a, b) => b.totalDurationSec - a.totalDurationSec,
  );
}
```

**충돌 검토:** 기존 함수·타입과 이름이 겹치지 않는다. export 추가만으로 하위 호환성이 유지된다.

---

### 2단계: `UserChannelPieChart` Props 확장 및 탭 UI 구현

**파일:** `apps/web/app/dashboard/guild/[guildId]/user/[userId]/components/UserChannelPieChart.tsx`

#### 2-1. Props 수정

```ts
interface Props {
  channelStats: VoiceChannelStat[];
  categoryStats: VoiceCategoryStat[];
}
```

기존 `data` prop을 `channelStats`로 이름을 변경하고, `categoryStats`를 추가한다.

#### 2-2. 내부 헬퍼 함수 추출 (DRY)

채널별/카테고리별 차트 데이터 변환 로직이 동일하므로 공통 헬퍼를 추출한다.

```ts
function toChartData(
  items: Array<{ id: string; label: string; totalDurationSec: number }>,
): Array<{ name: string; label: string; value: number }> {
  if (items.length <= MAX_ITEMS) {
    return items.map((item) => ({
      name: item.id,
      label: item.label,
      value: Math.round(item.totalDurationSec / 60),
    }));
  }
  const top = items.slice(0, MAX_ITEMS);
  const restTotal = items
    .slice(MAX_ITEMS)
    .reduce((sum, item) => sum + item.totalDurationSec, 0);
  return [
    ...top.map((item) => ({
      name: item.id,
      label: item.label,
      value: Math.round(item.totalDurationSec / 60),
    })),
    { name: 'etc', label: '기타', value: Math.round(restTotal / 60) },
  ];
}
```

상수명 `MAX_CHANNELS` → `MAX_ITEMS`로 변경 (카테고리에도 공용).

#### 2-3. 탭 상태 관리

`"use client"` 지시어가 이미 있으므로 `useState` 추가만 필요하다.

```ts
const [tab, setTab] = useState<'channel' | 'category'>('channel');
```

단, Base UI `Tabs`는 controlled/uncontrolled 모두 지원한다. `defaultValue`를 사용하면 상태를 컴포넌트 내부에서 관리하므로 별도 `useState` 없이 uncontrolled로 구현해도 충분하다.
→ **uncontrolled 방식 채택** (간결함 우선, 외부에서 탭 상태를 알 필요 없음).

#### 2-4. JSX 구조

```tsx
<Card>
  <CardHeader className="flex flex-row items-center justify-between">
    <CardTitle>채널별 활동 비율</CardTitle>
    <Tabs defaultValue="channel">
      <TabsList>
        <TabsTrigger value="channel">채널별</TabsTrigger>
        <TabsTrigger value="category">카테고리별</TabsTrigger>
      </TabsList>
    </Tabs>
  </CardHeader>
  <CardContent>
    <Tabs defaultValue="channel">
      <TabsContent value="channel">
        <PieChartView chartData={channelChartData} />
      </TabsContent>
      <TabsContent value="category">
        <PieChartView chartData={categoryChartData} />
      </TabsContent>
    </Tabs>
  </CardContent>
</Card>
```

**문제:** `CardHeader`의 탭과 `CardContent`의 탭이 별개의 `<Tabs>` 인스턴스이면 연동되지 않는다.

**해결:** 하나의 `<Tabs>` 루트로 감싸되 `CardHeader`, `CardContent`를 그 안에 배치한다. 또는 `CardTitle`과 `TabsList`를 `CardHeader` 안에 함께 두고, 차트 컨텐츠만 `CardContent`에 두는 방식으로 `<Tabs>` 단일 루트 유지.

**최종 JSX 구조:**

```tsx
<Card>
  <Tabs defaultValue="channel">
    <CardHeader className="flex flex-row items-center justify-between pb-2">
      <CardTitle>채널별 활동 비율</CardTitle>
      <TabsList>
        <TabsTrigger value="channel">채널별</TabsTrigger>
        <TabsTrigger value="category">카테고리별</TabsTrigger>
      </TabsList>
    </CardHeader>
    <CardContent>
      <TabsContent value="channel">
        <ChartContainer ...>...</ChartContainer>
      </TabsContent>
      <TabsContent value="category">
        <ChartContainer ...>...</ChartContainer>
      </TabsContent>
    </CardContent>
  </Tabs>
</Card>
```

`<Tabs>`가 `<Card>` 내부, `<CardHeader>` 바깥에 위치하므로 단일 상태 공유가 가능하다.

#### 2-5. 차트 렌더 중복 제거

채널/카테고리 두 탭 모두 동일한 `PieChart` 구조를 사용하므로, 내부 헬퍼 컴포넌트(`PieChartPanel`)를 추출하여 중복을 제거한다.

```tsx
function PieChartPanel({
  chartData,
}: {
  chartData: Array<{ name: string; label: string; value: number }>;
}) {
  const chartConfig = chartData.reduce<ChartConfig>((acc, item, index) => {
    acc[item.name] = {
      label: item.label,
      color: CHART_COLORS[index % CHART_COLORS.length],
    };
    return acc;
  }, {});
  const colors = chartData.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]);

  return (
    <ChartContainer config={chartConfig} className="h-[300px] w-full">
      <PieChart>
        <ChartTooltip content={<ChartTooltipContent nameKey="label" />} />
        <ChartLegend content={<ChartLegendContent nameKey="name" />} />
        <Pie
          data={chartData}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={2}
        >
          {chartData.map((_, index) => (
            <Cell key={index} fill={colors[index]} />
          ))}
        </Pie>
      </PieChart>
    </ChartContainer>
  );
}
```

---

### 3단계: `page.tsx`에서 props 전달 수정

**파일:** `apps/web/app/dashboard/guild/[guildId]/user/[userId]/page.tsx`

#### 3-1. import 추가

```ts
import {
  computeChannelStats,
  computeCategoryStats,  // 신규 추가
  computeDailyTrends,
  type VoiceChannelStat,
  type VoiceCategoryStat, // 신규 추가
  type VoiceDailyRecord,
  type VoiceDailyTrend,
} from "@/app/lib/voice-dashboard-api";
```

#### 3-2. 집계 호출 추가

```ts
const channelStats: VoiceChannelStat[] = computeChannelStats(dailyRecords);
const categoryStats: VoiceCategoryStat[] = computeCategoryStats(dailyRecords);
```

#### 3-3. JSX props 수정

```tsx
<UserChannelPieChart
  channelStats={channelStats}
  categoryStats={categoryStats}
/>
```

**충돌 검토:** `channelStats` prop 이름 변경으로 인해 기존 `data` prop을 사용하는 곳은 `page.tsx` 한 곳뿐이다. 변경 범위는 단일 파일로 한정된다.

---

## 파일별 변경 요약

| 파일 | 변경 내용 |
|------|-----------|
| `apps/web/app/lib/voice-dashboard-api.ts` | `VoiceCategoryStat` 타입 추가, `computeCategoryStats` 함수 추가 |
| `apps/web/app/dashboard/guild/[guildId]/user/[userId]/components/UserChannelPieChart.tsx` | Props 수정(`data` → `channelStats` + `categoryStats`), 탭 UI 추가, 헬퍼 함수/컴포넌트 추출로 DRY 준수 |
| `apps/web/app/dashboard/guild/[guildId]/user/[userId]/page.tsx` | `computeCategoryStats` import 추가, `categoryStats` 계산, `UserChannelPieChart` props 수정 |

---

## 주의사항

- `categoryId`가 null인 레코드들은 모두 `__unclassified__` 키로 묶어 단일 "미분류" 항목으로 집계한다.
- 카테고리가 1개뿐인 경우(예: 모두 미분류)에도 정상 동작해야 한다.
- `TabsList`는 `CardHeader` 내 우측에 배치하여 레이아웃이 기존 `UserMicPieChart`와 일관성을 유지하도록 한다.
- `PieChartPanel`은 파일 내부 헬퍼 컴포넌트(export 없음)로 정의한다.
- API 호출 변경 없음. `dailyRecords`는 이미 page.tsx가 보유 중이므로 추가 네트워크 요청 불필요.
