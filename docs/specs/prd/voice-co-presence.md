# Voice Co-Presence 도메인 PRD

> 신규 도메인. 기존 모코코 사냥(F-NEWBIE-003)의 동시접속 추적 로직을 범용화하여 분리한다.

## 개요

디스코드 서버의 **모든 음성 채널에서 누가 누구와 함께 있었는지**를 범용적으로 추적·기록하는 도메인이다.
기존 `MocoScheduler`는 "모코코(신입) + 사냥꾼(기존멤버)"라는 특수 조건에서만 동시접속을 추적했으나, 이 도메인은 **모든 사용자 쌍**의 동시접속을 기록하여 다양한 소비자(모코코 사냥, 사용자 관계 분석 등)가 활용할 수 있도록 한다.

## 배경 및 동기

### 현재 문제점

1. **모코코 전용 추적**: `MocoScheduler`가 60초 폴링으로 음성 채널을 순회하며 **모코코 조건에 맞는 사용자만** 추적한다. 범용 동시접속 데이터가 존재하지 않음.
2. **중복 가능성**: 향후 "사용자 관계 분석", "친밀도 그래프" 등의 기능을 추가하면 유사한 폴링 로직이 중복 생성될 수 있다.
3. **Voice 도메인과의 괴리**: Voice 도메인은 이벤트 기반으로 개별 유저 세션을 추적하지만, "누가 누구와 함께 있었는지"는 기록하지 않는다.

### 리팩토링 목표

- **범용 동시접속 추적기**를 Voice 도메인 내에 신설하여, 모든 사용자의 음성 채널 동시접속을 기록한다.
- **모코코 사냥**은 이 범용 데이터를 소비하는 소비자로 전환한다.
- **사용자 관계 분석** 기능의 데이터 기반을 마련한다 (쌍 단위 일별 집계).

## 관련 모듈

- `apps/api/src/channel/voice/co-presence/` — **신규** 동시접속 추적 핵심 로직
- `apps/api/src/channel/voice/` — 기존 Voice 도메인 (이벤트 디스패처, 제외 채널 등)
- `apps/api/src/newbie/moco/` — 모코코 사냥 (소비자로 전환)
- `apps/api/src/event/voice/` — 음성 이벤트 핸들러

## 아키텍처

```
[CoPresenceScheduler] ← 매 60초 폴링
    │
    ├──► 모든 길드의 음성 채널 순회
    ├──► 제외 채널 필터링 (VoiceExcludedChannelService)
    ├──► 채널별 사용자 목록 스냅샷 생성
    │
    ├──► [CoPresenceService] ← 세션 상태 관리 + DB 저장 + 이벤트 발행
    │       ├──► 세션 시작/계속/종료 (인메모리 상태 관리)
    │       ├──► DB 저장 (세션 + 일별 집계 + 쌍 일별 배치 upsert)
    │       └──► EventEmitter 이벤트 발행
    │
    ├──► [EventEmitter] ← 'co-presence.session.ended' 이벤트
    │       │
    │       └──► [MocoEventHandler] ← 소비자: 모코코 조건 판정, Redis 랭크 갱신
    │
    └──► [EventEmitter] ← 'co-presence.tick' 이벤트
            │
            └──► [MocoEventHandler] ← 소비자: 진행 중 세션 실시간 Redis 누적
```

## 기능 상세

### F-COPRESENCE-001: 음성 채널 동시접속 스냅샷 수집

- **트리거**: 스케줄러가 매 60초마다 실행
- **동작**:
  1. 봇이 참여 중인 모든 길드의 음성 채널을 순회
  2. `VoiceExcludedChannelService.isExcludedChannel()`로 제외 채널 필터링
  3. 채널당 2명 이상의 사용자가 있는 경우에만 처리
  4. 봇 유저 제외
  5. 채널별 사용자 목록(스냅샷)을 `VoiceCoPresenceService`에 전달

### F-COPRESENCE-002: 채널 동시접속 세션 추적

- **트리거**: F-COPRESENCE-001에서 전달된 스냅샷
- **동작**:
  1. 채널별로 현재 사용자 목록과 이전 tick의 사용자 목록을 비교
  2. **세션 시작**: 사용자가 새로 채널에 합류 (또는 채널에 2명 이상이 된 시점)
  3. **세션 계속**: 이전 tick에도 같은 채널에 있던 사용자에 대해 1분 누적
  4. **세션 종료**: 사용자가 채널을 떠나거나, 채널에 1명만 남은 시점
- **세션 데이터 구조** (인메모리):
  ```
  ActiveCoPresenceSession {
    guildId: string
    channelId: string
    userId: string           // 추적 대상 사용자
    startedAt: Date
    accumulatedMinutes: number
    peersSeen: Set<string>   // 세션 중 함께 있었던 모든 사용자 ID
    peerMinutes: Map<string, number>  // 사용자별 동시접속 시간(분)
  }
  ```
