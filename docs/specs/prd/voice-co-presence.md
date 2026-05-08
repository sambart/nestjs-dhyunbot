# Voice Co-Presence 도메인 PRD

> 신규 도메인. 기존 모코코 사냥(F-NEWBIE-003)의 동시접속 추적 로직을 범용화하여 분리한다.

> 변경이력: [prd-changelog.md](../../archive/prd-changelog.md)

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

---

## 친밀도 그래프 + 베스트 프렌드 TOP 리포트 (Phase 5)

기존 `VoiceCoPresencePairDaily` 데이터를 Discord 슬래시 커맨드로 소비하고, 사용자 사생활 정책을 도입하는 확장이다. 데이터 소스가 동일하므로 `voice-co-presence` 도메인에 흡수한다 (별도 `relationship` 도메인 분리하지 않음).

### 배경 및 동기

웹 대시보드(F-COPRESENCE-007~013)에서 관계 시각화는 이미 완성 상태이다. 그러나 다음 공백이 존재한다.

| 공백 항목 | 현재 상태 |
|-----------|-----------|
| 디스코드 슬래시 커맨드 친밀도 조회 | 없음 — 본인 음성 활동(`/me`)만 존재 |
| 주간 자동 리포트 친밀도 섹션 | 없음 — `WeeklyReportService`에 미포함 |
| 사용자 opt-out 사생활 정책 | 없음 — 현재 누구나 타인 친밀도 조회 가능 |
| AI 한 줄 코멘트 | 없음 — Gemini 활용 미구현 |
| 본인 시점 베스트 프렌드 TOP | 없음 — `top-pairs`는 서버 전체 TOP, 개인 시점 쿼리 별도 필요 |

### 사생활 정책 결정 사항

| 결정 항목 | 결정 | 근거 |
|-----------|------|------|
| P-1: opt-out 기본값 | **공개**(opt-out 시 비공개) | 트렌드·UX 표준. 첫 가입자 알림으로 보완 |
| P-2: 본인 미포함 페어 조회 | **길드 토글** (`GuildCoPresenceConfig.allowPublicAffinityQuery`) | 길드 성격에 따라 결정 가능 |
| P-3: 웹 분석 페이지 opt-out 적용 | **미적용** — 관리자 분석 도구로 유지 | `JwtAuthGuard + GuildMembershipGuard` 통과 인원에게만 노출, 합리적 |
| P-4: 비공개 사용자 표시 | **익명화**(`???` + 회색 원) — 결과에서 제거하지 않음 | 존재는 보이되 식별 불가; "1명 비공개" 병기 |
| P-5: 데이터 정확도 완화책 | **적용 보류** — 단순 SUM(minutes) 사용 | 채널 인원 가중치·최소 시간 임계는 별도 후속 과제 |
| P-6: 명령어 네이밍 | 영어 + ko 별칭: `/best-friend` + `ko: 친한친구`, `/affinity` + `ko: 친밀도` | `/me`와 일관성 유지 |
| P-7: 도메인 경계 | `voice-co-presence` 확장 흡수 | 데이터 소스 동일, 별도 모듈 분리 시 의존성 복잡도만 증가 |

### 관련 모듈 (Phase 5 신규)

- **API**: `apps/api/src/channel/voice/co-presence/application/best-friend-card-renderer.ts` — 베스트 프렌드 PNG 카드 렌더러
- **API**: `apps/api/src/channel/voice/co-presence/application/affinity-card-renderer.ts` — 친밀도 PNG 카드 렌더러
- **API**: `apps/api/src/bot-api/co-presence/bot-co-presence.controller.ts` — Bot API 엔드포인트 (신규)
- **API**: `apps/api/src/channel/voice/co-presence/application/user-privacy-config.service.ts` — 사생활 설정 서비스
- **Bot**: `apps/bot/src/command/friend/best-friend.command.ts` — `/best-friend` 슬래시 커맨드
- **Bot**: `apps/bot/src/command/friend/affinity.command.ts` — `/affinity` 슬래시 커맨드
- **공통**: `BotApiClientService`에 `getMyBestFriends()`, `getAffinity()` 메서드 추가

### 공통 구현 패턴 (Canvas PNG)

모든 사용자 대면 슬래시 커맨드(F-COPRESENCE-014/015)는 `/me` 패턴(`@napi-rs/canvas` PNG → base64 → AttachmentBuilder)을 따른다.

