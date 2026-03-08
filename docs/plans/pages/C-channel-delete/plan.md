# 단위 C: 자동방 채널 삭제 — 구현 계획

## 개요

F-VOICE-012를 구현한다. 음성 채널에서 마지막 유저가 퇴장할 때 해당 채널이 자동방(대기방 또는 확정방)이면 즉시 삭제하는 기능이다. 공통 모듈 판단 문서(auto-channel-common-modules.md)의 2-6, 2-8, 3-1, 3-2 항목이 이 단위에 해당한다.

---

## 1. 전제 조건 (선행 완료 필요)

이 단위 C는 공통 모듈 단계에서 아래 파일들이 이미 완성되어 있다고 가정한다.

| 파일 | 역할 |
|------|------|
| `apps/api/src/channel/auto/infrastructure/auto-channel.keys.ts` | Redis 키 패턴 중앙화 |
| `apps/api/src/channel/auto/infrastructure/auto-channel-state.ts` | `AutoChannelWaitingState`, `AutoChannelConfirmedState` 인터페이스 |
| `apps/api/src/channel/auto/infrastructure/auto-channel-redis.repository.ts` | `getWaitingState`, `deleteWaitingState`, `getConfirmedState`, `deleteConfirmedState` 메서드 포함 |
| `apps/api/src/event/auto-channel/auto-channel-events.ts` | `AUTO_CHANNEL_EVENTS.CHANNEL_EMPTY`, `AutoChannelChannelEmptyEvent` 정의 포함 |
| `apps/api/src/channel/auto/auto-channel.module.ts` | `AutoChannelModule` (providers 등록) |

---

## 2. 생성/수정 파일 목록

### 2-1. 신규 생성

| 파일 경로 | 설명 |
|-----------|------|
| `apps/api/src/event/auto-channel/auto-channel-channel-empty.handler.ts` | `CHANNEL_EMPTY` 이벤트 수신 후 서비스 호출 |

### 2-2. 기존 수정

| 파일 경로 | 수정 내용 |
|-----------|-----------|
| `apps/api/src/channel/auto/application/auto-channel.service.ts` | `handleChannelEmpty` 메서드 추가 |
| `apps/api/src/event/voice/voice-state.dispatcher.ts` | `isLeave` / `isMove` 분기에 `CHANNEL_EMPTY` 이벤트 발행 추가 |
| `apps/api/src/event/discord-events.module.ts` | `AutoChannelChannelEmptyHandler` provider 등록 및 `AutoChannelModule` import 추가 |

---

## 3. 각 파일의 구체적인 변경 내용

### 3-1. `voice-state.dispatcher.ts` 수정

**수정 목적**: `isLeave`와 `isMove` 분기에서 채널이 비어있으면 `CHANNEL_EMPTY` 이벤트를 추가 발행한다.

**핵심 판단 기준**: `oldState.channel.members.size === 0`. Discord.js `VoiceState.channel.members`는 해당 시점 채널 멤버 수를 반영한다. 퇴장 이후의 `oldState`에서 `members.size`를 읽으면 퇴장한 유저가 이미 빠진 상태이므로 0이면 빈 채널이다.

**추가 import**:

```typescript
import {
  AUTO_CHANNEL_EVENTS,
  AutoChannelChannelEmptyEvent,
} from '../auto-channel/auto-channel-events';
import { AutoChannelRedisRepository } from '../../channel/auto/infrastructure/auto-channel-redis.repository';
```

**생성자 변경**:

```typescript
constructor(
  private readonly eventEmitter: EventEmitter2,
  private readonly autoChannelRedisRepository: AutoChannelRedisRepository,
) {}
```

`AutoChannelRedisRepository`는 `AutoChannelModule`에서 export되어야 하므로, `AutoChannelModule`이 `DiscordEventsModule`에 import되면 자동으로 해결된다.

**`isLeave` 분기 변경**:

```typescript
if (isLeave) {
  const dto = VoiceStateDto.fromVoiceState(oldState);
  await this.eventEmitter.emitAsync(VOICE_EVENTS.LEAVE, new VoiceLeaveEvent(dto));
  this.emitAloneChanged(oldState);

  // 채널이 비어있으면 자동방 삭제 이벤트 발행 (비동기 fire-and-forget)
  if (oldState.channel && oldState.channel.members.size === 0) {
    this.eventEmitter.emit(
      AUTO_CHANNEL_EVENTS.CHANNEL_EMPTY,
      new AutoChannelChannelEmptyEvent(oldState.guild.id, oldState.channelId!),
    );
  }
}
```

