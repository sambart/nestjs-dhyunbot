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
4. **Phase 4**: 사용자 관계 분석 대시보드 구현 — `VoiceCoPresencePairDaily` / `VoiceCoPresenceDaily` 활용 (F-COPRESENCE-007 ~ F-COPRESENCE-013)

## 관계 분석 대시보드 (Phase 4)

웹 대시보드(`apps/web`)에 Co-Presence 도메인 데이터를 시각화하는 관계 분석 전용 페이지를 제공한다. 대규모 서버를 고려한 성능 제한과 인터랙티브 시각화를 갖춘다.

### 관련 모듈 (Phase 4)

- **백엔드**: `apps/api/src/channel/voice/co-presence/` — 기존 `CoPresenceModule`에 `CoPresenceAnalyticsController` + `CoPresenceAnalyticsService` 추가
- **프론트엔드**: `apps/web/app/dashboard/guild/[guildId]/co-presence/` — 신규 페이지

### F-COPRESENCE-007: 관계 분석 요약 카드

- **라우트**: `/dashboard/guild/[guildId]/co-presence`
- **인증**: JwtAuthGuard 적용
- **기간 선택**: 7일 / 30일 / 90일 프리셋 버튼 (기본값 30일)
- **API**: `GET /api/guilds/:guildId/co-presence/summary?days=30`
- **표시 항목**:

| 카드 | 계산 방법 |
|------|-----------|
| 활성 멤버 수 | `PairDaily`에서 기간 내 `COUNT(DISTINCT userId)` |
| 총 관계 수 | `PairDaily`에서 `userId < peerId` 조건으로 중복 제거한 쌍 수 |
| 총 동시접속 시간 | `Daily`에서 기간 내 `SUM(channelMinutes)` / 2 (양방향 저장 보정) |
| 평균 관계 수/인 | 총 관계 수 × 2 / 활성 멤버 수 |

- **응답 스키마**:
  ```json
  {
    "activeMemberCount": number,
    "totalPairCount": number,
    "totalCoPresenceMinutes": number,
    "avgPairsPerMember": number
  }
  ```

### F-COPRESENCE-008: 네트워크 그래프 시각화

- **API**: `GET /api/guilds/:guildId/co-presence/graph?days=30&minMinutes=10`
- **프론트엔드 라이브러리**: `@react-sigma/core` + `graphology`
- **노드 표현**:
  - 크기: 해당 사용자의 기간 내 `SUM(channelMinutes)` 비례 (최소 8px, 최대 40px)
  - 색상: graphology의 Louvain 알고리즘 기반 클러스터 자동 분류 (클러스터별 고정 팔레트)
  - 레이블: `userName` (기본 숨김, 호버 시 표시)
- **엣지 표현**:
  - 두께: 쌍의 `SUM(minutes)` 비례 (최소 1px, 최대 8px)
  - 방향 없음 (undirected)
- **인터랙션**:
  - 줌/패닝 (sigma.js 기본 제공)
  - 노드 클릭: 해당 유저와 연결된 엣지/노드만 하이라이트, 나머지 투명도 낮춤
  - 최소 임계값 슬라이더: 슬라이더 값(분) 변경 시 `minMinutes` 파라미터로 재조회
- **대규모 서버 대비**:
  - 노드 상한: 동시접속 시간 기준 상위 **50명**
  - 백엔드에서 상위 50명 필터링 후 해당 사용자 간 엣지만 반환
- **응답 스키마**:
  ```json
  {
    "nodes": [
      { "userId": string, "userName": string, "totalMinutes": number }
    ],
    "edges": [
      { "userA": string, "userB": string, "totalMinutes": number, "sessionCount": number }
    ]
  }
  ```

### F-COPRESENCE-009: 친밀도 TOP N 패널

- **API**: `GET /api/guilds/:guildId/co-presence/top-pairs?days=30&limit=10`
- **정렬 기준**: `PairDaily`에서 `userId < peerId` 조건으로 중복 제거 후 `SUM(minutes)` 내림차순 상위 N쌍
- **표시 항목** (행 단위):
  - 유저A 아바타 + 닉네임
  - ↔ 구분 아이콘
  - 유저B 아바타 + 닉네임
  - 총 동시접속 시간 (분 → "X시간 Y분" 포맷)
  - 세션 수
