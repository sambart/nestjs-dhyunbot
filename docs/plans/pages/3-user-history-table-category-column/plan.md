# UserHistoryTable 카테고리 컬럼 추가 구현 계획

## 개요

`UserHistoryTable` 컴포넌트의 테이블을 4열에서 5열로 확장하여, 기존 API 응답의 `categoryName` 필드를 첫 번째 컬럼으로 표시한다.

## 현재 상태 분석

### 데이터 타입 (`VoiceHistoryItem`)

```
id, channelId, channelName, categoryId, categoryName, joinAt, leftAt, durationSec
```

- `categoryName: string | null` 이미 존재하며, API 변경 없음.

### 현재 컬럼 구조 (4열)

```
채널 | 입장 시각 | 퇴장 시각 | 체류 시간
```

- 헤더: `grid-cols-4`
- 데이터 행: `grid-cols-4`

### 변경 후 컬럼 구조 (5열)

```
카테고리 | 채널 | 입장 시각 | 퇴장 시각 | 체류 시간
```

- 헤더: `grid-cols-5`
- 데이터 행: `grid-cols-5`

## 수정 대상

- 파일: `apps/web/app/dashboard/guild/[guildId]/user/[userId]/components/UserHistoryTable.tsx`
- Props, API 타입, 부모 페이지(`page.tsx`): 변경 없음.

## 구현 단계

### 1단계: 헤더 행 수정

- `grid-cols-4` → `grid-cols-5`
- 첫 번째 `<span>` 으로 `카테고리` 추가 (기존 `채널` 앞에 삽입)

변경 전:
```tsx
<div className="grid grid-cols-4 gap-2 border-b pb-2 text-sm font-medium text-muted-foreground">
  <span>채널</span>
  <span>입장 시각</span>
  <span>퇴장 시각</span>
  <span>체류 시간</span>
</div>
```

변경 후:
```tsx
<div className="grid grid-cols-5 gap-2 border-b pb-2 text-sm font-medium text-muted-foreground">
  <span>카테고리</span>
  <span>채널</span>
  <span>입장 시각</span>
  <span>퇴장 시각</span>
  <span>체류 시간</span>
</div>
```

### 2단계: 데이터 행 수정

- `grid-cols-4` → `grid-cols-5`
- 첫 번째 셀로 `categoryName` 표시 추가 (null 시 `"미분류"` 렌더링)

변경 전:
```tsx
<div
  key={item.id}
  className="grid grid-cols-4 gap-2 items-center text-sm py-1"
>
  <span className="truncate font-medium">
    {item.channelName}
  </span>
  ...
</div>
```

변경 후:
```tsx
<div
  key={item.id}
  className="grid grid-cols-5 gap-2 items-center text-sm py-1"
>
  <span className="truncate text-muted-foreground">
    {item.categoryName ?? "미분류"}
  </span>
  <span className="truncate font-medium">
    {item.channelName}
  </span>
  ...
</div>
```

## 기존 코드베이스 충돌 검토

| 항목 | 내용 | 충돌 여부 |
|---|---|---|
| `VoiceHistoryItem.categoryName` | 이미 `string \| null` 로 정의됨 | 없음 |
| `VoiceHistoryPage` | 변경 없음 | 없음 |
| `Props` 인터페이스 | 변경 없음 | 없음 |
| `page.tsx` 부모 컴포넌트 | `UserHistoryTable` props 동일 | 없음 |
| Tailwind `grid-cols-5` | 표준 유틸리티 클래스, 프로젝트 내 사용 중 | 없음 |

## 최종 변경 요약

- 수정 파일: 1개 (`UserHistoryTable.tsx`)
- 변경 범위: 헤더 div의 `grid-cols-4` → `grid-cols-5` 및 `<span>카테고리</span>` 추가, 데이터 행 div의 `grid-cols-4` → `grid-cols-5` 및 `categoryName` 셀 추가
- API/타입/부모 컴포넌트 변경: 없음
