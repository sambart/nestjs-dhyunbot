# 자동방 생성 (Auto Channel) — 공통 모듈 판단 문서

## 목적

페이지(기능) 단위 병렬 개발을 시작하기 전에, 자동방 생성 기능 구현에 필요한 공통 모듈을 식별하고 설계 방향을 확정한다.
이 문서에 정의된 모듈은 모든 개발 단위 작업보다 선행하여 완성되어야 하며, 이후 단위 작업들이 conflict 없이 병렬로 진행될 수 있도록 공통 인터페이스와 파일 경로를 명시한다.

---

## 1. 기존 모듈 중 자동방에서 재사용 가능한 것

### 1-1. 재사용 (수정 없음)

| 모듈 | 파일 | 재사용 이유 |
|------|------|-------------|
| `RedisService` | `apps/api/src/redis/redis.service.ts` | `get`, `set`, `del`, `sadd`, `srem`, `sismember`, `pipeline` 등 이미 자동방 Redis 키 패턴에 필요한 모든 기능이 구현되어 있음 |
| `DiscordVoiceGateway` | `apps/api/src/channel/voice/infrastructure/discord-voice.gateway.ts` | `createVoiceChannel`, `moveUserToChannel`, `deleteChannel` — 대기방 생성/이동/삭제에 그대로 사용 가능 |
| `VoiceChannelService` | `apps/api/src/channel/voice/application/voice-channel.service.ts` | 확정방 전환 시 `onUserJoined` 호출로 세션 추적 시작, 퇴장 시 `onUserLeave` 호출로 세션 종료 |
| `VoiceSessionService` | `apps/api/src/channel/voice/application/voice-session.service.ts` | 확정방 전환 시 세션 시작(`startOrUpdateSession`), 확정방 퇴장 시 세션 종료(`closeSession`) |
| `VoiceChannelHistoryService` | `apps/api/src/channel/voice/application/voice-channel-history.service.ts` | 확정방 전환 시 `logJoin`, 확정방 퇴장 시 `logLeave` |
| `MemberService` | `apps/api/src/member/member.service.ts` | 확정방 전환 시 `findOrCreateMember` |
| `ChannelService` | `apps/api/src/channel/channel.service.ts` | 확정방 전환 시 `findOrCreateChannel` |
| `JwtAuthGuard` | `apps/api/src/auth/jwt-auth.guard.ts` | 웹 설정 API 엔드포인트 보호 |
| `VoiceChannelModule` (exports) | `apps/api/src/channel/voice/voice-channel.module.ts` | `VoiceChannelService`, `VoiceDailyFlushService`, `VoiceRedisRepository` exports — AutoChannelModule에서 import |

### 1-2. 재사용하되 수정이 필요한 것

| 모듈 | 파일 | 필요한 수정 내용 |
|------|------|-----------------|
| `VoiceStateDispatcher` | `apps/api/src/event/voice/voice-state.dispatcher.ts` | `isJoin` 분기에서 트리거 채널 여부를 확인하는 로직 추가 필요. 트리거 채널 입장 시 `VOICE_EVENTS.JOIN` 대신 `AUTO_CHANNEL_EVENTS.TRIGGER_JOIN` 이벤트를 발행하도록 분기 처리. |
| `VoiceLeaveHandler` (간접 연계) | `apps/api/src/event/voice/voice-leave.handler.ts` | 수정 없음. 단, `VoiceChannelService.onUserLeave` 내부에서 자동방 삭제 연계가 이루어지므로, AutoChannelService를 VoiceChannelService에 주입하거나 이벤트를 통해 연계하는 방식 결정 필요. 이벤트 방식 권장 (의존성 역전). |
| `DiscordEventsModule` | `apps/api/src/event/discord-events.module.ts` | `AutoChannelModule` import 추가 및 `AutoChannelTriggerJoinHandler`, Discord Interaction 핸들러 등록 필요. |
| `AppModule` | `apps/api/src/app.module.ts` | `AutoChannelModule` import 추가 필요. |

---

## 2. 새로 만들어야 할 모듈/서비스/핸들러 목록

### 2-1. 자동방 전용 Redis 키 관리

**파일**: `apps/api/src/channel/auto/infrastructure/auto-channel.keys.ts`

