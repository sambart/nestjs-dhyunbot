# DHyunBot Database Schema

## 개요

DHyunBot은 PostgreSQL을 영구 저장소로, Redis를 실시간 세션 캐싱 및 임시 데이터 저장소로 사용한다.

### 기술 스택

| 구성 요소 | 기술 | 비고 |
|-----------|------|------|
| RDBMS | PostgreSQL 15 | 영구 데이터 저장 |
| ORM | TypeORM 0.3 | `synchronize: false`, 마이그레이션 기반 |
| 캐시 | Redis 7 (ioredis) | 세션, 이름 캐싱 |
| 타임존 | Asia/Seoul | TypeORM 설정 |

### TypeORM 설정

- 엔티티 자동 로드: `autoLoadEntities: true`
- 마이그레이션 테이블: `migrations`
- 마이그레이션 경로: `apps/api/src/migrations/*.ts`
- 로깅: 비프로덕션 환경에서 `advanced-console`

---

## PostgreSQL 엔티티

### 엔티티 관계도 (ERD)

```
┌──────────────┐       ┌─────────────────────────┐       ┌──────────────┐
│   Member     │       │  VoiceChannelHistory     │       │   Channel    │
├──────────────┤       ├─────────────────────────┤       ├──────────────┤
│ PK id        │──1:N─►│ PK id                   │◄─N:1──│ PK id        │
│ discordMem…  │       │ FK member               │       │ discordCha…  │
│ nickname     │       │ FK channel              │       │ channelName  │
│ createdAt    │       │ joinedAt                │       │ status       │
│ updatedAt    │       │ leftAt                  │       │ createdAt    │
└──────────────┘       │ createdAt               │       │ updatedAt    │
                       │ updatedAt               │       └──────────────┘
                       └─────────────────────────┘

┌───────────────────────────────────────────────────┐
│              VoiceDailyEntity (voice_daily)        │
├───────────────────────────────────────────────────┤
│ PK guildId + userId + date + channelId            │
│ channelName, userName                             │
│ channelDurationSec, micOnSec, micOffSec, aloneSec │
└───────────────────────────────────────────────────┘
  (독립 테이블 — FK 없음, Discord ID 직접 저장)

┌────────────────────────┐       ┌────────────────────────┐       ┌──────────────────────────┐
│  AutoChannelConfig     │       │  AutoChannelButton      │       │  AutoChannelSubOption    │
├────────────────────────┤       ├────────────────────────┤       ├──────────────────────────┤
│ PK id                  │──1:N─►│ PK id                  │──1:N─►│ PK id                    │
│ guildId                │       │ FK configId            │       │ FK buttonId              │
│ triggerChannelId       │       │ label                  │       │ label                    │
│ waitingRoomTemplate    │       │ emoji                  │       │ emoji                    │
│ guideMessage           │       │ targetCategoryId       │       │ channelSuffix            │
│ guideMessageId         │       │ sortOrder              │       │ sortOrder                │
│ createdAt              │       └────────────────────────┘       └──────────────────────────┘
│ updatedAt              │         ON DELETE CASCADE                ON DELETE CASCADE
└────────────────────────┘         IDX(configId)                    IDX(buttonId)
  UNIQUE(guildId, triggerChannelId)
```

---

### 1. Member

| 컬럼 | 타입 | 제약조건 | 설명 |
|-------|------|----------|------|
| `id` | `int` | PK, AUTO_INCREMENT | 내부 ID |
| `discordMemberId` | `varchar` | UNIQUE, NOT NULL | 디스코드 유저 ID |
| `nickname` | `varchar` | NOT NULL (컬럼명: `nickName`) | 디스코드 닉네임 |
| `createdAt` | `timestamp` | NOT NULL, DEFAULT now() | 생성일 |
| `updatedAt` | `timestamp` | NOT NULL, DEFAULT now() | 수정일 |

