# Status Prefix 도메인 PRD

> 변경이력: [prd-changelog.md](../../archive/prd-changelog.md)

## 개요

디스코드 서버 사용자가 버튼 한 번으로 자신의 닉네임에 상태 접두사를 붙이거나 원래 닉네임으로 복원하는 기능이다. 관리자는 웹 대시보드에서 접두사 버튼 목록, Embed 안내 메시지, 표시 채널, 접두사 형식 템플릿을 설정한다. 설정 저장 시 지정 텍스트 채널에 Embed + 버튼 메시지가 전송/갱신된다. 기능은 길드(서버)별로 독립 설정되며, 모든 음성 채널 사용자가 이용 가능한 독립 기능이다.

**안내 메시지 예시 (Discord Embed)**:
```
게임방 상태 설정 시스템
아래 버튼을 클릭하여 닉네임 접두사를 변경할 수 있습니다.

사용 가능한 접두사
- 관전 - [관전] [닉네임] 형태로 변경
- 대기 - [대기] [닉네임] 형태로 변경
- 막판 - [막판] [닉네임] 형태로 변경
- 원래대로 - 원래 닉네임으로 복원

[관전 적용] [대기 적용] [막판 적용] [원래대로]
```

## 관련 모듈

- `apps/api/src/status-prefix/` — 상태 접두사 핵심 로직
- `apps/api/src/status-prefix/config/` — 설정 관리 서비스 및 DB 저장소
- `apps/api/src/status-prefix/interaction/` — Discord 버튼 상호작용 핸들러
- `apps/api/src/status-prefix/infrastructure/` — Redis 저장소
- `apps/api/src/event/voice/` — voice 도메인 연계 (voiceStateUpdate 이벤트)

## 아키텍처

```
[Web Dashboard] — 설정 저장
    │
    ▼
POST /api/guilds/{guildId}/status-prefix/config
    │
    ▼
[StatusPrefixConfigService]
    │
    ├──► DB: StatusPrefixConfig, StatusPrefixButton upsert
    └──► Discord API: 안내 채널에 Embed + 버튼 메시지 전송/갱신 (F-STATUS-PREFIX-002)

Discord interactionCreate Event (버튼 클릭)
    │
    ▼
[StatusPrefixInteractionHandler]   ← customId prefix 분기
    │
    ├── customId: status_prefix:{buttonId}
    │       └──► [StatusPrefixApplyService]   → 닉네임 접두사 적용 (F-STATUS-PREFIX-003)
    │
    └── customId: status_reset:{buttonId}
            └──► [StatusPrefixResetService]   → 닉네임 복원 (F-STATUS-PREFIX-004)

Discord voiceStateUpdate Event (voice 도메인 연계)
    │
    ▼
[VoiceLeaveHandler] (기존 voice 도메인)
    │
    └──► [StatusPrefixResetService]  → 음성 채널 퇴장 시 닉네임 자동 복원 (F-STATUS-PREFIX-005)

Web Dashboard API
    │
    ├──► GET  /api/guilds/{guildId}/status-prefix/config   → 설정 조회
    └──► POST /api/guilds/{guildId}/status-prefix/config   → 설정 저장
```

---

## 기능 상세

### F-STATUS-PREFIX-001: 설정 조회

- **트리거**: 웹 대시보드에서 Status Prefix 설정 페이지 접근
- **동작**:
  1. `GET /api/guilds/{guildId}/status-prefix/config` 요청
  2. `StatusPrefixConfig` 및 연관 `StatusPrefixButton` 목록 조회
  3. 설정이 없으면 빈 기본값 반환
- **응답 형식**:
  ```json
  {
    "enabled": true,
    "channelId": "1234567890",
    "embedTitle": "게임방 상태 설정 시스템",
    "embedDescription": "아래 버튼을 클릭하여 닉네임 접두사를 변경할 수 있습니다.",
    "embedColor": "#5865F2",
    "prefixTemplate": "[{prefix}] {nickname}",
    "messageId": "9876543210",
    "buttons": [
      { "id": 1, "label": "관전 적용", "emoji": null, "prefix": "관전", "type": "PREFIX", "sortOrder": 0 },
      { "id": 2, "label": "대기 적용", "emoji": null, "prefix": "대기", "type": "PREFIX", "sortOrder": 1 },
      { "id": 3, "label": "원래대로", "emoji": null, "prefix": null, "type": "RESET", "sortOrder": 2 }
    ]
  }
  ```