```
[Bot]                                    [API]
슬래시 커맨드                    
  ├─ interaction.deferReply()           
  ├─ BotApiClient.getMyBestFriends()  ──► POST /bot-api/co-presence/best-friends
  │     (guildId, userId, displayName,        │
  │      avatarUrl, period, limit)            ├─ CoPresenceAnalyticsService.getMyTopPeers()
  │                                           ├─ UserPrivacyConfigService.filterPeers()
  │                                           ├─ (선택) VoiceAiAnalysisService.generateBestFriendComment()
  │                                           └─ BestFriendCardRenderer.render() → PNG Buffer → base64
  │ ◄─────────────────── { ok, data: { imageBase64 }, days } ────────────────────┘
  ├─ Buffer.from(base64, 'base64')
  ├─ new AttachmentBuilder(buf, { name: 'best-friends.png' })
  └─ interaction.editReply({ files: [attachment], components: [linkButtonRow] })
```

폰트는 기존 `ProfileCardRenderer`에서 이미 등록된 `NotoSansCJK`, `NotoColorEmoji`를 재사용한다. 카드 디자인 톤은 `apps/api/src/channel/voice/application/profile-card-renderer.ts`와 통일한다.

### Canvas 채택 근거

| 평가 축 | Embed | Canvas (PNG) |
|---------|-------|--------------|
| `/me`와 시각적 일관성 | 다름 | 동일 |
| 정보 밀도(아바타·친밀도 바·시간 라벨) | 글자/필드 한계 | 자유로운 레이아웃 |
| 외부 공유성(트위터/X, 스크린샷) | Discord 의존 | 단독 이미지 |
| 토큰 비용/속도 | 가벼움 | 캔버스 렌더 ~50–150ms |
| 다국어 폰트(CJK + emoji) | Discord가 처리 | 이미 `ProfileCardRenderer`에서 해결됨 |

---

### F-COPRESENCE-014: 본인 베스트 프렌드 조회 (`/best-friend`)

#### 트리거

사용자가 `/best-friend` (또는 한국어 별칭 `/친한친구`) 슬래시 커맨드를 실행한다.

#### 입력

| 파라미터 | 타입 | 기본값 | 설명 |
|----------|------|--------|------|
| `period` | choice(`7`, `30`, `90`) | `30` | 집계 기간(일) |
| `limit` | integer (3~5) | `5` | TOP N 개수 |
| `private` | boolean | `false` | `true`이면 ephemeral 응답(본인만 확인) |

#### 처리

1. `interaction.deferReply()` (이미지 생성 시간 확보)
2. Bot이 `BotApiClient.getMyBestFriends(guildId, userId, displayName, avatarUrl, period, limit)` 호출
3. API(`POST /bot-api/co-presence/best-friends`) 처리 순서:
   a. `CoPresenceAnalyticsService.getMyTopPeers(guildId, userId, period, limit)` — 신규 메서드. `WHERE userId = :me AND date >= :from GROUP BY peerId ORDER BY SUM(minutes) DESC` 단방향 쿼리
   b. `UserPrivacyConfigService.filterPeers(guildId, peers)` — `disableRelationshipShare = true`인 peer를 익명화(`name: '???'`, avatarUrl: null, isAnonymous: true)
   c. `GuildMemberService.findByUserIds(guildId, peerIds)` — 닉네임/아바타 일괄 조회. 실패 시 `Member-{userId.slice(0,6)}` 폴백
   d. (선택) `VoiceAiAnalysisService.generateBestFriendComment(data)` — 길드 일일 LLM 한도(`Redis INCR`) 미초과 시 호출
   e. `BestFriendCardRenderer.render(data, displayName, avatarUrl)` → PNG Buffer → base64
4. Bot이 `AttachmentBuilder(buf, { name: 'best-friends.png' })` + Link 버튼 행으로 응답

#### 출력: 카드 레이아웃 (800 × 약 580 px)

```
┌─────────────────────────────────────────────────────────┐
│  [원형 본인 아바타]  동현                                │
│                     🤝 베스트 프렌드 TOP 5 · 최근 30일   │
│  ─────────────────────────────────────────────────────   │
│  ① [원형 아바타] 민수      ████████████  12시간 30분     │
│  ② [원형 아바타] 지수      █████████     8시간 12분      │
│  ③ [원형 아바타] 영희      ██████        6시간 5분       │
│  ④ [원형 아바타] 철수      ████          4시간 20분      │
│  ⑤ [회색 원]     ???       ███           3시간 50분 (비공개)│
│  ─────────────────────────────────────────────────────   │
│  💬 평일 저녁 민수님과 가장 자주 어울리고 계세요. (AI)   │
└─────────────────────────────────────────────────────────┘
```

