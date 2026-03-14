# 대시보드 재구성 — 공통 모듈 판단 문서

## 목적

대시보드 재구성(서버 개요 + 신입 관리 대시보드) 기능의 페이지 단위 병렬 개발을 시작하기 전에, 2개 이상 도메인 또는 2개 이상 병렬 단위가 공유하는 모듈을 식별하고 설계 방향을 확정한다.
이 문서에 정의된 공통 모듈은 모든 병렬 단위 작업보다 선행하여 완성되어야 하며, 이후 단위 작업들이 conflict 없이 병렬로 진행될 수 있도록 공통 인터페이스와 파일 경로를 명시한다.

---

## 대상 변경 사항

| 변경 ID | 도메인 | 설명 |
|---------|--------|------|
| 변경 1 | web + newbie (BE) | 서버 개요 API (`GET /api/guilds/{guildId}/overview`) |
| 변경 2 | newbie (BE) | 모코코 순위 API 확인/보강 |
| 변경 3 | web (FE) | 서버 개요 페이지 (`/dashboard/guild/{guildId}/overview`) |
| 변경 4 | web + newbie (FE) | 신입 관리 대시보드 페이지 (`/dashboard/guild/{guildId}/newbie`) |
| 변경 5 | web (FE) | 사이드바 메뉴 추가 |
| 변경 6 | web + newbie (FE) | 설정 페이지 미션 관리 탭 제거 |

---

## 병렬 개발 단위 분리

| 단위 | 범위 | 의존하는 공통 모듈 |
|------|------|-------------------|
| A: 서버 개요 BE | 변경 1 | CM-1, CM-2 |
| B: 서버 개요 FE | 변경 3 | CM-1, CM-3 |
| C: 신입 관리 대시보드 FE | 변경 4 | CM-3, CM-4 |
| D: 사이드바 + 설정 조정 | 변경 5 + 변경 6 | CM-3, CM-4 |

---

## 공통 모듈 목록

### CM-1. 서버 개요 응답 타입 (`libs/shared`)

**사유**: 서버 개요 API의 응답 타입은 백엔드(단위 A)와 프론트엔드(단위 B) 두 도메인에서 동시에 참조한다. `libs/shared`에 정의하여 양쪽이 동일한 타입을 사용한다.

**파일**: `libs/shared/src/types/overview.ts`

```typescript
/** 서버 개요 API 응답 (GET /api/guilds/{guildId}/overview) */
export interface GuildOverviewResponse {
  /** 요약 카드 데이터 */
  summary: GuildOverviewSummary;
  /** 신입 미션 현황 (missionEnabled=false이면 null) */
  missionStatus: MissionStatusSummary | null;
  /** 최근 7일 일별 음성 활동 데이터 */
  recentVoiceDaily: DailyVoiceEntry[];
  /** 비활동 회원 등급별 인원 수 */
  inactiveGrades: InactiveGradeSummary;
}

export interface GuildOverviewSummary {
  /** 서버 총 멤버 수 (Discord API) */
  totalMemberCount: number;
  /** 오늘 총 음성 활동 시간(초) */
  todayVoiceDurationSec: number;
  /** 현재 음성 채널 접속자 수 */
  currentVoiceUserCount: number;
  /** 활성 멤버 비율 (0~1). 비활동 레코드가 없으면 null */
  activeRate: number | null;
}

export interface MissionStatusSummary {
  /** 진행 중 미션 수 */
  inProgressCount: number;
  /** 완료 미션 수 */
  completedCount: number;
  /** 실패 미션 수 */
  failedCount: number;
}

export interface DailyVoiceEntry {
  /** 날짜 (YYYYMMDD) */
  date: string;
  /** 총 음성 시간(초) */
  totalDurationSec: number;
}

export interface InactiveGradeSummary {
  /** 완전 비활동 인원 수 */
  fullyInactiveCount: number;
  /** 저활동 인원 수 */
  lowActiveCount: number;
  /** 활동 감소 인원 수 */
  decliningCount: number;
}
```

**export 등록**: `libs/shared/src/types/index.ts`에 `export * from './overview';` 추가.

**데이터 소스 매핑** (PRD F-WEB-008 기준):

