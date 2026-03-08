# Newbie 도메인 — 공통 모듈 판단 문서

## 목적

페이지(기능) 단위 병렬 개발을 시작하기 전에, Newbie 도메인 구현에 필요한 공통 모듈을 식별하고 설계 방향을 확정한다.
이 문서에 정의된 모듈은 모든 개발 단위 작업보다 선행하여 완성되어야 하며, 이후 단위 작업들이 conflict 없이 병렬로 진행될 수 있도록 공통 인터페이스와 파일 경로를 명시한다.

---

## 1. 기존 모듈 중 Newbie 도메인에서 재사용 가능한 것

### 1-1. 재사용 (수정 없음)

| 모듈 | 파일 | 재사용 이유 |
|------|------|-------------|
| `RedisService` | `apps/api/src/redis/redis.service.ts` | `get`, `set`, `del`, `sadd`, `sismember`, `hIncrBy`, `pipeline` 등 Newbie Redis 키 패턴에 필요한 모든 기능이 구현되어 있음. 모코코 사냥의 `HINCRBY`, `ZINCRBY`는 `hIncrBy`와 직접 `client` 접근으로 처리 가능 |
| `VoiceChannelModule` (exports) | `apps/api/src/channel/voice/voice-channel.module.ts` | `VoiceChannelService`, `VoiceDailyFlushService`, `VoiceRedisRepository` exports — NewbieModule에서 import하여 미션 플레이타임 측정에 사용 |
| `VoiceDailyEntity` | `apps/api/src/channel/voice/domain/voice-daily.entity.ts` | 미션 플레이타임 조회 쿼리 (`SUM(channelDurationSec)`, `channelId != 'GLOBAL'`)에 사용 |
| `VoiceChannelHistory` | `apps/api/src/channel/voice/domain/voice-channel-history.entity.ts` | 미션 플레이횟수 조회 쿼리 (`COUNT(*)`, `joinAt BETWEEN startDate AND endDate`)에 사용 |
| `JwtAuthGuard` | `apps/api/src/auth/jwt-auth.guard.ts` | 웹 대시보드 설정 API 엔드포인트 보호 |

### 1-2. 재사용하되 수정이 필요한 것

| 모듈 | 파일 | 필요한 수정 내용 |
|------|------|-----------------|
| `VoiceStateDispatcher` | `apps/api/src/event/voice/voice-state.dispatcher.ts` | `isJoin`, `isLeave`, `isMove` 세 분기 모두에서 `voiceStateUpdate` 이벤트 발생 시 `MocoService`가 모코코 사냥 시간을 처리할 수 있도록 `NEWBIE_EVENTS.VOICE_STATE_CHANGED` 이벤트를 추가 발행해야 함. 기존 voice 로직과 충돌 없이 추가(append) 방식으로 처리. |
| `DiscordEventsModule` | `apps/api/src/event/discord-events.module.ts` | `NewbieModule` import 추가 및 `NewbieGateway`(guildMemberAdd 핸들러)를 providers에 추가. |
| `AppModule` | `apps/api/src/app.module.ts` | `NewbieModule` import 추가 및 TypeORM 엔티티 등록. |

---

## 2. 새로 만들어야 할 모듈/서비스/핸들러 목록

### 2-1. Newbie Redis 키 정의

**파일**: `apps/api/src/newbie/infrastructure/newbie-cache.keys.ts`

PRD에 정의된 Redis 키 패턴을 중앙화한다. 모든 단위(B~E)가 이 파일의 키 생성 함수를 참조한다.

```typescript
export const NewbieKeys = {
  /** 설정 캐시: newbie:config:{guildId} — TTL 1시간 */
  config: (guildId: string) => `newbie:config:${guildId}`,

  /** 진행중 미션 목록 캐시: newbie:mission:active:{guildId} — TTL 30분 */
  missionActive: (guildId: string) => `newbie:mission:active:${guildId}`,

  /** 신입기간 활성 멤버 집합: newbie:period:active:{guildId} — TTL 1시간 */
  periodActive: (guildId: string) => `newbie:period:active:${guildId}`,

  /** 사냥꾼별 신규사용자별 사냥 시간 Hash: newbie:moco:total:{guildId}:{hunterId} — TTL 없음 */
  mocoTotal: (guildId: string, hunterId: string) =>
    `newbie:moco:total:${guildId}:${hunterId}`,

  /** 길드별 사냥꾼 순위 Sorted Set: newbie:moco:rank:{guildId} — TTL 없음 */
  mocoRank: (guildId: string) => `newbie:moco:rank:${guildId}`,
} as const;
```

### 2-2. Newbie Redis 저장소

**파일**: `apps/api/src/newbie/infrastructure/newbie-redis.repository.ts`

Newbie 도메인 관련 Redis CRUD를 한 곳에서 관리한다. `AutoChannelRedisRepository`와 동일한 패턴으로 설계한다.

TTL 상수:
- `CONFIG`: 3,600초 (1시간)
- `MISSION_ACTIVE`: 1,800초 (30분)
- `PERIOD_ACTIVE`: 3,600초 (1시간)

메서드 목록:

| 메서드 | 설명 |
|--------|------|
| `getConfig(guildId)` | NewbieConfig 캐시 조회 |
| `setConfig(guildId, config)` | NewbieConfig 캐시 저장 (TTL 1시간) |
| `deleteConfig(guildId)` | NewbieConfig 캐시 삭제 (설정 저장 시 갱신 전 삭제) |
| `getMissionActive(guildId)` | 진행중 미션 목록 캐시 조회 |
| `setMissionActive(guildId, missions)` | 진행중 미션 목록 캐시 저장 (TTL 30분) |
| `deleteMissionActive(guildId)` | 진행중 미션 목록 캐시 삭제 (미션 생성/갱신 시) |
| `getPeriodActiveMembers(guildId)` | 신입기간 활성 멤버 Set 전체 조회 (SMEMBERS) |
| `addPeriodActiveMember(guildId, memberId)` | 신입기간 활성 멤버 추가 (SADD) |
| `isPeriodActiveMember(guildId, memberId)` | 신입기간 활성 멤버 여부 확인 (SISMEMBER) |
| `initPeriodActiveMembers(guildId, memberIds)` | 활성 멤버 집합 초기화 (DEL + SADD, TTL 1시간) |
| `deletePeriodActive(guildId)` | 신입기간 활성 멤버 캐시 삭제 (스케줄러 실행 후) |
| `incrMocoMinutes(guildId, hunterId, newbieMemberId, minutes)` | 사냥꾼의 신규사용자별 사냥 시간 누적 (HINCRBY) |
| `incrMocoRank(guildId, hunterId, minutes)` | 사냥꾼 총 사냥 시간 Sorted Set 갱신 (ZINCRBY) |
| `getMocoRankPage(guildId, page, pageSize)` | 사냥꾼 순위 페이지 조회 (ZREVRANGE WITH SCORES) |
| `getMocoHunterDetail(guildId, hunterId)` | 사냥꾼의 신규사용자별 상세 시간 조회 (HGETALL) |
| `getMocoRankCount(guildId)` | 전체 사냥꾼 수 조회 (ZCARD) |

### 2-3. Newbie DB 저장소

**파일**: `apps/api/src/newbie/infrastructure/newbie-config.repository.ts`