- 친밀도 바: 1위 시간 = 100% 기준 상대 길이. BLURPLE(`#5865F2`) 색상으로 `/me` 바 톤과 통일
- 비공개 사용자: 회색 원(`ctx.arc() + #cccccc`) + `???`. 아바타·이름 노출 금지
- AI 코멘트: 1~2줄. LLM 미사용 시 해당 영역 생략하고 카드 높이 자동 축소
- 본인 데이터 0건: "비활성" 카드 변형 — "최근 N일간 함께한 친구 기록이 없어요. 음성방에 들어가 친구를 만들어보세요!" 메시지 출력

응답 구성:
- `files`: `best-friends.png`
- `components`: `[ActionRow [LinkButton("대시보드에서 그래프 보기" → /dashboard/guild/{guildId}/co-presence)]]`
- `ephemeral`: `private` 파라미터 값을 따름 (기본 `false` — 공개, 자랑 가능)

#### 장애 대응

| 장애 유형 | 처리 방법 |
|-----------|-----------|
| LLM 호출 실패 | 코멘트 영역만 생략하고 카드 정상 렌더 |
| 캔버스 렌더 실패 | Embed 폴백 응답("이미지 생성 실패") + 텍스트 리스트 |
| peer 닉네임 조회 실패 | `Member-{userId.slice(0,6)}` 폴백 |
| 아바타 이미지 로딩 실패 | `ctx.arc() + #cccccc` 회색 원 폴백 |

#### 캐시 전략

| 키 | TTL | 저장소 | 용도 |
|----|-----|--------|------|
| `friend:card:{guildId}:{userId}:{period}` | 5분 | 인메모리 LRU (`lru-cache`) | PNG base64 결과 재렌더 방지 (~30~80 KB이므로 Redis 미사용) |
| `friend:llm:quota:{guildId}:{YYYYMMDD}` | 24시간 | Redis | 길드별 일일 LLM 호출 카운터 |
| `friend:privacy:{guildId}:{userId}` | 30분 | Redis | opt-out 설정 빠른 확인 |

#### 속도 목표

- 캔버스 렌더 < 200ms (아바타 5개 병렬 `Promise.all` 로딩 포함)
- 전체 응답 < 1.5s (LLM 미사용 시 < 700ms, `deferReply`로 사용자 체감 우려 없음)

#### 권한

- 모든 길드 멤버 사용 가능 (본인 데이터 조회)
- 슬래시 커맨드 등록: `nameLocalizations: { ko: '친한친구' }`

---

### F-COPRESENCE-015: 두 사람 친밀도 조회 (`/affinity`)

#### 트리거

사용자가 `/affinity` (또는 한국어 별칭 `/친밀도`) 슬래시 커맨드를 실행한다.

#### 입력

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `user` | User (멘션) | 필수 | 비교 대상 |
| `user2` | User (멘션) | 선택 | 생략 시 명령 실행자 본인 |
| `period` | choice(`7`, `30`, `90`) | 선택 | 기본 `30` |

#### 처리

1. `interaction.deferReply()`
2. Bot이 `BotApiClient.getAffinity(guildId, userAId, userBId, period)` 호출
3. API(`POST /bot-api/co-presence/affinity`) 처리 순서:
   a. **권한 검증**: `user2` 생략(실행자↔대상) → 자기 자신 포함이므로 허용. `user2` 지정(타인↔타인) → `GuildCoPresenceConfig.allowPublicAffinityQuery` 확인. `false`이고 실행자가 `ManageGuild` 권한 없으면 ephemeral 에러 응답으로 분기
   b. **opt-out 검증**: 한쪽이라도 `disableRelationshipShare = true`이고 실행자가 해당 사용자 본인이 아니면 ephemeral 텍스트 응답 분기 (캔버스 미생성)
   c. `userId < peerId` 정렬로 단방향 키 생성 → `CoPresenceAnalyticsService.getPairDetail(guildId, userA, userB, period)` 재사용
   d. 일별 데이터(`dailyData`)까지 함께 수집 → 카드 내 미니 막대 차트로 활용
   e. `AffinityCardRenderer.render(data, memberA, memberB)` → PNG Buffer → base64
4. Bot이 `AttachmentBuilder(buf, { name: 'affinity.png' })` + Link 버튼으로 응답

