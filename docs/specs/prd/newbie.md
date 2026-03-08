# Newbie 도메인 PRD

> 변경이력: [prd-changelog.md](../../archive/prd-changelog.md)

## 개요

디스코드 서버에 신규 가입한 멤버를 종합적으로 관리하는 도메인이다. 환영인사 자동 전송, 음성 채널 플레이타임 기반 미션 추적, 기존 멤버의 신규사용자 동반 플레이 시간 기록(모코코 사냥), 신입기간 역할 자동 관리의 네 가지 하위 기능으로 구성된다. 모든 기능은 길드(서버)별로 독립 설정된다.

## 관련 모듈

- `apps/api/src/newbie/` — 신규사용자 관리 핵심 로직
- `apps/api/src/newbie/welcome/` — 환영인사 이벤트 핸들러 및 서비스
- `apps/api/src/newbie/mission/` — 미션 생성/추적 서비스 및 스케줄러
- `apps/api/src/newbie/moco/` — 모코코 사냥 집계 서비스
- `apps/api/src/newbie/role/` — 신입기간 역할 자동관리 서비스
- `apps/api/src/newbie/infrastructure/` — Redis 저장소, DB 저장소
- `apps/api/src/channel/voice/` — voice 도메인 연계 (VoiceDailyEntity 활용)

## 아키텍처

```
Discord guildMemberAdd Event
    │
    ▼
[NewbieGateway]              ← Discord.js guildMemberAdd 이벤트 수신
    │
    ├──► [WelcomeService]        → 환영 메시지 Embed 생성 및 채널 전송 (F-NEWBIE-001)
    ├──► [MissionService]        → 신규 멤버 미션 레코드 생성 (F-NEWBIE-002)
    └──► [NewbieRoleService]     → 신입기간 역할 자동 부여 (F-NEWBIE-004)

Discord voiceStateUpdate Event (voice 도메인 연계)
    │
    ▼
[MocoService]                ← 같은 채널 동시 접속 감지 (F-NEWBIE-003)
    │
    └──► [MocoRedisRepository]  → 기존 멤버별 모코코 사냥 시간 누적

Scheduler (cron)
    │
    ├──► [MissionScheduler]     → 미션 만료 확인 및 상태 갱신 (F-NEWBIE-002)
    └──► [NewbieRoleScheduler]  → 신입기간 만료 확인 및 역할 제거 (F-NEWBIE-004)

Web Dashboard API
    │
    ├──► GET  /api/guilds/{guildId}/newbie/config      → 설정 조회
    ├──► POST /api/guilds/{guildId}/newbie/config      → 설정 저장
    ├──► GET  /api/guilds/{guildId}/newbie/missions    → 미션 현황 조회
    └──► GET  /api/guilds/{guildId}/newbie/moco        → 모코코 사냥 순위 조회
```

---

## 기능 상세

### F-NEWBIE-001: 환영인사 설정

- **트리거**: 디스코드 서버에 새 멤버가 참여 (`guildMemberAdd` 이벤트)
- **전제 조건**: `NewbieConfig.welcomeEnabled = true`, 환영 채널이 설정되어 있음
- **동작**:
  1. `NewbieConfig`에서 해당 guildId의 설정 조회 (Redis 캐시 우선, 미스 시 DB)
  2. 설정이 없거나 `welcomeEnabled = false`이면 처리 중단
  3. 템플릿 변수 치환:
     - `{username}` → 신규 멤버의 서버 닉네임 (없으면 전역 닉네임)
     - `{memberCount}` → 현재 서버 멤버 수
     - `{serverName}` → 서버명
  4. Discord Embed 구성 (제목, 설명, 색상, 썸네일 이미지 URL)
  5. 설정된 환영 채널에 Embed 메시지 전송
- **템플릿 변수**:

  | 변수 | 치환값 |
  |------|--------|
  | `{username}` | 신규 멤버 닉네임 |
  | `{memberCount}` | 서버 전체 멤버 수 |
  | `{serverName}` | 서버명 |

- **오류 처리**: 채널을 찾을 수 없거나 봇 권한 부족 시 로그 기록 후 조용히 실패

---

### F-NEWBIE-002: 미션 생성 및 추적

