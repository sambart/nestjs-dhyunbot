# 코드베이스 공통화 및 리팩토링 계획

> 작성일: 2026-03-15
> 상태: Tier 1 진행 중

## Tier 1: 즉시 실행 (코드 삭제 + 단순 통합)

### 1-1. 레거시 중복 파일 제거 (~2,000줄 삭제)

newbie 모듈의 `application/` 구조 전환 후 레거시 파일이 잔존. auth 모듈의 re-export 파일도 불필요.

**삭제 대상:**

```
apps/api/src/newbie/mission/              ← 폴더 전체 삭제
apps/api/src/newbie/moco/                 ← 폴더 전체 삭제
apps/api/src/newbie/role/                 ← 폴더 전체 삭제
apps/api/src/newbie/welcome/              ← 폴더 전체 삭제
apps/api/src/newbie/util/                 ← 폴더 전체 삭제
apps/api/src/newbie/newbie.controller.ts  ← 삭제 (presentation/에 동일)
apps/api/src/newbie/newbie.gateway.ts     ← 삭제 (presentation/에 동일)
apps/api/src/newbie/dto/                  ← presentation/dto/에 동일하면 삭제

apps/api/src/auth/auth.controller.ts      ← re-export만, 삭제
apps/api/src/auth/auth.service.ts         ← re-export만, 삭제
apps/api/src/auth/discord.strategy.ts     ← re-export만, 삭제
apps/api/src/auth/jwt-auth.guard.ts       ← re-export만, 삭제
apps/api/src/auth/jwt.strategy.ts         ← re-export만, 삭제
```

**작업 순서:**
1. 각 레거시 파일이 실제로 re-export만인지 확인
2. module.ts와 외부 모듈에서 레거시 경로를 import하는 곳을 신규 경로로 교체
3. 레거시 파일/폴더 삭제
4. 빌드 검증

### 1-2. 포맷 함수 통합

`formatMinutes()`, `formatShortDate()`, `formatDuration()` 등이 여러 lib/*.ts에 중복.
이미 i18n 버전이 `format-utils.ts`에 있으므로 비i18n 버전도 통합.

**중복 현황:**

| 함수 | co-presence-api.ts | inactive-member-api.ts | overview-api.ts | voice-dashboard-api.ts |
|------|-------------------|----------------------|----------------|----------------------|
| `formatMinutes()` | ✓ L108 | ✓ L88 (완전 동일) | | |
| `formatShortDate()` | ✓ L118 | | ✓ L45 (거의 동일) | |
| `formatDuration(Sec)` | | | ✓ L37 | ✓ L71 (거의 동일) |

**작업:**
1. `apps/web/app/lib/format-utils.ts`에 비i18n 공통 함수 추가
2. 각 API 파일에서 중복 함수 삭제 후 `format-utils.ts`에서 import
3. 빌드 검증

### 1-3. 공유 타입 통합

**PaginatedResponse (7곳 중복):**
```typescript
// libs/shared/src/types/pagination.types.ts (신규)
export interface PaginatedResponse<T> {
  total: number;
  page: number;
  limit: number;
  items: T[];
}
```

**JwtUser (controller 3곳 중복):**
```typescript
// apps/api/src/common/types/jwt-user.types.ts (신규)
export interface JwtUser {
  discordId: string;
  username: string;
}
```

---

## Tier 2: 중기 리팩토링

### 2-1. 날짜 유틸 공유 라이브러리 확충
### 2-2. Discord 유틸 서비스 (fetchMember, fetchTextChannel, parseEmbedColor)
### 2-3. Web 설정 페이지 공통 훅 (useSettingsPage)
### 2-4. SummaryCardsGrid 컴포넌트 통합
### 2-5. EmbedPreview 컴포넌트 통합

## Tier 3: 장기 구조 개선

### 3-1. Redis TTL 중앙 관리
### 3-2. DataTable 제네릭 컴포넌트
### 3-3. 대형 설정 페이지 분리 (AutoChannel 735줄, StatusPrefix 627줄 등)
