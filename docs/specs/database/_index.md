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

┌──────────────────────────────────────────────────────────────────────┐
│                      NewbieConfig (newbie_config)                    │
├──────────────────────────────────────────────────────────────────────┤
│ PK id                                                                │
│ guildId (UNIQUE)                                                     │
│ welcomeEnabled, welcomeChannelId, welcomeEmbedTitle                  │
│ welcomeEmbedDescription, welcomeEmbedColor, welcomeEmbedThumbnailUrl │
│ missionEnabled, missionDurationDays, missionTargetPlaytimeHours      │
│ missionNotifyChannelId, missionNotifyMessageId                       │
│ mocoEnabled, mocoRankChannelId, mocoRankMessageId                    │
│ mocoAutoRefreshMinutes                                               │
│ roleEnabled, roleDurationDays, newbieRoleId                          │
│ createdAt, updatedAt                                                 │
└──────────────────────────────────────────────────────────────────────┘
  (독립 테이블 — FK 없음, Discord ID 직접 저장)

┌────────────────────────────┐       ┌──────────────────────────────┐
│  StatusPrefixConfig        │       │  StatusPrefixButton           │
│  (status_prefix_config)    │       │  (status_prefix_button)       │
├────────────────────────────┤       ├──────────────────────────────┤
│ PK id                      │──1:N─►│ PK id                        │
│ guildId (UNIQUE)           │       │ FK configId                  │
│ enabled                    │       │ label                        │
│ channelId                  │       │ emoji                        │
│ messageId                  │       │ prefix                       │
│ embedTitle                 │       │ type (PREFIX|RESET)          │
│ embedDescription           │       │ sortOrder                    │
│ embedColor                 │       │ createdAt                    │
│ prefixTemplate             │       │ updatedAt                    │
│ createdAt                  │       └──────────────────────────────┘
│ updatedAt                  │         ON DELETE CASCADE
└────────────────────────────┘         IDX(configId, sortOrder)
  UNIQUE(guildId)

┌──────────────────────────────────┐       ┌──────────────────────────────────┐
│    NewbieMission (newbie_mission) │       │    NewbiePeriod (newbie_period)   │
├──────────────────────────────────┤       ├──────────────────────────────────┤
│ PK id                            │       │ PK id                            │
│ guildId                          │       │ guildId                          │
│ memberId                         │       │ memberId                         │
│ startDate (YYYYMMDD)             │       │ startDate (YYYYMMDD)             │
│ endDate (YYYYMMDD)               │       │ expiresDate (YYYYMMDD)           │
│ targetPlaytimeSec                │       │ isExpired                        │
│ status (enum)                    │       │ createdAt, updatedAt             │
│ createdAt, updatedAt             │       └──────────────────────────────────┘
└──────────────────────────────────┘         IDX(guildId, memberId)
  IDX(guildId, memberId)                      IDX(guildId, isExpired)
  IDX(guildId, status)                        IDX(expiresDate, isExpired)
  IDX(status, endDate)

┌──────────────────────────────────────────┐       ┌──────────────────────────────────────────┐
│  NewbieMissionTemplate                   │       │  NewbieMocoTemplate                      │
│  (newbie_mission_template)               │       │  (newbie_moco_template)                  │
├──────────────────────────────────────────┤       ├──────────────────────────────────────────┤
│ PK id                                    │       │ PK id                                    │
│ guildId (UNIQUE)                         │       │ guildId (UNIQUE)                         │
│ titleTemplate                            │       │ titleTemplate                            │
│ headerTemplate                           │       │ bodyTemplate                             │
│ itemTemplate                             │       │ itemTemplate                             │
│ footerTemplate                           │       │ footerTemplate                           │
│ statusMapping (json)                     │       │ createdAt, updatedAt                     │
│ createdAt, updatedAt                     │       └──────────────────────────────────────────┘
└──────────────────────────────────────────┘         (독립 테이블 — FK 없음, 레코드 없으면 기본값 사용)
  (독립 테이블 — FK 없음, 레코드 없으면 기본값 사용)
  UNIQUE(guildId)                                    UNIQUE(guildId)
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