**`isMove` 분기 변경**:

```typescript
if (isMove) {
  const oldDto = VoiceStateDto.fromVoiceState(oldState);
  const newDto = VoiceStateDto.fromVoiceState(newState);
  await this.eventEmitter.emitAsync(VOICE_EVENTS.MOVE, new VoiceMoveEvent(oldDto, newDto));
  this.emitAloneChanged(oldState);
  this.emitAloneChanged(newState);

  // 이동 후 이전 채널이 비어있으면 자동방 삭제 이벤트 발행
  if (oldState.channel && oldState.channel.members.size === 0) {
    this.eventEmitter.emit(
      AUTO_CHANNEL_EVENTS.CHANNEL_EMPTY,
      new AutoChannelChannelEmptyEvent(oldState.guild.id, oldState.channelId!),
    );
  }
}
```

**주의 사항**:
- `CHANNEL_EMPTY`는 `emitAsync`가 아닌 `emit`으로 발행한다. 채널 삭제는 메인 leave/move 흐름과 독립적으로 진행되어야 하며, 삭제 실패가 세션 종료 처리를 블로킹해서는 안 된다.
- `isJoin` 분기는 이 단위에서 수정하지 않는다. 트리거 채널 입장 처리는 단위 A의 범위다.

---

### 3-2. `auto-channel-channel-empty.handler.ts` 신규 생성

**경로**: `apps/api/src/event/auto-channel/auto-channel-channel-empty.handler.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { AutoChannelService } from '../../channel/auto/application/auto-channel.service';
import {
  AUTO_CHANNEL_EVENTS,
  AutoChannelChannelEmptyEvent,
} from './auto-channel-events';

@Injectable()
export class AutoChannelChannelEmptyHandler {
  constructor(private readonly autoChannelService: AutoChannelService) {}

  @OnEvent(AUTO_CHANNEL_EVENTS.CHANNEL_EMPTY)
  async handle(event: AutoChannelChannelEmptyEvent): Promise<void> {
    await this.autoChannelService.handleChannelEmpty(event.guildId, event.channelId);
  }
}
```

기존 `VoiceLeaveHandler`, `VoiceJoinHandler` 패턴과 동일하다.

---

### 3-3. `auto-channel.service.ts` — `handleChannelEmpty` 메서드 추가

**경로**: `apps/api/src/channel/auto/application/auto-channel.service.ts`

이 메서드만 단위 C의 책임이다. 다른 메서드(`handleTriggerJoin`, `handleButtonClick` 등)는 단위 A, B의 범위다.

**추가할 의존성**:

```typescript
constructor(
  private readonly autoChannelRedisRepository: AutoChannelRedisRepository,
  private readonly discord: DiscordVoiceGateway,       // 기존 재사용
  private readonly voiceChannelService: VoiceChannelService, // 확정방 세션 종료용
  private readonly logger: Logger,
) {}
```

`DiscordVoiceGateway`는 `VoiceChannelModule`에서 export되지 않으므로 `AutoChannelModule`이 `DiscordModule.forFeature()`를 import하여 직접 주입받는다.

**`handleChannelEmpty` 메서드 전체 로직**:

```typescript
async handleChannelEmpty(guildId: string, channelId: string): Promise<void> {
  // 1단계: 대기방 여부 확인
  const waitingState = await this.autoChannelRedisRepository.getWaitingState(channelId);

  if (waitingState) {
    await this.deleteWaitingChannel(channelId, waitingState);
    return;
  }

  // 2단계: 확정방 여부 확인
  const confirmedState = await this.autoChannelRedisRepository.getConfirmedState(channelId);

  if (confirmedState) {
    await this.deleteConfirmedChannel(channelId, confirmedState);
    return;
  }

  // 자동방이 아니면 무시
}
```

**대기방 삭제 private 메서드**:

```typescript
private async deleteWaitingChannel(
  channelId: string,
  state: AutoChannelWaitingState,
): Promise<void> {
  // 대기방은 세션 추적이 없으므로 Redis 키 삭제 후 Discord 채널 삭제
  await this.autoChannelRedisRepository.deleteWaitingState(channelId);

  try {
    await this.discord.deleteChannel(channelId);
    this.logger.log(`[AUTO CHANNEL] Waiting channel deleted: ${channelId} (guild=${state.guildId})`);
  } catch (error) {
    this.logger.error(
      `[AUTO CHANNEL] Failed to delete waiting channel: ${channelId}`,
      (error as Error).stack,
    );
    // Discord 채널 삭제 실패는 Redis 키가 이미 삭제된 상태이므로 재시도 없이 로그만 남긴다.
    // TTL 12시간 경과 시 고아 키는 자동 소멸한다.
  }
}
```

**확정방 삭제 private 메서드**:

```typescript
private async deleteConfirmedChannel(
  channelId: string,
  state: AutoChannelConfirmedState,
): Promise<void> {
  // 1. 세션 종료 처리 (F-VOICE-002와 동일)
  //    확정방의 소유 유저(state.userId)에 대한 세션만 종료한다.
  //    채널에 다른 유저들도 있었다면 이미 각자의 LEAVE 이벤트로 세션이 종료된 상태이므로
  //    마지막 퇴장자(= state.userId인 경우가 대부분)의 세션을 종료한다.
  //    단, 마지막 퇴장자가 소유자가 아닐 수 있으므로 세션 존재 여부로 판단한다.
  try {
    await this.voiceChannelService.closeSessionForChannel(state.guildId, channelId);
  } catch (error) {
    this.logger.error(
      `[AUTO CHANNEL] Failed to close session for confirmed channel: ${channelId}`,
      (error as Error).stack,
    );
    // 세션 종료 실패 시에도 Redis 키와 Discord 채널은 삭제한다.
  }

  // 2. 확정방 Redis 키 삭제
  await this.autoChannelRedisRepository.deleteConfirmedState(channelId);

  // 3. Discord 채널 삭제
  try {
    await this.discord.deleteChannel(channelId);
    this.logger.log(`[AUTO CHANNEL] Confirmed channel deleted: ${channelId} (guild=${state.guildId})`);
  } catch (error) {
    this.logger.error(
      `[AUTO CHANNEL] Failed to delete confirmed channel: ${channelId}`,
      (error as Error).stack,
    );
  }
}
```

---

### 3-4. `VoiceChannelService`에 `closeSessionForChannel` 추가

**경로**: `apps/api/src/channel/voice/application/voice-channel.service.ts`

**추가 이유**: 확정방 채널 삭제 시 채널에 마지막으로 남아 있던 유저들의 세션이 이미 `VOICE_EVENTS.LEAVE`로 종료되어 있다. 그러나 확정방 상태(`AutoChannelConfirmedState`)에는 소유자 userId만 기록되어 있으며, 채널 삭제 시점에 아직 세션이 남아 있는 유저가 있을 수 있다. 이를 `VoiceChannelService`에 채널 ID 기반으로 처리하는 메서드를 추가한다.

**구체적인 설계 검토**: `VoiceSession`에는 `channelId`가 기록되어 있다. 그러나 채널 ID → 세션 목록 역방향 조회는 `VoiceRedisRepository`에 현재 구현이 없다. 스캔 비용을 고려하여, **확정방 삭제는 소유자 userId에 대해서만 세션 종료를 시도**하는 방식으로 단순화한다.

설계 근거:
- 확정방에서 마지막 유저가 퇴장할 때 `VOICE_EVENTS.LEAVE`가 이미 발행되어 해당 유저의 세션이 `onUserLeave`로 종료된다.
- `CHANNEL_EMPTY` 이벤트는 `VOICE_EVENTS.LEAVE`의 `await emitAsync` 완료 후 `emit`(비동기 fire-and-forget)으로 발행된다.
- 따라서 `handleChannelEmpty` 시점에는 마지막 퇴장자의 세션이 이미 종료되어 있다.
- 결론: `handleChannelEmpty`에서 별도의 세션 종료 처리는 불필요하다. Redis 키 삭제 + Discord 채널 삭제만 수행한다.

**수정된 설계 (세션 종료 제거)**:

```typescript
private async deleteConfirmedChannel(
  channelId: string,
  state: AutoChannelConfirmedState,
): Promise<void> {
  // VOICE_EVENTS.LEAVE가 await emitAsync로 완료된 후 CHANNEL_EMPTY가 발행되므로
  // 이 시점에서 채널의 마지막 퇴장자 세션은 이미 종료됨
  // 별도 세션 종료 처리 불필요

  // 1. 확정방 Redis 키 삭제
  await this.autoChannelRedisRepository.deleteConfirmedState(channelId);

  // 2. Discord 채널 삭제
  try {
    await this.discord.deleteChannel(channelId);
    this.logger.log(`[AUTO CHANNEL] Confirmed channel deleted: ${channelId} (guild=${state.guildId})`);
  } catch (error) {
    this.logger.error(
      `[AUTO CHANNEL] Failed to delete confirmed channel: ${channelId}`,
      (error as Error).stack,
    );
  }
}
```

따라서 `VoiceChannelService`에 새 메서드를 추가하지 않는다.

---

### 3-5. `discord-events.module.ts` 수정

**수정 내용**: `AutoChannelModule` import 추가, `AutoChannelChannelEmptyHandler` provider 등록.

```typescript
import { AutoChannelModule } from '../channel/auto/auto-channel.module';
import { AutoChannelChannelEmptyHandler } from './auto-channel/auto-channel-channel-empty.handler';

@Module({
  imports: [
    ChannelModule,
    VoiceChannelModule,
    AutoChannelModule,          // 추가
    DiscordModule.forFeature(),
  ],
  providers: [
    ChannelStateHandler,
    VoiceStateDispatcher,
    VoiceJoinHandler,
    VoiceLeaveHandler,
    VoiceMoveHandler,
    MicToggleHandler,
    VoiceAloneHandler,
    AutoChannelChannelEmptyHandler,  // 추가
  ],
})
export class DiscordEventsModule {}
```

---

## 4. 로직 흐름 전체 다이어그램

```
Discord voiceStateUpdate 이벤트
    │
    ▼
VoiceStateDispatcher.dispatch(oldState, newState)
    │
    ├── isLeave = true (또는 isMove = true, oldState 기준)
    │       │
    │       ├── emitAsync(VOICE_EVENTS.LEAVE, ...)    ← await: 세션 종료 완료 대기
    │       │       │
    │       │       └── VoiceLeaveHandler → VoiceChannelService.onUserLeave
    │       │               ├── historyService.logLeave   (PostgreSQL leftAt 갱신)
    │       │               ├── sessionService.closeSession (Redis 세션 종료 + flush)
    │       │               └── tempChannelService.handleLeave (기존 임시방 처리)
    │       │
    │       └── oldState.channel.members.size === 0
    │               │
    │               └── emit(AUTO_CHANNEL_EVENTS.CHANNEL_EMPTY, ...)  ← fire-and-forget
    │                       │
    │                       ▼
    │               AutoChannelChannelEmptyHandler.handle
    │                       │
    │                       ▼
    │               AutoChannelService.handleChannelEmpty(guildId, channelId)
    │                       │
    │                       ├── getWaitingState(channelId) → 존재
    │                       │       └── deleteWaitingChannel()
    │                       │               ├── deleteWaitingState(channelId)   [Redis]
    │                       │               └── discord.deleteChannel(channelId) [Discord API]
    │                       │
    │                       ├── getConfirmedState(channelId) → 존재
    │                       │       └── deleteConfirmedChannel()
    │                       │               ├── deleteConfirmedState(channelId) [Redis]
    │                       │               └── discord.deleteChannel(channelId) [Discord API]
    │                       │
    │                       └── 둘 다 없음 → 무시 (일반 채널)
    │
    └── emitAloneChanged(oldState)  ← 채널에 남은 유저 alone 상태 갱신
```

---

## 5. 대기방 vs 확정방 분기 처리 상세

### 대기방 (`auto_channel:waiting:{channelId}`)

| 단계 | 동작 | 실패 시 |
|------|------|---------|
| 1 | `autoChannelRedisRepository.getWaitingState(channelId)` | null이면 이 분기 건너뜀 |
| 2 | `autoChannelRedisRepository.deleteWaitingState(channelId)` | 예외 전파 (핸들러에서 catch 불가 → 로그) |
| 3 | `discord.deleteChannel(channelId)` | try-catch 내부 처리, 로그 기록 후 계속 |