#### 출력: 카드 레이아웃 (800 × 약 360 px)

```
┌─────────────────────────────────────────────────────────┐
│  [원형 A 아바타]  동현      ⇆      민수  [원형 B 아바타]│
│                                                          │
│  💞 최근 30일 함께한 시간                                │
│  ┌──────────────────┐  ┌──────────────┐  ┌────────────┐│
│  │ 12시간 30분       │  │ 24 세션      │  │ 마지막     ││
│  │ (총 동시접속)     │  │              │  │ 05-02      ││
│  └──────────────────┘  └──────────────┘  └────────────┘│
│                                                          │
│  📊 일별 추이 (최근 30일)                                │
│   ▂▂▃▅▃▂▁▁▃▆█▅▃▂▁▂▃▅▆▄▃▂▁▁▂▃▄▅▆▇                     │
└─────────────────────────────────────────────────────────┘
```

- 통계 카드 3개(`drawStatCardWithSub()`) — 총 시간 / 세션 수 / 마지막 함께한 날짜
- 일별 차트(`drawBarChart()`) — `ProfileCardRenderer` 헬퍼 재사용
- 응답 구성: `files: [affinity.png]` + Link 버튼(`PairDetailModal` 웹 페이지로 이동)

#### 장애 대응

- `getPairDetail()` 조회 결과 0건: "두 분은 아직 함께한 음성 기록이 없어요" 카드 변형
- 캔버스 렌더 실패: Embed 폴백 (텍스트 요약)
- opt-out / 권한 미달: ephemeral 텍스트 응답, 이유 안내

#### 권한

| 조합 | 조건 |
|------|------|
| 자기 자신 포함 페어 | 항상 허용 |
| 본인 미포함 페어 (타인↔타인) | `GuildCoPresenceConfig.allowPublicAffinityQuery = true` 이거나 실행자가 `ManageGuild` 권한 보유 |
| 비공개 사용자 포함 | ephemeral 텍스트 응답 (캔버스 미렌더) |

슬래시 커맨드 등록: `nameLocalizations: { ko: '친밀도' }`

---

### F-COPRESENCE-016: 주간 자동 리포트 친밀도 섹션 추가

#### 트리거

기존 `WeeklyReportScheduler` (매시간 정각, `0 * * * *` Cron) — 변경 없음.

#### 변경 위치

`apps/api/src/voice-analytics/weekly-report/application/weekly-report.service.ts`

#### 처리

1. `collectReportData()` 내에 다음 호출 추가:
   - `CoPresenceAnalyticsService.getTopPairs(guildId, 7, 5)` — 서버 전체 TOP 5 페어 (7일)
2. `buildPayload()` 내 기존 "TOP 3 채널"과 "AI 종합 분석" 사이에 신규 섹션 삽입:

```
💞 이번 주 베스트 페어 TOP 5
1. 동현 ↔ 민수    — 12시간 (24세션)
2. 지수 ↔ 영희    — 8시간 (15세션)
3. 철수 ↔ ???     — 6시간 (1명 비공개)
4. ...
```

3. AI 종합 분석 프롬프트에 페어 데이터 컨텍스트 추가 (선택):
   - "이번 주 활발한 페어가 누구이고 서버 분위기는 어떤가" 문단 보강

#### opt-out 처리

| 페어 상태 | 처리 |
|-----------|------|
| 양측 모두 비공개 | 해당 페어 섹션에서 제외 |
| 한쪽만 비공개 | 비공개 측 익명화(`???`) 후 포함 |
| 양측 공개 | 정상 표시 |

#### 출력

- 기존 Embed 형식 유지 (이미지 첨부 없음 — 페어 5쌍 텍스트로 충분)
- ephemeral 아님, 설정된 채널에 공개 전송

#### 장애 대응

- 페어 조회 실패 → 해당 섹션만 생략, 나머지 리포트 정상 발송 (기존 LLM 실패 처리와 동일 패턴)
- `getTopPairs()` 응답 빈 배열 → 섹션 자체를 Embed에서 제외

---

### F-COPRESENCE-017: 사용자 사생활 설정

#### 개요

사용자가 자신의 친밀도·베스트 프렌드 데이터 노출 여부를 제어할 수 있는 opt-out 정책이다. **기본값은 공개**이며, 비공개로 전환 시 타인의 슬래시 커맨드 결과에서 익명화된다.

#### 트리거