### 8. NewbieConfig (`newbie_config`)

길드별 신규사용자 관리 설정을 저장한다. 환영인사, 미션, 모코코 사냥, 신입기간 역할 관련 필드를 단일 테이블에 통합한다.

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

- **스키마**: `public`
- **관계**: 독립 테이블 (FK 없음, Discord ID 직접 저장)
- **파일**: `apps/api/src/newbie/domain/newbie-config.entity.ts`

#### 인덱스

| 인덱스 | 컬럼 | 용도 |
|--------|------|------|
| `UQ_newbie_config_guild` | `(guildId)` UNIQUE | 길드당 하나의 설정 보장 |

---

### 9. NewbieMission (`newbie_mission`)

신규사용자별 미션 진행 상태를 저장한다.

| 컬럼 | 타입 | 제약조건 | 설명 |
|-------|------|----------|------|
| `id` | `int` | PK, AUTO_INCREMENT | 내부 ID |
| `guildId` | `varchar` | NOT NULL | 디스코드 서버 ID |
| `memberId` | `varchar` | NOT NULL | 디스코드 유저 ID |
| `startDate` | `varchar` | NOT NULL | 미션 시작일 (`YYYYMMDD`) |
| `endDate` | `varchar` | NOT NULL | 미션 마감일 (`YYYYMMDD`) |
| `targetPlaytimeSec` | `int` | NOT NULL | 목표 플레이타임 (초 단위로 변환 저장) |
| `status` | `enum('IN_PROGRESS','COMPLETED','FAILED')` | NOT NULL, DEFAULT `'IN_PROGRESS'` | 미션 상태 |
| `createdAt` | `timestamp` | NOT NULL, DEFAULT now() | 생성일 |
| `updatedAt` | `timestamp` | NOT NULL, DEFAULT now() | 수정일 |

- **스키마**: `public`
- **관계**: 독립 테이블 (FK 없음, Discord ID 직접 저장)
- **파일**: `apps/api/src/newbie/domain/newbie-mission.entity.ts`

#### 인덱스

| 인덱스 | 컬럼 | 용도 |
|--------|------|------|
| `IDX_newbie_mission_guild_member` | `(guildId, memberId)` | 멤버별 미션 조회 |
| `IDX_newbie_mission_guild_status` | `(guildId, status)` | 길드별 진행중 미션 조회 |
| `IDX_newbie_mission_status_end_date` | `(status, endDate)` | 만료 예정 미션 스케줄러 조회 (`status='IN_PROGRESS' AND endDate < today`) |

#### 인덱스 설계 근거

만료 스케줄러 쿼리는 `status = 'IN_PROGRESS'` 등치 조건 이후 `endDate < today` 범위 조건을 사용한다. 등치 조건 컬럼을 선두에 두는 것이 범위 조건 컬럼을 선두에 두는 것보다 인덱스 선택도가 높아 효율적이다. 기존의 `(endDate, status)` 순서에서 `(status, endDate)` 순서로 변경한다.

---

### 10. NewbiePeriod (`newbie_period`)

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

- **스키마**: `public`
- **관계**: 독립 테이블 (FK 없음, Discord ID 직접 저장)
- **파일**: `apps/api/src/newbie/domain/newbie-period.entity.ts`

#### 인덱스

| 인덱스 | 컬럼 | 용도 |
|--------|------|------|
| `IDX_newbie_period_guild_member` | `(guildId, memberId)` | 멤버별 이력 조회 |
| `IDX_newbie_period_guild_active` | `(guildId, isExpired)` | 길드 내 활성 신입기간 멤버 집합 조회 (모코코 사냥 캐시 워밍업) |
| `IDX_newbie_period_expires` | `(expiresDate, isExpired)` | 만료 스케줄러 조회 |

#### 인덱스 설계 근거

모코코 사냥 측정 시 `newbie:period:active:{guildId}` 캐시 미스가 발생하면 `WHERE guildId = ? AND isExpired = false` 조건으로 DB를 조회한다. 기존 `IDX_newbie_period_guild_member`는 `memberId`까지 조건이 있는 단건 조회에 최적화되어 있어 이 쿼리를 커버하지 못한다. `IDX_newbie_period_guild_active`를 추가하여 활성 멤버 전체 조회를 지원한다.

