# 신입미션 플레이횟수 카운팅 옵션 — 백엔드 구현 계획

## 개요

`NewbieConfig`에 이미 추가된 두 컬럼(`playCountMinDurationMin`, `playCountIntervalMin`)을
실제 로직과 API에 연결한다. 작업은 세 파일로 한정되며, Entity/Migration은 이미 완료되어 있다.

---

## 현재 코드 상태 파악

### NewbieConfig 엔티티 (`newbie-config.entity.ts`)

두 컬럼이 이미 선언되어 있다.

```typescript
@Column({ type: 'int', nullable: true })
playCountMinDurationMin: number | null;

@Column({ type: 'int', nullable: true })
playCountIntervalMin: number | null;
```

### NewbieConfigSaveDto (`newbie-config-save.dto.ts`)

두 필드가 없다. 추가 필요.

### NewbieConfigRepository (`newbie-config.repository.ts`)

`upsert` 메서드에서 새 컬럼 두 개를 아직 처리하지 않는다. 추가 필요.

### MissionService.getPlayCount (`mission/mission.service.ts`)

현재 `COUNT(*)` 단순 집계만 수행한다.

```typescript
async getPlayCount(guildId, memberId, startDate, endDate): Promise<number> {
  // COUNT(*) 쿼리 반환
}
```

시그니처에 `config` 인자가 없으므로, 호출부(`buildMissionEmbed`)에서 config를 전달하도록 함께 수정한다.

### buildMissionEmbed의 getPlayCount 호출부

```typescript
const [playtimeSec, playCount] = await Promise.all([
  this.getPlaytimeSec(...),
  this.getPlayCount(guildId, mission.memberId, mission.startDate, mission.endDate),
]);
```

config 객체가 이미 `buildMissionEmbed`의 3번째 인자로 전달되고 있으므로,
`getPlayCount` 호출 시 config를 추가로 넘기면 된다.

### newbie-template.constants.ts

`{playCount}` 변수가 `MISSION_ITEM_ALLOWED_VARS`에 이미 포함되어 있고,
`DEFAULT_MISSION_ITEM_TEMPLATE`에도 `{playCount}회`로 사용 중이다. **변경 불필요**.

---

## 구현 작업 목록

### 작업 1: DTO 필드 추가

**파일**: `apps/api/src/newbie/dto/newbie-config-save.dto.ts`

`missionTargetPlaytimeHours` 필드 블록 바로 아래에 두 필드를 추가한다.
기존 정수형 선택 필드(`missionDurationDays` 등)와 동일한 데코레이터 패턴을 따른다.

추가할 내용:

```typescript
@IsOptional()
@IsInt()
@Min(1)
playCountMinDurationMin?: number | null;

@IsOptional()
@IsInt()
@Min(1)
playCountIntervalMin?: number | null;
```

### 작업 2: Repository upsert 수정

**파일**: `apps/api/src/newbie/infrastructure/newbie-config.repository.ts`

`upsert` 메서드의 기존 레코드 업데이트 블록(`if (config)`)과 신규 생성 블록(`else`)
양쪽 모두에 두 필드 할당을 추가한다.

기존 레코드 업데이트 블록에서 `missionTargetPlaytimeHours` 할당 바로 다음에 삽입:
```typescript
config.playCountMinDurationMin = dto.playCountMinDurationMin ?? null;
config.playCountIntervalMin = dto.playCountIntervalMin ?? null;
```

신규 생성 블록의 `repo.create({...})` 객체 리터럴에서 `missionTargetPlaytimeHours` 다음에 삽입:
```typescript
playCountMinDurationMin: dto.playCountMinDurationMin ?? null,
playCountIntervalMin: dto.playCountIntervalMin ?? null,
```

### 작업 3: getPlayCount 로직 확장

**파일**: `apps/api/src/newbie/mission/mission.service.ts`

#### 3-1. getPlayCount 시그니처 변경

`config` 파라미터를 추가한다. `NewbieConfig`는 이미 import되어 있다.

변경 전:
```typescript
async getPlayCount(
  guildId: string,
  memberId: string,
  startDate: string,
  endDate: string,
): Promise<number>
```

변경 후:
```typescript
async getPlayCount(
  guildId: string,
  memberId: string,
  startDate: string,
  endDate: string,
  config: NewbieConfig,
): Promise<number>
```

#### 3-2. getPlayCount 내부 로직 교체

현재 `COUNT(*)` 쿼리를 `SELECT joinedAt, leftAt` 조회로 교체하고
애플리케이션 레이어에서 두 단계 필터를 적용한다.

PRD 명세 쿼리 (`voice_channel_history`):
- `m.discordMemberId = :memberId`
- `vch.joinedAt BETWEEN :startDatetime AND :endDatetime`
- `ORDER BY vch.joinedAt ASC`
- 컬럼 선택: `joinedAt`, `leftAt`

주의: 엔티티 프로퍼티명은 `joinedAt`이고 DB 컬럼명은 `joinAt`이다(엔티티 정의 참고).
`createQueryBuilder`에서는 엔티티 프로퍼티명(`vch.joinedAt`)을 사용한다.

구현 로직:

```typescript
async getPlayCount(
  guildId: string,
  memberId: string,
  startDate: string,
  endDate: string,
  config: NewbieConfig,
): Promise<number> {
  const startDatetime = this.yyyymmddToKSTDate(startDate, 'start');
  const endDatetime = this.yyyymmddToKSTDate(endDate, 'end');

  // 후보 세션 조회 (joinedAt, leftAt)
  const rows = await this.voiceHistoryRepo
    .createQueryBuilder('vch')
    .select(['vch.joinedAt', 'vch.leftAt'])
    .innerJoin('vch.member', 'm')
    .where('m.discordMemberId = :memberId', { memberId })
    .andWhere('vch.joinedAt BETWEEN :startDatetime AND :endDatetime', {
      startDatetime,
      endDatetime,
    })
    .orderBy('vch.joinedAt', 'ASC')
    .getMany();

  // 두 옵션 모두 null이면 단순 COUNT 반환
  if (config.playCountMinDurationMin === null && config.playCountIntervalMin === null) {
    return rows.length;
  }

  // Step 1: 최소 참여시간 필터 (playCountMinDurationMin NOT NULL)
  let sessions = rows;
  if (config.playCountMinDurationMin !== null) {
    const minMs = config.playCountMinDurationMin * 60 * 1000;
    sessions = sessions.filter((row) => {
      if (!row.leftAt) return false; // 퇴장 기록 없는 세션은 제외
      return row.leftAt.getTime() - row.joinedAt.getTime() >= minMs;
    });
  }

  if (sessions.length === 0) return 0;

  // Step 2: 시간 간격 병합 (playCountIntervalMin NOT NULL)
  if (config.playCountIntervalMin === null) {
    return sessions.length;
  }

  const intervalMs = config.playCountIntervalMin * 60 * 1000;
  let count = 1;
  let baseJoinedAt = sessions[0].joinedAt.getTime();

  for (let i = 1; i < sessions.length; i++) {
    const currentJoinedAt = sessions[i].joinedAt.getTime();
    if (currentJoinedAt - baseJoinedAt >= intervalMs) {
      // 간격 초과 → 새로운 1회로 카운트
      count++;
      baseJoinedAt = currentJoinedAt;
    }
    // 간격 이내 → 동일 1회로 병합 (baseJoinedAt 갱신 없음)
  }

  return count;
}
```

**병합 기준 시각 해설**:
- PRD 명세: "앞 세션의 `joinAt` 기준"으로 병합 여부 판단
- 즉, 기준점(`baseJoinedAt`)은 병합된 그룹의 첫 세션 `joinedAt`으로 고정하며, 이후 세션이 기준점 + intervalMs 이내이면 병합, 초과이면 새 카운트 + 기준점 교체

#### 3-3. buildMissionEmbed 내 getPlayCount 호출부 수정

```typescript
const [playtimeSec, playCount] = await Promise.all([
  this.getPlaytimeSec(guildId, mission.memberId, mission.startDate, mission.endDate),
  this.getPlayCount(guildId, mission.memberId, mission.startDate, mission.endDate, config),
]);
```

`config`는 `buildMissionEmbed`의 3번째 파라미터로 이미 존재하므로 그대로 전달한다.

---

## 기존 코드와의 충돌 검토

| 항목 | 충돌 여부 | 근거 |
|------|----------|------|
| DTO 필드 추가 | 없음 | 기존 필드와 독립적, `@IsOptional()` 사용 |
| Repository upsert | 없음 | 누락 필드 보충이므로 기존 동작 영향 없음 |
| getPlayCount 시그니처 변경 | 호출부 1곳 수정 필요 | `buildMissionEmbed` 내부 호출 1곳만 존재 |
| `voiceHistoryRepo` SELECT 변경 | 없음 | 기존 COUNT 쿼리를 교체하는 것이며 다른 곳에서 `getPlayCount`를 호출하는 곳 없음 |
| `newbie-template.constants.ts` | 변경 불필요 | `{playCount}` 변수 이미 정의됨 |

`getPlayCount`의 외부 호출자 확인: `buildMissionEmbed` 내에서만 호출되고 있으며, 스케줄러(`mission.scheduler.ts`)는 `getPlaytimeSec`만 호출하고 `getPlayCount`는 호출하지 않는다. 따라서 시그니처 변경 영향 범위는 `buildMissionEmbed` 단 1곳이다.

---

## 구현 순서

1. `newbie-config-save.dto.ts` — 필드 2개 추가
2. `newbie-config.repository.ts` — upsert 양쪽 블록에 필드 2개 추가
3. `mission/mission.service.ts`
   - `getPlayCount` 시그니처에 `config: NewbieConfig` 파라미터 추가
   - `getPlayCount` 내부 로직 교체 (세션 조회 + 2단계 필터)
   - `buildMissionEmbed` 내 호출부에 `config` 인자 추가

---

## 엣지 케이스 처리

| 케이스 | 처리 방법 |
|--------|----------|
| `leftAt`이 null인 세션 (현재 접속 중) | 최소 참여시간 필터에서 제외 (`return false`) |
| 두 옵션 모두 null | 전체 세션 수 그대로 반환 (기존 동작과 동일) |
| Step 1 필터 후 세션 0개 | `0` 반환 |
| Step 2에서 단일 세션 | `1` 반환 |