TypeORM Repository 래퍼. `NewbieConfig` 엔티티에 대한 DB CRUD를 캡슐화한다.

메서드 목록:

| 메서드 | 설명 |
|--------|------|
| `findByGuildId(guildId)` | guildId로 설정 단건 조회 |
| `upsert(guildId, dto)` | 설정 생성 또는 갱신 (guildId 기준 ON CONFLICT) |
| `updateMissionNotifyMessageId(guildId, messageId)` | 미션 현황 Embed 메시지 ID 갱신 |
| `updateMocoRankMessageId(guildId, messageId)` | 모코코 사냥 순위 Embed 메시지 ID 갱신 |

**파일**: `apps/api/src/newbie/infrastructure/newbie-mission.repository.ts`

TypeORM Repository 래퍼. `NewbieMission` 엔티티에 대한 DB CRUD를 캡슐화한다.

메서드 목록:

| 메서드 | 설명 |
|--------|------|
| `create(guildId, memberId, startDate, endDate, targetPlaytimeSec)` | 미션 레코드 생성 |
| `findActiveByGuild(guildId)` | 길드의 IN_PROGRESS 미션 목록 조회 |
| `findActiveByMember(guildId, memberId)` | 멤버의 IN_PROGRESS 미션 조회 (단건) |
| `findExpired(today)` | 만료된 IN_PROGRESS 미션 전체 조회 (스케줄러용, `status='IN_PROGRESS' AND endDate < today`) |
| `updateStatus(id, status)` | 미션 상태 갱신 (COMPLETED / FAILED) |

**파일**: `apps/api/src/newbie/infrastructure/newbie-period.repository.ts`

TypeORM Repository 래퍼. `NewbiePeriod` 엔티티에 대한 DB CRUD를 캡슐화한다.

메서드 목록:

| 메서드 | 설명 |
|--------|------|
| `create(guildId, memberId, startDate, expiresDate)` | 신입기간 레코드 생성 |
| `findActiveByGuild(guildId)` | 길드의 미만료 신입기간 레코드 전체 조회 (캐시 워밍업용) |
| `findActiveMemberByGuild(guildId, memberId)` | 특정 멤버의 활성 신입기간 조회 (단건) |
| `findExpired(today)` | 만료된 활성 레코드 조회 (스케줄러용, `isExpired=false AND expiresDate < today`) |
| `markExpired(id)` | isExpired = true 로 갱신 |

### 2-4. Newbie 이벤트 정의

**파일**: `apps/api/src/event/newbie/newbie-events.ts`

voice-events.ts, auto-channel-events.ts와 동일한 패턴으로 Newbie 전용 이벤트를 정의한다. 이 파일의 상수와 이벤트 클래스를 기준으로 모든 단위(B~E)가 구현된다.

```typescript
export const NEWBIE_EVENTS = {
  /** voiceStateUpdate 발생 시 MocoService 처리용 — Dispatcher에서 추가 발행 */
  VOICE_STATE_CHANGED: 'newbie.voice-state-changed',
} as const;

export class NewbieVoiceStateChangedEvent {
  constructor(
    public readonly guildId: string,
    public readonly channelId: string | null,
    /** voiceStateUpdate 이전 채널 ID (퇴장/이동 시 사용) */
    public readonly oldChannelId: string | null,
    /** 현재 채널의 모든 멤버 ID 목록 */
    public readonly channelMemberIds: string[],
  ) {}
}
```

### 2-5. Newbie Gateway (guildMemberAdd 이벤트 핸들러)

**파일**: `apps/api/src/newbie/newbie.gateway.ts`

Discord.js `guildMemberAdd` 이벤트 리스너. `@On('guildMemberAdd')`로 수신한다.
신규 멤버 가입 시 `WelcomeService`, `MissionService`, `NewbieRoleService`를 순서대로 호출한다.

```typescript
@On('guildMemberAdd')
async handleMemberJoin(member: GuildMember): Promise<void>
```

처리 순서:
1. `NewbieConfigRepository.findByGuildId(guildId)` — Redis 캐시 우선 조회
2. 설정 없으면 처리 중단
3. `welcomeEnabled = true` 이면 `WelcomeService.sendWelcomeMessage(member, config)` 호출
4. `missionEnabled = true` 이면 `MissionService.createMission(member, config)` 호출
5. `roleEnabled = true` 이면 `NewbieRoleService.assignRole(member, config)` 호출

오류 격리: 각 서비스 호출을 개별 try-catch로 감싸 하나 실패 시 나머지가 계속 실행되도록 한다.

### 2-6. Newbie 설정 컨트롤러 (웹 API)

**파일**: `apps/api/src/newbie/newbie.controller.ts`

경로: `GET/POST /api/guilds/:guildId/newbie/config`, `GET /api/guilds/:guildId/newbie/missions`, `GET /api/guilds/:guildId/newbie/moco`

`JwtAuthGuard`로 인증을 보호한다.

엔드포인트 목록:

| 메서드 | 경로 | 설명 |
|--------|------|------|
| `GET` | `/api/guilds/:guildId/newbie/config` | 설정 조회 |
| `POST` | `/api/guilds/:guildId/newbie/config` | 설정 저장 및 Redis 캐시 갱신 |
| `GET` | `/api/guilds/:guildId/newbie/missions` | 미션 현황 조회 (IN_PROGRESS 미션 목록 + 각 미션의 현재 플레이타임) |
| `GET` | `/api/guilds/:guildId/newbie/moco` | 모코코 사냥 순위 조회 (페이지 파라미터 포함) |

### 2-7. Newbie 설정 DTO

**파일**: `apps/api/src/newbie/dto/newbie-config-save.dto.ts`

웹 API 요청 바디 DTO. 하나의 DTO로 4개 탭 설정을 모두 수신한다 (POST 시 전체 설정을 일괄 전송).

```typescript
export class NewbieConfigSaveDto {
  // 환영인사
  welcomeEnabled: boolean;
  welcomeChannelId?: string | null;
  welcomeEmbedTitle?: string | null;
  welcomeEmbedDescription?: string | null;
  welcomeEmbedColor?: string | null;
  welcomeEmbedThumbnailUrl?: string | null;

  // 미션
  missionEnabled: boolean;
  missionDurationDays?: number | null;
  missionTargetPlaytimeHours?: number | null;
  missionNotifyChannelId?: string | null;

  // 모코코 사냥
  mocoEnabled: boolean;
  mocoRankChannelId?: string | null;
  mocoAutoRefreshMinutes?: number | null;

  // 신입기간 역할
  roleEnabled: boolean;
  roleDurationDays?: number | null;
  newbieRoleId?: string | null;
}
```

### 2-8. Newbie 메인 NestJS 모듈

**파일**: `apps/api/src/newbie/newbie.module.ts`

Newbie 도메인 관련 모든 provider를 등록하고, 의존 모듈을 import한다.

- TypeOrmModule에 `NewbieConfig`, `NewbieMission`, `NewbiePeriod`, `VoiceDailyEntity`, `VoiceChannelHistory` 엔티티 등록
- `VoiceChannelModule`, `RedisModule`, `DiscordModule.forFeature()`, `AuthModule` import
- exports: `NewbieConfigRepository`, `NewbieRedisRepository`, `NewbieMissionRepository`, `NewbiePeriodRepository`