PRD에 정의된 Redis 키 패턴을 중앙화한다.

```typescript
export const AutoChannelKeys = {
  // 대기방 메타데이터: auto_channel:waiting:{channelId}
  waiting: (channelId: string) => `auto_channel:waiting:${channelId}`,

  // 확정방 메타데이터: auto_channel:confirmed:{channelId}
  confirmed: (channelId: string) => `auto_channel:confirmed:${channelId}`,

  // 서버별 트리거 채널 집합: auto_channel:trigger:{guildId}
  triggerSet: (guildId: string) => `auto_channel:trigger:${guildId}`,
};
```

### 2-2. 자동방 전용 Redis 상태 인터페이스

**파일**: `apps/api/src/channel/auto/infrastructure/auto-channel-state.ts`

DB 스키마 문서(database/_index.md)에 정의된 구조를 그대로 타입으로 정의한다.

```typescript
export interface AutoChannelWaitingState {
  guildId: string;
  userId: string;
  triggerChannelId: string;
  configId: number;
}

export interface AutoChannelConfirmedState {
  guildId: string;
  userId: string;
  buttonId: number;
  subOptionId?: number;
}
```

### 2-3. 자동방 Redis 저장소

**파일**: `apps/api/src/channel/auto/infrastructure/auto-channel-redis.repository.ts`

자동방 관련 Redis CRUD를 한 곳에서 관리한다. `VoiceRedisRepository`와 동일한 패턴으로 설계한다.

- TTL: 대기방/확정방 상태 12시간 (43,200초), 트리거 집합 TTL 없음
- 메서드 목록:
  - `setWaitingState(channelId, state)`: 대기방 상태 저장
  - `getWaitingState(channelId)`: 대기방 상태 조회
  - `deleteWaitingState(channelId)`: 대기방 상태 삭제
  - `setConfirmedState(channelId, state)`: 확정방 상태 저장
  - `getConfirmedState(channelId)`: 확정방 상태 조회
  - `deleteConfirmedState(channelId)`: 확정방 상태 삭제
  - `addTriggerChannel(guildId, triggerChannelId)`: 트리거 채널 집합에 추가 (SADD)
  - `removeTriggerChannel(guildId, triggerChannelId)`: 트리거 채널 집합에서 제거 (SREM)
  - `isTriggerChannel(guildId, channelId)`: 트리거 채널 여부 확인 (SISMEMBER)
  - `initTriggerSet(guildId, triggerChannelIds)`: 봇 기동 시 트리거 집합 초기화

### 2-4. 자동방 이벤트 정의

**파일**: `apps/api/src/event/auto-channel/auto-channel-events.ts`

voice-events.ts와 동일한 패턴으로 자동방 전용 이벤트를 정의한다.

```typescript
export const AUTO_CHANNEL_EVENTS = {
  TRIGGER_JOIN: 'auto-channel.trigger-join',
  CHANNEL_EMPTY: 'auto-channel.channel-empty',
} as const;

export class AutoChannelTriggerJoinEvent {
  constructor(public readonly state: VoiceStateDto) {}
}

export class AutoChannelChannelEmptyEvent {
  constructor(
    public readonly guildId: string,
    public readonly channelId: string,
  ) {}
}
```

### 2-5. 자동방 트리거 입장 핸들러

**파일**: `apps/api/src/event/auto-channel/auto-channel-trigger-join.handler.ts`

`AUTO_CHANNEL_EVENTS.TRIGGER_JOIN` 이벤트를 수신하여 `AutoChannelService.handleTriggerJoin`을 호출한다.

### 2-6. 자동방 채널 비어있음 핸들러

**파일**: `apps/api/src/event/auto-channel/auto-channel-channel-empty.handler.ts`

`AUTO_CHANNEL_EVENTS.CHANNEL_EMPTY` 이벤트를 수신하여 `AutoChannelService.handleChannelEmpty`를 호출한다.
이 이벤트는 `VoiceStateDispatcher`의 `isLeave` 분기에서 채널 잔류 인원이 0명일 때 발행한다.

### 2-7. 자동방 Discord Interaction 핸들러

**파일**: `apps/api/src/event/auto-channel/auto-channel-interaction.handler.ts`