- **스키마**: `public`
- **관계**: `VoiceChannelHistory` (1:N)
- **파일**: `apps/api/src/member/member.entity.ts`

---

### 2. Channel

| 컬럼 | 타입 | 제약조건 | 설명 |
|-------|------|----------|------|
| `id` | `int` | PK, AUTO_INCREMENT | 내부 ID |
| `discordChannelId` | `varchar` | UNIQUE, NOT NULL | 디스코드 채널 ID |
| `channelName` | `varchar` | NOT NULL | 채널명 |
| `status` | `enum('ACTIVE','DELETED')` | NOT NULL, DEFAULT `'ACTIVE'` | 채널 상태 |
| `createdAt` | `timestamp` | NOT NULL, DEFAULT now() | 생성일 |
| `updatedAt` | `timestamp` | NOT NULL, DEFAULT now() | 수정일 |

- **스키마**: `public`
- **관계**: `VoiceChannelHistory` (1:N)
- **파일**: `apps/api/src/channel/channel.entity.ts`

---

### 3. VoiceChannelHistory

| 컬럼 | 타입 | 제약조건 | 설명 |
|-------|------|----------|------|
| `id` | `int` | PK, AUTO_INCREMENT | 내부 ID |
| `channelId` | `int` | FK → Channel.id | 채널 참조 |
| `memberId` | `int` | FK → Member.id | 멤버 참조 |
| `joinAt` | `timestamp` | NOT NULL | 입장 시각 |
| `leftAt` | `timestamp` | NULLABLE | 퇴장 시각 |
| `createdAt` | `timestamp` | NOT NULL, DEFAULT now() | 생성일 |
| `updatedAt` | `timestamp` | NOT NULL, DEFAULT now() | 수정일 |

- **스키마**: `public`
- **관계**: Channel (N:1), Member (N:1)
- **계산 속성**: `duration` — `leftAt - joinedAt` (초 단위, getter)
- **파일**: `apps/api/src/channel/voice/domain/voice-channel-history.entity.ts`

---

### 4. VoiceDailyEntity (`voice_daily`)

| 컬럼 | 타입 | 제약조건 | 설명 |
|-------|------|----------|------|
| `guildId` | `varchar` | PK | 디스코드 서버 ID |
| `userId` | `varchar` | PK | 디스코드 유저 ID |
| `date` | `varchar` | PK | 날짜 (`YYYYMMDD` 형식) |
| `channelId` | `varchar` | PK | 채널 ID 또는 `'GLOBAL'` |
| `channelName` | `varchar` | DEFAULT `''` | 채널명 캐시 (비정규화) |
| `userName` | `varchar` | DEFAULT `''` | 유저명 캐시 (비정규화) |
| `channelDurationSec` | `int` | DEFAULT `0` | 채널 체류 시간 (초) |
| `micOnSec` | `int` | DEFAULT `0` | 마이크 ON 시간 (초) |
| `micOffSec` | `int` | DEFAULT `0` | 마이크 OFF 시간 (초) |
| `aloneSec` | `int` | DEFAULT `0` | 혼자 있던 시간 (초) |

- **복합 PK**: `(guildId, userId, date, channelId)`
- **테이블명**: `voice_daily` (커스텀 지정)
- **파일**: `apps/api/src/channel/voice/domain/voice-daily.entity.ts`

#### 인덱스

| 인덱스 | 컬럼 | 용도 |
|--------|------|------|
| `IDX_voice_daily_guild_date` | `(guildId, date)` | 날짜별 전체 조회 |
| `IDX_voice_daily_guild_channel_date` | `(guildId, channelId, date)` | 채널별 조회 |
| `IDX_voice_daily_guild_user_date` | `(guildId, userId, date)` | 유저별 조회 |

#### channelId 규칙

| 값 | 의미 |
|----|------|
| `'GLOBAL'` | 유저의 전체 집계 (마이크, 혼자시간 등) |
| 실제 채널 ID | 해당 채널에서의 체류 시간 |