등록할 providers:
- `NewbieConfigRepository`
- `NewbieMissionRepository`
- `NewbiePeriodRepository`
- `NewbieRedisRepository`
- `NewbieGateway`
- `NewbieController`
- Unit B: `WelcomeService`
- Unit C: `MissionService`, `MissionScheduler`
- Unit D: `MocoService`, `NewbieVoiceStateChangedHandler`
- Unit E: `NewbieRoleService`, `NewbieRoleScheduler`

### 2-9. Newbie voiceStateUpdate 이벤트 핸들러 (모코코용)

**파일**: `apps/api/src/event/newbie/newbie-voice-state-changed.handler.ts`

`NEWBIE_EVENTS.VOICE_STATE_CHANGED` 이벤트를 수신하여 `MocoService.handleVoiceStateChanged`를 호출한다.

```typescript
@OnEvent(NEWBIE_EVENTS.VOICE_STATE_CHANGED)
async handle(event: NewbieVoiceStateChangedEvent): Promise<void>
```

---

## 3. 수정이 필요한 기존 파일 목록 및 수정 내용

### 3-1. `VoiceStateDispatcher` 수정

**파일**: `apps/api/src/event/voice/voice-state.dispatcher.ts`

`isJoin`, `isLeave`, `isMove` 세 분기 모두에서 기존 voice 이벤트 발행 이후에 `NEWBIE_EVENTS.VOICE_STATE_CHANGED`를 추가로 발행한다.

- 기존 voice 이벤트 처리 로직은 변경 없음 (append-only 수정)
- 모코코 사냥은 음성 상태가 변할 때마다 채널 내 동시 접속자 목록을 `NewbieVoiceStateChangedEvent`에 담아 발행
- 트리거 채널 입장(`TRIGGER_JOIN`) 분기에서는 `NEWBIE_EVENTS.VOICE_STATE_CHANGED`를 발행하지 않음 (대기방은 모코코 사냥 대상 외)

추가되는 의존성: `NewbieRedisRepository` (또는 이벤트 방식으로 분리하여 의존성 없이 처리 가능 — 이벤트 방식 권장)

수정 예시 (`isJoin` 분기 내):
```typescript
// 기존 일반 입장 처리 이후 추가
const dto = VoiceStateDto.fromVoiceState(newState);
await this.eventEmitter.emitAsync(VOICE_EVENTS.JOIN, new VoiceJoinEvent(dto));
this.emitAloneChanged(newState);

// 모코코 사냥 처리용 이벤트 (fire-and-forget)
if (newState.channelId && newState.channel) {
  const memberIds = [...newState.channel.members.keys()];
  this.eventEmitter.emit(
    NEWBIE_EVENTS.VOICE_STATE_CHANGED,
    new NewbieVoiceStateChangedEvent(
      newState.guild.id,
      newState.channelId,
      null,
      memberIds,
    ),
  );
}
```

### 3-2. `DiscordEventsModule` 수정

**파일**: `apps/api/src/event/discord-events.module.ts`

`NewbieModule` import 추가. `NewbieVoiceStateChangedHandler`를 providers에 추가.

### 3-3. `AppModule` 수정

**파일**: `apps/api/src/app.module.ts`

`NewbieModule`을 imports 목록에 추가한다.

---

## 4. 구현 단위(Unit) 분류

이후 병렬 개발을 위해 다음 6개의 단위로 분리한다. 각 단위는 이 문서에서 정의된 공통 모듈 완성 후 병렬 진행 가능하다.

| 단위 | 기능 | 포함 서비스/파일 |
|------|------|-----------------|
| A | 백엔드 코어 모듈 | `newbie.module.ts`, 엔티티 3종, 저장소 4종(config/mission/period/redis), `newbie-cache.keys.ts`, `newbie-config-save.dto.ts`, `newbie.controller.ts`, `newbie.gateway.ts` |
| B | 환영인사 (F-NEWBIE-001) | `welcome/welcome.service.ts` |
| C | 미션 추적 (F-NEWBIE-002) | `mission/mission.service.ts`, `mission/mission.scheduler.ts` |
| D | 모코코 사냥 (F-NEWBIE-003) | `moco/moco.service.ts`, `newbie-voice-state-changed.handler.ts` |
| E | 신입기간 역할 (F-NEWBIE-004) | `role/newbie-role.service.ts`, `role/newbie-role.scheduler.ts` |
| F | 웹 대시보드 (F-WEB-NEWBIE-001) | `apps/web/app/settings/newbie/` 페이지 파일들 |

---

## 5. 파일 경로 전체 목록 (충돌 방지용 사전 확정)

공통 모듈 단계에서 생성/수정할 파일:

### 신규 생성

```
apps/api/src/newbie/
  newbie.module.ts                                              (2-8)
  newbie.controller.ts                                          (2-6)
  newbie.gateway.ts                                             (2-5)
  dto/
    newbie-config-save.dto.ts                                   (2-7)
  infrastructure/
    newbie-cache.keys.ts                                        (2-1)
    newbie-redis.repository.ts                                  (2-2)
    newbie-config.repository.ts                                 (2-3)
    newbie-mission.repository.ts                                (2-3)
    newbie-period.repository.ts                                 (2-3)
  welcome/
    welcome.service.ts                                          (Unit B)
  mission/
    mission.service.ts                                          (Unit C)
    mission.scheduler.ts                                        (Unit C)
  moco/
    moco.service.ts                                             (Unit D)
  role/
    newbie-role.service.ts                                      (Unit E)
    newbie-role.scheduler.ts                                    (Unit E)

apps/api/src/event/newbie/
  newbie-events.ts                                              (2-4)
  newbie-voice-state-changed.handler.ts                         (2-9)

apps/web/app/settings/newbie/
  page.tsx                                                      (Unit F — 탭 구조 진입점)
```

### 기존 수정

```
apps/api/src/event/voice/voice-state.dispatcher.ts             (3-1)
apps/api/src/event/discord-events.module.ts                    (3-2)
apps/api/src/app.module.ts                                     (3-3)
```

### 이미 존재하는 파일 (수정 없음, 공통 모듈 단계에서 확인만)

```
apps/api/src/newbie/domain/newbie-config.entity.ts             (이미 생성됨)
apps/api/src/newbie/domain/newbie-mission.entity.ts            (이미 생성됨)
apps/api/src/newbie/domain/newbie-period.entity.ts             (이미 생성됨)
```

---

## 6. Newbie 이벤트 상수 네이밍 규칙

Discord 버튼 `customId`는 다음 패턴으로 통일한다. 이를 통해 Newbie 인터랙션 핸들러가 다른 버튼과 구분할 수 있다.

| 버튼 종류 | customId 패턴 | 예시 |
|-----------|---------------|------|
| 미션 현황 갱신 버튼 | `newbie_mission:refresh:{guildId}` | `newbie_mission:refresh:1234567890` |
| 모코코 순위 이전 페이지 버튼 | `newbie_moco:prev:{guildId}:{page}` | `newbie_moco:prev:1234567890:2` |
| 모코코 순위 다음 페이지 버튼 | `newbie_moco:next:{guildId}:{page}` | `newbie_moco:next:1234567890:2` |
| 모코코 순위 갱신 버튼 | `newbie_moco:refresh:{guildId}` | `newbie_moco:refresh:1234567890` |

`interaction.customId.startsWith('newbie_mission:')` 또는 `'newbie_moco:'`로 필터링한다.