- **트리거**: 신규사용자가 서버에 가입 (`guildMemberAdd` 이벤트), 미션 기능 활성화 시 자동 시작
- **전제 조건**: `NewbieConfig.missionEnabled = true`
- **동작 (미션 생성)**:
  1. `NewbieMission` 레코드 생성 (guildId, memberId, 시작일, 마감일, 목표 플레이타임)
  2. 마감일 = 시작일 + `missionDurationDays`
- **동작 (플레이타임 측정)**:
  1. voice 도메인의 `VoiceDailyEntity`에서 해당 멤버의 기간 내 `channelDurationSec` 합산
  2. 조회 범위: `startDate` ~ `endDate`, `channelId != 'GLOBAL'`인 레코드
  3. "플레이횟수" = 해당 기간 내 `VoiceChannelHistory` 세션 수
- **미션 상태**:

  | 상태 | 코드 | 조건 |
  |------|------|------|
  | 진행중 | `IN_PROGRESS` | 현재일 <= 마감일, 목표 미달성 |
  | 완료 | `COMPLETED` | 목표 플레이타임 달성 (마감일 이전 포함) |
  | 실패 | `FAILED` | 현재일 > 마감일, 목표 미달성 |

- **스케줄러**: 매일 자정 `MissionScheduler` 실행
  1. `IN_PROGRESS` 상태 미션 중 마감일이 지난 항목 조회
  2. 목표 달성 여부 재확인 후 `COMPLETED` 또는 `FAILED`로 상태 갱신
- **알림 메시지 (채널 Embed)**:
  - 설정된 알림 채널에 미션 현황 Embed 표시
  - 갱신 버튼(Discord Button) 클릭 시 최신 데이터로 Embed 수정
  - Embed 표시 형식:

    ```
    🧑‍🌾 신입 미션 체크
    🧑‍🌾 뉴비 멤버 (총 인원: N명)

    @{username} 🌱
    {startDate} ~ {endDate}
    {statusEmoji} {statusText} | 플레이타임: {H}시간 {M}분 {S}초 | 플레이횟수: {N}회
    ```

  - 상태 이모지: 진행중 = `🟡`, 완료 = `✅`, 실패 = `❌`
- **길드별 독립 설정**

---

### F-NEWBIE-003: 같이 플레이한 사용자 기록 (모코코 사냥)

- **개념**: "모코코" = 신규사용자(신입기간 내 멤버). 기존 멤버가 신규사용자와 같은 음성 채널에 동시 접속한 시간을 "모코코 사냥" 시간으로 기록한다.
- **전제 조건**: `NewbieConfig.mocoEnabled = true`
- **측정 방식**:
  1. `voiceStateUpdate` 이벤트 발생 시 해당 채널의 현재 접속자 목록 조회
  2. 채널 내 신규사용자(신입기간 중인 멤버) 존재 여부 확인
  3. 신규사용자와 같은 채널에 있는 기존 멤버 각각에 대해 Redis에 시간 누적
  4. 신규사용자 기준: `NewbieMission` 상태가 `IN_PROGRESS`인 멤버
- **순위 기준**: 기존 멤버별 모코코 사냥 누적 시간(분) 내림차순
- **알림 메시지 (채널 Embed)**:
  - 설정된 채널에 TOP N 순위 Embed 표시
  - 페이지네이션: Discord Button으로 이전/다음 페이지 이동
  - 자동 갱신: 설정된 간격(분)마다 Embed 수정, 또는 갱신 버튼 클릭 시 즉시 갱신
  - Embed 표시 형식:

    ```
    모코코 사냥 TOP {rank} — {memberName} 🌱
    총 모코코 사냥 시간: {totalMinutes}분

    도움을 받은 모코코들:
    – {newbieName} 🌱: {minutes}분
    – {newbieName} 🌱: {minutes}분
    ...

    페이지 {currentPage}/{totalPages} | 자동 갱신 {interval}분
    ```

- **MVP 제외 항목**: [막판], [관전] 등 태그 구분 기능
- **길드별 독립 설정**

---

### F-NEWBIE-004: 신입기간 역할 자동관리

- **트리거 (부여)**: 신규사용자가 서버에 가입 (`guildMemberAdd` 이벤트)
- **트리거 (제거)**: 신입기간 만료 (스케줄러 실행)
- **전제 조건**: `NewbieConfig.roleEnabled = true`, 역할 ID 설정되어 있음
- **동작 (역할 부여)**:
  1. `guildMemberAdd` 이벤트 발생 시 `NewbieConfig` 조회
  2. `roleEnabled = true`이고 `newbieRoleId`가 설정된 경우 Discord API로 역할 부여
  3. `NewbiePeriod` 레코드 생성 (guildId, memberId, 시작일, 만료일)