- **tick 이벤트**: 매 tick마다 `co-presence.tick` 이벤트를 발행하여, 소비자가 `@OnEvent`로 현재 스냅샷(guildId, channelId, 사용자 목록)을 수신한다. 소비자는 이를 통해 진행 중 세션의 실시간 데이터를 갱신할 수 있다.

### F-COPRESENCE-003: 세션 종료 처리 및 이벤트 발행

- **트리거**: 사용자가 채널을 떠나거나, 채널에 1명만 남거나, 봇 종료 시
- **동작**:
  1. 세션 데이터를 `VoiceCoPresenceSession` 테이블에 저장 (`peerMinutes` 포함)
  2. `VoiceCoPresencePairDaily` 테이블에 쌍 단위 일별 집계 upsert
  3. `VoiceCoPresenceDaily` 테이블에 사용자 단위 일별 집계 upsert
  4. NestJS `EventEmitter2.emitAsync()`로 `co-presence.session.ended` 이벤트 발행 — 모든 핸들러의 비동기 처리 완료를 await하여 정합성 보장
  5. 이벤트 페이로드:
     ```
     CoPresenceSessionEndedEvent {
       guildId: string
       channelId: string
       userId: string
       startedAt: Date
       endedAt: Date
       durationMin: number
       peerIds: string[]        // 세션 중 함께 있었던 사용자 목록
       peerMinutes: Record<string, number>  // 사용자별 동시접속 시간
     }
     ```
- **제약**: 최소 시간 조건 없음 (1분이라도 기록). 최소 시간 필터는 소비자가 자체 판단.

### F-COPRESENCE-004: 일별 동시접속 집계

- **트리거**: 세션 종료 시 (F-COPRESENCE-003)
- **동작**:
  1. `VoiceCoPresenceDaily` 테이블에 사용자 단위 일별 집계 upsert
     - 집계 항목: 채널 체류 시간(분), 세션 수
     - `uniquePeerCount`는 저장하지 않음 — 필요 시 `PairDaily`에서 `COUNT(DISTINCT peerId)` 조회
  2. `VoiceCoPresencePairDaily` 테이블에 쌍 단위 일별 집계 upsert
     - 집계 항목: 동시접속 시간(분), 세션 수
- **복합키**:
  - Daily: `(guildId, userId, date)`
  - PairDaily: `(guildId, userId, peerId, date)`

### F-COPRESENCE-005: 봇 종료/재시작 시 세션 정리

- **트리거**: `onApplicationShutdown` / `onApplicationBootstrap`
- **동작**:
  1. 종료 시: 모든 활성 세션을 강제 종료 (F-COPRESENCE-003 동작 수행)
  2. 시작 시: 인메모리 세션 맵 초기화, Discord ready 후 첫 tick에서 자연스럽게 새 세션 시작

### F-COPRESENCE-006: 세션 이력 자동 삭제

- **트리거**: 매일 자정 (KST) 스케줄러 실행
- **동작**:
  1. `VoiceCoPresenceSession` 테이블에서 `endedAt < NOW() - 90일`인 레코드 일괄 삭제
  2. 삭제 건수 로그 출력
- **제약**: 일별 집계 테이블(`Daily`, `PairDaily`)은 삭제하지 않음 (영구 보존)

## 데이터 모델

### VoiceCoPresenceSession (`voice_co_presence_session`)

사용자 단위의 동시접속 세션 이력을 저장한다. 90일 보존 후 자동 삭제.

| 컬럼 | 타입 | 제약조건 | 설명 |
|-------|------|----------|------|
| `id` | `int` | PK, AUTO_INCREMENT | 내부 ID |
| `guildId` | `varchar` | NOT NULL | 디스코드 서버 ID |
| `userId` | `varchar` | NOT NULL | 추적 대상 사용자 디스코드 ID |
| `channelId` | `varchar` | NOT NULL | 동시접속이 발생한 음성 채널 ID |
| `startedAt` | `timestamp` | NOT NULL | 동시접속 시작 시각 |
| `endedAt` | `timestamp` | NOT NULL | 동시접속 종료 시각 |
| `durationMin` | `int` | NOT NULL | 동시접속 시간(분) |
| `peerIds` | `json` | NOT NULL | 세션 중 함께 있었던 사용자 ID 배열 |
| `peerMinutes` | `json` | NOT NULL | 사용자별 동시접속 시간 (`{"userId1": 30, "userId2": 60}`) |
| `createdAt` | `timestamp` | NOT NULL, DEFAULT now() | 생성일 |