---

### F-STATUS-PREFIX-002: 안내 메시지 전송/갱신

- **트리거**: 웹 대시보드에서 설정 저장 (`POST /api/guilds/{guildId}/status-prefix/config`)
- **동작**:
  1. `StatusPrefixConfig` 및 `StatusPrefixButton` 목록을 DB에 upsert
  2. `channelId`로 지정된 텍스트 채널 조회
  3. `messageId`가 존재하면 기존 메시지 수정(edit), 없으면 신규 전송
  4. Embed 구성:
     - 제목: `embedTitle`
     - 설명: `embedDescription`
     - 색상: `embedColor` (HEX)
  5. ActionRow에 버튼 목록 구성:
     - `type = PREFIX` 버튼: `customId = status_prefix:{buttonId}`
     - `type = RESET` 버튼: `customId = status_reset:{buttonId}`
     - 버튼 `style`: Primary (파란색) 고정
  6. 전송된 메시지 ID를 `StatusPrefixConfig.messageId`에 저장
- **제약**:
  - Discord 버튼은 메시지당 최대 25개 (ActionRow 5개 × 버튼 5개)
  - `enabled = false`이면 메시지 전송/갱신 생략
- **오류 처리**: 채널을 찾을 수 없거나 봇 권한 부족 시 로그 기록 후 API 오류 반환

---

### F-STATUS-PREFIX-003: 접두사 적용

- **트리거**: 사용자가 `type = PREFIX` 버튼 클릭 (`customId: status_prefix:{buttonId}`)
- **동작**:
  1. `buttonId`로 `StatusPrefixButton` 조회 (prefix, type 확인)
  2. Redis에서 해당 멤버의 원래 닉네임 조회
     - 원래 닉네임이 저장되어 있지 않으면: 현재 Discord 닉네임을 원래 닉네임으로 Redis에 저장
     - 원래 닉네임이 이미 저장되어 있으면: 기존 저장값 유지 (덮어쓰지 않음)
  3. `StatusPrefixConfig.prefixTemplate`을 적용하여 새 닉네임 생성
     - 예: 템플릿 `[{prefix}] {nickname}`, prefix = `관전`, 원래 닉네임 = `동현` → `[관전] 동현`
  4. Discord API `GuildMember.setNickname(newNickname)`으로 닉네임 변경
  5. 버튼 클릭에 대해 Ephemeral 성공 응답 (`닉네임이 [관전] 동현으로 변경되었습니다.`)
- **템플릿 변수**:

  | 변수 | 치환값 |
  |------|--------|
  | `{prefix}` | 버튼에 설정된 접두사 텍스트 |
  | `{nickname}` | 원래 닉네임 (Redis 저장값 기준) |

- **오류 처리**:
  - `buttonId` 미존재 시 Ephemeral 오류 응답
  - 봇 권한 부족 (닉네임 변경 불가) 시 Ephemeral 오류 응답

---

### F-STATUS-PREFIX-004: 접두사 제거 (원래대로)

- **트리거**: 사용자가 `type = RESET` 버튼 클릭 (`customId: status_reset:{buttonId}`)
- **동작**:
  1. Redis에서 해당 멤버의 원래 닉네임 조회
  2. 원래 닉네임이 없으면 Ephemeral 응답 (`변경된 닉네임이 없습니다.`)
  3. 원래 닉네임이 있으면 Discord API `GuildMember.setNickname(originalNickname)`으로 닉네임 복원
  4. Redis에서 원래 닉네임 키 삭제
  5. Ephemeral 성공 응답 (`닉네임이 원래대로 복원되었습니다.`)
- **오류 처리**:
  - 봇 권한 부족 시 Ephemeral 오류 응답

---

### F-STATUS-PREFIX-005: 음성 채널 퇴장 시 닉네임 자동 복원

