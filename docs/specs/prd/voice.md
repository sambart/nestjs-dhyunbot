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

### F-VOICE-017: 음성 일별 통계 조회 API

- **트리거**: FE 대시보드(`/dashboard/guild/{guildId}/voice`)의 초기 로드 및 기간 변경
- **엔드포인트**: `GET /api/guilds/:guildId/voice/daily`
- **인증**: JWT Bearer 토큰 필수 (JwtAuthGuard 적용)
- **쿼리 파라미터**:
  | 파라미터 | 타입 | 필수 | 설명 |
  |----------|------|------|------|
  | `from` | string (YYYYMMDD) | 필수 | 조회 시작 날짜 (예: `20260301`) |
  | `to` | string (YYYYMMDD) | 필수 | 조회 종료 날짜 (예: `20260309`) |
- **동작**:
  1. `guildId` + `date BETWEEN from AND to` 조건으로 `VoiceDailyEntity` 레코드 전체 조회
  2. 결과를 `VoiceDailyRecord[]` 형태로 직렬화하여 반환
- **응답 형식**: `VoiceDailyRecord[]`
  ```json
  [
    {
      "guildId": "123456789012345678",
      "userId": "111111111111111111",
      "userName": "DHyun",
      "date": "20260301",
      "channelId": "222222222222222222",
      "channelName": "일반",
      "channelDurationSec": 3600,
      "micOnSec": 1800,
      "micOffSec": 1800,
      "aloneSec": 600
    }
  ]
  ```
- **호출 경로**:
  - FE(`apps/web/app/dashboard/guild/[guildId]/voice/page.tsx`) → Next.js API 프록시(`/api/guilds/{guildId}/voice/daily?from=&to=`) → 백엔드(`http://api:3000/api/guilds/{guildId}/voice/daily?from=&to=`)
- **관련 FE 파일**:
  - `apps/web/app/dashboard/guild/[guildId]/voice/page.tsx` — 대시보드 페이지
  - `apps/web/app/lib/voice-dashboard-api.ts` — API 클라이언트 함수
  - 차트 컴포넌트 5종 (동일 디렉토리)

---

## 음성 시간 제외 채널 (Voice Time Excluded Channels)

> 변경이력: [prd-changelog.md](../../archive/prd-changelog.md)

### 개요

길드별로 음성 시간 추적에서 제외할 채널 또는 카테고리를 설정한다. 제외 채널에 입장·퇴장·이동이 발생해도 VoiceChannelHistory 미생성, VoiceDailyEntity 미누적, Redis 세션 미생성이 보장된다.

### F-VOICE-013: 제외 채널 설정 조회

- **트리거**: 웹 대시보드 설정 페이지 초기 로드
- **엔드포인트**: `GET /api/guilds/{guildId}/voice/excluded-channels`
- **동작**:
  1. `VoiceExcludedChannel` 레코드를 guildId 기준으로 전체 조회
  2. `type` 및 `channelId` 목록 반환
- **응답 형식**:
  ```json
  [
    { "id": 1, "channelId": "111111111111111111", "type": "CHANNEL" },
    { "id": 2, "channelId": "222222222222222222", "type": "CATEGORY" }
  ]
  ```

### F-VOICE-014: 제외 채널 등록

- **트리거**: 웹 대시보드에서 채널/카테고리 선택 후 저장
- **엔드포인트**: `POST /api/guilds/{guildId}/voice/excluded-channels`
- **요청 바디**:
  ```json
  { "channelId": "111111111111111111", "type": "CHANNEL" }
  ```
  - `type`: `CHANNEL` (개별 음성 채널) 또는 `CATEGORY` (카테고리)
- **동작**:
  1. 동일 guildId + channelId 조합이 이미 존재하면 409 응답
  2. `VoiceExcludedChannel` 레코드 생성
  3. `voice:excluded:{guildId}` Redis 캐시 무효화 (삭제)
- **제약**:
  - 카테고리를 등록하면 해당 카테고리 하위의 모든 음성 채널이 제외 대상이 됨 (하위 채널을 개별 등록할 필요 없음)

### F-VOICE-015: 제외 채널 삭제

- **트리거**: 웹 대시보드에서 항목 삭제 버튼 클릭
- **엔드포인트**: `DELETE /api/guilds/{guildId}/voice/excluded-channels/{id}`
- **동작**:
  1. `VoiceExcludedChannel` 레코드 삭제 (id + guildId 일치 검증)
  2. `voice:excluded:{guildId}` Redis 캐시 무효화 (삭제)
