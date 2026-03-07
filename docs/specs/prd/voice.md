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