---

### 5. AutoChannelConfig (`auto_channel_config`)

자동방 기능의 서버별 트리거 채널 설정을 저장한다. 서버(guildId)와 트리거 채널(triggerChannelId)의 조합이 유일하게 존재한다.

| 컬럼 | 타입 | 제약조건 | 설명 |
|-------|------|----------|------|
| `id` | `int` | PK, AUTO_INCREMENT | 내부 ID |
| `guildId` | `varchar` | NOT NULL | 디스코드 서버 ID |
| `triggerChannelId` | `varchar` | NOT NULL | 트리거 음성 채널 ID |
| `waitingRoomTemplate` | `varchar` | NOT NULL | 대기방 네이밍 템플릿 (예: `⌛ {username}의 대기방`) |
| `guideMessage` | `text` | NOT NULL | 트리거 채널 안내 메시지 텍스트 |
| `guideMessageId` | `varchar` | NULLABLE | 전송된 안내 메시지 ID (Discord message ID) |
| `createdAt` | `timestamp` | NOT NULL, DEFAULT now() | 생성일 |
| `updatedAt` | `timestamp` | NOT NULL, DEFAULT now() | 수정일 |

- **스키마**: `public`
- **관계**: `AutoChannelButton` (1:N)
- **파일**: `apps/api/src/channel/auto/domain/auto-channel-config.entity.ts`

#### 인덱스

| 인덱스 | 컬럼 | 용도 |
|--------|------|------|
| `UQ_auto_channel_config_guild_trigger` | `(guildId, triggerChannelId)` UNIQUE | 서버+트리거 채널 단위 중복 방지 |

---

### 6. AutoChannelButton (`auto_channel_button`)

트리거 채널 안내 메시지에 표시되는 Discord Button Component 설정을 저장한다.

| 컬럼 | 타입 | 제약조건 | 설명 |
|-------|------|----------|------|
| `id` | `int` | PK, AUTO_INCREMENT | 내부 ID |
| `configId` | `int` | FK → AutoChannelConfig.id, NOT NULL, ON DELETE CASCADE | 소속 설정 |
| `label` | `varchar` | NOT NULL | 버튼 표시 라벨 |
| `emoji` | `varchar` | NULLABLE | 버튼 이모지 |
| `targetCategoryId` | `varchar` | NOT NULL | 확정방이 이동할 Discord 카테고리 ID |
| `sortOrder` | `int` | NOT NULL, DEFAULT `0` | 버튼 표시 순서 |

- **스키마**: `public`
- **관계**: AutoChannelConfig (N:1), `AutoChannelSubOption` (1:N)
- **파일**: `apps/api/src/channel/auto/domain/auto-channel-button.entity.ts`

#### 인덱스

| 인덱스 | 컬럼 | 용도 |
|--------|------|------|
| `IDX_auto_channel_button_config` | `(configId)` | 설정별 버튼 목록 조회 |

---

### 7. AutoChannelSubOption (`auto_channel_sub_option`)

버튼 클릭 시 Ephemeral 메시지로 표시되는 하위 선택지 설정을 저장한다.

| 컬럼 | 타입 | 제약조건 | 설명 |
|-------|------|----------|------|
| `id` | `int` | PK, AUTO_INCREMENT | 내부 ID |
| `buttonId` | `int` | FK → AutoChannelButton.id, NOT NULL, ON DELETE CASCADE | 소속 버튼 |
| `label` | `varchar` | NOT NULL | 하위 선택지 표시 라벨 |
| `emoji` | `varchar` | NULLABLE | 하위 선택지 이모지 |
| `channelSuffix` | `varchar` | NOT NULL | 채널명 접미사 (예: `경쟁`) |
| `sortOrder` | `int` | NOT NULL, DEFAULT `0` | 선택지 표시 순서 |