- 슬래시 커맨드: `/privacy affinity-visible:<true|false>` (ephemeral 응답, 텍스트만)
- 웹 대시보드: `apps/web/app/settings/me/privacy/page.tsx` — 친밀도 공개 토글 UI

#### 입력

슬래시 커맨드:

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `affinity-visible` | boolean | `true` = 공개, `false` = 비공개 |

웹 API:

- `GET /api/users/me/privacy` — 현재 설정 조회
- `PUT /api/users/me/privacy` — `{ disableRelationshipShare: boolean }` body

#### 처리

1. `UserPrivacyConfigService.upsert(guildId, userId, { disableRelationshipShare })` 호출
2. Redis 캐시 즉시 무효화 (`DEL friend:privacy:{guildId}:{userId}`)
3. ephemeral 확인 메시지 응답 ("친밀도 공개 설정이 변경되었습니다.")

#### 적용 범위

| 기능 | opt-out 적용 |
|------|-------------|
| F-COPRESENCE-014 (베스트 프렌드 카드) | 적용 — 비공개 사용자 익명화 |
| F-COPRESENCE-015 (친밀도 카드) | 적용 — 본인이 비공개이고 실행자가 본인이 아니면 ephemeral 분기 |
| F-COPRESENCE-016 (주간 리포트) | 적용 — 익명화 처리 |
| F-COPRESENCE-007~013 (웹 분석 대시보드) | **미적용** — 관리자 전용 분석 도구. `JwtAuthGuard + GuildMembershipGuard` 통과 인원에게만 노출되므로 합리적 |

#### 권한

- 모든 인증된 사용자 (본인 설정만 변경 가능)
- JwtAuthGuard 적용

---

### F-COPRESENCE-018: AI 한 줄 코멘트

#### 개요

베스트 프렌드 카드(F-COPRESENCE-014) 및 주간 자동 리포트(F-COPRESENCE-016)에 자연어 코멘트를 추가하는 선택 기능이다. 기존 `LlmProvider` 추상화를 재사용한다.

#### 사용처

| 기능 | 사용 |
|------|------|
| F-COPRESENCE-014 베스트 프렌드 카드 | 카드 하단 코멘트 영역 |
| F-COPRESENCE-016 주간 리포트 | AI 종합 분석 프롬프트 컨텍스트 보강 |

#### 처리

신규 메서드: `VoiceAiAnalysisService.generateBestFriendComment(data: BestFriendAiContext): Promise<string | null>`

프롬프트 예시:
```
사용자 X의 최근 30일 베스트 프렌드 TOP 3는 다음과 같다:
1. 동현 — 12시간 (24세션)
2. 민수 — 8시간 (15세션)
3. 지수 — 6시간 (10세션)
이 데이터를 1~2문장의 친근한 한국어로 묘사하라. 인용/추측 금지.
```

#### 비용 통제

1. 길드별 일일 LLM 호출 한도: `Redis INCR friend:llm:quota:{guildId}:{YYYYMMDD}`, EXPIRE 24h. 한도 초과 시 코멘트 생략
2. LLM 결과 캐시 1시간 (동일 사용자 반복 호출 시 캐시 응답)
3. 카드 PNG 전체는 인메모리 LRU 5분 캐시 (렌더 재발생 방지)

#### 장애 대응

- `LlmProvider` 실패 → `null` 반환 → 코멘트 영역 생략, 통계만 출력
- 기존 `WeeklyReportService` LLM 실패 패턴과 동일 방식

---

## 데이터 모델 추가 (Phase 5)

### UserPrivacyConfig (`user_privacy_config`)

사용자별 길드 단위 사생활 설정을 저장한다.

| 컬럼 | 타입 | 제약조건 | 설명 |
|-------|------|----------|------|
| `guildId` | `varchar` | PK | 디스코드 서버 ID |
| `userId` | `varchar` | PK | 사용자 디스코드 ID |
| `disableRelationshipShare` | `boolean` | NOT NULL, DEFAULT `false` | `true` = 친밀도·베프 노출 비공개(opt-out) |
| `updatedAt` | `timestamp` | NOT NULL, DEFAULT now() | 마지막 변경 시각 |

**인덱스**:
- PK: `(guildId, userId)`

**캐시**: `friend:privacy:{guildId}:{userId}` — Redis, TTL 30분

### GuildCoPresenceConfig (`guild_co_presence_config`)

길드 단위 Co-Presence 공개 설정을 저장한다. P-2 결정(본인 미포함 페어 조회 허용 여부)을 관리한다.