- **동작 (역할 제거)**:
  1. 매일 자정 `NewbieRoleScheduler` 실행
  2. `NewbiePeriod` 중 만료일이 지난 활성 레코드 조회
  3. Discord API로 해당 멤버의 신입 역할 제거
  4. `NewbiePeriod.isExpired = true` 로 갱신
- **미션 완료 여부와 무관**: 역할 관리는 신입기간(일수)만 기준으로 함
- **기간 만료 후 역할 교체 없음**: 역할 제거만 수행하며 다른 역할로 교체하지 않음
- **길드별 독립 설정**

---

### F-WEB-NEWBIE-001: 신입 관리 설정 페이지

- **경로**: `/dashboard/servers/{guildId}/settings/newbie`
- **위치**: 대시보드 > 서버 설정 > 신입 관리
- **접근 조건**: Discord OAuth 로그인 + 해당 서버 관리 권한

#### 탭 구성

| 탭 번호 | 탭 이름 | 대응 기능 |
|---------|---------|-----------|
| 1 | 환영인사 설정 | F-NEWBIE-001 |
| 2 | 미션 설정 | F-NEWBIE-002 |
| 3 | 모코코 사냥 설정 | F-NEWBIE-003 |
| 4 | 신입기간 설정 | F-NEWBIE-004 |

#### 탭 1: 환영인사 설정

| UI 요소 | 설명 |
|---------|------|
| 기능 활성화 토글 | 환영 메시지 전송 기능 ON/OFF |
| 채널 선택 드롭다운 | 환영 메시지를 보낼 텍스트 채널 선택 (서버 채널 목록) |
| Embed 제목 입력 | 환영 Embed 제목 (템플릿 변수 사용 가능) |
| Embed 설명 입력 (멀티라인) | 환영 Embed 본문 (템플릿 변수 사용 가능) |
| Embed 색상 선택 | HEX 색상 코드 입력 또는 컬러 피커 |
| 썸네일 이미지 URL 입력 | Embed 썸네일 이미지 URL |
| 템플릿 변수 안내 | `{username}`, `{memberCount}`, `{serverName}` 설명 인라인 표시 |
| 미리보기 패널 | 현재 설정 기준 Embed 모습 실시간 미리보기 |
| 저장 버튼 | 설정 내용을 API로 전송 |

#### 탭 2: 미션 설정

| UI 요소 | 설명 |
|---------|------|
| 기능 활성화 토글 | 미션 기능 ON/OFF |
| 미션 기간 입력 (숫자) | 신규 멤버 가입 후 미션 기간 (일수, 예: 7) |
| 목표 플레이타임 입력 (숫자) | 미션 완료 기준 최소 플레이타임 (시간 단위) |
| 알림 채널 선택 드롭다운 | 미션 현황 Embed를 표시할 채널 선택 |
| 저장 버튼 | 설정 내용을 API로 전송 |

#### 탭 3: 모코코 사냥 설정

| UI 요소 | 설명 |
|---------|------|
| 기능 활성화 토글 | 모코코 사냥 기능 ON/OFF |
| 순위 표시 채널 선택 드롭다운 | 모코코 사냥 TOP N Embed를 표시할 채널 선택 |
| 자동 갱신 간격 입력 (숫자) | Embed 자동 갱신 주기 (분 단위) |
| 저장 버튼 | 설정 내용을 API로 전송 |

#### 탭 4: 신입기간 설정

| UI 요소 | 설명 |
|---------|------|
| 기능 활성화 토글 | 신입기간 역할 자동관리 ON/OFF |
| 신입기간 입력 (숫자) | 역할 부여 기간 (일수) |
| 역할 선택 드롭다운 | 자동 부여할 Discord 역할 선택 (서버 역할 목록) |
| 저장 버튼 | 설정 내용을 API로 전송 |

#### 저장 동작 (공통)

1. 각 탭의 설정을 `POST /api/guilds/{guildId}/newbie/config`로 전송
2. 백엔드에서 `NewbieConfig` DB 저장 및 Redis 캐시 갱신
3. 저장 성공 시 토스트 알림 표시

---

## 데이터 모델

### NewbieConfig (`newbie_config`)

길드별 신규사용자 관리 설정을 저장한다.