이 인터랙션 핸들러는 Newbie 도메인 고유이므로 별도 파일로 분리한다.

**파일**: `apps/api/src/event/newbie/newbie-interaction.handler.ts`

```
apps/api/src/event/newbie/newbie-interaction.handler.ts        (Unit C, D 에서 사용)
```

---

## 7. 미션 Embed / 모코코 Embed 공통 포맷

### 미션 현황 Embed

Unit C (`MissionService`)에서 생성하며, PRD F-NEWBIE-002에 정의된 형식을 따른다.

```
제목: 🧑‍🌾 신입 미션 체크
설명:
🧑‍🌾 뉴비 멤버 (총 인원: N명)

@{username} 🌱
{startDate} ~ {endDate}
{statusEmoji} {statusText} | 플레이타임: {H}시간 {M}분 {S}초 | 플레이횟수: {N}회
```

상태 이모지 상수 (Unit A 공통 파일에 정의):

```typescript
// apps/api/src/newbie/infrastructure/newbie-mission.constants.ts
export const MISSION_STATUS_EMOJI = {
  IN_PROGRESS: '🟡',
  COMPLETED: '✅',
  FAILED: '❌',
} as const;
```

**파일**: `apps/api/src/newbie/infrastructure/newbie-mission.constants.ts` (Unit A에서 생성)

### 모코코 사냥 순위 Embed

Unit D (`MocoService`)에서 생성하며, PRD F-NEWBIE-003에 정의된 형식을 따른다.

```
제목: 모코코 사냥 TOP {rank} — {memberName} 🌱
설명:
총 모코코 사냥 시간: {totalMinutes}분

도움을 받은 모코코들:
– {newbieName} 🌱: {minutes}분
...

페이지 {currentPage}/{totalPages} | 자동 갱신 {interval}분
```

---

## 검증 체크리스트

이 문서가 "페이지 단위 병렬 개발 시 코드 conflict가 생길 공통 모듈을 모두 포함하는가"를 3회 확인한다.

### 1차 확인

- [x] **Redis 키 네이밍**: `NewbieKeys` (2-1)에서 중앙화 — 단위 B~E 모두 동일 키 패턴 참조
- [x] **Redis 저장소 인터페이스**: `NewbieRedisRepository` (2-2)에서 메서드 시그니처 사전 확정 — 단위 C(미션 캐시), D(모코코 Hash/Sorted Set), E(신입기간 Set) 각각 독립 메서드 사용
- [x] **DB 저장소**: `NewbieConfigRepository`, `NewbieMissionRepository`, `NewbiePeriodRepository` (2-3)에서 메서드 사전 확정 — 단위 B~E가 의존하는 메서드 모두 명세됨
- [x] **이벤트 상수**: `NEWBIE_EVENTS.VOICE_STATE_CHANGED` (2-4)에서 중앙화 — Dispatcher(3-1)와 Handler(2-9)가 동일 상수 참조
- [x] **customId 패턴**: 6절에서 사전 확정 — 단위 C(미션 갱신), D(모코코 페이지네이션/갱신) 각각 충돌 없는 접두사 사용
- [x] **DTO 구조**: `NewbieConfigSaveDto` (2-7)에서 사전 확정 — 웹 API 요청 구조 단일화
- [x] **모듈 등록**: `NewbieModule` (2-8)에서 providers 목록 사전 확정 — 단위 B~F가 개별 파일만 구현하고 모듈 등록은 이 문서 기준
- [x] **`VoiceStateDispatcher` 수정**: 3-1에서 수정 범위 확정 — 단위 D가 의존하는 이벤트 발행 분기 사전 완료
- [x] **`DiscordEventsModule` 수정**: 3-2에서 수정 내용 확정
- [x] **`AppModule` 수정**: 3-3에서 수정 내용 확정
- [x] **파일 경로 전체 목록**: 5절에서 사전 확정 — 단위 간 동일 파일 동시 생성 충돌 없음
- [x] **Embed 상태 상수**: `newbie-mission.constants.ts` (7절)에서 사전 확정 — 단위 C, D가 독립적으로 사용
- [x] **인터랙션 핸들러 파일**: `newbie-interaction.handler.ts` (6절)에서 경로 사전 확정 — 단위 C, D가 customId 패턴 공유

### 2차 확인

- [x] **단위 A (백엔드 코어)** 가 생성하는 파일 목록: `newbie.module.ts`, `newbie.controller.ts`, `newbie.gateway.ts`, `newbie-config-save.dto.ts`, `newbie-cache.keys.ts`, `newbie-redis.repository.ts`, `newbie-config.repository.ts`, `newbie-mission.repository.ts`, `newbie-period.repository.ts`, `newbie-mission.constants.ts`, `newbie-events.ts`, `newbie-voice-state-changed.handler.ts` — 이 모두 단위 B~F 착수 전에 완성되어야 함
- [x] **단위 B (환영인사)** 가 의존하는 공통 모듈: `NewbieKeys.config` (2-1), `NewbieRedisRepository.getConfig/setConfig` (2-2), `NewbieConfigRepository.findByGuildId` (2-3), `NewbieGateway` 콜백 (2-5), `NewbieModule` (2-8) — 모두 단위 A에서 생성, 이 문서에 포함됨
- [x] **단위 C (미션 추적)** 가 의존하는 공통 모듈: `NewbieKeys.missionActive` (2-1), `NewbieRedisRepository.getMissionActive/setMissionActive/deleteMissionActive` (2-2), `NewbieMissionRepository` 전체 (2-3), `VoiceDailyEntity` (재사용), `VoiceChannelHistory` (재사용), `MISSION_STATUS_EMOJI` (7절), `customId: newbie_mission:*` (6절), `newbie-interaction.handler.ts` (6절) — 모두 이 문서에 포함됨
- [x] **단위 D (모코코 사냥)** 가 의존하는 공통 모듈: `NewbieKeys.mocoTotal/mocoRank/periodActive` (2-1), `NewbieRedisRepository.incrMocoMinutes/incrMocoRank/getMocoRankPage/getMocoHunterDetail/getPeriodActiveMembers/initPeriodActiveMembers` (2-2), `NewbieMissionRepository.findActiveByMember` (2-3), `NewbiePeriodRepository.findActiveByGuild` (2-3), `NEWBIE_EVENTS.VOICE_STATE_CHANGED` (2-4), `NewbieVoiceStateChangedHandler` (2-9), `customId: newbie_moco:*` (6절), 수정된 `VoiceStateDispatcher` (3-1) — 모두 이 문서에 포함됨
- [x] **단위 E (신입기간 역할)** 가 의존하는 공통 모듈: `NewbieKeys.periodActive` (2-1), `NewbieRedisRepository.addPeriodActiveMember/deletePeriodActive` (2-2), `NewbiePeriodRepository` 전체 (2-3), `NewbieGateway` 콜백 (2-5) — 모두 이 문서에 포함됨
- [x] **단위 F (웹 대시보드)** 가 의존하는 공통 모듈: `NewbieConfigSaveDto` (2-7), `NewbieController`의 API 엔드포인트 명세 (2-6), `JwtAuthGuard` (재사용) — 모두 이 문서에 포함됨

### 3차 확인