- **예외**:
  - 레코드가 존재하지 않으면 404 응답

### F-VOICE-016: 음성 이벤트 처리 시 제외 채널 필터링

- **트리거**: Discord `voiceStateUpdate` 이벤트 수신 (F-VOICE-001, F-VOICE-002, F-VOICE-003 실행 직전)
- **동작**:
  1. `voice:excluded:{guildId}` Redis 캐시 조회
     - 캐시 미스: `VoiceExcludedChannel` 레코드를 DB에서 조회 후 Redis에 저장 (TTL 1시간)
  2. 대상 채널이 제외 채널 목록에 포함되는지 확인:
     - `type = CHANNEL`: channelId 직접 일치 여부 확인
     - `type = CATEGORY`: Discord API로 해당 채널의 parentId(카테고리 ID) 조회 후 일치 여부 확인
  3. 제외 대상이면 해당 이벤트 처리 중단 (VoiceChannelHistory 미생성, VoiceDailyEntity 미누적, Redis 세션 미생성)
  4. 제외 대상이 아니면 기존 플로우(F-VOICE-001 ~ F-VOICE-003) 정상 수행
- **이동(move) 이벤트 처리 세부 규칙**:
  - 이전 채널(A)이 제외 채널이고 새 채널(B)이 일반 채널: B에 대한 입장(F-VOICE-001)만 수행, A 퇴장 처리 생략
  - 이전 채널(A)이 일반 채널이고 새 채널(B)이 제외 채널: A에 대한 퇴장(F-VOICE-002)만 수행, B 입장 처리 생략
  - 이전 채널(A)과 새 채널(B) 모두 제외 채널: 이동 이벤트 전체 무시
- **자동방 트리거 채널과의 관계**:
  - 트리거 채널은 F-VOICE-007에서 이미 세션 추적을 제외하므로 별도 처리 불필요
  - 트리거 채널을 제외 채널로 추가 등록하더라도 동작 상 중복될 뿐 오류 없음

## 음성 시간 제외 채널 데이터 모델

### VoiceExcludedChannel (voice_excluded_channel)

| 컬럼 | 타입 | 설명 |
|-------|------|------|
| id | PK, auto | 내부 ID |
| guildId | string | 디스코드 서버 ID |
| channelId | string | 제외할 채널 또는 카테고리 ID |
| type | enum (CHANNEL/CATEGORY) | 제외 단위 (개별 채널 또는 카테고리) |
| createdAt | timestamp | 생성일 |
| updatedAt | timestamp | 수정일 |

**인덱스**:
- `(guildId, channelId)` unique — 서버+채널 단위 중복 방지
- `(guildId)` — 서버별 전체 목록 조회

## 음성 시간 제외 채널 Redis 키 구조

| 키 패턴 | TTL | 자료구조 | 설명 |
|---------|-----|----------|------|
| `voice:excluded:{guildId}` | 1시간 | String (JSON) | 길드별 제외 채널 목록 캐시 (`VoiceExcludedChannel[]` JSON 직렬화) |

- 설정 등록(`POST`) 또는 삭제(`DELETE`) 시 해당 키를 명시적으로 삭제하여 캐시를 무효화한다.
- 캐시 미스 시 DB 조회 후 Redis에 1시간 TTL로 재저장한다.
- 캐시 히트 시 parentId 확인을 위한 Discord API 호출은 여전히 발생할 수 있다 (`type = CATEGORY` 항목이 존재하는 경우).

---

## 자동방 생성 (Auto Channel)

> 변경이력: [prd-changelog.md](../../archive/prd-changelog.md)

### 개요

트리거 채널 입장(대기방 역할) → 안내 메시지 버튼 클릭 → 확정방 신규 생성 및 이동하는 2단계 자동 음성 채널 생성 기능이다.
확정방 생성 시점부터 기존 voice 세션 추적 시스템과 통합된다.

### 전체 흐름

```
[웹 설정 저장]
    │  guideChannelId(텍스트 채널)에 Embed + 버튼 안내 메시지 전송/갱신
    ▼
[사용자가 트리거 채널(대기방) 입장]
    │  DB 조회로 트리거 채널 여부 확인 → 세션 추적 제외
    ▼
[안내 메시지에서 버튼 클릭]
    ├─ 하위 선택지 없음 → 즉시 확정방 신규 생성 → 유저 이동
    └─ 하위 선택지 있음 → Ephemeral 추가 버튼 표시 → 선택 후 확정방 신규 생성 → 유저 이동
    │
    ▼
[확정방 생성 완료 → Redis 확정방 키 저장 → 세션 추적 시작]
    │
    ▼
[모든 사용자 퇴장] → 확정방 즉시 삭제 (Redis 키 정리)
```