- **스키마**: `public`
- **관계**: AutoChannelButton (N:1)
- **파일**: `apps/api/src/channel/auto/domain/auto-channel-sub-option.entity.ts`

#### 인덱스

| 인덱스 | 컬럼 | 용도 |
|--------|------|------|
| `IDX_auto_channel_sub_option_button` | `(buttonId)` | 버튼별 하위 선택지 목록 조회 |

---

## Redis 데이터 구조

### 키 네이밍 패턴

모든 키는 도메인 접두사를 사용하며, 계층적 구조를 따른다.

```
voice:{category}:{sub}:{guildId}:{...params}
auto_channel:{category}:{...params}
```

### voice 키 정의

| 키 패턴 | TTL | 설명 |
|---------|-----|------|
| `voice:session:{guildId}:{userId}` | 12시간 | 현재 음성 세션 정보 |
| `voice:duration:channel:{guildId}:{userId}:{date}:{channelId}` | — | 채널별 체류 시간 누적 |
| `voice:duration:mic:{guildId}:{userId}:{date}:{on\|off}` | — | 마이크 ON/OFF 시간 누적 |
| `voice:duration:alone:{guildId}:{userId}:{date}` | — | 혼자 있던 시간 누적 |
| `voice:channel:name:{guildId}:{channelId}` | 7일 | 채널명 캐시 |
| `voice:user:name:{guildId}:{userId}` | 7일 | 유저명 캐시 |

- **키 생성 함수**: `apps/api/src/channel/voice/infrastructure/voice-cache.keys.ts`
- **저장소**: `apps/api/src/channel/voice/infrastructure/voice-redis.repository.ts`

### VoiceSession 구조

```typescript
interface VoiceSession {
  channelId: string;      // 현재 접속 중인 채널 ID
  joinedAt: number;       // 입장 시각 (ms timestamp)
  mic: boolean;           // 마이크 상태
  alone: boolean;         // 혼자 여부
  lastUpdatedAt: number;  // 마지막 시간 계산 시점 (ms timestamp)
  date: string;           // 날짜 (YYYYMMDD)
}
```

### auto_channel 키 정의

자동방의 런타임 상태를 저장한다. 채널 삭제 또는 확정방 전환 시 해당 키를 삭제한다.

| 키 패턴 | TTL | 설명 |
|---------|-----|------|
| `auto_channel:waiting:{channelId}` | 12시간 | 대기방 메타데이터 |
| `auto_channel:confirmed:{channelId}` | 12시간 | 확정방 메타데이터 |
| `auto_channel:trigger:{guildId}` | — | 서버별 트리거 채널 ID 집합 (조회 최적화) |

#### AutoChannelWaitingState 구조

```typescript
interface AutoChannelWaitingState {
  guildId: string;          // 디스코드 서버 ID
  userId: string;           // 대기방 소유 유저 ID
  triggerChannelId: string; // 진입한 트리거 채널 ID
  configId: number;         // auto_channel_config PK
}
```

#### AutoChannelConfirmedState 구조

```typescript
interface AutoChannelConfirmedState {
  guildId: string;       // 디스코드 서버 ID
  userId: string;        // 확정방 소유 유저 ID
  buttonId: number;      // auto_channel_button PK
  subOptionId?: number;  // auto_channel_sub_option PK (하위 선택지 선택 시)
}
```

#### auto_channel:trigger 구조

Redis Set 자료구조로 저장된다. 봇 기동 시 또는 설정 저장 시 갱신된다.

```
SADD auto_channel:trigger:{guildId} {triggerChannelId}
```

### TTL 정책