- [x] **단위 A~F 간에 동일 파일을 동시에 신규 생성하는 경우가 없는가**: 5절 파일 경로 목록 기준으로 각 파일은 단 하나의 단위에만 귀속됨. 저장소/키/이벤트 파일은 단위 A에서 먼저 생성되므로 충돌 없음. `newbie-interaction.handler.ts`는 단위 C, D 모두가 사용하지만 파일 자체는 단위 A 또는 단위 C에서 먼저 생성하여 공유.
- [x] **단위 B~F가 수정하는 기존 파일에 중복이 없는가**: 3절에서 수정 대상 파일(`VoiceStateDispatcher`, `DiscordEventsModule`, `AppModule`) 3개 모두 공통 모듈 단계(단위 A)에서 수정 완료되므로, 이후 단위 작업에서 이 파일들에 추가 수정이 불필요함.
- [x] **엔티티 파일이 이미 존재하는 경우 중복 생성하지 않는가**: `newbie-config.entity.ts`, `newbie-mission.entity.ts`, `newbie-period.entity.ts` 3개 파일은 이미 `apps/api/src/newbie/domain/`에 존재한다. 공통 모듈 단계에서 내용을 확인하고 TypeORM 설정이 올바른지 검증만 수행하며 재생성하지 않음.
- [x] **VoiceChannelModule exports가 Newbie에서 필요한 서비스를 모두 포함하는가**: `VoiceDailyEntity`, `VoiceChannelHistory` 엔티티를 Newbie 모듈에서 직접 `TypeOrmModule.forFeature()`로 등록하므로 voice 모듈 의존 없이 DB 조회 가능. `VoiceChannelModule` import는 필요 없으며 TypeOrm 엔티티 직접 등록 방식을 사용함.

---

# Status Prefix 도메인 — 공통 모듈 판단 문서

## 목적

Status Prefix 도메인 구현에 필요한 공통 모듈을 식별하고 설계 방향을 확정한다.
이 문서에 정의된 모듈은 모든 개발 단위 작업보다 선행하여 완성되어야 하며, 이후 단위 작업들이 conflict 없이 병렬로 진행될 수 있도록 공통 인터페이스와 파일 경로를 명시한다.

---

## 1. 기존 모듈 중 Status Prefix 도메인에서 재사용 가능한 것

### 1-1. 재사용 (수정 없음)

| 모듈 | 파일 | 재사용 이유 |
|------|------|-------------|
| `RedisService` | `apps/api/src/redis/redis.service.ts` | `get`, `set`, `del`, `exists`, `pipeline` 등 status-prefix Redis 키 패턴에 필요한 기능이 구현되어 있음. `SET NX` 패턴(`status_prefix:original` 최초 저장 시 덮어쓰기 방지)은 `pipeline` 콜백 내에서 `pipe.set(key, value, 'NX')`로 직접 처리 가능 |
| `RedisModule` | `apps/api/src/redis/redis.module.ts` | `@Global()` 모듈이므로 `StatusPrefixModule`에서 별도 import 없이 `RedisService` 주입 가능 |
| `JwtAuthGuard` | `apps/api/src/auth/jwt-auth.guard.ts` | 웹 대시보드 설정 API 엔드포인트(`GET/POST /api/guilds/:guildId/status-prefix/config`) 보호 |
| `StatusPrefixConfig` entity | `apps/api/src/status-prefix/domain/status-prefix-config.entity.ts` | 이미 생성 완료. TypeORM 엔티티 정의 및 마이그레이션 완비 |
| `StatusPrefixButton` entity | `apps/api/src/status-prefix/domain/status-prefix-button.entity.ts` | 이미 생성 완료. `StatusPrefixButtonType` enum 포함 |
| Migration | `apps/api/src/migrations/1773200000000-AddStatusPrefix.ts` | 이미 생성 완료. DB 스키마 적용 준비됨 |
| `SettingsSidebar` | `apps/web/app/components/SettingsSidebar.tsx` | 사이드바 메뉴 항목에 Status Prefix 항목 추가가 필요함 (수정 대상, 1-2 참조) |
| `useSettings` hook | `apps/web/app/settings/SettingsContext.tsx` | `selectedGuildId` 조회에 사용. 수정 불필요 |
| `fetchGuildTextChannels` | `apps/web/app/lib/discord-api.ts` | 안내 채널 선택 드롭다운에 텍스트 채널 목록 제공. 수정 불필요 |

### 1-2. 재사용하되 수정이 필요한 것

| 모듈 | 파일 | 필요한 수정 내용 |
|------|------|-----------------|
| `VoiceLeaveHandler` | `apps/api/src/event/voice/voice-leave.handler.ts` | `VOICE_EVENTS.LEAVE` 이벤트 처리 완료 후 `StatusPrefixResetService.restoreOnLeave(guildId, memberId)`를 호출해야 함 (F-STATUS-PREFIX-005). 기존 voice 로직(`voiceChannelService.onUserLeave`) 이후에 추가(append) 방식으로 처리. 단, `StatusPrefixModule`을 `DiscordEventsModule`에 import하면 순환 의존 없이 주입 가능 |
| `DiscordEventsModule` | `apps/api/src/event/discord-events.module.ts` | `StatusPrefixModule` import 추가. `StatusPrefixInteractionHandler`를 providers에 추가 |
| `AppModule` | `apps/api/src/app.module.ts` | `StatusPrefixModule`을 imports 목록에 추가 |
| `SettingsSidebar` | `apps/web/app/components/SettingsSidebar.tsx` | `menuItems` 배열에 `{ href: '/settings/status-prefix', label: '게임방 상태 설정', icon: GamepadIcon }` 항목 추가 |

---

## 2. 새로 만들어야 할 모듈/서비스/핸들러 목록

### 2-1. Status Prefix Redis 키 정의

**파일**: `apps/api/src/status-prefix/infrastructure/status-prefix-cache.keys.ts`

PRD에 정의된 Redis 키 패턴을 중앙화한다. 모든 단위가 이 파일의 키 생성 함수를 참조한다.

```typescript
export const StatusPrefixKeys = {
  /** 원래 닉네임 저장: status_prefix:original:{guildId}:{memberId} — TTL 없음 (퇴장 시 명시적 삭제) */
  originalNickname: (guildId: string, memberId: string) =>
    `status_prefix:original:${guildId}:${memberId}`,

  /** 설정 캐시: status_prefix:config:{guildId} — TTL 1시간 */
  config: (guildId: string) => `status_prefix:config:${guildId}`,
} as const;
```

### 2-2. Status Prefix Redis 저장소

**파일**: `apps/api/src/status-prefix/infrastructure/status-prefix-redis.repository.ts`

Status Prefix 도메인 관련 Redis CRUD를 한 곳에서 관리한다. `AutoChannelRedisRepository`와 동일한 패턴으로 설계한다.

TTL 상수:
- `CONFIG`: 3,600초 (1시간)

메서드 목록:

| 메서드 | 설명 | Redis 명령 |
|--------|------|-----------|
| `getOriginalNickname(guildId, memberId)` | 원래 닉네임 조회 | `GET` |
| `setOriginalNicknameNx(guildId, memberId, nickname)` | 원래 닉네임 저장 (이미 존재하면 무시) | `SET NX` — pipeline 내 `pipe.set(key, value, 'NX')` |
| `deleteOriginalNickname(guildId, memberId)` | 원래 닉네임 삭제 (RESET 또는 퇴장 시) | `DEL` |
| `getConfig(guildId)` | 설정 캐시 조회 | `GET` |
| `setConfig(guildId, config)` | 설정 캐시 저장 (TTL 1시간) | `SET EX 3600` |
| `deleteConfig(guildId)` | 설정 캐시 무효화 (설정 저장 시 갱신 전) | `DEL` |

