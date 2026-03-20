# Domain Entity ↔ ORM Entity 분리 및 도메인 로직 이동 계획

> 작성일: 2026-03-15
> 상태: 계획 수립 완료 (미적용)

## 목적

아키텍처 가이드(`docs/guides/architecture-pragmatic-ddd.md`)의 핵심 원칙을 코드베이스에 적용한다:

1. **Domain Entity ↔ ORM Entity 분리** — domain/ 폴더에서 TypeORM import를 제거한다
2. **도메인 로직을 Domain 레이어로 이동** — Service에 흩어진 비즈니스 규칙을 Entity 메서드로 캡슐화한다

---

## 현황 분석

### 대상 Entity (36개)

| 복잡도 | 개수 | 접근법 |
|--------|------|--------|
| LOW (단순 데이터, < 40줄) | 24 | ORM Entity만 분리 (domain → infrastructure), 도메인 Entity 생략 |
| MEDIUM (상태 전이, 조건부 규칙) | 10 | ORM Entity 분리 + Domain Entity 생성 + Mapper |
| HIGH (복잡한 불변식, 다수 설정) | 2 | ORM Entity 분리 + Domain Entity 생성 + Mapper + 비즈니스 메서드 |

### 핵심 판단 근거

아키텍처 가이드 §3 전술적 설계:

> **복잡도 낮음 (CRUD, 단순 상태 저장)** → Transaction Script. Entity는 데이터 홀더 역할.

따라서 LOW 복잡도 Entity는 **도메인 Entity 클래스를 별도로 만들지 않는다**. 대신:
- 현재 `domain/*.entity.ts` 파일을 `infrastructure/*.orm-entity.ts`로 이동 (TypeORM 의존성을 infrastructure로 격리)
- `domain/`에는 interface/type/enum만 남긴다
- Service에서 ORM Entity를 직접 사용하되, import 경로만 infrastructure로 변경

MEDIUM/HIGH 복잡도 Entity만 도메인 Entity + Mapper를 생성한다.

---

## 페이즈 구성

### Phase 0: 공통 인프라 준비

**DomainException 도입** — 비즈니스 규칙 위반을 HTTP에 독립적으로 표현한다.

| 작업 | 파일 | 설명 |
|------|------|------|
| 0-1 | `src/shared/domain-exception.ts` | DomainException 클래스 생성 (message + code) |
| 0-2 | `src/shared/domain-exception.filter.ts` | NestJS ExceptionFilter — DomainException → HTTP 400 매핑 |
| 0-3 | `src/main.ts` | `app.useGlobalFilters(new DomainExceptionFilter())` 등록 |

```typescript
// src/shared/domain-exception.ts
export class DomainException extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = 'DomainException';
  }
}
```

```typescript
// src/shared/domain-exception.filter.ts
@Catch(DomainException)
export class DomainExceptionFilter implements ExceptionFilter {
  catch(exception: DomainException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    ctx.getResponse<Response>().status(400).json({
      code: exception.code,
      message: exception.message,
    });
  }
}
```

---

### Phase 1: LOW 복잡도 Entity — ORM 파일 이동 (24개)

**원칙:** domain/ → infrastructure/ 이동. domain/에는 enum/interface/type만 남긴다.

**변경 패턴 (반복 작업):**

```
[Before]
module/
  domain/
    foo.entity.ts          ← TypeORM @Entity + @Column
    foo-status.enum.ts     ← enum

[After]
module/
  domain/
    foo.types.ts           ← interface + enum (export)
  infrastructure/
    foo.orm-entity.ts      ← TypeORM @Entity (기존 파일 이동 + 이름 변경)
```

**대상 파일 목록:**

#### 1-1. channel/voice/ (3개)

| 현재 경로 | 이동 후 | 비고 |
|-----------|---------|------|
| `domain/voice-daily.entity.ts` | `infrastructure/voice-daily.orm-entity.ts` | 복합키 집계 데이터 |
| `domain/voice-channel-history.entity.ts` | `infrastructure/voice-channel-history.orm-entity.ts` | `get duration()` 계산 속성은 유지 |
| `domain/voice-excluded-channel.entity.ts` | `infrastructure/voice-excluded-channel.orm-entity.ts` | enum → domain/voice-excluded-channel.types.ts로 분리 |

#### 1-2. channel/voice/co-presence/ (3개)

