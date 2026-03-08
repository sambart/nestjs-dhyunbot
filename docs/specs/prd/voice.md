# Voice 도메인 PRD

## 개요
디스코드 서버의 음성 채널 활동을 실시간으로 추적하고, 세션 데이터를 Redis에 임시 저장한 뒤 PostgreSQL에 일별 집계로 영구 저장하는 핵심 도메인이다.

## 관련 모듈
- `apps/api/src/channel/voice/` — 음성 채널 핵심 로직
- `apps/api/src/channel/` — 채널 엔티티 및 서비스
- `apps/api/src/member/` — 멤버 엔티티 및 서비스
- `apps/api/src/event/` — 디스코드 이벤트 핸들러
- `apps/api/src/redis/` — Redis 클라이언트

## 아키텍처

```
Discord Voice Event
    │
    ▼
[DiscordVoiceGateway]        ← Discord.js voiceStateUpdate 이벤트 수신
    │
    ▼
[VoiceStateDispatcher]       ← 이벤트 타입 분류 (join/leave/move/mic-toggle)
    │
    ├──► [VoiceJoinHandler]      → Redis 세션 시작 + DB 히스토리 생성
    ├──► [VoiceLeaveHandler]     → Redis 세션 종료 + DB 히스토리 업데이트
    ├──► [VoiceMoveHandler]      → 이전 채널 leave + 새 채널 join 처리
    └──► [MicToggleHandler]      → Redis 마이크 상태 시간 누적
    │
    ▼
[VoiceChannelService]        ← 비즈니스 로직 (세션 관리, 시간 계산)
    │
    ├──► [VoiceRedisRepository]  → Redis 세션/캐시 CRUD
    ├──► [VoiceChannelHistoryService] → PostgreSQL 히스토리 CRUD
    └──► [VoiceDailyFlushService]    → 일별 통계 집계 및 flush
```

## 기능 상세

### F-VOICE-001: 음성 채널 입장 감지
- **트리거**: 유저가 음성 채널에 입장
- **동작**:
  1. Member가 DB에 없으면 생성 (discordMemberId, nickName)
  2. Channel이 DB에 없으면 생성 (discordChannelId, channelName)
  3. VoiceChannelHistory 레코드 생성 (joinAt = now)
  4. Redis에 세션 시작 시간 저장

### F-VOICE-002: 음성 채널 퇴장 감지
- **트리거**: 유저가 음성 채널에서 퇴장
- **동작**:
  1. VoiceChannelHistory 레코드 업데이트 (leftAt = now)
  2. Redis 세션 종료, 체류 시간 계산
  3. VoiceDailyEntity에 시간 누적 (GLOBAL + 개별 채널)

### F-VOICE-003: 음성 채널 이동 감지
- **트리거**: 유저가 음성 채널 A → B로 이동
- **동작**:
  1. 채널 A에 대해 퇴장 처리 (F-VOICE-002)
  2. 채널 B에 대해 입장 처리 (F-VOICE-001)

### F-VOICE-004: 마이크 상태 토글 감지
- **트리거**: 유저가 마이크를 켜거나 끔
- **동작**:
  1. Redis에 마이크 ON/OFF 시간 누적
  2. VoiceDailyEntity의 micOnSec/micOffSec 갱신

### F-VOICE-005: 일별 통계 집계 (Daily Flush)
- **트리거**: 스케줄 또는 세션 종료 시
- **동작**:
  1. Redis 세션 데이터를 VoiceDailyEntity에 flush
  2. GLOBAL 레코드: 유저의 전체 마이크/혼자시간 집계
  3. 개별 채널 레코드: 유저-채널별 체류 시간 집계
- **복합키**: guildId + userId + date + channelId

### F-VOICE-006: 혼자 있는 시간 추적
- **트리거**: 채널에 유저가 1명만 남았을 때
- **동작**: aloneSec 시간 누적 (GLOBAL 레코드에 기록)

## 데이터 모델

### Member
| 컬럼 | 타입 | 설명 |
|-------|------|------|
| id | PK, auto | 내부 ID |
| discordMemberId | string, unique | 디스코드 유저 ID |
| nickName | string | 디스코드 닉네임 |
| createdAt | timestamp | 생성일 |
| updatedAt | timestamp | 수정일 |

### Channel
| 컬럼 | 타입 | 설명 |
|-------|------|------|
| id | PK, auto | 내부 ID |
| discordChannelId | string, unique | 디스코드 채널 ID |
| channelName | string | 채널명 |
| status | enum (ACTIVE/DELETED) | 채널 상태 |
| createdAt | timestamp | 생성일 |
| updatedAt | timestamp | 수정일 |

### VoiceChannelHistory
| 컬럼 | 타입 | 설명 |
|-------|------|------|
| id | PK, auto | 내부 ID |
| channel | FK → Channel | 채널 (eager) |
| member | FK → Member | 멤버 (eager) |
| joinAt | timestamp | 입장 시각 |
| leftAt | timestamp, nullable | 퇴장 시각 |
| duration | computed getter | 체류 시간 (초) |