Discord.js의 `interactionCreate` 이벤트 리스너. `@On('interactionCreate')`를 사용하며, `interaction.isButton()`으로 버튼 인터랙션을 필터링한다.
customId 접두사 `auto_btn:{buttonId}` 또는 `auto_sub:{subOptionId}` 패턴으로 자동방 버튼 여부를 판별하고, `AutoChannelService`의 적절한 메서드를 호출한다.

### 2-8. 자동방 핵심 서비스

**파일**: `apps/api/src/channel/auto/application/auto-channel.service.ts`

자동방 생성/전환/삭제의 핵심 비즈니스 로직을 담당한다.

- 메서드 목록:
  - `handleTriggerJoin(state: VoiceStateDto)`: 트리거 채널 입장 처리 (대기방 생성 + 이동)
  - `handleButtonClick(interaction)`: 버튼 클릭 처리 (하위 선택지 여부에 따라 분기)
  - `handleSubOptionClick(interaction)`: 하위 선택지 클릭 처리 (확정방 전환)
  - `convertToConfirmed(guildId, waitingChannelId, button, subOption?)`: 확정방 전환 (채널명/카테고리 변경 + 세션 추적 시작)
  - `handleChannelEmpty(guildId, channelId)`: 채널 비어있음 처리 (대기방/확정방 판별 후 삭제)
  - `resolveChannelName(guild, baseName)`: 중복 채널명 순번 처리

- 의존성:
  - `AutoChannelRedisRepository`
  - `AutoChannelConfigRepository` (DB)
  - `DiscordVoiceGateway` (채널 생성/삭제/이동)
  - `VoiceChannelService` (확정방 전환 시 세션 추적 시작/종료)

### 2-9. 자동방 DB 설정 저장소

**파일**: `apps/api/src/channel/auto/infrastructure/auto-channel-config.repository.ts`

TypeORM Repository 래퍼. 설정 저장/조회/삭제 로직을 캡슐화한다.

- 메서드 목록:
  - `findByGuildId(guildId)`: 서버별 설정 목록 조회 (buttons, subOptions eager)
  - `findByTriggerChannel(guildId, triggerChannelId)`: 특정 트리거 채널 설정 조회
  - `upsert(guildId, triggerChannelId, dto)`: 설정 생성 또는 갱신 (버튼/하위선택지 replace 포함)
  - `updateGuideMessageId(configId, messageId)`: 안내 메시지 ID 갱신

### 2-10. 자동방 설정 웹 API 컨트롤러

**파일**: `apps/api/src/channel/auto/auto-channel.controller.ts`

경로: `POST /api/guilds/:guildId/auto-channel`

PRD F-WEB-004의 저장 동작(설정 DB 저장 → 안내 메시지 전송/갱신)을 처리하는 REST API 엔드포인트.
`JwtAuthGuard`로 인증을 보호한다.

### 2-11. 자동방 설정 요청/응답 DTO

**파일**: `apps/api/src/channel/auto/dto/auto-channel-save.dto.ts`

웹 API 요청 바디 DTO.

```typescript
export class AutoChannelSubOptionDto {
  label: string;
  emoji?: string;
  channelSuffix: string;
  sortOrder: number;
}

export class AutoChannelButtonDto {
  label: string;
  emoji?: string;
  targetCategoryId: string;
  sortOrder: number;
  subOptions: AutoChannelSubOptionDto[];
}

export class AutoChannelSaveDto {
  triggerChannelId: string;
  waitingRoomTemplate: string;
  guideMessage: string;
  buttons: AutoChannelButtonDto[];
}
```

### 2-12. 자동방 메인 NestJS 모듈

**파일**: `apps/api/src/channel/auto/auto-channel.module.ts`

자동방 관련 모든 provider를 등록하고, `VoiceChannelModule`, `MemberModule`, `ChannelModule`, `GatewayModule`, `RedisModule`, `DiscordModule.forFeature()`, `AuthModule`을 import한다.
TypeOrmModule에 `AutoChannelConfig`, `AutoChannelButton`, `AutoChannelSubOption` 엔티티를 등록한다.

### 2-13. 자동방 안내 메시지 Discord Gateway

**파일**: `apps/api/src/channel/auto/infrastructure/auto-channel-discord.gateway.ts`

자동방 전용 Discord API 호출 (안내 메시지 전송/수정, 채널명/카테고리 변경)을 담당한다.
`DiscordVoiceGateway`와 별도로 분리하여 관심사를 명확히 한다.