- **응답 스키마**:
  ```json
  [
    {
      "userA": { "userId": string, "userName": string, "avatarUrl": string | null },
      "userB": { "userId": string, "userName": string, "avatarUrl": string | null },
      "totalMinutes": number,
      "sessionCount": number
    }
  ]
  ```
- **아바타 출처**: Discord CDN (`https://cdn.discordapp.com/avatars/{userId}/{avatarHash}.png`). `Member` 테이블의 `avatarUrl` 참조. null 가능 (기본 아바타 대체).

### F-COPRESENCE-010: 고립 멤버 감지

- **API**: `GET /api/guilds/:guildId/co-presence/isolated?days=30`
- **조건**: 기간 내 `VoiceCoPresenceDaily` 레코드는 존재하지만 (`channelMinutes > 0`) 동일 기간 `VoiceCoPresencePairDaily` 레코드가 전혀 없는 사용자 목록
  - 즉, 음성 채널에는 접속했지만 단 한 번도 다른 사람과 동시에 있지 않은 멤버
- **표시 항목**: 사용자명, 기간 내 총 음성 접속 시간(분), 마지막 음성 접속일
- **응답 스키마**:
  ```json
  [
    {
      "userId": string,
      "userName": string,
      "totalVoiceMinutes": number,
      "lastVoiceDate": string
    }
  ]
  ```

### F-COPRESENCE-011: 관계 상세 테이블

- **API**: `GET /api/guilds/:guildId/co-presence/pairs?days=30&search=&page=1&limit=20`
- **표시 항목** (컬럼):

| 컬럼 | 설명 |
|------|------|
| 유저A | 닉네임 |
| 유저B | 닉네임 |
| 총 동시접속 시간 | 분 → "X시간 Y분" |
| 세션 수 | 합계 |
| 마지막 함께한 날짜 | `PairDaily.date` 최대값 |

- **필터 및 페이지네이션**:
  - 유저명 검색: `search` 파라미터, `userName`에 LIKE 매칭 (A 또는 B 유저명 모두 검색)
  - 페이지네이션: 오프셋 기반, 기본 20건/페이지
  - 정렬: 총 동시접속 시간 내림차순 기본. 컬럼 헤더 클릭으로 오름차순/내림차순 토글
- **응답 스키마**:
  ```json
  {
    "total": number,
    "page": number,
    "limit": number,
    "items": [
      {
        "userA": { "userId": string, "userName": string },
        "userB": { "userId": string, "userName": string },
        "totalMinutes": number,
        "sessionCount": number,
        "lastDate": string
      }
    ]
  }
  ```
- **중복 제거**: `userId < peerId` 조건으로 단방향 쌍만 조회 (양방향 레코드 중복 제거)

### F-COPRESENCE-012: 일별 동시접속 추이 차트

- **API**: `GET /api/guilds/:guildId/co-presence/daily-trend?days=30`
- **데이터 소스**: `VoiceCoPresenceDaily`에서 기간 내 날짜별 `SUM(channelMinutes) / 2` (양방향 보정)
- **차트**: Recharts `AreaChart` (기존 모니터링 페이지 패턴 동일)
  - X축: 날짜 (YYYY-MM-DD)
  - Y축: 서버 전체 동시접속 총 시간 (분)
  - 기간 내 데이터가 없는 날짜는 0으로 채움
- **응답 스키마**:
  ```json
  [{ "date": string, "totalMinutes": number }]
  ```

### F-COPRESENCE-013: 특정 쌍 일별 상세 모달

- **API**: `GET /api/guilds/:guildId/co-presence/pair-detail?userA=&userB=&days=30`
- **트리거**: F-COPRESENCE-011 관계 테이블에서 행 클릭
- **표시 방식**: 모달(오버레이) — 페이지 이동 없이 현재 페이지 위에 표시
- **차트**: Recharts `BarChart`
  - X축: 날짜
  - Y축: 해당 쌍의 당일 동시접속 시간 (분)