| 현재 경로 | 이동 후 |
|-----------|---------|
| `domain/voice-co-presence-daily.entity.ts` | `infrastructure/voice-co-presence-daily.orm-entity.ts` |
| `domain/voice-co-presence-session.entity.ts` | `infrastructure/voice-co-presence-session.orm-entity.ts` |
| `domain/voice-co-presence-pair-daily.entity.ts` | `infrastructure/voice-co-presence-pair-daily.orm-entity.ts` |

#### 1-3. channel/auto/ (3개)

| 현재 경로 | 이동 후 |
|-----------|---------|
| `domain/auto-channel-config.entity.ts` | `infrastructure/auto-channel-config.orm-entity.ts` |
| `domain/auto-channel-button.entity.ts` | `infrastructure/auto-channel-button.orm-entity.ts` |
| `domain/auto-channel-sub-option.entity.ts` | `infrastructure/auto-channel-sub-option.orm-entity.ts` |

#### 1-4. status-prefix/ (2개)

| 현재 경로 | 이동 후 | 비고 |
|-----------|---------|------|
| `domain/status-prefix-config.entity.ts` | `infrastructure/status-prefix-config.orm-entity.ts` | |
| `domain/status-prefix-button.entity.ts` | `infrastructure/status-prefix-button.orm-entity.ts` | enum → domain/status-prefix-button.types.ts |

#### 1-5. sticky-message/ (1개)

| 현재 경로 | 이동 후 |
|-----------|---------|
| `domain/sticky-message-config.entity.ts` | `infrastructure/sticky-message-config.orm-entity.ts` |

#### 1-6. monitoring/ (1개)

| 현재 경로 | 이동 후 | 비고 |
|-----------|---------|------|
| `domain/bot-metric.entity.ts` | `infrastructure/bot-metric.orm-entity.ts` | enum → domain/bot-metric.types.ts |

#### 1-7. voice-analytics/self-diagnosis/ (2개)

| 현재 경로 | 이동 후 |
|-----------|---------|
| `domain/voice-health-badge.entity.ts` | `infrastructure/voice-health-badge.orm-entity.ts` |
| `domain/voice-health-config.entity.ts` | `infrastructure/voice-health-config.orm-entity.ts` |

#### 1-8. common/ (2개)

| 현재 경로 | 이동 후 |
|-----------|---------|
| `domain/guild-setting.entity.ts` | `infrastructure/guild-setting.orm-entity.ts` |
| `domain/user-setting.entity.ts` | `infrastructure/user-setting.orm-entity.ts` |

#### 1-9. member/ (1개)

| 현재 경로 | 이동 후 |
|-----------|---------|
| `domain/member.entity.ts` | `infrastructure/member.orm-entity.ts` |

#### 1-10. channel/ (1개)

| 현재 경로 | 이동 후 |
|-----------|---------|
| `channel.entity.ts` | `infrastructure/channel.orm-entity.ts` |

#### 1-11. newbie/ — LOW만 (4개)

| 현재 경로 | 이동 후 |
|-----------|---------|
| `domain/newbie-period.entity.ts` | `infrastructure/newbie-period.orm-entity.ts` |
| `domain/newbie-mission-template.entity.ts` | `infrastructure/newbie-mission-template.orm-entity.ts` |
| `domain/newbie-moco-template.entity.ts` | `infrastructure/newbie-moco-template.orm-entity.ts` |
| `domain/moco-hunting-daily.entity.ts` | `infrastructure/moco-hunting-daily.orm-entity.ts` |

**Phase 1 작업 순서 (모듈당):**

1. `domain/*.entity.ts` → `infrastructure/*.orm-entity.ts`로 파일 이동 + 이름 변경
2. entity 내 enum이 있으면 `domain/*.types.ts`로 분리하여 남긴다
3. `*.module.ts`의 `TypeOrmModule.forFeature()` import 경로 수정
4. `application/`, `infrastructure/`의 import 경로 수정
5. 다른 모듈에서 import하는 곳도 경로 수정
6. `pnpm --filter @nexus/api build` 로 빌드 확인

---

### Phase 2: MEDIUM 복잡도 Entity — Domain Entity + Mapper 생성 (6개)

상태 전이나 조건부 규칙이 있는 Entity만 도메인 Entity를 별도로 만든다.

#### 2-1. inactive-member/domain/ (3개)

**InactiveMemberRecord** — 등급 분류 로직이 Service에 있음

```
[Before] inactive-member.service.ts:144
private determineGrade(totalMinutes, prevTotalMinutes, config): Grade | null {
  if (totalMinutes === 0) return FULLY_INACTIVE;
  if (totalMinutes < config.lowActiveThresholdMin * periodDays) return LOW_ACTIVE;
  if (prev > 0 && totalMinutes < prev * (1 - decliningPercent/100)) return DECLINING;
  return null;
}
```