### VoiceDailyEntity (voice_daily)
| 컬럼 | 타입 | 설명 |
|-------|------|------|
| guildId | PK | 서버 ID |
| userId | PK | 유저 ID |
| date | PK | 날짜 (YYYYMMDD) |
| channelId | PK | 채널 ID 또는 'GLOBAL' |
| channelName | string | 채널명 캐시 |
| userName | string | 유저명 캐시 |
| channelDurationSec | int | 채널 체류 시간 (초) |
| micOnSec | int | 마이크 ON 시간 (초) |
| micOffSec | int | 마이크 OFF 시간 (초) |
| aloneSec | int | 혼자 있던 시간 (초) |

**인덱스**:
- `(guildId, date)` — 날짜별 조회
- `(guildId, channelId, date)` — 채널별 조회
- `(guildId, userId, date)` — 유저별 조회

## Redis 키 구조
- 세션 키: 유저별 현재 음성 세션 정보 (입장 시간, 채널 ID 등)
- 캐시 키: 유저명/채널명 캐시 (7일 TTL)
- 임시 채널 저장소: 채널 정보 임시 보관
- 자동방 대기방 키: 대기방 채널 ID → guildId/userId 매핑

---

## 자동방 생성 (Auto Channel)

> 변경이력: [prd-changelog.md](../../archive/prd-changelog.md)

### 개요

트리거 채널 입장 → 대기방 생성 → 버튼 클릭으로 확정방 전환하는 2단계 자동 음성 채널 생성 기능이다.
확정방 전환 시점부터 기존 voice 세션 추적 시스템과 통합된다.

### 전체 흐름

```
[웹 설정 저장]
    │  트리거 채널에 안내 메시지(설명 + 버튼) 전송/갱신
    ▼
[사용자가 트리거 채널 입장]
    │  대기방 생성 → 사용자 이동 (세션 추적 제외)
    ▼
[안내 메시지에서 버튼 클릭]
    ├─ 하위 선택지 없음 → 대기방 이름/카테고리 변경 → 확정방 전환
    └─ 하위 선택지 있음 → Ephemeral 추가 버튼 표시 → 선택 후 확정방 전환
    │
    ▼
[확정방 전환 완료 → 세션 추적 시작]
    │
    ▼
[모든 사용자 퇴장] → 채널 즉시 삭제
```

### F-VOICE-007: 트리거 채널 입장 감지

- **트리거**: 유저가 트리거 채널로 설정된 음성 채널에 입장
- **전제 조건**: AutoChannelConfig에 해당 채널이 triggerChannelId로 등록되어 있음
- **동작**:
  1. 트리거 채널 여부 확인 (Redis 또는 DB 조회)
  2. F-VOICE-008 (대기방 생성 및 이동) 호출
  3. 트리거 채널 자체에 대한 음성 세션 추적은 시작하지 않음
- **예외**:
  - 트리거 채널 설정이 존재하지 않으면 일반 입장(F-VOICE-001)으로 처리

### F-VOICE-008: 대기방 생성 및 사용자 이동

- **트리거**: F-VOICE-007 호출 시
- **동작**:
  1. AutoChannelConfig의 `waitingRoomTemplate`으로 채널명 생성 (예: `⌛ {username}의 대기방`)
  2. 트리거 채널과 동일한 카테고리에 음성 채널 생성
  3. 생성된 채널을 Redis에 대기방으로 기록 (채널 ID → guildId, userId, triggerChannelId)
  4. 사용자를 대기방으로 이동 (Discord API `guild.members.move`)
  5. 대기방은 세션 추적 대상에서 제외 (VoiceChannelHistory 미생성)
- **네이밍 템플릿 변수**:
  - `{username}`: 유저의 서버 닉네임
- **제약**:
  - 이미 생성한 자동방이 있어도 항상 새 대기방 생성

### F-VOICE-009: 안내 메시지 & 버튼 전송/갱신

- **트리거**: 웹 대시보드에서 자동방 설정 저장 시
- **동작**:
  1. 트리거 채널에 기존 안내 메시지가 있으면 수정(edit), 없으면 신규 전송
  2. 메시지 구성:
     - 설명 텍스트 (`guideMessage`)
     - Discord Button Component 목록 (라벨 + 이모지)
  3. 안내 메시지 ID를 AutoChannelConfig에 저장
- **버튼 속성**:
  - `label`: 버튼 표시 텍스트
  - `emoji`: 버튼 이모지 (선택)
  - `style`: Primary (파란색) 고정
  - `customId`: 버튼 식별자 (내부 ID 기반)
- **제약**:
  - Discord 버튼은 메시지당 최대 25개 (ActionRow 5개 × 버튼 5개)

### F-VOICE-010: 하위 선택지 Ephemeral 처리