| 컬럼 | 타입 | 제약조건 | 설명 |
|-------|------|----------|------|
| `id` | `int` | PK, AUTO_INCREMENT | 내부 ID |
| `guildId` | `varchar` | UNIQUE, NOT NULL | 디스코드 서버 ID |
| `welcomeEnabled` | `boolean` | NOT NULL, DEFAULT `false` | 환영인사 기능 활성화 여부 |
| `welcomeChannelId` | `varchar` | NULLABLE | 환영 메시지 전송 채널 ID |
| `welcomeEmbedTitle` | `varchar` | NULLABLE | Embed 제목 (템플릿 변수 포함 가능) |
| `welcomeEmbedDescription` | `text` | NULLABLE | Embed 설명 (템플릿 변수 포함 가능) |
| `welcomeEmbedColor` | `varchar` | NULLABLE | Embed 색상 (HEX, 예: `#5865F2`) |
| `welcomeEmbedThumbnailUrl` | `varchar` | NULLABLE | Embed 썸네일 이미지 URL |
| `missionEnabled` | `boolean` | NOT NULL, DEFAULT `false` | 미션 기능 활성화 여부 |
| `missionDurationDays` | `int` | NULLABLE | 미션 기간 (일수) |
| `missionTargetPlaytimeHours` | `int` | NULLABLE | 미션 목표 플레이타임 (시간) |
| `missionNotifyChannelId` | `varchar` | NULLABLE | 미션 현황 알림 채널 ID |
| `missionNotifyMessageId` | `varchar` | NULLABLE | 미션 현황 Embed 메시지 ID (Discord message ID) |
| `mocoEnabled` | `boolean` | NOT NULL, DEFAULT `false` | 모코코 사냥 기능 활성화 여부 |
| `mocoRankChannelId` | `varchar` | NULLABLE | 모코코 사냥 순위 표시 채널 ID |
| `mocoRankMessageId` | `varchar` | NULLABLE | 모코코 사냥 순위 Embed 메시지 ID |
| `mocoAutoRefreshMinutes` | `int` | NULLABLE | 모코코 사냥 순위 자동 갱신 간격 (분) |
| `roleEnabled` | `boolean` | NOT NULL, DEFAULT `false` | 신입기간 역할 자동관리 활성화 여부 |
| `roleDurationDays` | `int` | NULLABLE | 신입기간 (일수) |
| `newbieRoleId` | `varchar` | NULLABLE | 자동 부여할 Discord 역할 ID |
| `createdAt` | `timestamp` | NOT NULL, DEFAULT now() | 생성일 |
| `updatedAt` | `timestamp` | NOT NULL, DEFAULT now() | 수정일 |

**인덱스**:
- `UNIQUE(guildId)` — 길드당 하나의 설정

---

### NewbieMission (`newbie_mission`)

신규사용자별 미션 진행 상태를 저장한다.

| 컬럼 | 타입 | 제약조건 | 설명 |
|-------|------|----------|------|
| `id` | `int` | PK, AUTO_INCREMENT | 내부 ID |
| `guildId` | `varchar` | NOT NULL | 디스코드 서버 ID |
| `memberId` | `varchar` | NOT NULL | 디스코드 유저 ID |
| `startDate` | `varchar` | NOT NULL | 미션 시작일 (`YYYYMMDD`) |
| `endDate` | `varchar` | NOT NULL | 미션 마감일 (`YYYYMMDD`) |
| `targetPlaytimeSec` | `int` | NOT NULL | 목표 플레이타임 (초 단위로 저장) |
| `status` | `enum('IN_PROGRESS','COMPLETED','FAILED')` | NOT NULL, DEFAULT `'IN_PROGRESS'` | 미션 상태 |
| `createdAt` | `timestamp` | NOT NULL, DEFAULT now() | 생성일 |
| `updatedAt` | `timestamp` | NOT NULL, DEFAULT now() | 수정일 |

**인덱스**:
- `IDX_newbie_mission_guild_member` — `(guildId, memberId)` — 멤버별 미션 조회
- `IDX_newbie_mission_guild_status` — `(guildId, status)` — 길드별 진행중 미션 조회
- `IDX_newbie_mission_end_date` — `(endDate, status)` — 만료 예정 미션 스케줄러 조회

---

### NewbiePeriod (`newbie_period`)

신입기간 역할 관리 이력을 저장한다.