`setOriginalNicknameNx` 구현 참고:
```typescript
// RedisService.pipeline()을 통해 직접 ioredis NX 플래그 사용
async setOriginalNicknameNx(guildId: string, memberId: string, nickname: string): Promise<boolean> {
  const key = StatusPrefixKeys.originalNickname(guildId, memberId);
  // ioredis set NX: null 반환 시 이미 존재, 'OK' 반환 시 저장 성공
  const result = await this.redis['client'].set(key, JSON.stringify(nickname), 'NX');
  return result === 'OK';
}
```

단, `RedisService`에 `setNx` 전용 메서드가 없으므로 `StatusPrefixRedisRepository` 내부에서 `@Inject(REDIS_CLIENT) private readonly client: Redis`를 직접 주입하거나, `pipeline` 콜백 안에서 `pipe.set(key, value, 'NX')`를 사용한다. 더 단순한 방법은 `REDIS_CLIENT`를 직접 주입받아 사용하는 것이다.

### 2-3. Status Prefix DB 저장소

**파일**: `apps/api/src/status-prefix/infrastructure/status-prefix-config.repository.ts`

TypeORM Repository 래퍼. `StatusPrefixConfig`와 `StatusPrefixButton` 엔티티에 대한 DB CRUD를 캡슐화한다.

메서드 목록:

| 메서드 | 설명 |
|--------|------|
| `findByGuildId(guildId)` | guildId로 설정 단건 조회 (buttons 관계 포함) |
| `upsert(guildId, dto)` | 설정 생성 또는 갱신 (guildId 기준). 트랜잭션 내에서 버튼 전체 삭제 후 재삽입. `AutoChannelConfigRepository.upsert`와 동일한 패턴 |
| `updateMessageId(guildId, messageId)` | Discord Embed 메시지 ID 갱신 (메시지 전송 후 호출) |
| `findButtonById(buttonId)` | 버튼 ID로 단건 조회 (prefix, type 확인용) |

### 2-4. Status Prefix 설정 서비스 (Config)

**파일**: `apps/api/src/status-prefix/config/status-prefix-config.service.ts`

설정 조회 및 저장, Discord Embed 메시지 전송/갱신 로직을 담당한다.

메서드 목록:

| 메서드 | 설명 |
|--------|------|
| `getConfig(guildId)` | Redis 캐시 우선 조회, 미스 시 DB 조회 후 캐시 저장 |
| `saveConfig(guildId, dto)` | DB upsert → Redis 캐시 갱신 → enabled 시 Discord 메시지 전송/갱신 |
| `buildAndSendMessage(guildId, config)` | channelId 채널에 Embed + 버튼 ActionRow 메시지 전송 또는 수정 |

### 2-5. Status Prefix 접두사 적용 서비스

**파일**: `apps/api/src/status-prefix/interaction/status-prefix-apply.service.ts`

버튼 클릭(type = PREFIX) 시 닉네임에 접두사를 적용한다.

메서드 목록:

| 메서드 | 설명 |
|--------|------|
| `apply(guildId, memberId, buttonId, interaction)` | 버튼 조회 → 원래 닉네임 Redis 저장(NX) → 템플릿 적용 → Discord API 닉네임 변경 → Ephemeral 응답 |

### 2-6. Status Prefix 닉네임 복원 서비스

**파일**: `apps/api/src/status-prefix/interaction/status-prefix-reset.service.ts`

버튼 클릭(type = RESET) 및 음성 채널 퇴장 시 원래 닉네임을 복원한다.

메서드 목록:

| 메서드 | 설명 |
|--------|------|
| `reset(guildId, memberId, interaction)` | Redis 조회 → 없으면 Ephemeral 안내 → 있으면 닉네임 복원 + Redis 삭제 + Ephemeral 응답 |
| `restoreOnLeave(guildId, memberId)` | (음성 퇴장 연계) 설정 enabled 확인 → Redis 조회 → 있으면 닉네임 복원 + Redis 삭제. 오류 시 조용히 실패 |

### 2-7. Status Prefix 인터랙션 핸들러

**파일**: `apps/api/src/status-prefix/interaction/status-prefix-interaction.handler.ts`

Discord `interactionCreate` 이벤트에서 `status_prefix:` 및 `status_reset:` 접두사를 가진 버튼만 처리한다.
`AutoChannelInteractionHandler`, `NewbieInteractionHandler`와 동일한 패턴으로 설계한다.

```typescript
/** 버튼 customId 접두사 */
const CUSTOM_ID_PREFIX = {
  APPLY: 'status_prefix:',   // F-STATUS-PREFIX-003
  RESET: 'status_reset:',    // F-STATUS-PREFIX-004
} as const;

@On('interactionCreate')
async handle(interaction: Interaction): Promise<void>
```

처리 흐름:
1. `interaction.isButton()` 확인
2. `customId.startsWith('status_prefix:')` → `buttonId` 파싱 → `StatusPrefixApplyService.apply()` 호출
3. `customId.startsWith('status_reset:')` → `buttonId` 파싱 → `StatusPrefixResetService.reset()` 호출
4. 그 외 → 즉시 반환 (타 도메인 인터랙션과 충돌 없음)

### 2-8. Status Prefix 설정 컨트롤러 (웹 API)

**파일**: `apps/api/src/status-prefix/config/status-prefix.controller.ts`

경로: `GET/POST /api/guilds/:guildId/status-prefix/config`

`JwtAuthGuard`로 인증을 보호한다.

엔드포인트 목록:

| 메서드 | 경로 | 설명 |
|--------|------|------|
| `GET` | `/api/guilds/:guildId/status-prefix/config` | 설정 조회 (F-STATUS-PREFIX-001) |
| `POST` | `/api/guilds/:guildId/status-prefix/config` | 설정 저장 및 Discord 메시지 전송/갱신 (F-STATUS-PREFIX-002) |

### 2-9. Status Prefix 설정 DTO

**파일**: `apps/api/src/status-prefix/dto/status-prefix-config-save.dto.ts`

웹 API 요청 바디 DTO. POST 시 설정 전체를 일괄 전송한다.

```typescript
export class StatusPrefixConfigSaveDto {
  enabled: boolean;
  channelId?: string | null;
  embedTitle?: string | null;
  embedDescription?: string | null;
  embedColor?: string | null;
  prefixTemplate: string;  // 기본값: '[{prefix}] {nickname}'
  buttons: StatusPrefixButtonDto[];
}

export class StatusPrefixButtonDto {
  label: string;
  emoji?: string | null;
  prefix?: string | null;  // type = PREFIX 시 필수
  type: 'PREFIX' | 'RESET';
  sortOrder: number;
}
```

### 2-10. Status Prefix 메인 NestJS 모듈

**파일**: `apps/api/src/status-prefix/status-prefix.module.ts`

Status Prefix 도메인 관련 모든 provider를 등록하고, 의존 모듈을 import한다.