**인덱스**:
- `IDX_copresence_session_guild_user` — `(guildId, userId)` — 사용자별 세션 조회
- `IDX_copresence_session_guild_started` — `(guildId, startedAt)` — 기간별 세션 조회
- `IDX_copresence_session_ended` — `(endedAt)` — 자동 삭제 스케줄러용

### VoiceCoPresenceDaily (`voice_co_presence_daily`)

사용자별 일별 동시접속 집계 데이터. 영구 보존.

| 컬럼 | 타입 | 제약조건 | 설명 |
|-------|------|----------|------|
| `guildId` | `varchar` | PK | 디스코드 서버 ID |
| `userId` | `varchar` | PK | 사용자 디스코드 ID |
| `date` | `date` | PK | 날짜 |
| `channelMinutes` | `int` | NOT NULL, DEFAULT `0` | 당일 다른 사용자와 함께한 채널 체류 시간(분) |
| `sessionCount` | `int` | NOT NULL, DEFAULT `0` | 당일 세션 수 |

**인덱스**:
- PK: `(guildId, userId, date)`
- `IDX_copresence_daily_guild_date` — `(guildId, date)` — 기간별 조회

### VoiceCoPresencePairDaily (`voice_co_presence_pair_daily`)

사용자 쌍 단위 일별 동시접속 집계. 관계 분석의 핵심 테이블. 영구 보존.

| 컬럼 | 타입 | 제약조건 | 설명 |
|-------|------|----------|------|
| `guildId` | `varchar` | PK | 디스코드 서버 ID |
| `userId` | `varchar` | PK | 사용자 A |
| `peerId` | `varchar` | PK | 사용자 B |
| `date` | `date` | PK | 날짜 |
| `minutes` | `int` | NOT NULL, DEFAULT `0` | 당일 동시접속 시간(분) |
| `sessionCount` | `int` | NOT NULL, DEFAULT `0` | 당일 세션 수 |

**인덱스**:
- PK: `(guildId, userId, peerId, date)`
- `IDX_copresence_pair_guild_user_date` — `(guildId, userId, date)` — 특정 사용자의 기간별 관계 조회
- `IDX_copresence_pair_guild_date` — `(guildId, date)` — 서버 전체 기간별 관계 조회

**관계 분석 쿼리 예시**:
```sql
-- 유저 A의 친밀도 TOP 5 (최근 30일)
SELECT "peerId", SUM(minutes) AS "totalMin"
FROM voice_co_presence_pair_daily
WHERE "guildId" = :guildId AND "userId" = :userId
  AND date BETWEEN :from AND :to
GROUP BY "peerId" ORDER BY "totalMin" DESC LIMIT 5;

-- 유저 A와 B의 총 동시접속 시간
SELECT SUM(minutes)
FROM voice_co_presence_pair_daily
WHERE "guildId" = :guildId AND "userId" = :userA AND "peerId" = :userB;
```

**데이터 방향성**: A와 B가 함께 있으면, `(userId=A, peerId=B)`와 `(userId=B, peerId=A)` **양방향 모두 저장**한다. 각 사용자의 세션 종료 시점에 자신의 peerMinutes를 기반으로 upsert하므로, 자연스럽게 양방향 레코드가 생성된다.

## 모코코 사냥 소비자 전환 (F-NEWBIE-003 리팩토링)

### 변경 범위

| 컴포넌트 | 현재 | 변경 후 |
|-----------|------|---------|
| `MocoScheduler` | 60초 폴링 + 세션 추적 + 모코코 판정 + DB/Redis 저장 | **삭제** — 폴링/세션 추적 역할 제거 |
| `MocoEventHandler` (신규) | — | `co-presence.session.ended` + `co-presence.tick` 이벤트 수신. 모코코 조건 판정, DB/Redis 저장 |
| `CoPresenceScheduler` (신규) | — | 60초 폴링, 모든 사용자 스냅샷 수집, 세션 관리 |
| `MocoService` | 순위 Embed 표시 | 변경 없음 |
| `MocoResetScheduler` | 기간별 리셋 | `MocoScheduler.flushGuildSessions()` 호출을 `CoPresenceScheduler.flushGuildSessions()`로 변경 |

### MocoEventHandler 동작

**세션 종료 이벤트 처리** (`co-presence.session.ended`):
1. `NewbieConfig` 조회 → `mocoEnabled` 확인
2. 이벤트의 `userId`가 사냥꾼 조건에 맞는지 확인 (봇 제외, 신입 여부 판정)
3. `peerIds` 중 모코코(신입) 조건에 맞는 사용자 필터링
4. 모코코가 1명 이상이면:
   a. `MocoHuntingSession` DB 저장
   b. 최소 동시접속 시간(`mocoMinCoPresenceMin`) 유효성 판정
   c. 유효 세션: Redis에 채널분/모코코별분/세션수 **한번에 갱신** (롤백 불필요)
   d. 무효 세션: Redis 조작 없음
   e. 플레이횟수 카운팅 옵션 적용
   f. 점수 재계산 및 Redis 랭크 갱신