| 컬럼 | 타입 | 제약조건 | 설명 |
|-------|------|----------|------|
| `id` | `int` | PK, AUTO_INCREMENT | 내부 ID |
| `guildId` | `varchar` | NOT NULL | 디스코드 서버 ID |
| `memberId` | `varchar` | NOT NULL | 디스코드 유저 ID |
| `startDate` | `varchar` | NOT NULL | 신입기간 시작일 (`YYYYMMDD`) |
| `expiresDate` | `varchar` | NOT NULL | 신입기간 만료일 (`YYYYMMDD`) |
| `isExpired` | `boolean` | NOT NULL, DEFAULT `false` | 만료 처리 완료 여부 |
| `createdAt` | `timestamp` | NOT NULL, DEFAULT now() | 생성일 |
| `updatedAt` | `timestamp` | NOT NULL, DEFAULT now() | 수정일 |

**인덱스**:
- `IDX_newbie_period_guild_member` — `(guildId, memberId)` — 멤버별 이력 조회
- `IDX_newbie_period_expires` — `(expiresDate, isExpired)` — 만료 스케줄러 조회

---

### MocoHunting (Redis 전용)

기존 멤버의 모코코 사냥 시간 누적 데이터. 영구 저장이 필요한 경우 별도 PostgreSQL 테이블로 이관 가능하다. MVP에서는 Redis로만 관리한다.

| 키 패턴 | 타입 | 설명 |
|---------|------|------|
| `newbie:moco:total:{guildId}:{hunterId}` | `Hash` | 사냥꾼(기존 멤버)의 신규사용자별 사냥 시간(분) |
| `newbie:moco:rank:{guildId}` | `Sorted Set` | guildId 기준 사냥꾼 총 사냥 시간 순위 (score = 총 사냥분) |

**Hash 필드 구조** (`newbie:moco:total:{guildId}:{hunterId}`):
```
HSET newbie:moco:total:{guildId}:{hunterId} {newbieMemberId} {minutes}
```
- 필드: 신규사용자 memberId
- 값: 해당 신규사용자와의 동시 접속 시간 (분)

---

## Redis 키 구조

| 키 패턴 | TTL | 설명 |
|---------|-----|------|
| `newbie:config:{guildId}` | 1시간 | NewbieConfig 설정 캐시 |
| `newbie:mission:active:{guildId}` | 30분 | 진행중 미션 목록 캐시 |
| `newbie:period:active:{guildId}` | 1시간 | 신입기간 활성 멤버 집합 캐시 (`Set<memberId>`) |
| `newbie:moco:total:{guildId}:{hunterId}` | 없음 | 사냥꾼별 신규사용자별 사냥 시간 Hash |
| `newbie:moco:rank:{guildId}` | 없음 | 길드별 사냥꾼 총 사냥 시간 Sorted Set |

**TTL 정책**:

| 대상 | TTL | 사유 |
|------|-----|------|
| 설정 캐시 | 1시간 | 설정 변경 빈도 낮음, 저장 시 명시적 갱신 |
| 미션 목록 캐시 | 30분 | 갱신 버튼 클릭 시 명시적 갱신 |
| 신입기간 활성 멤버 | 1시간 | 스케줄러 실행 시 갱신 |
| 모코코 사냥 데이터 | 없음 | 영구 누적 (리셋 시 명시적 삭제) |

---

## Voice 도메인 연계

Newbie 도메인은 voice 도메인과 다음 지점에서 연계된다.

| 연계 지점 | 방향 | 설명 |
|-----------|------|------|
| `VoiceDailyEntity` 조회 | newbie → voice | 미션 플레이타임 측정 시 `channelDurationSec` 합산 |
| `VoiceChannelHistory` 조회 | newbie → voice | 미션 플레이횟수 측정 시 세션 수 집계 |
| `voiceStateUpdate` 이벤트 | voice → newbie | 모코코 사냥 시간 측정을 위한 동시 접속 감지 |

**플레이타임 조회 쿼리 조건**:
```
SELECT SUM(channelDurationSec)
FROM voice_daily
WHERE guildId = :guildId
  AND userId = :memberId
  AND date BETWEEN :startDate AND :endDate
  AND channelId != 'GLOBAL'
```

**플레이횟수 조회 쿼리 조건**:
```
SELECT COUNT(*)
FROM voice_channel_history vch
JOIN member m ON m.id = vch.memberId
WHERE m.discordMemberId = :memberId
  AND vch.joinAt BETWEEN :startDatetime AND :endDatetime
```