- **트리거**: 사용자가 음성 채널에서 퇴장 (`voiceStateUpdate` 이벤트, 기존 voice 도메인 연계)
- **동작**:
  1. 퇴장한 멤버의 `guildId`로 `StatusPrefixConfig` 조회 (`enabled` 확인)
  2. `enabled = false`이면 처리 중단
  3. Redis에서 해당 멤버의 원래 닉네임 조회
  4. 원래 닉네임이 저장되어 있으면:
     - Discord API `GuildMember.setNickname(originalNickname)`으로 닉네임 복원
     - Redis에서 원래 닉네임 키 삭제
  5. 원래 닉네임이 없으면 처리 중단 (닉네임 변경 이력 없음)
- **오류 처리**: 봇 권한 부족 또는 Discord API 오류 시 로그 기록 후 조용히 실패

---

### F-WEB-STATUS-PREFIX-001: Status Prefix 설정 페이지

- **경로**: `/dashboard/servers/{guildId}/settings/status-prefix`
- **위치**: 대시보드 > 서버 설정 > 게임방 상태 설정
- **접근 조건**: Discord OAuth 로그인 + 해당 서버 관리 권한

#### 페이지 구성

| UI 요소 | 설명 |
|---------|------|
| 기능 활성화 토글 | Status Prefix 기능 전체 ON/OFF |
| 안내 채널 선택 드롭다운 | Embed + 버튼 메시지를 표시할 텍스트 채널 선택 (서버 채널 목록) |
| Embed 제목 입력 | 안내 Embed 제목 텍스트 |
| Embed 설명 입력 (멀티라인) | 안내 Embed 본문 텍스트 |
| Embed 색상 선택 | HEX 색상 코드 입력 또는 컬러 피커 |
| 접두사 형식 템플릿 입력 | 닉네임 변환 템플릿 (예: `[{prefix}] {nickname}`, `{prefix} {nickname}`) |
| 템플릿 변수 안내 | `{prefix}`, `{nickname}` 변수 설명 인라인 표시 |
| 버튼 목록 관리 영역 | 접두사 버튼 추가/수정/삭제/순서 변경 |
| 저장 버튼 | 설정 내용을 API로 전송하고 Discord 채널에 메시지 전송/갱신 |

#### 버튼 목록 관리

| UI 요소 | 설명 |
|---------|------|
| 버튼 카드 목록 | 등록된 버튼 목록 (드래그로 순서 변경) |
| 버튼 라벨 입력 | Discord 버튼에 표시될 텍스트 (예: `관전 적용`) |
| 이모지 입력 | 버튼 이모지 (선택, 예: `👁`) |
| 접두사 텍스트 입력 | 닉네임에 삽입될 접두사 (type = PREFIX 버튼에만 활성화, 예: `관전`) |
| 버튼 타입 선택 | `PREFIX` (접두사 적용) 또는 `RESET` (원래대로 복원) |
| 버튼 추가 버튼 | 새 버튼 카드 추가 |
| 버튼 삭제 버튼 | 버튼 카드 제거 |

#### 저장 동작

1. 설정 내용을 `POST /api/guilds/{guildId}/status-prefix/config`로 전송
2. 백엔드에서 `StatusPrefixConfig`, `StatusPrefixButton` DB upsert
3. `enabled = true`이면 지정 채널에 Embed + 버튼 메시지 전송 또는 갱신 (F-STATUS-PREFIX-002)
4. 저장 성공 시 토스트 알림 표시 (`설정이 저장되었습니다.`)
5. 저장 실패(채널 없음, 권한 부족 등) 시 오류 토스트 표시

---

## 데이터 모델

### StatusPrefixConfig (`status_prefix_config`)

길드별 Status Prefix 기능 설정을 저장한다.

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
| `prefixTemplate` | `varchar` | NOT NULL, DEFAULT `'[{prefix}] {nickname}'` | 닉네임 변환 템플릿 |
| `createdAt` | `timestamp` | NOT NULL, DEFAULT now() | 생성일 |
| `updatedAt` | `timestamp` | NOT NULL, DEFAULT now() | 수정일 |