---

### 11. NewbieMissionTemplate (`newbie_mission_template`)

미션 Embed 표시 형식을 길드별로 커스터마이징하는 템플릿을 저장한다. `NewbieConfig`와 별도 테이블로 분리되어 있으며, 레코드가 없으면 F-NEWBIE-002에 정의된 기본값을 사용한다.

| 컬럼 | 타입 | 제약조건 | 설명 |
|-------|------|----------|------|
| `id` | `int` | PK, AUTO_INCREMENT | 내부 ID |
| `guildId` | `varchar` | UNIQUE, NOT NULL | 디스코드 서버 ID |
| `titleTemplate` | `varchar` | NULLABLE | Embed 제목 템플릿. 허용 변수: `{totalCount}` |
| `headerTemplate` | `text` | NULLABLE | description 최상단 헤더 템플릿. 허용 변수: `{totalCount}`, `{inProgressCount}`, `{completedCount}`, `{failedCount}` |
| `itemTemplate` | `text` | NULLABLE | 멤버별 미션 현황 항목 템플릿 (반복 렌더링). 허용 변수: `{username}`, `{mention}`, `{startDate}`, `{endDate}`, `{statusEmoji}`, `{statusText}`, `{playtimeHour}`, `{playtimeMin}`, `{playtimeSec}`, `{playtime}`, `{playCount}`, `{targetPlaytime}`, `{daysLeft}` |
| `footerTemplate` | `varchar` | NULLABLE | Embed footer 템플릿. 허용 변수: `{updatedAt}` |
| `statusMapping` | `json` | NULLABLE | 상태별 이모지·텍스트 매핑. 형식: `{"IN_PROGRESS":{"emoji":"🟡","text":"진행중"},"COMPLETED":{"emoji":"✅","text":"완료"},"FAILED":{"emoji":"❌","text":"실패"}}` |
| `createdAt` | `timestamp` | NOT NULL, DEFAULT now() | 생성일 |
| `updatedAt` | `timestamp` | NOT NULL, DEFAULT now() | 수정일 |

- **스키마**: `public`
- **관계**: 독립 테이블 (FK 없음, Discord ID 직접 저장). 레코드가 없으면 기본값 사용.
- **파일**: `apps/api/src/newbie/domain/newbie-mission-template.entity.ts`

#### 인덱스

| 인덱스 | 컬럼 | 용도 |
|--------|------|------|
| `UQ_newbie_mission_template_guild` | `(guildId)` UNIQUE | 길드당 하나의 템플릿 보장 |

---

### 12. NewbieMocoTemplate (`newbie_moco_template`)

모코코 사냥 Embed 표시 형식을 길드별로 커스터마이징하는 템플릿을 저장한다. `NewbieConfig`와 별도 테이블로 분리되어 있으며, 레코드가 없으면 F-NEWBIE-003에 정의된 기본값을 사용한다.

| 컬럼 | 타입 | 제약조건 | 설명 |
|-------|------|----------|------|
| `id` | `int` | PK, AUTO_INCREMENT | 내부 ID |
| `guildId` | `varchar` | UNIQUE, NOT NULL | 디스코드 서버 ID |
| `titleTemplate` | `varchar` | NULLABLE | Embed 제목 템플릿. 허용 변수: `{rank}`, `{hunterName}` |
| `bodyTemplate` | `text` | NULLABLE | 사냥꾼 1명 페이지 전체 본문 템플릿. `{mocoList}` 위치에 항목 템플릿 반복 삽입. 허용 변수: `{totalMinutes}`, `{mocoList}` |
| `itemTemplate` | `varchar` | NULLABLE | 도움받은 모코코 한 줄 항목 템플릿. 허용 변수: `{newbieName}`, `{minutes}` |
| `footerTemplate` | `varchar` | NULLABLE | Embed footer 템플릿. 허용 변수: `{currentPage}`, `{totalPages}`, `{interval}` |
| `createdAt` | `timestamp` | NOT NULL, DEFAULT now() | 생성일 |
| `updatedAt` | `timestamp` | NOT NULL, DEFAULT now() | 수정일 |