```
[After]
domain/
  inactive-member-record.entity.ts    ← 순수 도메인 Entity (비즈니스 규칙 포함)
  inactive-member-config.types.ts     ← interface InactiveMemberConfigProps
  inactive-member.types.ts            ← enum InactiveMemberGrade
infrastructure/
  inactive-member-record.orm-entity.ts ← TypeORM Entity
  inactive-member-config.orm-entity.ts ← TypeORM Entity
  inactive-member-record.mapper.ts     ← ORM ↔ Domain 변환
```

**도메인 Entity 설계:**

```typescript
// domain/inactive-member-record.entity.ts
export class InactiveMemberRecord {
  private constructor(
    readonly guildId: string,
    readonly userId: string,
    private grade: InactiveMemberGrade | null,
    private totalMinutes: number,
    private prevTotalMinutes: number,
    private lastVoiceDate: Date | null,
    private gradeChangedAt: Date | null,
    private classifiedAt: Date,
  ) {}

  static reconstitute(props: InactiveMemberRecordProps): InactiveMemberRecord { ... }

  /** 활동 데이터를 기반으로 비활동 등급을 분류한다 */
  classify(config: InactiveMemberClassifyParams): void {
    const prevGrade = this.grade;
    this.grade = this.determineGrade(config);
    if (this.grade !== prevGrade) {
      this.gradeChangedAt = new Date();
    }
    this.classifiedAt = new Date();
  }

  private determineGrade(config: InactiveMemberClassifyParams): InactiveMemberGrade | null {
    if (this.totalMinutes === 0) return InactiveMemberGrade.FULLY_INACTIVE;
    const threshold = config.lowActiveThresholdMin * config.periodDays;
    if (this.totalMinutes < threshold) return InactiveMemberGrade.LOW_ACTIVE;
    if (this.prevTotalMinutes > 0) {
      const ratio = 1 - config.decliningPercent / 100;
      if (this.totalMinutes < this.prevTotalMinutes * ratio) return InactiveMemberGrade.DECLINING;
    }
    return null;
  }

  get isInactive(): boolean { return this.grade !== null; }
  get currentGrade(): InactiveMemberGrade | null { return this.grade; }
}
```

**InactiveMemberConfig** — 설정 자체는 상태 전이가 없지만, 검증 규칙이 있을 수 있음

- ORM Entity만 infrastructure/로 이동
- `domain/inactive-member-config.types.ts`에 interface 정의

**InactiveMemberActionLog** — 감사 로그, 단순 기록

- ORM Entity만 infrastructure/로 이동
- `domain/inactive-member-action.types.ts`에 enum 정의

#### 2-2. newbie/domain/ — MEDIUM (3개)

**NewbieMission** — 상태 머신 (IN_PROGRESS → COMPLETED / FAILED / LEFT)

```
[Before] mission.service.ts
- 미션 완료 판정: totalSec >= targetPlaytimeSec → status = COMPLETED
- 미션 실패 판정: endDate < now && status === IN_PROGRESS → status = FAILED
- 미션 탈퇴 처리: status = LEFT
```

```
[After]
domain/
  newbie-mission.entity.ts       ← 상태 전이 메서드 포함
  newbie-mission.types.ts        ← enum MissionStatus
```

**도메인 Entity 설계:**

```typescript
// domain/newbie-mission.entity.ts
export class NewbieMission {
  private constructor(
    readonly guildId: string,
    readonly memberId: string,
    private memberName: string,
    private startDate: Date,
    private endDate: Date,
    private targetPlaytimeSec: number,
    private status: MissionStatus,
  ) {}

  static create(props: NewbieMissionCreateProps): NewbieMission { ... }
  static reconstitute(props: NewbieMissionProps): NewbieMission { ... }

  /** 누적 플레이타임이 목표를 달성하면 미션을 완료한다 */
  complete(currentPlaytimeSec: number): void {
    if (this.status !== MissionStatus.IN_PROGRESS) {
      throw new DomainException('진행 중인 미션만 완료할 수 있습니다.', 'MISSION_NOT_IN_PROGRESS');
    }
    if (currentPlaytimeSec < this.targetPlaytimeSec) {
      throw new DomainException('목표 플레이타임을 달성하지 못했습니다.', 'PLAYTIME_NOT_MET');
    }
    this.status = MissionStatus.COMPLETED;
  }

  /** 기한이 만료된 미션을 실패 처리한다 */
  expire(now: Date): void {
    if (this.status !== MissionStatus.IN_PROGRESS) return;
    if (now < this.endDate) {
      throw new DomainException('아직 기한이 만료되지 않았습니다.', 'NOT_EXPIRED');
    }
    this.status = MissionStatus.FAILED;
  }

  /** 서버를 떠난 경우 미션을 탈퇴 처리한다 */
  markAsLeft(): void {
    if (this.status !== MissionStatus.IN_PROGRESS) return;
    this.status = MissionStatus.LEFT;
  }

  get isInProgress(): boolean { return this.status === MissionStatus.IN_PROGRESS; }
  get isCompleted(): boolean { return this.status === MissionStatus.COMPLETED; }
  get currentStatus(): MissionStatus { return this.status; }
}
```