- 메서드 목록:
  - `sendGuideMessage(channelId, guideMessage, buttons)`: 트리거 채널에 안내 메시지 + 버튼 전송
  - `editGuideMessage(channelId, messageId, guideMessage, buttons)`: 기존 안내 메시지 수정
  - `editVoiceChannel(channelId, name, parentCategoryId)`: 채널명과 카테고리 동시 변경 (대기방→확정방 전환)
  - `getVoiceChannelMemberCount(channelId)`: 채널 잔류 인원 수 조회 (채널 삭제 판단용)
  - `fetchGuildVoiceChannels(guildId)`: 서버 내 음성 채널 목록 조회 (중복 채널명 순번 처리 + 웹 설정 UI용)

### 2-14. 자동방 봇 기동 시 트리거 캐시 초기화 서비스

**파일**: `apps/api/src/channel/auto/application/auto-channel-bootstrap.service.ts`

`OnApplicationBootstrap`을 구현한다. 봇 기동 시 DB의 모든 AutoChannelConfig를 조회하여 Redis의 `auto_channel:trigger:{guildId}` Set을 초기화한다. 이를 통해 트리거 채널 판별 조회가 항상 Redis에서 처리된다.

---

## 3. 수정이 필요한 기존 파일 목록 및 수정 내용

### 3-1. `VoiceStateDispatcher` 수정

**파일**: `apps/api/src/event/voice/voice-state.dispatcher.ts`

`isJoin` 분기에서 트리거 채널 여부를 확인하는 로직을 추가한다.

```typescript
// 기존 isJoin 처리
if (isJoin) {
  const isTrigger = await this.autoChannelRedisRepository.isTriggerChannel(
    newState.guild.id,
    newState.channelId!,
  );

  if (isTrigger) {
    // 자동방 트리거 입장 이벤트 발행 — voice 세션 추적 건너뜀
    const dto = VoiceStateDto.fromVoiceState(newState);
    await this.eventEmitter.emitAsync(
      AUTO_CHANNEL_EVENTS.TRIGGER_JOIN,
      new AutoChannelTriggerJoinEvent(dto),
    );
  } else {
    // 일반 입장
    const dto = VoiceStateDto.fromVoiceState(newState);
    await this.eventEmitter.emitAsync(VOICE_EVENTS.JOIN, new VoiceJoinEvent(dto));
    this.emitAloneChanged(newState);
  }
}
```

`isLeave` 분기에서 채널 잔류 인원이 0명일 때 `AUTO_CHANNEL_EVENTS.CHANNEL_EMPTY` 이벤트를 추가 발행한다.

```typescript
if (isLeave) {
  const dto = VoiceStateDto.fromVoiceState(oldState);
  await this.eventEmitter.emitAsync(VOICE_EVENTS.LEAVE, new VoiceLeaveEvent(dto));
  this.emitAloneChanged(oldState);

  // 채널이 비어있으면 자동방 삭제 이벤트 발행
  if (oldState.channel && oldState.channel.members.size === 0) {
    this.eventEmitter.emit(
      AUTO_CHANNEL_EVENTS.CHANNEL_EMPTY,
      new AutoChannelChannelEmptyEvent(oldState.guild.id, oldState.channelId!),
    );
  }
}
```

`isMove` 분기에서 이동 후 이전 채널(oldState)이 비어있을 경우에도 동일하게 `CHANNEL_EMPTY` 이벤트를 발행한다.

`AutoChannelRedisRepository`를 생성자에서 주입받는다.

### 3-2. `DiscordEventsModule` 수정

**파일**: `apps/api/src/event/discord-events.module.ts`

`AutoChannelModule`을 import 목록에 추가하고, 새로 생성할 이벤트 핸들러들(`AutoChannelTriggerJoinHandler`, `AutoChannelChannelEmptyHandler`, `AutoChannelInteractionHandler`)을 providers에 추가한다.

### 3-3. `AppModule` 수정

**파일**: `apps/api/src/app.module.ts`

`AutoChannelModule`을 imports 목록에 추가한다.

---

## 4. 구현 단위(모듈) 분류