| 대상 | TTL | 사유 |
|------|-----|------|
| 세션 데이터 | 12시간 (43,200초) | 서버 크래시 시 고아 세션 자동 정리 |
| 이름 캐시 | 7일 (604,800초) | Discord API 호출 최소화 |
| 시간 누적 데이터 | 없음 | 일별 flush 시 삭제 |
| 대기방 상태 | 12시간 (43,200초) | 봇 크래시 시 고아 대기방 자동 정리 |
| 확정방 상태 | 12시간 (43,200초) | voice session과 동일한 생명주기. 봇 크래시 시 고아 키 자동 정리 |
| 트리거 채널 집합 | 없음 | 설정 변경 시 명시적 갱신 |

---

## 데이터 흐름

### 음성 세션 라이프사이클

```
[입장]
  1. Member/Channel → PostgreSQL upsert
  2. VoiceChannelHistory → PostgreSQL insert (joinAt)
  3. VoiceSession → Redis set (TTL 12h)

[마이크 토글]
  4. mic duration → Redis incrBy

[퇴장]
  5. VoiceSession → Redis get & delete
  6. VoiceChannelHistory → PostgreSQL update (leftAt)
  7. 시간 계산 → Redis duration keys에 누적
  8. VoiceDailyEntity → PostgreSQL upsert (GLOBAL + 개별 채널)
```

### 일별 집계 (Daily Flush)

```
Redis 누적 데이터 ──► VoiceDailyEntity (voice_daily)
                      ├── GLOBAL 레코드: 전체 마이크/혼자시간
                      └── 채널별 레코드: 채널 체류 시간
```

### 자동방 라이프사이클

```
[웹 설정 저장]
  1. auto_channel_config → PostgreSQL upsert (guildId, triggerChannelId, 템플릿, 안내 메시지)
  2. auto_channel_button → PostgreSQL insert/replace (configId, label, emoji, targetCategoryId, sortOrder)
  3. auto_channel_sub_option → PostgreSQL insert/replace (buttonId, label, emoji, channelSuffix, sortOrder)
  4. Discord API → 트리거 채널에 안내 메시지 전송 또는 수정
  5. auto_channel_config.guideMessageId → PostgreSQL update (Discord message ID 저장)
  6. auto_channel:trigger:{guildId} → Redis SADD (triggerChannelId 추가)

[트리거 채널 입장 — 대기방 생성]
  1. auto_channel:trigger:{guildId} → Redis SISMEMBER (트리거 채널 여부 확인)
  2. Discord API → 대기방 음성 채널 생성 (waitingRoomTemplate 적용)
  3. Discord API → 사용자를 대기방으로 이동
  4. auto_channel:waiting:{channelId} → Redis set (guildId, userId, triggerChannelId, configId, TTL 12h)
  ※ VoiceChannelHistory 미생성 (세션 추적 제외)

[버튼 클릭 — 하위 선택지 없음 또는 하위 선택지 선택 완료 — 확정방 전환]
  1. auto_channel:waiting:{channelId} → Redis get (대기방 소유자 확인)
  2. Discord API → 대기방 채널명·카테고리 변경 (삭제+재생성 아님)
  3. auto_channel:waiting:{channelId} → Redis delete
  4. auto_channel:confirmed:{channelId} → Redis set (guildId, userId, buttonId, subOptionId?, TTL 12h)
  5. Member/Channel → PostgreSQL upsert (F-VOICE-001과 동일)
  6. VoiceChannelHistory → PostgreSQL insert (joinAt, 확정방부터 세션 추적 시작)
  7. voice:session:{guildId}:{userId} → Redis set (TTL 12h)

[모든 사용자 퇴장 — 채널 삭제]
  대기방:
    1. auto_channel:waiting:{channelId} → Redis get & delete
    2. Discord API → 채널 즉시 삭제
  확정방:
    1. voice:session:{guildId}:{userId} → Redis get & delete
    2. VoiceChannelHistory → PostgreSQL update (leftAt)
    3. Redis duration keys에 시간 누적 → VoiceDailyEntity upsert (F-VOICE-002와 동일)
    4. auto_channel:confirmed:{channelId} → Redis delete
    5. Discord API → 채널 즉시 삭제
```