5. 모코코가 0명이면 무시 (범용 세션은 이미 저장됨)

**tick 이벤트 처리** (`@OnEvent('co-presence.tick')`, 매 60초):
1. 스냅샷에서 현재 채널 내 모코코 존재 여부 확인
2. 모코코가 있는 사냥꾼에 대해 Redis에 1분 실시간 누적 (`incrMocoChannelMinutes`, `incrMocoMinutes`)
3. 세션 종료 시 이벤트 핸들러에서 **이미 누적된 분은 중복 적립하지 않도록** 세션 종료 이벤트에서는 Redis 분 누적을 생략하고 유효성 판정 + 세션수/랭크만 갱신

### MocoResetScheduler의 flush 정합성

기존: `MocoScheduler.flushGuildSessions()` → 직접 세션 종료
변경: `CoPresenceScheduler.flushGuildSessions()` → 세션 종료 → `emitAsync()` → 모든 핸들러 await 완료 → 리턴

`EventEmitter2.emitAsync()`를 사용하여 모든 `@OnEvent` 핸들러의 비동기 처리가 완료될 때까지 await한다. 이를 통해 flush 후 Redis 키 삭제 시점에 모든 모코코 데이터가 이미 갱신되어 있음을 보장한다. (주의: `emit()`은 async 핸들러의 완료를 기다리지 않으므로 반드시 `emitAsync()`를 사용해야 한다.)

### 데이터 정합성

- 범용 세션(`VoiceCoPresenceSession`)은 **항상** 저장된다 (최소 시간 조건 없음)
- 모코코 세션(`MocoHuntingSession`)은 모코코 조건을 통과한 경우 저장 (유효/무효 모두)
- Redis 모코코 분 누적은 `co-presence.tick` 이벤트에서 실시간 처리, 세션수/랭크는 `co-presence.session.ended` 이벤트에서 처리

## 기존 기능과의 관계

| 기존 기능 | 관계 | 설명 |
|-----------|------|------|
| Voice 세션 추적 (F-VOICE-001~006) | **독립** | 개별 유저 입퇴장 + 시간 기록. Co-Presence는 "함께 있었는지"를 기록 |
| 음성 제외 채널 (F-VOICE-013~016) | **연동** | Co-Presence 스냅샷 수집 시 제외 채널 필터링 적용 |
| 모코코 사냥 (F-NEWBIE-003) | **소비자** | Co-Presence 이벤트(`co-presence.session.ended`, `co-presence.tick`)를 `@OnEvent`로 수신하여 모코코 조건 판정 |
| 미션 추적 (F-NEWBIE-002) | **무관** | 미션은 VoiceDailyEntity를 직접 조회. 변경 없음 |

## 마이그레이션 전략

1. **Phase 1**: `CoPresenceScheduler` + `VoiceCoPresenceService` 신설, 범용 세션/일별/쌍 일별 테이블 생성
2. **Phase 2**: `MocoEventHandler` 신설, `@OnEvent`로 `co-presence.session.ended` + `co-presence.tick` 이벤트 수신하여 모코코 로직 전환
3. **Phase 3**: 기존 `MocoScheduler`의 폴링/세션 추적 코드 삭제, 이벤트 기반으로 완전 전환
4. **Phase 4**: (향후) 사용자 관계 분석 기능 구현 — `VoiceCoPresencePairDaily` 활용

## 보존 정책

| 테이블 | 보존 기간 | 삭제 방식 | 사유 |
|--------|-----------|-----------|------|
| `VoiceCoPresenceSession` | **90일** | 매일 자정 스케줄러 자동 삭제 | 상세 세션 이력. 일별 집계가 장기 분석을 대체 |
| `VoiceCoPresenceDaily` | **영구** | 삭제 안 함 | 사용자별 일별 요약. 데이터 크기 작음 |
| `VoiceCoPresencePairDaily` | **영구** | 삭제 안 함 | 관계 분석 핵심 데이터 |

## 제약사항

- 폴링 주기는 기존과 동일하게 **60초** 유지 (더 짧게 하면 Discord API 부하 증가)
- Co-Presence 세션은 **사용자 단위**로 생성 (채널에 5명이면 5개 세션). 쌍 단위가 아님.
- `PairDaily`는 양방향 저장이므로 채널에 N명이면 세션 종료 시 N-1개의 pair 레코드가 배치 upsert됨 (단건이 아닌 한 번의 쿼리로 처리)
- 대규모 서버(수백 명 동시 음성)에서 `PairDaily` 행 수가 O(N²)으로 증가할 수 있으므로, 향후 파티션 또는 샤딩 검토 필요
