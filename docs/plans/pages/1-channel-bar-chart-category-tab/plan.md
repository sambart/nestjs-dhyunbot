# ChannelBarChart 카테고리별 탭 전환 구현 계획

## 개요

`ChannelBarChart` 컴포넌트에 [채널별 | 카테고리별] 탭 전환 UI를 추가한다.
카테고리별 집계는 프론트엔드에서 `VoiceDailyRecord[]` 원시 데이터로부터 직접 수행하며, API 변경은 없다.

---

## 현재 구조 파악

### 데이터 흐름

```
page.tsx
  └─ fetchVoiceDaily() → VoiceDailyRecord[]
       └─ computeChannelStats() → VoiceChannelStat[]
            └─ <ChannelBarChart data={channelStats} />
```

### 현재 Props

```ts
interface Props {
  data: VoiceChannelStat[]; // 채널별 집계 결과
}
```

`ChannelBarChart`는 현재 채널별 집계 결과(`VoiceChannelStat[]`)만 받는다.
카테고리별 집계를 위해서는 원시 레코드(`VoiceDailyRecord[]`)가 필요하다.

### 관련 타입 (voice-dashboard-api.ts)

- `VoiceDailyRecord.categoryId: string | null`
- `VoiceDailyRecord.categoryName: string | null`
- `VoiceDailyRecord.channelDurationSec: number`
- `VoiceDailyRecord.micOnSec: number`
- `VoiceDailyRecord.micOffSec: number`
- GLOBAL 레코드 (`channelId === 'GLOBAL'`)는 채널 집계에서 제외되어 있으므로 카테고리 집계도 동일하게 제외한다.

### 탭 컴포넌트 API (tabs.tsx)

`@base-ui/react/tabs` 기반. 사용 방법:

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

`value` prop으로 현재 활성 탭을 제어할 수 있고, `defaultValue`로 초기값을 설정한다.
`Tabs`는 내부적으로 상태를 관리하므로 별도 `useState` 불필요 (`defaultValue` 방식 사용).

---

## 구현 단계

### 1단계: `voice-dashboard-api.ts`에 카테고리 집계 타입 및 함수 추가

**위치:** `apps/web/app/lib/voice-dashboard-api.ts`

#### 1-1. `VoiceCategoryStat` 타입 추가

```ts
export interface VoiceCategoryStat {
  categoryId: string | null;
  categoryName: string; // null인 경우 "미분류"로 채워서 반환
  totalDurationSec: number;
  micOnSec: number;
  micOffSec: number;
  aloneSec: number;
}
```

#### 1-2. `computeCategoryStats()` 함수 추가

기존 `computeChannelStats()`와 동일한 패턴으로 작성한다.
집계 키는 `categoryId`(null 포함)이며, `categoryName`이 null이면 `"미분류"`로 치환한다.
GLOBAL 레코드(`channelId === 'GLOBAL'`)는 제외한다.

```ts
export function computeCategoryStats(
  records: VoiceDailyRecord[],
): VoiceCategoryStat[] {
  const channelRecords = records.filter((r) => r.channelId !== 'GLOBAL');
  const byCategory = new Map<string, VoiceCategoryStat>();

  for (const r of channelRecords) {
    const key = r.categoryId ?? '__null__';
    const existing = byCategory.get(key);
    if (existing) {
      existing.totalDurationSec += r.channelDurationSec;
      existing.micOnSec += r.micOnSec;
      existing.micOffSec += r.micOffSec;
      existing.aloneSec += r.aloneSec;
    } else {
      byCategory.set(key, {
        categoryId: r.categoryId,
        categoryName: r.categoryName ?? '미분류',
        totalDurationSec: r.channelDurationSec,
        micOnSec: r.micOnSec,
        micOffSec: r.micOffSec,
        aloneSec: r.aloneSec,
      });
    }
  }

  return Array.from(byCategory.values()).sort(
    (a, b) => b.totalDurationSec - a.totalDurationSec,
  );
}
```

**충돌 검토:** 기존 함수명, 타입명과 겹치지 않음. 패턴 일치.

---

### 2단계: `page.tsx`에서 원시 데이터를 `ChannelBarChart`에 추가 전달

**위치:** `apps/web/app/dashboard/guild/[guildId]/voice/page.tsx`

`ChannelBarChart`는 현재 `channelStats`만 받는다.
카테고리 집계는 `ChannelBarChart` 내부에서 처리할 것이므로, 원시 레코드(`VoiceDailyRecord[]`)도 prop으로 넘겨야 한다.

#### 변경 내용

1. `fetchVoiceDaily`의 결과를 state로 보관한다.

```ts
const [rawRecords, setRawRecords] = useState<VoiceDailyRecord[]>([]);
```

2. `loadData` 내부에서 `setRawRecords(data)` 호출을 추가한다.

3. `ChannelBarChart`에 `records` prop 추가 전달:

```tsx
<ChannelBarChart data={channelStats} records={rawRecords} />
```

**충돌 검토:**
- `VoiceDailyRecord`는 이미 `page.tsx`에서 import되어 있다.
- 기존 상태(`channelStats`)는 그대로 유지한다.

---

### 3단계: `ChannelBarChart.tsx` 수정

**위치:** `apps/web/app/dashboard/guild/[guildId]/voice/components/ChannelBarChart.tsx`

#### 3-1. Props 확장