이후 병렬 개발을 위해 다음 4개의 단위로 분리한다. 각 단위는 이 문서에서 정의된 공통 모듈(인터페이스, Redis 키, 이벤트 상수) 완성 후 병렬 진행 가능하다.

| 단위 | 기능 | 포함 파일 |
|------|------|-----------|
| A. 트리거-대기방 | F-VOICE-007, F-VOICE-008 | `AutoChannelTriggerJoinHandler`, `AutoChannelService.handleTriggerJoin`, `AutoChannelBootstrapService` |
| B. 버튼-확정방 | F-VOICE-009, F-VOICE-010, F-VOICE-011 | `AutoChannelInteractionHandler`, `AutoChannelDiscordGateway.sendGuideMessage/editGuideMessage/editVoiceChannel`, `AutoChannelService.handleButtonClick/handleSubOptionClick/convertToConfirmed` |
| C. 채널 삭제 | F-VOICE-012 | `AutoChannelChannelEmptyHandler`, `AutoChannelService.handleChannelEmpty` |
| D. 웹 설정 API | F-WEB-004 | `AutoChannelController`, `AutoChannelSaveDto`, `AutoChannelConfigRepository.upsert` |

---

## 5. 파일 경로 전체 목록 (충돌 방지용 사전 확정)

공통 모듈 단계에서 생성/수정할 파일:

### 신규 생성

```
apps/api/src/channel/auto/
  auto-channel.module.ts                              (2-12)
  auto-channel.controller.ts                          (2-10)
  application/
    auto-channel.service.ts                           (2-8)
    auto-channel-bootstrap.service.ts                 (2-14)
  infrastructure/
    auto-channel.keys.ts                              (2-1)
    auto-channel-state.ts                             (2-2)
    auto-channel-redis.repository.ts                  (2-3)
    auto-channel-config.repository.ts                 (2-9)
    auto-channel-discord.gateway.ts                   (2-13)
  dto/
    auto-channel-save.dto.ts                          (2-11)

apps/api/src/event/auto-channel/
  auto-channel-events.ts                              (2-4)
  auto-channel-trigger-join.handler.ts                (2-5)
  auto-channel-channel-empty.handler.ts               (2-6)
  auto-channel-interaction.handler.ts                 (2-7)
```

### 기존 수정

```
apps/api/src/event/voice/voice-state.dispatcher.ts   (3-1)
apps/api/src/event/discord-events.module.ts          (3-2)
apps/api/src/app.module.ts                           (3-3)
```

---

## 6. customId 네이밍 규칙 (버튼 인터랙션 판별)

Discord 버튼 `customId`는 다음 패턴으로 통일한다. 이를 통해 `AutoChannelInteractionHandler`가 자동방 버튼과 다른 버튼을 구분할 수 있다.

| 버튼 종류 | customId 패턴 | 예시 |
|-----------|---------------|------|
| 1단계 버튼 (하위 선택지 없음) | `auto_btn:{buttonId}` | `auto_btn:3` |
| 1단계 버튼 (하위 선택지 있음) | `auto_btn:{buttonId}` | `auto_btn:5` |
| 2단계 하위 선택지 버튼 | `auto_sub:{subOptionId}` | `auto_sub:12` |

`interaction.customId.startsWith('auto_btn:')` 또는 `'auto_sub:'`로 필터링한다.

---

## 7. 네이밍 템플릿 처리 규칙

대기방 채널명 생성 시 `waitingRoomTemplate`의 `{username}` 변수를 치환한다.
이 로직은 `AutoChannelService` 내부 private 메서드로 구현한다.

```typescript
private applyTemplate(template: string, username: string): string {
  return template.replace('{username}', username);
}
```

확정방 채널명 결정 규칙:
- 하위 선택지 없음: `{username}의 {버튼 라벨}`
- 하위 선택지 있음: `{username}의 {버튼 라벨} {channelSuffix}`
- 동일 이름 채널 존재 시: `{위 이름} 2`, `{위 이름} 3` 순번 자동 부여

동일 채널명 중복 확인은 `AutoChannelDiscordGateway.fetchGuildVoiceChannels`로 서버 내 음성 채널 목록을 가져와 클라이언트 사이드에서 처리한다.

---

## 검증 체크리스트

이 문서가 "페이지 단위 병렬 개발 시 코드 conflict가 생길 공통 모듈을 모두 포함하는가"를 3회 확인한다.