- **모달 헤더**: 유저A 닉네임 ↔ 유저B 닉네임, 기간 내 총 시간 요약
- **응답 스키마**:
  ```json
  {
    "userA": { "userId": string, "userName": string },
    "userB": { "userId": string, "userName": string },
    "totalMinutes": number,
    "dailyData": [{ "date": string, "minutes": number }]
  }
  ```
- **쿼리**: `userId IN (userA, userB) AND peerId IN (userA, userB)` 로 단방향 집계 (중복 방지)

### 백엔드 API 요약 (Phase 4)

컨트롤러: `CoPresenceAnalyticsController`
기본 경로: `api/guilds/:guildId/co-presence`
인증: 모든 엔드포인트에 `JwtAuthGuard` 적용

| 엔드포인트 | 메서드 | 기능 ID | 쿼리 파라미터 |
|-----------|--------|---------|--------------|
| `/summary` | GET | F-COPRESENCE-007 | `days` (기본 30) |
| `/graph` | GET | F-COPRESENCE-008 | `days`, `minMinutes` (기본 10) |
| `/top-pairs` | GET | F-COPRESENCE-009 | `days`, `limit` (기본 10) |
| `/isolated` | GET | F-COPRESENCE-010 | `days` (기본 30) |
| `/pairs` | GET | F-COPRESENCE-011 | `days`, `search`, `page`, `limit` |
| `/daily-trend` | GET | F-COPRESENCE-012 | `days` (기본 30) |
| `/pair-detail` | GET | F-COPRESENCE-013 | `userA`, `userB`, `days` |

### 프론트엔드 파일 구조 (Phase 4)

```
apps/web/app/dashboard/guild/[guildId]/co-presence/
  page.tsx                      — 관계 분석 메인 페이지 (F-COPRESENCE-007 요약 카드, 기간 선택)
  components/
    CoPresenceSummaryCards.tsx  — 요약 카드 4개 (F-COPRESENCE-007)
    CoPresenceGraph.tsx         — 네트워크 그래프 (@react-sigma/core) (F-COPRESENCE-008)
    TopPairsPanel.tsx           — 친밀도 TOP N 패널 (F-COPRESENCE-009)
    IsolatedMemberList.tsx      — 고립 멤버 목록 (F-COPRESENCE-010)
    PairsTable.tsx              — 관계 상세 테이블 + 페이지네이션 (F-COPRESENCE-011)
    DailyTrendChart.tsx         — 일별 추이 AreaChart (F-COPRESENCE-012)
    PairDetailModal.tsx         — 특정 쌍 상세 모달 + BarChart (F-COPRESENCE-013)
apps/web/app/lib/
  co-presence-api.ts            — API 클라이언트 함수 (7종 엔드포인트)
```

### 의존성 추가 (Phase 4)

| 패키지 | 버전 | 용도 |
|--------|------|------|
| `@react-sigma/core` | latest | 시그마.js React 래퍼 — 네트워크 그래프 렌더링 |
| `graphology` | latest | 그래프 자료구조 및 Louvain 클러스터링 알고리즘 |
| `graphology-communities-louvain` | latest | Louvain 커뮤니티 탐지 |

### 기존 기능과의 관계 (Phase 4 추가)

| 기존 기능 | 관계 | 설명 |
|-----------|------|------|
| 관계 분석 대시보드 (F-COPRESENCE-007~013) | **소비자** | Co-Presence 기록 데이터(`PairDaily`, `Daily`)를 읽기 전용으로 조회. 쓰기 없음 |
| 비활동 회원 (inactive-member) | **독립** | `VoiceDailyEntity` 기반. Co-Presence 데이터 미사용 |
| 웹 대시보드 사이드바 | **연동** | `DashboardSidebar`에 "관계 분석" 메뉴 항목 추가 필요 (`/dashboard/guild/[guildId]/co-presence`) |

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