- **스키마**: `public`
- **관계**: 독립 테이블 (FK 없음, Discord ID 직접 저장). 레코드가 없으면 기본값 사용.
- **파일**: `apps/api/src/newbie/domain/newbie-moco-template.entity.ts`

#### 인덱스

| 인덱스 | 컬럼 | 용도 |
|--------|------|------|
| `UQ_newbie_moco_template_guild` | `(guildId)` UNIQUE | 길드당 하나의 템플릿 보장 |

---

### 13. StatusPrefixConfig (`status_prefix_config`)

길드별 Status Prefix 기능 설정을 저장한다. 길드당 하나의 설정이 존재하며, 안내 Embed 메시지 구성과 접두사 형식 템플릿을 포함한다.

| 컬럼 | 타입 | 제약조건 | 설명 |
|-------|------|----------|------|
| `id` | `int` | PK, AUTO_INCREMENT | 내부 ID |
| `guildId` | `varchar` | UNIQUE, NOT NULL | 디스코드 서버 ID |
| `enabled` | `boolean` | NOT NULL, DEFAULT `false` | 기능 활성화 여부 |
| `channelId` | `varchar` | NULLABLE | 안내 메시지를 표시할 텍스트 채널 ID |
| `messageId` | `varchar` | NULLABLE | 전송된 안내 Embed 메시지 ID (Discord message ID) |
| `embedTitle` | `varchar` | NULLABLE | Embed 제목 |
| `embedDescription` | `text` | NULLABLE | Embed 설명 |
| `embedColor` | `varchar` | NULLABLE | Embed 색상 (HEX, 예: `#5865F2`) |
| `prefixTemplate` | `varchar` | NOT NULL, DEFAULT `'[{prefix}] {nickname}'` | 닉네임 변환 템플릿 (`{prefix}`, `{nickname}` 변수 사용) |
| `createdAt` | `timestamp` | NOT NULL, DEFAULT now() | 생성일 |
| `updatedAt` | `timestamp` | NOT NULL, DEFAULT now() | 수정일 |

- **스키마**: `public`
- **관계**: `StatusPrefixButton` (1:N)
- **파일**: `apps/api/src/status-prefix/domain/status-prefix-config.entity.ts`

#### 인덱스

| 인덱스 | 컬럼 | 용도 |
|--------|------|------|
| `UQ_status_prefix_config_guild` | `(guildId)` UNIQUE | 길드당 하나의 설정 보장 |

---

### 14. StatusPrefixButton (`status_prefix_button`)

길드별 접두사 버튼 목록을 저장한다. Discord 안내 메시지의 ActionRow에 표시되는 버튼 각각에 대응하며, 접두사 적용(PREFIX)과 원래대로 복원(RESET) 두 가지 타입을 가진다.

| 컬럼 | 타입 | 제약조건 | 설명 |
|-------|------|----------|------|
| `id` | `int` | PK, AUTO_INCREMENT | 내부 ID |
| `configId` | `int` | FK → StatusPrefixConfig.id, NOT NULL, ON DELETE CASCADE | 소속 설정 |
| `label` | `varchar` | NOT NULL | Discord 버튼 표시 라벨 (예: `관전 적용`) |
| `emoji` | `varchar` | NULLABLE | Discord 버튼 이모지 (예: `👁`) |
| `prefix` | `varchar` | NULLABLE | 닉네임에 삽입될 접두사 텍스트 (type = `PREFIX` 시 필수, `RESET` 시 NULL) |
| `type` | `enum('PREFIX','RESET')` | NOT NULL | 버튼 동작 타입 |
| `sortOrder` | `int` | NOT NULL, DEFAULT `0` | 버튼 표시 순서 |
| `createdAt` | `timestamp` | NOT NULL, DEFAULT now() | 생성일 |
| `updatedAt` | `timestamp` | NOT NULL, DEFAULT now() | 수정일 |

- **스키마**: `public`
- **관계**: StatusPrefixConfig (N:1)
- **파일**: `apps/api/src/status-prefix/domain/status-prefix-button.entity.ts`