**대기방은 세션 추적 대상이 아니므로** VoiceChannelHistory, VoiceSession 관련 처리가 전혀 없다. Redis 키 삭제 → Discord 채널 삭제 2단계로 끝난다.

### 확정방 (`auto_channel:confirmed:{channelId}`)

| 단계 | 동작 | 실패 시 |
|------|------|---------|
| 1 | `autoChannelRedisRepository.getConfirmedState(channelId)` | null이면 이 분기 건너뜀 |
| 2 | `autoChannelRedisRepository.deleteConfirmedState(channelId)` | 예외 전파 |
| 3 | `discord.deleteChannel(channelId)` | try-catch 내부 처리, 로그 기록 후 계속 |

**세션 종료는 불필요**하다. `VOICE_EVENTS.LEAVE`의 `emitAsync` 완료 후 `CHANNEL_EMPTY`가 발행되므로, 마지막 퇴장자의 `VoiceChannelService.onUserLeave`가 이미 완료된 시점이다.

---

## 6. 에러 처리 전략

### 에러 발생 지점별 처리

| 지점 | 처리 방식 | 이유 |
|------|-----------|------|
| `VoiceStateDispatcher` 내 `CHANNEL_EMPTY` emit | fire-and-forget (`emit`, not `emitAsync`) | 채널 삭제 실패가 세션 종료 블로킹 금지 |
| `getWaitingState` / `getConfirmedState` Redis 조회 실패 | 핸들러 상위 전파 → `@OnEvent` NestJS 기본 로깅 | Redis 장애 시 별도 처리 불가 |
| `deleteWaitingState` / `deleteConfirmedState` 삭제 실패 | 핸들러 상위 전파 | 고아 키는 TTL 12시간 자동 소멸 |
| `discord.deleteChannel` 실패 | try-catch 내부 처리, error 로그 기록 | 이미 삭제된 채널, 권한 없음 등 일시적 오류 가능 |

### Discord 채널이 이미 삭제된 경우

`DiscordVoiceGateway.deleteChannel`은 `channel?.isVoiceBased()`를 확인한다. `client.channels.fetch`가 404(Unknown Channel)를 던지면 예외가 전파된다. try-catch로 감싸 로그만 기록하고 진행한다.

### 동시성 고려

같은 채널에 여러 유저가 동시에 퇴장하는 경우:
- `CHANNEL_EMPTY`는 `members.size === 0`일 때만 발행되므로 마지막 한 명이 퇴장할 때만 트리거된다.
- 단, Discord `voiceStateUpdate` 이벤트는 순서가 보장되지 않을 수 있다. 두 유저가 거의 동시에 퇴장하면 두 이벤트가 연속 처리될 수 있으나, Redis의 `getWaitingState` / `getConfirmedState` 조회 결과가 첫 번째 처리에서 삭제되어 두 번째는 무시된다 (idempotent).

---

## 7. 의존성 주입 구조

### `AutoChannelService` 의존성

```
AutoChannelService
  ├── AutoChannelRedisRepository  (자체 모듈 내부)
  └── DiscordVoiceGateway         (DiscordModule.forFeature()로 주입)
```

`DiscordVoiceGateway`는 `VoiceChannelModule` 내부에 있으나 export되지 않는다. `AutoChannelModule`에서 `DiscordModule.forFeature()`를 import하면 `@InjectDiscordClient()`가 해결되므로, `AutoChannelModule` 내에서 `DiscordVoiceGateway`를 직접 provider로 선언하거나, 또는 `VoiceChannelModule`이 `DiscordVoiceGateway`를 export하도록 수정한다.

**결정**: `VoiceChannelModule`의 exports에 `DiscordVoiceGateway`를 추가한다. 이렇게 하면 단위 A, B, C 모두 동일 인스턴스를 공유하여 DRY를 준수한다.

**`VoiceChannelModule` exports 수정**:

```typescript
exports: [
  VoiceChannelService,
  VoiceDailyFlushService,
  VoiceRedisRepository,
  DiscordVoiceGateway,   // 추가
  TypeOrmModule,
],
```