| 응답 필드 | 데이터 소스 | 조회 방식 |
|-----------|------------|-----------|
| `summary.totalMemberCount` | Discord API (`guild.memberCount`) | Discord.js `client.guilds.cache.get(guildId)` |
| `summary.todayVoiceDurationSec` | `VoiceDailyEntity` | `SUM(channelDurationSec) WHERE date = today AND channelId = 'GLOBAL'` |
| `summary.currentVoiceUserCount` | `BotMetricEntity` | 최신 레코드의 `voiceUserCount` (또는 Discord.js 실시간 조회) |
| `summary.activeRate` | `InactiveMemberRecordEntity` | `1 - (비활동 인원 / 전체 레코드 수)` |
| `missionStatus` | `NewbieMissionEntity` + `NewbieConfigEntity` | `missionEnabled` 확인 후 상태별 `COUNT(*)` |
| `recentVoiceDaily` | `VoiceDailyEntity` | 최근 7일 `SUM(channelDurationSec) WHERE channelId = 'GLOBAL' GROUP BY date` |
| `inactiveGrades` | `InactiveMemberRecordEntity` | `COUNT(*) GROUP BY grade` |

---

### CM-2. 서버 개요 백엔드 모듈 스캐폴딩 (`apps/api`)

**사유**: 서버 개요 API는 voice(VoiceDaily), monitoring(BotMetric), inactive-member(InactiveMemberRecord), newbie(NewbieMission, NewbieConfig) 4개 도메인의 데이터를 교차 조회한다. 단일 도메인에 속하지 않는 교차 도메인 API이므로 독립 모듈로 생성한다. `AppModule` 등록이 필요하여 다른 단위와 동시 수정 시 conflict 위험이 있다.

**파일 구조**:
```
apps/api/src/overview/
  overview.module.ts
  overview.controller.ts
  overview.service.ts
```

**`overview.module.ts`**:
```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { VoiceDailyEntity } from '../channel/voice/domain/voice-daily.entity';
import { BotMetricEntity } from '../monitoring/domain/bot-metric.entity';
import { InactiveMemberRecordEntity } from '../inactive-member/entities/inactive-member-record.entity';
import { NewbieMissionEntity } from '../newbie/domain/newbie-mission.entity';
import { NewbieConfigEntity } from '../newbie/domain/newbie-config.entity';

import { OverviewController } from './overview.controller';
import { OverviewService } from './overview.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      VoiceDailyEntity,
      BotMetricEntity,
      InactiveMemberRecordEntity,
      NewbieMissionEntity,
      NewbieConfigEntity,
    ]),
  ],
  controllers: [OverviewController],
  providers: [OverviewService],
})
export class OverviewModule {}
```

**`overview.controller.ts`**:
```typescript
import { Controller, Get, Param, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { GuildOverviewResponse } from '@nexus/shared';
import { OverviewService } from './overview.service';

@Controller('api/guilds/:guildId/overview')
@UseGuards(JwtAuthGuard)
export class OverviewController {
  constructor(private readonly overviewService: OverviewService) {}

  @Get()
  async getOverview(
    @Param('guildId') guildId: string,
  ): Promise<GuildOverviewResponse> {
    return this.overviewService.getOverview(guildId);
  }
}
```

**`overview.service.ts`** (메서드 시그니처만, 구현은 단위 A에서):
```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import type { GuildOverviewResponse } from '@nexus/shared';
import { VoiceDailyEntity } from '../channel/voice/domain/voice-daily.entity';
import { BotMetricEntity } from '../monitoring/domain/bot-metric.entity';
import { InactiveMemberRecordEntity } from '../inactive-member/entities/inactive-member-record.entity';
import { NewbieMissionEntity } from '../newbie/domain/newbie-mission.entity';
import { NewbieConfigEntity } from '../newbie/domain/newbie-config.entity';

@Injectable()
export class OverviewService {
  constructor(
    @InjectRepository(VoiceDailyEntity)
    private readonly voiceDailyRepo: Repository<VoiceDailyEntity>,
    @InjectRepository(BotMetricEntity)
    private readonly botMetricRepo: Repository<BotMetricEntity>,
    @InjectRepository(InactiveMemberRecordEntity)
    private readonly inactiveRecordRepo: Repository<InactiveMemberRecordEntity>,
    @InjectRepository(NewbieMissionEntity)
    private readonly missionRepo: Repository<NewbieMissionEntity>,
    @InjectRepository(NewbieConfigEntity)
    private readonly configRepo: Repository<NewbieConfigEntity>,
  ) {}

  /** 서버 개요 통합 데이터를 조회한다. 구현은 단위 A에서 수행. */
  async getOverview(guildId: string): Promise<GuildOverviewResponse> {
    throw new Error('Not implemented — 단위 A에서 구현');
  }
}
```