#### 인덱스

| 인덱스 | 컬럼 | 용도 |
|--------|------|------|
| `IDX_status_prefix_button_config` | `(configId, sortOrder)` | 설정별 버튼 목록을 순서대로 조회 |

#### 버튼 타입 정의

| 타입 | customId 형식 | 동작 |
|------|---------------|------|
| `PREFIX` | `status_prefix:{buttonId}` | 닉네임에 접두사 적용 |
| `RESET` | `status_reset:{buttonId}` | 원래 닉네임으로 복원 |

---

## Redis 데이터 구조

### 키 네이밍 패턴

모든 키는 도메인 접두사를 사용하며, 계층적 구조를 따른다.

```
voice:{category}:{sub}:{guildId}:{...params}
auto_channel:{category}:{...params}
newbie:{category}:{...params}
status_prefix:{category}:{...params}
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

### newbie 키 정의

신규사용자 도메인의 설정 캐시, 미션 목록 캐시, 신입기간 활성 멤버 집합, 모코코 사냥 누적 데이터를 저장한다.

| 키 패턴 | TTL | 자료구조 | 설명 |
|---------|-----|----------|------|
| `newbie:config:{guildId}` | 1시간 | String (JSON) | NewbieConfig 설정 캐시 |
| `newbie:mission:active:{guildId}` | 30분 | String (JSON) | 진행중 미션 목록 캐시 (NewbieMission[] JSON 직렬화) |
| `newbie:period:active:{guildId}` | 1시간 | Set | 신입기간 활성 멤버 집합 (`Set<memberId>`) |
| `newbie:moco:total:{guildId}:{hunterId}` | 없음 | Hash | 사냥꾼(기존 멤버)의 신규사용자별 사냥 시간 |
| `newbie:moco:rank:{guildId}` | 없음 | Sorted Set | 길드별 사냥꾼 총 사냥 시간 순위 (score = 총 사냥분) |

- **키 생성 함수**: `apps/api/src/newbie/infrastructure/newbie-cache.keys.ts`
- **저장소**: `apps/api/src/newbie/infrastructure/newbie-redis.repository.ts`

#### newbie:moco:total 구조

Redis Hash 자료구조로 저장된다. 필드는 신규사용자 memberId, 값은 동시 접속 시간(분)이다.

```
HSET newbie:moco:total:{guildId}:{hunterId} {newbieMemberId} {minutes}
```

#### newbie:moco:rank 구조

Redis Sorted Set 자료구조로 저장된다. score는 사냥꾼의 총 사냥 시간(분)이다.

```
ZADD newbie:moco:rank:{guildId} {totalMinutes} {hunterId}
```

### status_prefix 키 정의

멤버의 원래 닉네임(접두사 적용 전)과 설정 캐시를 저장한다.

| 키 패턴 | TTL | 자료구조 | 설명 |
|---------|-----|----------|------|
| `status_prefix:original:{guildId}:{memberId}` | 없음 (퇴장 시 명시적 삭제) | String | 멤버의 원래 닉네임 (접두사 적용 전 닉네임) |
| `status_prefix:config:{guildId}` | 1시간 | String (JSON) | StatusPrefixConfig 설정 캐시 |

- **키 생성 함수**: `apps/api/src/status-prefix/infrastructure/status-prefix-cache.keys.ts`
- **저장소**: `apps/api/src/status-prefix/infrastructure/status-prefix-redis.repository.ts`

#### status_prefix:original 저장 규칙

최초 접두사 적용 시에만 저장하며, 이미 값이 존재하면 덮어쓰지 않는다. 이유: 접두사가 이미 적용된 상태에서 다른 접두사로 교체할 때 원래 닉네임(접두사 적용 전)을 보존해야 한다.

```
SET status_prefix:original:{guildId}:{memberId} {originalNickname} NX
```

#### status_prefix:config 구조

StatusPrefixConfig와 연관 StatusPrefixButton 목록을 JSON으로 직렬화하여 저장한다. 설정 저장(POST) 시 명시적으로 갱신된다.

```
SET status_prefix:config:{guildId} {configJson} EX 3600
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
| newbie 설정 캐시 | 1시간 (3,600초) | 설정 변경 빈도 낮음, 저장 시 명시적 갱신 |
| newbie 미션 목록 캐시 | 30분 (1,800초) | 갱신 버튼 클릭 시 명시적 갱신 |
| newbie 신입기간 활성 멤버 | 1시간 (3,600초) | 스케줄러 실행 시 갱신 |
| newbie 모코코 사냥 데이터 | 없음 | 영구 누적, 리셋 시 명시적 삭제 |
| status_prefix 원래 닉네임 | 없음 (명시적 삭제) | 퇴장(F-STATUS-PREFIX-005) 또는 RESET 버튼(F-STATUS-PREFIX-004) 시 삭제. 비정상 종료 대비 운영 환경에서 24시간 TTL 설정 검토 |
| status_prefix 설정 캐시 | 1시간 (3,600초) | 설정 변경 빈도 낮음, 저장 시 명시적 갱신 |

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