### 1차 확인

- [x] Redis 키 네이밍: `AutoChannelKeys` (2-1)에서 중앙화 — 각 단위가 동일 키 패턴 사용
- [x] Redis 상태 인터페이스: `AutoChannelWaitingState`, `AutoChannelConfirmedState` (2-2)에서 공유 타입 확정
- [x] 이벤트 상수: `AUTO_CHANNEL_EVENTS` (2-4)에서 중앙화 — Dispatcher와 Handler가 동일 상수 참조
- [x] customId 패턴: 6절에서 사전 확정 — 단위 B, C가 동일 패턴 사용
- [x] DTO 구조: `AutoChannelSaveDto` (2-11)에서 사전 확정 — 단위 D가 단독 사용
- [x] `VoiceStateDispatcher` 수정: 3-1에서 수정 범위 확정 — 단위 A, C가 의존하는 분기 수정 사전 완료
- [x] `DiscordEventsModule` 수정: 3-2에서 수정 내용 확정
- [x] `AppModule` 수정: 3-3에서 수정 내용 확정
- [x] 파일 경로 전체 목록: 5절에서 사전 확정 — 단위 간 같은 파일을 동시 생성하는 충돌 없음

### 2차 확인

- [x] 단위 A (트리거-대기방)가 의존하는 공통 모듈: `AutoChannelKeys` (2-1), `AutoChannelWaitingState` (2-2), `AutoChannelRedisRepository` (2-3), `AUTO_CHANNEL_EVENTS.TRIGGER_JOIN` (2-4), `DiscordVoiceGateway` (기존 재사용), 수정된 `VoiceStateDispatcher` (3-1) — 모두 이 문서에 포함됨
- [x] 단위 B (버튼-확정방)가 의존하는 공통 모듈: `AutoChannelKeys` (2-1), `AutoChannelWaitingState`, `AutoChannelConfirmedState` (2-2), `AutoChannelRedisRepository` (2-3), `AUTO_CHANNEL_EVENTS` (2-4), customId 패턴 (6절), `AutoChannelDiscordGateway` (2-13), `VoiceChannelService` (기존 재사용) — 모두 이 문서에 포함됨
- [x] 단위 C (채널 삭제)가 의존하는 공통 모듈: `AutoChannelKeys` (2-1), `AutoChannelWaitingState`, `AutoChannelConfirmedState` (2-2), `AutoChannelRedisRepository` (2-3), `AUTO_CHANNEL_EVENTS.CHANNEL_EMPTY` (2-4), 수정된 `VoiceStateDispatcher` (3-1), `VoiceChannelService` (기존 재사용) — 모두 이 문서에 포함됨
- [x] 단위 D (웹 설정 API)가 의존하는 공통 모듈: `AutoChannelSaveDto` (2-11), `AutoChannelConfigRepository` (2-9), `AutoChannelRedisRepository.initTriggerSet/addTriggerChannel` (2-3), `AutoChannelDiscordGateway.sendGuideMessage/editGuideMessage` (2-13), `JwtAuthGuard` (기존 재사용) — 모두 이 문서에 포함됨

### 3차 확인

- [x] 단위 A~D 간에 동일 파일을 동시에 신규 생성하는 경우가 없는가: 5절 파일 경로 목록 기준으로 각 파일은 단 하나의 단위에만 귀속됨. `AutoChannelService`(2-8)는 모든 단위가 사용하지만 파일 자체는 공통 모듈 단계에서 먼저 생성되므로 충돌 없음.
- [x] 단위 A~D가 수정하는 기존 파일에 중복이 없는가: 3절에서 수정 대상 파일(`VoiceStateDispatcher`, `DiscordEventsModule`, `AppModule`) 3개가 모두 공통 모듈 단계에서 수정 완료되므로, 이후 단위 작업에서 이 파일들에 추가 수정이 불필요함.
- [x] `VoiceChannelModule`의 exports 항목이 자동방에서 필요한 서비스를 모두 포함하는가: 현재 `exports: [VoiceChannelService, VoiceDailyFlushService, VoiceRedisRepository, TypeOrmModule]`으로, 자동방에서 필요한 `VoiceChannelService`가 포함되어 있음. 추가 export 필요 없음.
