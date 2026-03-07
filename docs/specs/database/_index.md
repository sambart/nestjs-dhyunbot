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

## Redis 데이터 구조

### 키 네이밍 패턴

모든 키는 `voice:` 접두사를 사용하며, 계층적 구조를 따른다.

```
voice:{category}:{sub}:{guildId}:{...params}
```

### 키 정의

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

### TTL 정책

| 대상 | TTL | 사유 |
|------|-----|------|
| 세션 데이터 | 12시간 (43,200초) | 서버 크래시 시 고아 세션 자동 정리 |
| 이름 캐시 | 7일 (604,800초) | Discord API 호출 최소화 |
| 시간 누적 데이터 | 없음 | 일별 flush 시 삭제 |

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