```ts
import type { VoiceCategoryStat, VoiceChannelStat } from "@/app/lib/voice-dashboard-api";
import { computeCategoryStats } from "@/app/lib/voice-dashboard-api";

interface Props {
  data: VoiceChannelStat[];
  records: VoiceDailyRecord[];
}
```

#### 3-2. 카테고리 집계 데이터 파생

컴포넌트 내부에서 `useMemo` 없이 단순 파생 계산으로 처리한다.
(렌더 빈도가 낮고, 데이터량이 크지 않아 메모이제이션 불필요)

```ts
const categoryChartData = computeCategoryStats(records)
  .slice(0, 10)
  .map((d) => ({
    name: d.categoryName,
    durationMin: Math.round(d.totalDurationSec / 60),
    micOnMin: Math.round(d.micOnSec / 60),
    micOffMin: Math.round(d.micOffSec / 60),
  }));
```

#### 3-3. 탭 UI 구조

```tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

return (
  <Card>
    <CardHeader>
      <div className="flex items-center justify-between">
        <CardTitle>음성 활동</CardTitle>
        <Tabs defaultValue="channel">
          <TabsList>
            <TabsTrigger value="channel">채널별</TabsTrigger>
            <TabsTrigger value="category">카테고리별</TabsTrigger>
          </TabsList>
          <TabsContent value="channel">
            {/* 채널별 바차트 */}
          </TabsContent>
          <TabsContent value="category">
            {/* 카테고리별 바차트 */}
          </TabsContent>
        </Tabs>
      </div>
    </CardHeader>
    <CardContent>
      ...
    </CardContent>
  </Card>
);
```

단, `Tabs`와 `TabsContent`가 `CardHeader`와 `CardContent`에 걸쳐 있으면 구조가 어색해진다.
올바른 구조는 `Card` 전체를 `Tabs`로 감싸거나, `CardHeader` + `CardContent`를 `TabsContent` 안에 넣는 방식을 피해야 한다.

**채택 구조:** `Card` 내부 전체를 `Tabs`로 구성하고, `CardHeader`에 `TabsList`를, `CardContent`에 `TabsContent`를 배치한다.

```tsx
return (
  <Card>
    <Tabs defaultValue="channel">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle>음성 활동 (Top 10)</CardTitle>
        <TabsList>
          <TabsTrigger value="channel">채널별</TabsTrigger>
          <TabsTrigger value="category">카테고리별</TabsTrigger>
        </TabsList>
      </CardHeader>
      <CardContent>
        <TabsContent value="channel">
          <ChartContainer config={chartConfig} className="h-[300px] w-full">
            {/* 채널별 BarChart */}
          </ChartContainer>
        </TabsContent>
        <TabsContent value="category">
          <ChartContainer config={chartConfig} className="h-[300px] w-full">
            {/* 카테고리별 BarChart */}
          </ChartContainer>
        </TabsContent>
      </CardContent>
    </Tabs>
  </Card>
);
```

**충돌 검토:**
- `Tabs` 컴포넌트는 `"use client"` 지시어를 포함하며, `ChannelBarChart`도 `"use client"`이므로 문제없다.
- `TabsList`의 기본 스타일은 `bg-muted`로 인라인에 자연스럽게 녹아든다.
- `CardHeader`에 `flex flex-row`를 추가하면 기존 `CardTitle`과 `TabsList`가 가로 배치된다. 기존 `CardHeader`의 기본 클래스(`flex flex-col space-y-1.5`)와 충돌하므로 `className`을 명시적으로 재정의한다.

---

## 최종 변경 파일 목록

| 파일 | 변경 유형 | 변경 내용 |
|---|---|---|
| `apps/web/app/lib/voice-dashboard-api.ts` | 추가 | `VoiceCategoryStat` 타입, `computeCategoryStats()` 함수 |
| `apps/web/app/dashboard/guild/[guildId]/voice/page.tsx` | 수정 | `rawRecords` state 추가, `ChannelBarChart`에 `records` prop 전달 |
| `apps/web/app/dashboard/guild/[guildId]/voice/components/ChannelBarChart.tsx` | 수정 | Props 확장, 탭 UI 및 카테고리별 차트 렌더링 추가 |

---

## 주의사항 및 결정 사항

1. **API 변경 없음**: 모든 집계는 프론트엔드에서 수행한다.
2. **`computeCategoryStats`는 lib에 위치**: 다른 컴포넌트에서 재사용 가능하도록 컴포넌트 내부가 아닌 `voice-dashboard-api.ts`에 추가한다.
3. **`"미분류"` 치환**: `computeCategoryStats` 함수 내부에서 `categoryName`이 null이면 `"미분류"`로 치환하여 반환한다. 컴포넌트 레이어에서 null 처리를 하지 않는다.
4. **Top 10 슬라이스**: 채널별과 동일하게 카테고리도 상위 10개만 표시한다.
5. **집계 키 충돌**: `categoryId`가 null인 레코드들이 여러 개 있을 때 하나의 "미분류" 항목으로 올바르게 합산되도록 `'__null__'`을 Map 키로 사용한다.
6. **`CardHeader` 레이아웃 재정의**: 기존 `CardHeader`의 `flex-col` 기본 스타일을 `flex-row items-center justify-between`으로 재정의하여 제목과 탭이 가로 배치되게 한다.