### Newbie 라이프사이클

```
[신규 멤버 가입 — guildMemberAdd 이벤트]
  1. newbie:config:{guildId} → Redis get (설정 캐시 조회, 미스 시 DB)
  2. NewbieConfig → PostgreSQL select (캐시 미스 시 조회 후 Redis set, TTL 1h)

  [환영인사 — welcomeEnabled = true]
  3. Discord API → 환영 채널에 Embed 메시지 전송

  [미션 생성 — missionEnabled = true]
  4. NewbieMission → PostgreSQL insert (guildId, memberId, startDate, endDate, targetPlaytimeSec, status='IN_PROGRESS')
  5. newbie:mission:active:{guildId} → Redis delete (캐시 무효화)

  [신입기간 역할 부여 — roleEnabled = true]
  6. Discord API → 신규 멤버에게 newbieRoleId 역할 부여
  7. NewbiePeriod → PostgreSQL insert (guildId, memberId, startDate, expiresDate, isExpired=false)
  8. newbie:period:active:{guildId} → Redis delete (캐시 무효화)

[모코코 사냥 측정 — voiceStateUpdate 이벤트]
  1. newbie:period:active:{guildId} → Redis get (신입기간 활성 멤버 집합 조회, 미스 시 DB)
  2. NewbiePeriod → PostgreSQL select WHERE guildId=? AND isExpired=false (IDX_newbie_period_guild_active 활용, Redis SADD, TTL 1h)
  3. 채널 내 신규사용자(IN_PROGRESS 미션 보유) 존재 여부 확인
  4. newbie:moco:total:{guildId}:{hunterId} → Redis HINCRBY (신규사용자별 사냥 시간 누적, 분 단위)
  5. newbie:moco:rank:{guildId} → Redis ZINCRBY (사냥꾼 총 사냥 시간 갱신)

[미션 만료 스케줄러 — 매일 자정]
  1. NewbieMission → PostgreSQL select WHERE status='IN_PROGRESS' AND endDate < today (IDX_newbie_mission_status_end_date 활용)
  2. VoiceDailyEntity → PostgreSQL select SUM(channelDurationSec) (startDate~endDate, channelId != 'GLOBAL')
  3. 목표 달성 여부 판별 → NewbieMission → PostgreSQL update (status='COMPLETED' 또는 'FAILED')
  4. newbie:mission:active:{guildId} → Redis delete (캐시 무효화)

[신입기간 만료 스케줄러 — 매일 자정]
  1. NewbiePeriod → PostgreSQL select WHERE isExpired=false AND expiresDate < today (IDX_newbie_period_expires 활용)
  2. Discord API → 해당 멤버의 신입 역할 제거
  3. NewbiePeriod → PostgreSQL update (isExpired=true)
  4. newbie:period:active:{guildId} → Redis delete (캐시 무효화)

[웹 대시보드 설정 저장 — NewbieConfig]
  1. NewbieConfig → PostgreSQL upsert (guildId 기준)
  2. newbie:config:{guildId} → Redis set (설정 캐시 갱신, TTL 1h)

[웹 대시보드 설정 저장 — NewbieMissionTemplate]
  1. 허용 변수 유효성 검사 (백엔드) → 실패 시 400 응답
  2. NewbieMissionTemplate → PostgreSQL upsert (guildId 기준)
     - 레코드 없음: INSERT (id, guildId, titleTemplate, headerTemplate, itemTemplate, footerTemplate, statusMapping, createdAt, updatedAt)
     - 레코드 있음: UPDATE (titleTemplate, headerTemplate, itemTemplate, footerTemplate, statusMapping, updatedAt)

[웹 대시보드 설정 저장 — NewbieMocoTemplate]
  1. 허용 변수 유효성 검사 (백엔드) → 실패 시 400 응답
  2. NewbieMocoTemplate → PostgreSQL upsert (guildId 기준)
     - 레코드 없음: INSERT (id, guildId, titleTemplate, bodyTemplate, itemTemplate, footerTemplate, createdAt, updatedAt)
     - 레코드 있음: UPDATE (titleTemplate, bodyTemplate, itemTemplate, footerTemplate, updatedAt)
```