**인덱스**:
- `UNIQUE(guildId)` — 길드당 하나의 설정

---

### StatusPrefixButton (`status_prefix_button`)

길드별 접두사 버튼 목록을 저장한다.

| 컬럼 | 타입 | 제약조건 | 설명 |
|-------|------|----------|------|
| `id` | `int` | PK, AUTO_INCREMENT | 내부 ID |
| `configId` | `int` | FK → StatusPrefixConfig, NOT NULL | 소속 설정 |
| `label` | `varchar` | NOT NULL | Discord 버튼 표시 라벨 (예: `관전 적용`) |
| `emoji` | `varchar` | NULLABLE | Discord 버튼 이모지 (예: `👁`) |
| `prefix` | `varchar` | NULLABLE | 닉네임에 삽입될 접두사 텍스트 (type = PREFIX 시 필수) |
| `type` | `enum('PREFIX','RESET')` | NOT NULL | 버튼 동작 타입 |
| `sortOrder` | `int` | NOT NULL, DEFAULT `0` | 버튼 표시 순서 |
| `createdAt` | `timestamp` | NOT NULL, DEFAULT now() | 생성일 |
| `updatedAt` | `timestamp` | NOT NULL, DEFAULT now() | 수정일 |

**인덱스**:
- `IDX_status_prefix_button_config` — `(configId, sortOrder)` — 설정별 버튼 순서 조회

**버튼 타입 정의**:

| 타입 | customId 형식 | 동작 |
|------|---------------|------|
| `PREFIX` | `status_prefix:{buttonId}` | 닉네임에 접두사 적용 (F-STATUS-PREFIX-003) |
| `RESET` | `status_reset:{buttonId}` | 원래 닉네임으로 복원 (F-STATUS-PREFIX-004) |

---

## Redis 키 구조

| 키 패턴 | TTL | 타입 | 설명 |
|---------|-----|------|------|
| `status_prefix:original:{guildId}:{memberId}` | 없음 (음성 채널 접속 중만 유지, 퇴장 시 삭제) | `String` | 멤버의 원래 닉네임 (접두사 적용 전 닉네임) |
| `status_prefix:config:{guildId}` | 1시간 | `String` (JSON) | StatusPrefixConfig 설정 캐시 |

**TTL 정책**:

| 대상 | TTL | 사유 |
|------|-----|------|
| 원래 닉네임 | 없음 (명시적 삭제) | 퇴장 시 F-STATUS-PREFIX-005에서 삭제. 비정상 종료 시 자동 정리 불가 — 운영 환경에서는 충분히 긴 TTL(24시간 등) 설정 검토 |
| 설정 캐시 | 1시간 | 설정 변경 빈도 낮음, 저장 시 명시적 갱신 |

**원래 닉네임 저장 규칙**:
- 최초 접두사 적용 시에만 저장 (이미 값이 있으면 덮어쓰지 않음)
- 이유: 접두사가 이미 적용된 상태에서 다른 접두사로 교체 시 원래 닉네임을 보존해야 함

---

## Voice 도메인 연계

Status Prefix 도메인은 voice 도메인과 다음 지점에서 연계된다.

| 연계 지점 | 방향 | 설명 |
|-----------|------|------|
| `voiceStateUpdate` 이벤트 (퇴장) | voice → status-prefix | 음성 채널 퇴장 감지 시 닉네임 자동 복원 (F-STATUS-PREFIX-005) |

**연계 방식**:

기존 `VoiceLeaveHandler`(또는 `VoiceStateDispatcher`)에서 퇴장 처리 완료 후 `StatusPrefixResetService.restoreOnLeave(guildId, memberId)`를 호출한다. 이벤트 직접 구독 방식과 서비스 호출 방식 중 구현 시 결정한다.

```
voiceStateUpdate (퇴장)
    │
    ▼
[VoiceLeaveHandler]          ← 기존 voice 도메인 퇴장 처리
    │
    └──► [StatusPrefixResetService.restoreOnLeave()]
              │
              ├── Redis에서 원래 닉네임 조회
              ├── Discord API 닉네임 복원
              └── Redis 키 삭제
```