### F-VOICE-007: 트리거 채널 입장 감지

- **트리거**: 유저가 트리거 채널로 설정된 음성 채널에 입장
- **전제 조건**: AutoChannelConfig에 해당 채널이 triggerChannelId로 등록되어 있음
- **동작**:
  1. 트리거 채널 여부 확인 (DB 직접 조회 — `AutoChannelConfigRepository.findByTriggerChannel`)
  2. 트리거 채널 자체에 대한 음성 세션 추적은 시작하지 않음
  3. 유저는 트리거 채널(대기방)에 머물며 안내 메시지의 버튼 클릭을 기다림
- **예외**:
  - 트리거 채널 설정이 존재하지 않으면 일반 입장(F-VOICE-001)으로 처리
- **구현 참고**:
  - 트리거 채널 집합을 별도 Redis 키로 캐싱하지 않으며, 입장 시마다 DB에서 조회한다

### F-VOICE-008: 대기방 상태 관리

- **트리거**: F-VOICE-007 이후 유저가 트리거 채널에 체류 중인 상태
- **동작**:
  1. 트리거 채널 자체가 대기방 역할을 수행 (별도 채널 생성 없음)
  2. 대기방(트리거 채널) 정보는 `RedisTempChannelStore`를 통해 관리
     - `voice:temp:channels:{guildId}` (Set): 서버 내 임시 채널 ID 집합
     - `voice:temp:channel:{channelId}:members` (Set): 채널 내 멤버 ID 집합
  3. 대기방은 세션 추적 대상에서 제외 (VoiceChannelHistory 미생성)
  4. 유저 퇴장 시 멤버 제거, 채널이 비면 임시 채널 등록 해제
- **네이밍 템플릿 변수** (`waitingRoomTemplate`):
  - `{username}`: 유저의 서버 닉네임
  - `waitingRoomTemplate`은 nullable이며, 미설정 시 기본 임시 채널명 사용

### F-VOICE-009: 안내 메시지 & 버튼 전송/갱신

- **트리거**: 웹 대시보드에서 자동방 설정 저장 시
- **동작**:
  1. `guideChannelId`(별도 텍스트 채널)에 기존 안내 메시지가 있으면 수정(edit), 없으면 신규 전송
  2. 메시지 구성:
     - Discord Embed 형식: `embedTitle` (제목, 선택), `guideMessage` (설명 본문), `embedColor` (색상, 선택)
     - Discord Button Component 목록 (라벨 + 이모지)
  3. 안내 메시지 ID(`guideMessageId`)를 AutoChannelConfig에 저장
  4. 수정 실패(메시지 삭제 등) 시 신규 전송으로 폴백
- **버튼 속성**:
  - `label`: 버튼 표시 텍스트
  - `emoji`: 버튼 이모지 (선택)
  - `style`: Primary (파란색) 고정
  - `customId`: `auto_btn:{buttonId}` 형식
- **제약**:
  - Discord 버튼은 메시지당 최대 25개 (ActionRow 5개 × 버튼 5개)

### F-VOICE-010: 하위 선택지 Ephemeral 처리

- **트리거**: 하위 선택지가 설정된 버튼 클릭
- **동작**:
  1. 버튼 클릭한 유저가 트리거 채널(대기방)에 있는지 확인 — 유저의 현재 음성 채널 ID와 `button.config.triggerChannelId` 비교
  2. 대기방에 없으면 오류 응답 (ephemeral)
  3. 대기방에 있으면 Ephemeral 메시지로 하위 선택지 버튼 목록 표시
  4. 하위 버튼 클릭 시 F-VOICE-011 (확정방 전환) 호출
- **하위 선택지 버튼 속성**:
  - `label`: 선택지 표시 텍스트
  - `emoji`: 선택지 이모지 (선택)
  - `channelNameTemplate`: 채널명 템플릿 문자열 (예: `{name} 경쟁`, `{name} 일반`)
    - `{name}` 포함 시: 버튼 단계에서 생성된 기본 채널명으로 치환
    - `{name}` 미포함 시: 기본 채널명 뒤에 공백과 함께 이어붙임
  - `customId`: `auto_sub:{subOptionId}` 형식
- **예시**: "스팀" 버튼 → Ephemeral로 [일반] [경쟁] 버튼 표시 → "경쟁" 선택