| 컬럼 | 타입 | 제약조건 | 설명 |
|-------|------|----------|------|
| `guildId` | `varchar` | PK | 디스코드 서버 ID |
| `allowPublicAffinityQuery` | `boolean` | NOT NULL, DEFAULT `false` | `true` = 일반 사용자도 타인↔타인 `/affinity` 조회 가능 |
| `updatedAt` | `timestamp` | NOT NULL, DEFAULT now() | 마지막 변경 시각 |

**인덱스**:
- PK: `guildId`

**설정 경로**: 웹 대시보드 관리자 설정 페이지에서 토글. `InactiveMemberConfig`와 동일한 패턴.

---

## 마이그레이션 전략 (Phase 5)

### Phase 5-1: 사생활 정책 + 본인 베프 카드 (~1.5주)

1. `UserPrivacyConfigOrm` 엔티티 + Repository + `UserPrivacyConfigService`
2. `GuildCoPresenceConfigOrm` 엔티티 + Repository
3. `CoPresenceAnalyticsService.getMyTopPeers(guildId, userId, days, limit)` 신규 메서드
4. `BestFriendCardRenderer` 신규 (`ProfileCardRenderer` 폰트 등록 패턴 답습)
5. `POST /bot-api/co-presence/best-friends` Bot API 엔드포인트 신규
6. Bot 슬래시 커맨드 `/best-friend` 신규 (`me.command.ts` 패턴 동일)
7. `BotApiClientService.getMyBestFriends()` 추가
8. `/privacy` 슬래시 커맨드 신규 (ephemeral, 텍스트)

### Phase 5-2: 친밀도 카드 + 주간 리포트 통합 (~5일)

9. `AffinityCardRenderer` 신규 (Phase 5-1 헬퍼/폰트 재사용)
10. `POST /bot-api/co-presence/affinity` Bot API 엔드포인트 신규
11. Bot 슬래시 커맨드 `/affinity` 신규
12. `WeeklyReportService.collectReportData()`에 `getTopPairs()` 호출 + opt-out 필터 추가
13. `WeeklyReportService.buildPayload()`에 친밀도 섹션 삽입

### Phase 5-3: AI 코멘트 (~2일, 선택)

14. `VoiceAiAnalysisService.generateBestFriendComment()` 추가
15. Redis 일일 한도 + 인메모리 LRU 캐시(5분) 구현
16. `BestFriendCardRenderer`에 코멘트 영역 렌더 통합

### Phase 5-4: 웹 사생활 설정 페이지 (~2일, 선택)

17. `apps/web/app/settings/me/privacy/page.tsx` — 친밀도 공개 토글
18. API `GET/PUT /api/users/me/privacy` (JwtAuthGuard 적용)

---

## 트레이드오프 기록 (Phase 5)

### Canvas 출력의 트레이드오프

| 항목 | 영향 | 완화 |
|------|------|------|
| 응답 페이로드 크기 | base64 PNG ~30~80 KB → bot↔api 트래픽 증가 | 인메모리 LRU 5분 + Discord 측 압축 |
| 컨테이너 폰트 의존 | `NotoSansCJK` 미설치 시 글자 깨짐 | `/me` Dockerfile에서 이미 검증됨 |
| 카드 디자인 변경 비용 | UI 변경 시 코드 수정 + 시각 회귀 테스트 | `ProfileCardRenderer` 헬퍼 공통 유틸 추출 후 재사용 |
| 접근성 | 이미지라 스크린 리더 미지원 | 메시지 본문에 짧은 요약 텍스트 1줄 병기 (선택) |
| 모바일 가독성 | 800px 폭이 모바일에서 축소 | 글자 크기·여백 충분히 확보 (`/me` 800×650 레이아웃 톤 답습) |

### LLM 비용 통제

- 캔버스 렌더는 CPU-bound. 동시 요청 다발 시 API 응답 지연 가능 → 인메모리 LRU 캐시 5분으로 완화
- 길드별 일일 LLM 한도 초과 시 코멘트 생략하고 카드만 렌더
- `Promise.all`로 아바타 병렬 로딩, 5명 카드 기준 < 200ms 목표

### 데이터 정확도 보류 사항 (P-5)

대규모 음성방에서 의도 없이 함께 있던 사람이 베프로 집계될 수 있다. 완화책(채널 인원 가중치, 최소 시간 임계)은 별도 후속 과제로 보류하며, 현 PRD에서는 단순 `SUM(minutes)` 사용으로 정의한다.