- **트리거**: 하위 선택지가 설정된 버튼 클릭
- **동작**:
  1. 버튼 클릭한 유저가 대기방에 있는지 확인
  2. 대기방에 없으면 오류 응답 (ephemeral)
  3. 대기방에 있으면 Ephemeral 메시지로 하위 선택지 버튼 목록 표시
  4. 하위 버튼 클릭 시 F-VOICE-011 (확정방 전환) 호출
- **하위 선택지 버튼 속성**:
  - `label`: 선택지 표시 텍스트
  - `emoji`: 선택지 이모지 (선택)
  - `channelSuffix`: 채널명에 추가될 접미사 (예: `경쟁`, `일반`)
- **예시**: "스팀" 버튼 → Ephemeral로 [일반] [경쟁] 버튼 표시 → "경쟁" 선택

### F-VOICE-011: 확정방 전환

- **트리거**: 하위 선택지 없는 버튼 클릭, 또는 하위 선택지 선택 완료
- **전제 조건**: 버튼 클릭한 유저가 대기방에 입장해 있어야 함
- **동작**:
  1. 버튼 클릭 유저의 대기방 채널 조회 (Redis)
  2. 유저가 대기방에 없으면 오류 응답 (ephemeral)
  3. 확정방 채널명 결정:
     - 기본: `{username}의 {버튼 라벨}` (예: `DHyun의 오버워치`)
     - 하위 선택지 있음: `{username}의 {버튼 라벨} {채널 접미사}` (예: `DHyun의 스팀 경쟁`)
     - 동일 이름 채널이 이미 존재하면 자동 순번 부여 (예: `DHyun의 오버워치 2`)
  4. 대기방 채널의 이름과 카테고리를 변경 (삭제+재생성 아님)
  5. Redis에서 대기방 키 제거
  6. 확정방을 세션 추적 대상으로 등록 (F-VOICE-001과 동일한 세션 시작 처리)
  7. Discord 상호작용에 성공 응답 (ephemeral 또는 defer 처리)
- **채널 권한**: 생성자에게 특별 권한 부여 없음 (서버 기본 권한 적용)

### F-VOICE-012: 자동방 채널 삭제

- **트리거**: 음성 채널에서 마지막 유저가 퇴장 (F-VOICE-002 연계)
- **적용 대상**: 대기방 및 확정방
- **동작**:
  1. 퇴장 이후 채널 잔류 인원 확인
  2. 0명이면 해당 채널이 자동방(대기방 또는 확정방)인지 확인 (Redis)
  3. 자동방이면 Discord API로 채널 즉시 삭제
  4. Redis에서 관련 키 정리
  5. 확정방의 경우 세션 종료 처리 후 삭제 (F-VOICE-002)

---

## 자동방 데이터 모델

### AutoChannelConfig (auto_channel_config)

| 컬럼 | 타입 | 설명 |
|-------|------|------|
| id | PK, auto | 내부 ID |
| guildId | string | 디스코드 서버 ID |
| triggerChannelId | string | 트리거 음성 채널 ID |
| waitingRoomTemplate | string | 대기방 네이밍 템플릿 (예: `⌛ {username}의 대기방`) |
| guideMessage | string | 트리거 채널 안내 메시지 텍스트 |
| guideMessageId | string, nullable | 전송된 안내 메시지 ID |
| createdAt | timestamp | 생성일 |
| updatedAt | timestamp | 수정일 |

**인덱스**:
- `(guildId, triggerChannelId)` unique — 서버+트리거 채널 단위 설정

### AutoChannelButton (auto_channel_button)

| 컬럼 | 타입 | 설명 |
|-------|------|------|
| id | PK, auto | 내부 ID |
| configId | FK → AutoChannelConfig | 소속 설정 |
| label | string | 버튼 표시 라벨 |
| emoji | string, nullable | 버튼 이모지 |
| targetCategoryId | string | 확정방이 이동할 카테고리 ID |
| sortOrder | int | 버튼 표시 순서 |

### AutoChannelSubOption (auto_channel_sub_option)

| 컬럼 | 타입 | 설명 |
|-------|------|------|
| id | PK, auto | 내부 ID |
| buttonId | FK → AutoChannelButton | 소속 버튼 |
| label | string | 하위 선택지 표시 라벨 |
| emoji | string, nullable | 하위 선택지 이모지 |
| channelSuffix | string | 채널명 접미사 (예: `경쟁`) |
| sortOrder | int | 선택지 표시 순서 |

### AutoChannelState (Redis)

대기방 및 확정방의 런타임 상태를 Redis에 저장한다.

| 키 패턴 | 값 | 설명 |
|---------|-----|------|
| `auto_channel:waiting:{channelId}` | `{ guildId, userId, triggerChannelId, configId }` | 대기방 메타데이터 |
| `auto_channel:confirmed:{channelId}` | `{ guildId, userId, buttonId, subOptionId? }` | 확정방 메타데이터 |
| `auto_channel:trigger:{guildId}` | `Set<triggerChannelId>` | 서버별 트리거 채널 ID 집합 (조회 최적화) |