### F-VOICE-011: 확정방 전환

- **트리거**: 하위 선택지 없는 버튼 클릭, 또는 하위 선택지 선택 완료
- **전제 조건**: 버튼 클릭한 유저가 트리거 채널(대기방)에 입장해 있어야 함
- **동작**:
  1. 유저의 현재 음성 채널 ID와 `button.config.triggerChannelId` 비교로 대기방 검증
  2. 유저가 대기방에 없으면 오류 응답 (ephemeral)
  3. 확정방 채널명 결정:
     - 버튼의 `channelNameTemplate` 적용 (없으면 `{username}의 {버튼 라벨}` 기본 형식)
     - `{username}` 변수를 유저 서버 닉네임으로 치환
     - 하위 선택지 있음: `subOption.channelNameTemplate`의 `{name}`을 기본 채널명으로 치환 (`{name}` 없으면 뒤에 이어붙임)
     - 채널명에 `{n}` 포함 시: 1부터 증가시키며 미사용 순번 탐색 (예: `오버워치 #1`, `오버워치 #2`)
     - `{n}` 미포함 + 중복 이름: 뒤에 숫자 순번 부여 (예: `DHyun의 오버워치 2`)
  4. 트리거 채널과 별개로 신규 확정방 채널을 `button.targetCategoryId` 카테고리에 생성
  5. 유저를 확정방으로 이동
  6. 확정방 메타데이터를 Redis에 저장 (`auto_channel:confirmed:{channelId}`, TTL 12시간)
  7. 확정방을 세션 추적 대상으로 등록 (F-VOICE-001과 동일한 세션 시작 처리)
  8. Discord 상호작용에 성공 응답 (defer → editReply)
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
| name | string | 설정 이름 (웹 탭 라벨용, 예: "게임방", "스터디방") |
| triggerChannelId | string | 트리거 음성 채널 ID (대기방 역할) |
| guideChannelId | string, nullable | 안내 메시지를 전송할 텍스트 채널 ID |
| waitingRoomTemplate | string, nullable | 대기방 네이밍 템플릿 (예: `⌛ {username}의 대기방`) |
| guideMessage | text | 안내 메시지 Embed 설명 본문 |
| embedTitle | string, nullable | 안내 메시지 Embed 제목 |
| embedColor | string, nullable | 안내 메시지 Embed 색상 (예: `#5865F2`) |
| guideMessageId | string, nullable | 전송된 안내 메시지 Discord ID |
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
| targetCategoryId | string | 확정방을 생성할 카테고리 ID |
| channelNameTemplate | string, nullable | 확정방 채널명 템플릿 (예: `{username}의 오버워치`). 미설정 시 `{username}의 {label}` 기본 형식 사용 |
| sortOrder | int | 버튼 표시 순서 |

### AutoChannelSubOption (auto_channel_sub_option)

| 컬럼 | 타입 | 설명 |
|-------|------|------|
| id | PK, auto | 내부 ID |
| buttonId | FK → AutoChannelButton | 소속 버튼 |
| label | string | 하위 선택지 표시 라벨 |
| emoji | string, nullable | 하위 선택지 이모지 |
| channelNameTemplate | string | 채널명 합성 템플릿. `{name}` 포함 시 버튼 단계 기본 채널명으로 치환, 미포함 시 기본 채널명 뒤에 이어붙임 (예: `{name} 경쟁`, `경쟁`) |
| sortOrder | int | 선택지 표시 순서 |

### AutoChannelState (Redis)

확정방의 런타임 상태를 Redis에 저장한다. 대기방(트리거 채널)의 멤버 상태는 voice 도메인의 `RedisTempChannelStore`가 관리한다.

**확정방 메타데이터**:

| 키 패턴 | 값 | TTL | 설명 |
|---------|-----|-----|------|
| `auto_channel:confirmed:{channelId}` | `{ guildId, userId, buttonId, subOptionId? }` | 12시간 | 확정방 메타데이터 |

**대기방(트리거 채널) 관련 키** (RedisTempChannelStore 관리):

| 키 패턴 | 자료구조 | 설명 |
|---------|----------|------|
| `voice:temp:channels:{guildId}` | Set | 서버 내 임시 채널(대기방 포함) ID 집합 |
| `voice:temp:channel:{channelId}:members` | Set | 해당 임시 채널의 멤버 ID 집합 |

**트리거 채널 조회**: Redis 캐싱 없이 `AutoChannelConfigRepository.findByTriggerChannel(guildId, channelId)` DB 조회로 처리