**`AppModule` 등록**: `apps/api/src/app.module.ts`의 imports 배열에 `OverviewModule` 추가.

---

### CM-3. `DashboardSidebar.tsx` 메뉴 항목 확장

**사유**: 서버 개요 페이지(단위 B)와 신입 관리 대시보드(단위 C)가 모두 사이드바에 메뉴 항목을 추가해야 한다. 두 단위가 동시에 같은 파일의 같은 배열을 수정하면 conflict가 발생한다. PRD(F-WEB-008 DashboardSidebar 메뉴 구성)에 정의된 전체 메뉴를 선행으로 반영한다.

**파일**: `apps/web/app/components/DashboardSidebar.tsx`

**변경 내용**: `menuItems` 배열을 PRD 명세대로 갱신한다. 기존 항목의 순서도 PRD에 맞게 조정한다.

변경 전:
```typescript
import { Activity, ArrowLeftRight, GitFork, Mic, Search, Settings, UserX } from "lucide-react";

const menuItems = [
  { href: `.../voice`, label: "음성 활동", icon: Mic },
  { href: `.../user`, label: "유저 검색", icon: Search },
  { href: `.../inactive-member`, label: "비활동 회원", icon: UserX },
  { href: `.../co-presence`, label: "관계 분석", icon: GitFork },
  { href: `.../monitoring`, label: "모니터링", icon: Activity },
];
```

변경 후:
```typescript
import { Activity, ArrowLeftRight, GitFork, LayoutDashboard, Mic, Search, Settings, Sprout, UserX } from "lucide-react";

const menuItems = [
  { href: `.../overview`, label: "서버 개요", icon: LayoutDashboard },
  { href: `.../voice`, label: "음성 활동", icon: Mic },
  { href: `.../user`, label: "유저 검색", icon: Search },
  { href: `.../newbie`, label: "신입 관리", icon: Sprout },
  { href: `.../inactive-member`, label: "비활동 회원", icon: UserX },
  { href: `.../co-presence`, label: "관계 분석", icon: GitFork },
  { href: `.../monitoring`, label: "모니터링", icon: Activity },
];
```

추가 아이콘 import: `LayoutDashboard`, `Sprout` (lucide-react).

---

### CM-4. MissionManageTab 컴포넌트 경로 이동 및 설정 페이지 탭 제거

**사유**: `MissionManageTab` 컴포넌트는 현재 설정 페이지에 위치해 있다. 단위 C(신입 관리 대시보드)에서 대시보드 페이지가 이 컴포넌트를 사용하고, 단위 D(설정 조정)에서 설정 페이지의 해당 탭을 제거해야 한다. 두 단위가 동시에 같은 컴포넌트 파일을 참조하므로 이동을 선행한다.

**현재 경로**:
```
apps/web/app/settings/guild/[guildId]/newbie/components/MissionManageTab.tsx
```

**이동 경로**:
```
apps/web/app/dashboard/guild/[guildId]/newbie/components/MissionManageTab.tsx
```

**선행 작업 상세**:

1. **파일 이동**: `MissionManageTab.tsx`를 대시보드 디렉토리로 이동한다.

2. **import 경로 조정** (이동 후 `MissionManageTab.tsx` 내부):
   - `newbie-api.ts` import 경로를 설정 기준(`../../../../lib/newbie-api`)에서 대시보드 기준으로 변경한다.
   - 실제 상대 경로는 `apps/web/app/dashboard/guild/[guildId]/newbie/components/` → `apps/web/app/lib/` 이므로 `../../../../../lib/newbie-api`가 된다.