```typescript
@Module({
  imports: [
    DiscordModule.forFeature(),
    TypeOrmModule.forFeature([StatusPrefixConfig, StatusPrefixButton]),
    AuthModule,
  ],
  controllers: [StatusPrefixController],
  providers: [
    StatusPrefixConfigRepository,
    StatusPrefixRedisRepository,
    StatusPrefixConfigService,
    StatusPrefixApplyService,
    StatusPrefixResetService,
    StatusPrefixInteractionHandler,
  ],
  exports: [
    StatusPrefixResetService,  // VoiceLeaveHandler에서 주입받기 위해 export
  ],
})
export class StatusPrefixModule {}
```

`RedisModule`은 `@Global()` 모듈이므로 import 불필요.

### 2-11. 웹 API 클라이언트 함수

**파일**: `apps/web/app/lib/status-prefix-api.ts`

`newbie-api.ts`와 동일한 패턴으로 설계한다.

```typescript
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

export interface StatusPrefixButtonConfig {
  id?: number;
  label: string;
  emoji: string | null;
  prefix: string | null;
  type: 'PREFIX' | 'RESET';
  sortOrder: number;
}

export interface StatusPrefixConfig {
  enabled: boolean;
  channelId: string | null;
  embedTitle: string | null;
  embedDescription: string | null;
  embedColor: string | null;
  prefixTemplate: string;
  messageId: string | null;
  buttons: StatusPrefixButtonConfig[];
}

export async function fetchStatusPrefixConfig(guildId: string): Promise<StatusPrefixConfig | null>
export async function saveStatusPrefixConfig(guildId: string, config: Omit<StatusPrefixConfig, 'messageId'>): Promise<void>
```

---

## 3. 수정이 필요한 기존 파일 목록 및 수정 내용

### 3-1. `VoiceLeaveHandler` 수정

**파일**: `apps/api/src/event/voice/voice-leave.handler.ts`

`VOICE_EVENTS.LEAVE` 처리 완료 후 `StatusPrefixResetService.restoreOnLeave()`를 호출한다.
기존 voice 로직과 충돌 없이 추가(append) 방식으로 처리한다. 오류 시 로그 기록 후 조용히 실패한다.

수정 예시:
```typescript
@OnEvent(VOICE_EVENTS.LEAVE)
async handle(event: VoiceLeaveEvent) {
  await this.voiceChannelService.onUserLeave(event.state);

  // Status Prefix 닉네임 자동 복원 (F-STATUS-PREFIX-005, fire-and-forget)
  this.statusPrefixResetService
    .restoreOnLeave(event.state.guildId, event.state.userId)
    .catch((err) => this.logger.error('[STATUS_PREFIX] restoreOnLeave failed', err.stack));
}
```

추가되는 의존성: `StatusPrefixResetService` (생성자 주입). `StatusPrefixModule`에서 `StatusPrefixResetService`를 export하고, `DiscordEventsModule`이 `StatusPrefixModule`을 import하면 주입 가능.

### 3-2. `DiscordEventsModule` 수정

**파일**: `apps/api/src/event/discord-events.module.ts`

`StatusPrefixModule` import 추가. `StatusPrefixInteractionHandler`를 providers에 추가.

```typescript
// imports에 추가
StatusPrefixModule,

// providers에 추가
StatusPrefixInteractionHandler,
```

단, `StatusPrefixInteractionHandler`는 `StatusPrefixModule` 내부 provider이므로, `DiscordEventsModule`의 providers 목록에 직접 추가하지 않고 `StatusPrefixModule`에서 내부적으로 등록하는 방식을 사용한다. `DiscordEventsModule`은 `StatusPrefixModule`을 import만 하면 된다.

### 3-3. `AppModule` 수정

**파일**: `apps/api/src/app.module.ts`

`StatusPrefixModule`을 imports 목록에 추가한다.

### 3-4. `SettingsSidebar` 수정

**파일**: `apps/web/app/components/SettingsSidebar.tsx`

`menuItems` 배열에 Status Prefix 설정 메뉴 항목을 추가한다.

```typescript
// 기존 menuItems에 추가
{ href: '/settings/status-prefix', label: '게임방 상태 설정', icon: GamepadIcon }
```

---

## 4. 구현 단위(Unit) 분류

이후 병렬 개발을 위해 다음 3개의 단위로 분리한다. 각 단위는 이 문서에서 정의된 공통 모듈 완성 후 병렬 진행 가능하다.

| 단위 | 기능 | 포함 서비스/파일 |
|------|------|-----------------|
| A | 백엔드 코어 모듈 | `status-prefix.module.ts`, 엔티티 2종(이미 존재), 저장소 2종(config/redis), `status-prefix-cache.keys.ts`, `status-prefix-config-save.dto.ts`, `status-prefix.controller.ts`, `status-prefix-config.service.ts`, `status-prefix-apply.service.ts`, `status-prefix-reset.service.ts`, `status-prefix-interaction.handler.ts` |
| B | Discord 인터랙션 처리 (F-STATUS-PREFIX-003, 004) | `status-prefix-apply.service.ts`, `status-prefix-reset.service.ts` 내부 로직 구현 (파일은 단위 A에서 생성) |
| C | 웹 대시보드 (F-WEB-STATUS-PREFIX-001) | `apps/web/app/settings/status-prefix/page.tsx`, `apps/web/app/lib/status-prefix-api.ts` |

단위 A에서 생성한 파일을 기반으로 단위 B, C가 병렬 진행 가능하다. 단위 B는 서비스 내부 로직을, 단위 C는 웹 페이지를 독립적으로 구현한다.

---

## 5. 파일 경로 전체 목록 (충돌 방지용 사전 확정)

공통 모듈 단계에서 생성/수정할 파일:

### 신규 생성

```
apps/api/src/status-prefix/
  status-prefix.module.ts                                         (2-10, 단위 A)
  config/
    status-prefix.controller.ts                                   (2-8, 단위 A)
    status-prefix-config.service.ts                               (2-4, 단위 A)
  interaction/
    status-prefix-apply.service.ts                                (2-5, 단위 A/B)
    status-prefix-reset.service.ts                                (2-6, 단위 A/B)
    status-prefix-interaction.handler.ts                          (2-7, 단위 A)
  infrastructure/
    status-prefix-cache.keys.ts                                   (2-1, 단위 A)
    status-prefix-redis.repository.ts                             (2-2, 단위 A)
    status-prefix-config.repository.ts                            (2-3, 단위 A)
  dto/
    status-prefix-config-save.dto.ts                              (2-9, 단위 A)

apps/web/app/
  lib/
    status-prefix-api.ts                                          (2-11, 단위 C)
  settings/
    status-prefix/
      page.tsx                                                    (단위 C)
```

### 기존 수정

```
apps/api/src/event/voice/voice-leave.handler.ts                  (3-1, 단위 A)
apps/api/src/event/discord-events.module.ts                      (3-2, 단위 A)
apps/api/src/app.module.ts                                       (3-3, 단위 A)
apps/web/app/components/SettingsSidebar.tsx                      (3-4, 단위 C)
```

### 이미 존재하는 파일 (수정 없음, 공통 모듈 단계에서 확인만)

```
apps/api/src/status-prefix/domain/status-prefix-config.entity.ts   (이미 생성됨)
apps/api/src/status-prefix/domain/status-prefix-button.entity.ts   (이미 생성됨)
apps/api/src/migrations/1773200000000-AddStatusPrefix.ts            (이미 생성됨)
```