**MocoHuntingSession** — 유효성 검증 로직

```typescript
// domain/moco-hunting-session.entity.ts
export class MocoHuntingSession {
  ...
  /** 최소 지속 시간을 충족하면 유효 세션으로 마킹한다 */
  validate(minDurationMin: number, minCoPresenceMin: number): void {
    this.isValid = this.durationMin >= minDurationMin
      && this.durationMin >= minCoPresenceMin
      && this.newbieMemberIds.length > 0;
  }
}
```

**NewbieConfig** (148줄, HIGH) — 설정 Entity

- ORM Entity만 infrastructure/로 이동
- 섹션별 interface를 `domain/newbie-config.types.ts`로 분리
- 설정 검증 로직이 필요한 경우 추후 도메인 Entity 추가 (현재는 불필요)

---

### Phase 3: import 경로 일괄 수정 및 Module 업데이트

Phase 1, 2에서 파일 이동 후 깨지는 import를 수정한다.

| 작업 | 설명 |
|------|------|
| 3-1 | 각 `*.module.ts`에서 `TypeOrmModule.forFeature()` import 경로를 `infrastructure/*.orm-entity`로 변경 |
| 3-2 | application/ 서비스에서 `@InjectRepository()` 타입 참조를 `infrastructure/*.orm-entity`로 변경 |
| 3-3 | enum/interface import 경로를 `domain/*.types.ts`로 변경 |
| 3-4 | 다른 모듈에서 import하는 entity 경로 수정 (cross-module 의존) |
| 3-5 | MEDIUM Entity의 Mapper 클래스를 module providers에 등록 |
| 3-6 | presentation/ 컨트롤러의 DTO에서 enum import 경로 수정 |

**교차 모듈 의존 (주의 필요):**

| Entity | 사용하는 외부 모듈 |
|--------|-------------------|
| `VoiceDailyEntity` | newbie, voice-analytics, co-presence |
| `VoiceChannelHistory` | newbie, voice-analytics |
| `VoiceCoPresencePairDaily` | voice-analytics |
| `MocoHuntingDaily` | voice-analytics |
| `Channel` | voice (member → channel relation) |
| `Member` | voice (channel → member relation) |

---

### Phase 4: DomainException 전환

비즈니스 규칙 위반에 NestJS HttpException 대신 DomainException을 사용한다.

**대상:** Application Service에서 `BadRequestException`, `ConflictException`, `NotFoundException` 등을 throw하는 곳 중 **비즈니스 규칙 위반**에 해당하는 것만 전환한다.

| 구분 | DomainException으로 전환 | 그대로 유지 (HTTP 의미) |
|------|-------------------------|----------------------|
| "이미 등록된 채널입니다" | O (비즈니스 중복 규칙) | |
| "진행 중인 미션만 실패 처리 가능" | O (상태 전이 규칙) | |
| "이미 집계가 진행 중입니다" | O (동시성 규칙) | |
| "사용자를 찾을 수 없습니다" | | O (리소스 404) |
| "인증이 필요합니다" | | O (인증 401) |

**작업:**

| 작업 | 대상 파일 | 설명 |
|------|----------|------|
| 4-1 | `inactive-member-action.service.ts` | ConflictException → DomainException 전환 |
| 4-2 | `voice-excluded-channel.service.ts` | ConflictException → DomainException 전환 |
| 4-3 | `voice-daily-flush-service.ts` | Error → DomainException 전환 |
| 4-4 | `mission.service.ts` | BadRequestException → DomainException 전환 |
| 4-5 | `sticky-message-config.service.ts` | 비즈니스 규칙 위반 → DomainException 전환 |

---

### Phase 5: DataDeletionController 레이어 건너뛰기 수정

Controller에서 TypeORM Repository를 직접 주입하는 유일한 위반 사례를 수정한다.