3. **설정 페이지 수정** (`apps/web/app/settings/guild/[guildId]/newbie/page.tsx`):
   - `MissionManageTab` import 문 제거
   - `TabId` 타입에서 `'mission-manage'` 제거
   - `TABS` 배열에서 `{ id: 'mission-manage', label: '미션 관리' }` 항목 제거
   - 탭 번호 재조정 (PRD F-WEB-NEWBIE-001 기준):

     | 탭 번호 | 탭 이름 | 대응 기능 |
     |---------|---------|-----------|
     | 1 | 환영인사 설정 | F-NEWBIE-001 |
     | 2 | 미션 설정 | F-NEWBIE-002 |
     | 3 | 모코코 사냥 설정 | F-NEWBIE-003 |
     | 4 | 신입기간 설정 | F-NEWBIE-004 |

---

## 공통 모듈에 포함하지 않은 항목 (단일 도메인 전용)

| 항목 | 담당 단위 | 제외 사유 |
|------|-----------|-----------|
| `apps/web/app/lib/overview-api.ts` (FE API 클라이언트) | 단위 B | 서버 개요 FE에서만 사용 |
| `apps/web/app/lib/newbie-dashboard-api.ts` (FE API 클라이언트) | 단위 C | 신입 관리 대시보드 FE에서만 사용. 모코코 순위 조회 함수만 추가하고, 미션 관련 함수는 기존 `newbie-api.ts`를 직접 import |
| `apps/web/app/dashboard/guild/[guildId]/overview/page.tsx` | 단위 B | 서버 개요 페이지 단독 |
| `apps/web/app/dashboard/guild/[guildId]/newbie/page.tsx` | 단위 C | 신입 관리 대시보드 페이지 단독 |
| 모코코 순위 API 보강 (변경 2) | 단위 C | 기존 `GET /api/guilds/{guildId}/newbie/moco` 엔드포인트가 이미 존재하며 페이지네이션, score, sessionCount, uniqueNewbieCount 등을 응답함. 사냥꾼 닉네임/아바타 보강이 필요하더라도 newbie 도메인 단독 수정으로 충분 |

---

## 판단 요청에 대한 답변

### 1. 공통 모듈이 필요한가?

필요하다. 4개의 공통 모듈(CM-1 ~ CM-4)을 선행 구현해야 한다.

- **CM-1** (응답 타입): 백엔드(단위 A)와 프론트엔드(단위 B)가 동시에 참조하는 타입 정의
- **CM-2** (overview 모듈): 4개 도메인 엔티티를 교차 참조하는 신규 백엔드 모듈 + AppModule 등록
- **CM-3** (사이드바): 서버 개요(단위 B)와 신입 관리(단위 C) 메뉴 항목이 동일 파일의 동일 배열을 수정
- **CM-4** (MissionManageTab 이동): 설정 페이지(단위 D)에서 제거하고 대시보드(단위 C)에서 사용하는 컴포넌트

### 2. 구현 계획을 몇 개 모듈로 분리해야 하는가?

공통 모듈 4개 + 병렬 단위 4개 = 총 8개.

- **Phase 1 (선행)**: CM-1, CM-2, CM-3, CM-4
- **Phase 2 (병렬)**: 단위 A, B, C, D — Phase 1 완료 후 독립 병렬 진행

### 3. 각 모듈 간 의존관계가 있는가?

Phase 1 내부에서 CM-1 ~ CM-4는 상호 의존이 없으므로 병렬 구현 가능하다.

Phase 2의 의존 구조:

```
Phase 1 (선행, 병렬 가능)
  CM-1 (응답 타입)
  CM-2 (overview 모듈 스캐폴딩)
  CM-3 (사이드바 메뉴)
  CM-4 (MissionManageTab 이동)

Phase 2 (병렬 진행)
  단위 A (서버 개요 BE)     ← CM-1, CM-2
  단위 B (서버 개요 FE)     ← CM-1, CM-3
  단위 C (신입 대시보드 FE) ← CM-3, CM-4
  단위 D (사이드바+설정)    ← CM-3, CM-4
```

단위 A, B, C, D 간에는 상호 의존이 없다. Phase 1 완료 후 완전 병렬 진행이 가능하다.