---

## 6. Discord customId 네이밍 규칙

Status Prefix 도메인의 Discord 버튼 `customId`는 다음 패턴으로 통일한다. 기존 `auto_btn:`, `auto_sub:`, `newbie_mission:`, `newbie_moco:` 접두사와 충돌하지 않는다.

| 버튼 종류 | customId 패턴 | 예시 |
|-----------|---------------|------|
| 접두사 적용 버튼 (PREFIX) | `status_prefix:{buttonId}` | `status_prefix:3` |
| 원래대로 복원 버튼 (RESET) | `status_reset:{buttonId}` | `status_reset:4` |

`interaction.customId.startsWith('status_prefix:')` 또는 `'status_reset:'`으로 필터링한다.

---

## 7. 검증 체크리스트

이 문서가 "페이지 단위 병렬 개발 시 코드 conflict가 생길 공통 모듈을 모두 포함하는가"를 3회 확인한다.

### 1차 확인

- [x] **Redis 키 네이밍**: `StatusPrefixKeys` (2-1)에서 중앙화 — 단위 A/B/C 모두 동일 키 패턴 참조
- [x] **Redis 저장소 인터페이스**: `StatusPrefixRedisRepository` (2-2)에서 메서드 시그니처 사전 확정 — `getOriginalNickname`, `setOriginalNicknameNx`, `deleteOriginalNickname`, `getConfig`, `setConfig`, `deleteConfig` 모두 명세됨
- [x] **DB 저장소**: `StatusPrefixConfigRepository` (2-3)에서 메서드 사전 확정 — `findByGuildId`, `upsert`, `updateMessageId`, `findButtonById` 모두 명세됨
- [x] **customId 패턴**: 6절에서 사전 확정 — `status_prefix:`, `status_reset:` 접두사로 기존 도메인과 충돌 없음
- [x] **DTO 구조**: `StatusPrefixConfigSaveDto`, `StatusPrefixButtonDto` (2-9)에서 사전 확정 — 웹 API 요청 구조 단일화
- [x] **모듈 등록**: `StatusPrefixModule` (2-10)에서 providers/exports 목록 사전 확정 — `StatusPrefixResetService` export 포함
- [x] **`VoiceLeaveHandler` 수정**: 3-1에서 수정 범위 확정 — 단위 B가 의존하는 퇴장 연계 처리(F-STATUS-PREFIX-005) 사전 완료
- [x] **`DiscordEventsModule` 수정**: 3-2에서 수정 내용 확정 — `StatusPrefixModule` import
- [x] **`AppModule` 수정**: 3-3에서 수정 내용 확정
- [x] **`SettingsSidebar` 수정**: 3-4에서 수정 내용 확정 — 웹 사이드바 메뉴 항목 추가
- [x] **파일 경로 전체 목록**: 5절에서 사전 확정 — 단위 간 동일 파일 동시 생성 충돌 없음
- [x] **웹 API 클라이언트**: `status-prefix-api.ts` (2-11)에서 함수 시그니처 사전 확정 — 웹 페이지(단위 C)가 의존하는 API 함수 정의

### 2차 확인

- [x] **단위 A (백엔드 코어)** 가 생성하는 파일 목록: `status-prefix.module.ts`, `status-prefix.controller.ts`, `status-prefix-config.service.ts`, `status-prefix-apply.service.ts`, `status-prefix-reset.service.ts`, `status-prefix-interaction.handler.ts`, `status-prefix-cache.keys.ts`, `status-prefix-redis.repository.ts`, `status-prefix-config.repository.ts`, `status-prefix-config-save.dto.ts` — 이 모두 단위 B, C 착수 전에 완성되어야 함
- [x] **단위 B (Discord 인터랙션)** 가 의존하는 공통 모듈: `StatusPrefixKeys` (2-1), `StatusPrefixRedisRepository` 전체 (2-2), `StatusPrefixConfigRepository.findButtonById` (2-3), `StatusPrefixConfigService.getConfig` (2-4), `StatusPrefixModule` (2-10), 수정된 `VoiceLeaveHandler` (3-1) — 모두 이 문서에 포함됨
- [x] **단위 C (웹 대시보드)** 가 의존하는 공통 모듈: `StatusPrefixConfigSaveDto` (2-9), `StatusPrefixController` API 엔드포인트 명세 (2-8), `status-prefix-api.ts` (2-11), `fetchGuildTextChannels` (재사용), `useSettings` hook (재사용), 수정된 `SettingsSidebar` (3-4) — 모두 이 문서에 포함됨
- [x] **단위 A가 수정하는 기존 파일**: `VoiceLeaveHandler` (3-1), `DiscordEventsModule` (3-2), `AppModule` (3-3) — 공통 모듈 단계에서 수정 완료 후 이후 단위 작업에서 이 파일들에 추가 수정 불필요
- [x] **단위 C가 수정하는 기존 파일**: `SettingsSidebar` (3-4) 1개뿐 — 단위 A와 수정 파일 중복 없음

### 3차 확인

- [x] **단위 A~C 간에 동일 파일을 동시에 신규 생성하는 경우가 없는가**: 5절 파일 경로 목록 기준으로 각 파일은 단 하나의 단위에만 귀속됨. `status-prefix-apply.service.ts`, `status-prefix-reset.service.ts`는 단위 A에서 파일 골격을 먼저 생성하고, 단위 B에서 내부 로직을 구현. 파일 자체는 단위 A에서 먼저 생성하므로 충돌 없음
- [x] **기존 수정 파일이 단위 B, C와 중복되지 않는가**: `VoiceLeaveHandler`, `DiscordEventsModule`, `AppModule`은 단위 A(공통 모듈 단계)에서만 수정. `SettingsSidebar`는 단위 C에서만 수정. 단위 A와 단위 C 간 수정 파일 중복 없음
- [x] **엔티티 파일이 이미 존재하는 경우 중복 생성하지 않는가**: `status-prefix-config.entity.ts`, `status-prefix-button.entity.ts`, 마이그레이션 파일 3개 모두 이미 `apps/api/src/status-prefix/domain/`과 `apps/api/src/migrations/`에 존재함. 공통 모듈 단계에서 내용을 확인하고 TypeORM 설정이 올바른지 검증만 수행하며 재생성하지 않음
- [x] **`StatusPrefixResetService`가 `VoiceLeaveHandler`에서 사용 가능한가**: `StatusPrefixModule`에서 `StatusPrefixResetService`를 exports하고, `DiscordEventsModule`이 `StatusPrefixModule`을 import함. `VoiceLeaveHandler`는 `DiscordEventsModule`의 provider이므로 `StatusPrefixResetService`를 주입받을 수 있음. 순환 의존 없음 (`StatusPrefixModule` → voice 도메인 의존 없음)
- [x] **기존 `REDIS_CLIENT` 직접 주입 패턴이 일관성을 해치지 않는가**: `setOriginalNicknameNx`에서 `REDIS_CLIENT`를 직접 주입하는 방식은 `RedisService`에 `setNx` 메서드가 없어 불가피함. 이 패턴은 `StatusPrefixRedisRepository` 내부에만 한정되므로 다른 도메인 코드에 영향 없음. 향후 `RedisService`에 `setNx` 메서드를 추가하여 통일할 수 있으나, 현재 status-prefix 구현에서는 필요 없음