### `VoiceStateDispatcher` 의존성 추가

```
VoiceStateDispatcher
  ├── EventEmitter2               (기존)
  └── AutoChannelRedisRepository  (추가)
```

`AutoChannelRedisRepository`는 `AutoChannelModule`에서 export되어야 하며, `DiscordEventsModule`이 `AutoChannelModule`을 import하면 DI가 해결된다.

---

## 8. 구현 순서

아래 순서대로 구현하면 컴파일 오류 없이 진행 가능하다.

1. **공통 모듈 확인**: `auto-channel-events.ts`에 `CHANNEL_EMPTY` 이벤트와 `AutoChannelChannelEmptyEvent`가 정의되어 있는지 확인. 없으면 추가.

2. **`AutoChannelRedisRepository`**: `getWaitingState`, `deleteWaitingState`, `getConfirmedState`, `deleteConfirmedState` 메서드 존재 여부 확인. 없으면 추가.

3. **`VoiceChannelModule` exports 수정**: `DiscordVoiceGateway` export 추가.

4. **`auto-channel.service.ts`**: `handleChannelEmpty`, `deleteWaitingChannel`, `deleteConfirmedChannel` 메서드 추가. 서비스가 아직 없으면 골격 생성 후 해당 메서드만 추가.

5. **`auto-channel-channel-empty.handler.ts` 신규 생성**.

6. **`voice-state.dispatcher.ts` 수정**: `isLeave`, `isMove` 분기에 `CHANNEL_EMPTY` emit 추가. 생성자에 `AutoChannelRedisRepository` 주입 추가.

7. **`discord-events.module.ts` 수정**: `AutoChannelModule` import, `AutoChannelChannelEmptyHandler` provider 등록.

8. **`AutoChannelModule`**: `AutoChannelRedisRepository`가 export 목록에 포함되는지 확인.

---

## 9. 기존 코드와의 충돌 검토

| 항목 | 충돌 위험 | 판단 |
|------|-----------|------|
| `VoiceTempChannelService.handleLeave` | 기존 임시방 삭제와 자동방 삭제가 동시에 실행될 수 있음 | `VoiceTempChannelService`는 `TempChannelStore`에 등록된 채널만 삭제한다. 자동방은 `TempChannelStore`에 등록되지 않으므로 충돌 없음. |
| `emitAloneChanged` | `members.size === 0` 채널에 대해 alone 이벤트가 발행될 수 있음 | `emitAloneChanged`는 `memberIds.length > 2`일 때 early return, `members.size === 0`이면 `memberIds = []`이므로 `VoiceAloneHandler`가 빈 배열로 호출된다. `updateAloneForChannel`은 빈 배열에 대해 for 루프를 건너뛰므로 부작용 없음. |
| `VoiceStateDispatcher` 생성자 변경 | `AutoChannelRedisRepository` DI 추가 | `DiscordEventsModule`에 `AutoChannelModule`이 import되면 자동 해결. 기존 테스트 코드가 있다면 mock 추가 필요. |
| `VOICE_EVENTS.LEAVE` 처리 순서 | leave → alone → CHANNEL_EMPTY 순서 보장 필요 | `emitAsync`로 leave 완료 대기 → `emitAloneChanged`(동기 emit) → `emit(CHANNEL_EMPTY)` 순서이므로 leave 완료 후 CHANNEL_EMPTY 발행이 보장됨. |

---

## 10. 파일 경로 최종 목록

```
# 신규 생성
apps/api/src/event/auto-channel/auto-channel-channel-empty.handler.ts

# 기존 수정
apps/api/src/channel/auto/application/auto-channel.service.ts
  └── handleChannelEmpty, deleteWaitingChannel, deleteConfirmedChannel 추가

apps/api/src/channel/voice/voice-channel.module.ts
  └── exports에 DiscordVoiceGateway 추가

apps/api/src/event/voice/voice-state.dispatcher.ts
  └── isLeave/isMove 분기에 CHANNEL_EMPTY emit 추가
  └── 생성자에 AutoChannelRedisRepository 주입 추가

apps/api/src/event/discord-events.module.ts
  └── AutoChannelModule import 추가
  └── AutoChannelChannelEmptyHandler provider 등록 추가
```