### Status Prefix 라이프사이클

```
[웹 설정 저장 — POST /api/guilds/{guildId}/status-prefix/config]
  1. status_prefix_config → PostgreSQL upsert (guildId 기준)
  2. status_prefix_button → PostgreSQL delete WHERE configId = ? (기존 버튼 전체 삭제)
  3. status_prefix_button → PostgreSQL insert (요청 버튼 목록 일괄 삽입, sortOrder 순서 반영)
  4. status_prefix:config:{guildId} → Redis set (설정 캐시 갱신, TTL 1h)
  5. enabled = true 인 경우:
     - Discord API → channelId 채널 조회
     - messageId 존재 시 → Discord API 기존 메시지 edit (Embed + 버튼 ActionRow)
     - messageId 없을 시 → Discord API 신규 메시지 send
     - status_prefix_config.messageId → PostgreSQL update (Discord message ID 저장)

[버튼 클릭 — 접두사 적용 (customId: status_prefix:{buttonId})]
  1. status_prefix_button → PostgreSQL select WHERE id = {buttonId} (label, prefix, type 확인)
  2. status_prefix:original:{guildId}:{memberId} → Redis get (원래 닉네임 조회)
     - 값 없음: Discord API → 현재 멤버 닉네임 조회 후
               status_prefix:original:{guildId}:{memberId} → Redis SET NX (원래 닉네임 저장, 덮어쓰지 않음)
     - 값 있음: 기존 저장값 유지
  3. status_prefix:config:{guildId} → Redis get (캐시 조회, 미스 시 DB)
     - 캐시 미스: status_prefix_config → PostgreSQL select WHERE guildId = ? → Redis set (TTL 1h)
  4. prefixTemplate 적용 → 새 닉네임 생성 (예: `[관전] 동현`)
  5. Discord API → GuildMember.setNickname(newNickname)
  6. Discord API → Ephemeral 성공 응답

[버튼 클릭 — 원래대로 복원 (customId: status_reset:{buttonId})]
  1. status_prefix:original:{guildId}:{memberId} → Redis get (원래 닉네임 조회)
  2. 값 없음: Discord API → Ephemeral 응답 (`변경된 닉네임이 없습니다.`) 후 종료
  3. 값 있음:
     - Discord API → GuildMember.setNickname(originalNickname)
     - status_prefix:original:{guildId}:{memberId} → Redis delete
     - Discord API → Ephemeral 성공 응답

[음성 채널 퇴장 — voiceStateUpdate 이벤트 연계]
  1. status_prefix:config:{guildId} → Redis get (캐시 조회, 미스 시 DB)
     - 캐시 미스: status_prefix_config → PostgreSQL select WHERE guildId = ? → Redis set (TTL 1h)
  2. enabled = false 이면 처리 중단
  3. status_prefix:original:{guildId}:{memberId} → Redis get (원래 닉네임 조회)
  4. 값 없음: 처리 중단 (닉네임 변경 이력 없음)
  5. 값 있음:
     - Discord API → GuildMember.setNickname(originalNickname)
     - status_prefix:original:{guildId}:{memberId} → Redis delete
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