```
[Before]
DataDeletionController → @InjectRepository(VoiceDailyEntity) → createQueryBuilder().delete()

[After]
DataDeletionController → DataDeletionService → Repository
```

| 작업 | 파일 | 설명 |
|------|------|------|
| 5-1 | `application/data-deletion.service.ts` 생성 | 삭제 로직을 Service로 이동 |
| 5-2 | `presentation/data-deletion.controller.ts` 수정 | Service 주입으로 변경 |
| 5-3 | `voice-channel.module.ts` 수정 | DataDeletionService를 providers에 추가 |

---

## 실행 순서 및 의존 관계

```
Phase 0 (공통 인프라)
  │
  ├─→ Phase 1 (LOW Entity 이동) ─── 모듈 단위로 독립 작업 가능
  │     │
  │     └─→ Phase 3 (import 경로 수정) ─── Phase 1 완료된 모듈부터 순차 적용
  │
  ├─→ Phase 2 (MEDIUM Entity 분리) ─── Phase 0 완료 후 착수
  │     │
  │     └─→ Phase 3 (import 경로 수정)
  │
  ├─→ Phase 4 (DomainException 전환) ─── Phase 0 완료 후 독립 작업 가능
  │
  └─→ Phase 5 (레이어 건너뛰기 수정) ─── 독립 작업 가능
```

**권장 실행 순서:**

1. **Phase 0** → 모든 작업의 전제 조건
2. **Phase 1 + 3** → 모듈 단위 반복 (가장 큰 작업량, 단순 반복)
3. **Phase 2 + 3** → 도메인 로직 이동 (설계 판단 필요)
4. **Phase 4** → DomainException 전환
5. **Phase 5** → DataDeletionController 수정

---

## 모듈별 작업 우선순위

영향 범위와 도메인 복잡도를 기준으로 정렬한다.

| 순위 | 모듈 | Entity 수 | 복잡도 | 교차 의존 | 이유 |
|------|------|-----------|--------|-----------|------|
| 1 | inactive-member | 3 | MEDIUM | 없음 | 도메인 로직 가장 명확, 독립적 |
| 2 | newbie | 7 | MEDIUM~HIGH | voice 의존 | Entity 수 최다, 상태 머신 있음 |
| 3 | channel/voice | 4 | LOW | 많음 | 교차 의존 파급 효과 큼 |
| 4 | channel/voice/co-presence | 3 | LOW | voice 의존 | voice 이후 연속 작업 |
| 5 | channel/auto | 3 | LOW | 없음 | 독립적 |
| 6 | status-prefix | 2 | LOW | 없음 | 독립적 |
| 7 | sticky-message | 1 | LOW | 없음 | 가장 단순 |
| 8 | monitoring | 1 | LOW | 없음 | 가장 단순 |
| 9 | voice-analytics | 2 | LOW | voice 의존 | voice 이후 |
| 10 | common | 2 | LOW | 없음 | 전역 모듈 |
| 11 | member | 1 | LOW | voice 의존 | voice 이후 |
| 12 | channel (parent) | 1 | LOW | voice 의존 | voice 이후 |

---

## 검증 기준

각 Phase 완료 시 다음을 확인한다:

| 검증 | 방법 |
|------|------|
| `domain/` 폴더에 TypeORM import 없음 | `grep -r "from 'typeorm'" apps/api/src/**/domain/` 결과 0건 |
| `domain/` 폴더에 NestJS import 없음 | `grep -r "from '@nestjs" apps/api/src/**/domain/` 결과 0건 |
| 빌드 성공 | `pnpm --filter @nexus/api build` 에러 0건 |
| 기존 테스트 통과 | `pnpm --filter @nexus/api test` (있는 경우) |
| Entity 관계 정상 | TypeORM migration:generate로 스키마 변경 없음 확인 |

---

## 주의사항

1. **DB 스키마 변경 없음** — ORM Entity의 `@Entity()`, `@Column()` 데코레이터는 그대로 유지. 파일 위치와 import만 변경.
2. **한 모듈씩 커밋** — 모듈 단위로 커밋하여 문제 발생 시 롤백이 쉽도록 한다.
3. **교차 모듈 의존** — `VoiceDailyEntity`를 다른 모듈에서 import하는 경우, re-export 또는 shared 모듈로 관리 검토.
4. **가이드의 실용 팁 준수** — "단순 조회는 TypeORM Repository 직접 주입 허용" 원칙에 따라 LOW 복잡도 Entity는 Repository 인터페이스를 강제하지 않는다.
