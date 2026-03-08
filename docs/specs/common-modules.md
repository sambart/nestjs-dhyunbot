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

---

# Newbie 도메인 — Embed 템플릿 커스터마이징 (F-NEWBIE-002-TMPL / F-NEWBIE-003-TMPL)

## 목적

미션 Embed 템플릿(F-NEWBIE-002-TMPL)과 모코코 사냥 Embed 템플릿(F-NEWBIE-003-TMPL) 기능 구현에 필요한 공통 모듈을 식별하고 설계 방향을 확정한다.
이 문서에 정의된 모듈은 백엔드와 프론트엔드의 모든 단위 작업보다 선행하여 완성되어야 하며, 이후 단위 작업들이 conflict 없이 병렬로 진행될 수 있도록 공통 인터페이스와 파일 경로를 명시한다.

---

## 1. 기존 모듈 현황

### 1-1. 이미 존재하며 수정 없이 재사용 가능한 것

| 모듈 | 파일 | 재사용 이유 |
|------|------|-------------|
| `NewbieMissionTemplate` entity | `apps/api/src/newbie/domain/newbie-mission-template.entity.ts` | 이미 생성됨. `NewbieModule`의 `TypeOrmModule.forFeature()`에 등록됨. `StatusMapping` 인터페이스도 포함 |
| `NewbieMocoTemplate` entity | `apps/api/src/newbie/domain/newbie-moco-template.entity.ts` | 이미 생성됨. `NewbieModule`의 `TypeOrmModule.forFeature()`에 등록됨 |
| `NewbieModule` | `apps/api/src/newbie/newbie.module.ts` | 두 엔티티가 이미 등록되어 있어 Repository 추가 시 `TypeOrmModule.forFeature()` 재등록 불필요. providers/exports 목록에 새 Repository만 추가 |
| `JwtAuthGuard` | `apps/api/src/auth/jwt-auth.guard.ts` | 신규 템플릿 API 엔드포인트 보호 |

### 1-2. 수정이 필요한 기존 파일

| 모듈 | 파일 | 필요한 수정 내용 |
|------|------|-----------------|
| `MissionService` | `apps/api/src/newbie/mission/mission.service.ts` | `buildMissionEmbed` 메서드를 `NewbieConfig.missionEmbed*` 기반에서 `NewbieMissionTemplate` 기반으로 교체. `applyTemplate` private 메서드를 공통 유틸로 이동하고 삭제 |
| `MocoService` | `apps/api/src/newbie/moco/moco.service.ts` | `buildHunterEmbed` 메서드를 `NewbieConfig.mocoEmbed*` 기반에서 `NewbieMocoTemplate` 기반으로 교체. `applyTemplate` private 메서드를 공통 유틸로 이동하고 삭제 |
| `NewbieController` | `apps/api/src/newbie/newbie.controller.ts` | `GET/POST /api/guilds/:guildId/newbie/mission-template`, `GET/POST /api/guilds/:guildId/newbie/moco-template` 엔드포인트 4개 추가 |
| `NewbieModule` | `apps/api/src/newbie/newbie.module.ts` | `NewbieMissionTemplateRepository`, `NewbieMocoTemplateRepository` 두 Repository를 providers와 exports에 추가. 생성자 주입은 각 서비스 파일에서 처리 |

---

## 2. 새로 만들어야 할 모듈 목록

### 2-1. 템플릿 문자열 치환 유틸리티

**파일**: `apps/api/src/newbie/infrastructure/newbie-template.util.ts`

현재 `MissionService.applyTemplate`과 `MocoService.applyTemplate`이 동일한 로직으로 중복 구현되어 있다. 이 유틸을 공통 파일로 추출하여 두 서비스가 모두 참조한다.

```typescript
/**
 * 템플릿 문자열의 {변수} 자리를 실제 값으로 치환한다.
 * @param template - 치환할 템플릿 문자열 (예: '안녕 {username}')
 * @param vars - 변수명 → 치환값 매핑 (예: { username: '동현' })
 * @returns 치환이 완료된 문자열
 */
export function applyTemplate(template: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (result, [key, value]) => result.replace(new RegExp(`\\{${key}\\}`, 'g'), value),
    template,
  );
}
```

이 함수를 추출한 뒤 `MissionService`와 `MocoService`의 private `applyTemplate` 메서드를 삭제하고 임포트로 대체한다.

### 2-2. 템플릿 변수 유효성 검사 유틸리티 (백엔드)

**파일**: `apps/api/src/newbie/infrastructure/newbie-template-validator.util.ts`

PRD에 따르면 허용되지 않는 변수가 포함된 템플릿 저장을 백엔드에서 차단해야 한다. 각 필드별 허용 변수 목록을 상수로 정의하고, 템플릿 문자열에서 `{변수명}` 패턴을 추출하여 허용 목록과 대조하는 함수를 제공한다.

```typescript
/** 미션 템플릿 각 필드별 허용 변수 목록 */
export const MISSION_TEMPLATE_ALLOWED_VARS = {
  titleTemplate: ['totalCount'],
  headerTemplate: ['totalCount', 'inProgressCount', 'completedCount', 'failedCount'],
  itemTemplate: [
    'username', 'mention', 'startDate', 'endDate',
    'statusEmoji', 'statusText',
    'playtimeHour', 'playtimeMin', 'playtimeSec', 'playtime',
    'playCount', 'targetPlaytime', 'daysLeft',
  ],
  footerTemplate: ['updatedAt'],
} as const;

/** 모코코 템플릿 각 필드별 허용 변수 목록 */
export const MOCO_TEMPLATE_ALLOWED_VARS = {
  titleTemplate: ['rank', 'hunterName'],
  bodyTemplate: ['totalMinutes', 'mocoList'],
  itemTemplate: ['newbieName', 'minutes'],
  footerTemplate: ['currentPage', 'totalPages', 'interval'],
} as const;

/**
 * 템플릿 문자열에서 사용된 변수 목록 추출.
 * '{변수명}' 패턴에 해당하는 변수명만 추출한다.
 */
export function extractTemplateVars(template: string): string[] {
  const matches = template.match(/\{(\w+)\}/g) ?? [];
  return matches.map((m) => m.slice(1, -1));
}

/**
 * 사용된 변수가 모두 허용 목록 안에 있는지 확인.
 * @returns 허용되지 않는 변수 목록. 빈 배열이면 유효.
 */
export function findInvalidVars(template: string, allowedVars: readonly string[]): string[] {
  const used = extractTemplateVars(template);
  const allowedSet = new Set(allowedVars);
  return used.filter((v) => !allowedSet.has(v));
}
```

### 2-3. 미션 템플릿 Repository

**파일**: `apps/api/src/newbie/infrastructure/newbie-mission-template.repository.ts`

TypeORM Repository 래퍼. `NewbieMissionTemplate` 엔티티에 대한 DB CRUD를 캡슐화한다.
엔티티는 이미 `NewbieModule.TypeOrmModule.forFeature()`에 등록되어 있으므로 `@InjectRepository(NewbieMissionTemplate)`로 주입 가능하다.

메서드 목록:

| 메서드 | 설명 |
|--------|------|
| `findByGuildId(guildId)` | guildId로 템플릿 단건 조회. 없으면 `null` 반환 |
| `upsert(guildId, dto)` | 템플릿 생성 또는 갱신 (guildId 기준 ON CONFLICT). 반환값: 저장된 `NewbieMissionTemplate` |

### 2-4. 모코코 템플릿 Repository

**파일**: `apps/api/src/newbie/infrastructure/newbie-moco-template.repository.ts`

TypeORM Repository 래퍼. `NewbieMocoTemplate` 엔티티에 대한 DB CRUD를 캡슐화한다.

메서드 목록:

| 메서드 | 설명 |
|--------|------|
| `findByGuildId(guildId)` | guildId로 템플릿 단건 조회. 없으면 `null` 반환 |
| `upsert(guildId, dto)` | 템플릿 생성 또는 갱신 (guildId 기준 ON CONFLICT). 반환값: 저장된 `NewbieMocoTemplate` |

### 2-5. 미션 템플릿 DTO

**파일**: `apps/api/src/newbie/dto/newbie-mission-template-save.dto.ts`

POST `/api/guilds/:guildId/newbie/mission-template` 요청 바디 DTO.
모든 필드는 optional이다 (null 전송 시 DB 컬럼도 null로 저장, 렌더링 시 기본값 사용).
백엔드에서 저장 전 `findInvalidVars`를 통해 각 필드의 허용 변수를 검사한다.

```typescript
export class NewbieMissionTemplateSaveDto {
  @IsOptional()
  @IsString()
  titleTemplate?: string | null;

  @IsOptional()
  @IsString()
  headerTemplate?: string | null;

  @IsOptional()
  @IsString()
  itemTemplate?: string | null;

  @IsOptional()
  @IsString()
  footerTemplate?: string | null;

  @IsOptional()
  @IsObject()
  statusMapping?: {
    IN_PROGRESS: { emoji: string; text: string };
    COMPLETED: { emoji: string; text: string };
    FAILED: { emoji: string; text: string };
  } | null;
}
```

### 2-6. 모코코 템플릿 DTO

**파일**: `apps/api/src/newbie/dto/newbie-moco-template-save.dto.ts`

POST `/api/guilds/:guildId/newbie/moco-template` 요청 바디 DTO.
모든 필드는 optional이다.

```typescript
export class NewbieMocoTemplateSaveDto {
  @IsOptional()
  @IsString()
  titleTemplate?: string | null;

  @IsOptional()
  @IsString()
  bodyTemplate?: string | null;

  @IsOptional()
  @IsString()
  itemTemplate?: string | null;

  @IsOptional()
  @IsString()
  footerTemplate?: string | null;
}
```

### 2-7. 미션 템플릿 기본값 상수

**파일**: `apps/api/src/newbie/infrastructure/newbie-mission.constants.ts` (기존 파일에 추가)

PRD에 정의된 미션 템플릿 기본값을 상수로 정의한다. `MissionService.buildMissionEmbed`에서 DB에 템플릿이 없을 경우 이 값을 사용한다.

기존 파일(`newbie-mission.constants.ts`)에 다음 상수를 추가한다:

```typescript
/** 미션 Embed 템플릿 기본값 (DB 레코드 없거나 필드가 null인 경우 사용) */
export const MISSION_TEMPLATE_DEFAULTS = {
  titleTemplate: '🧑‍🌾 신입 미션 체크',
  headerTemplate: '🧑‍🌾 뉴비 멤버 (총 인원: {totalCount}명)',
  itemTemplate: '{mention} 🌱\n{startDate} ~ {endDate}\n{statusEmoji} {statusText} | 플레이타임: {playtime} | 플레이횟수: {playCount}회',
  footerTemplate: '마지막 갱신: {updatedAt}',
  statusMapping: {
    IN_PROGRESS: { emoji: '🟡', text: '진행중' },
    COMPLETED: { emoji: '✅', text: '완료' },
    FAILED: { emoji: '❌', text: '실패' },
  },
} as const;

/** 모코코 Embed 템플릿 기본값 (DB 레코드 없거나 필드가 null인 경우 사용) */
export const MOCO_TEMPLATE_DEFAULTS = {
  titleTemplate: '모코코 사냥 TOP {rank} — {hunterName} 🌱',
  bodyTemplate: '총 모코코 사냥 시간: {totalMinutes}분\n\n도움을 받은 모코코들:\n{mocoList}',
  itemTemplate: '– {newbieName} 🌱: {minutes}분',
  footerTemplate: '페이지 {currentPage}/{totalPages} | 자동 갱신 {interval}분',
} as const;
```

### 2-8. 프론트엔드 템플릿 API 클라이언트 함수 및 타입

**파일**: `apps/web/app/lib/newbie-template-api.ts` (신규 생성)

기존 `newbie-api.ts` 패턴에 따라 템플릿 전용 API 클라이언트를 분리한다.
기존 `newbie-api.ts`에는 config 관련 API만 있으므로 충돌 없이 별도 파일로 작성한다.

```typescript
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

/** 미션 템플릿 저장/조회 인터페이스 */
export interface MissionStatusMappingEntry {
  emoji: string;
  text: string;
}

export interface MissionStatusMapping {
  IN_PROGRESS: MissionStatusMappingEntry;
  COMPLETED: MissionStatusMappingEntry;
  FAILED: MissionStatusMappingEntry;
}

export interface MissionTemplateConfig {
  titleTemplate: string | null;
  headerTemplate: string | null;
  itemTemplate: string | null;
  footerTemplate: string | null;
  statusMapping: MissionStatusMapping | null;
}

/** 모코코 템플릿 저장/조회 인터페이스 */
export interface MocoTemplateConfig {
  titleTemplate: string | null;
  bodyTemplate: string | null;
  itemTemplate: string | null;
  footerTemplate: string | null;
}

export async function fetchMissionTemplate(guildId: string): Promise<MissionTemplateConfig | null>
export async function saveMissionTemplate(guildId: string, template: MissionTemplateConfig): Promise<{ ok: boolean }>
export async function fetchMocoTemplate(guildId: string): Promise<MocoTemplateConfig | null>
export async function saveMocoTemplate(guildId: string, template: MocoTemplateConfig): Promise<{ ok: boolean }>
```

### 2-9. 프론트엔드 템플릿 변수 허용 목록 상수

**파일**: `apps/web/app/lib/newbie-template-vars.ts` (신규 생성)

프론트엔드에서 실시간 유효성 검사와 "사용 가능 변수 안내" UI에 사용하는 상수 파일. 백엔드 `newbie-template-validator.util.ts`의 허용 목록과 동일 내용이지만, 백엔드-프론트엔드 간 공유 타입이 아닌 독립 정의로 관리한다 (이 프로젝트의 `libs/shared` 사용 방침에 따라).

```typescript
/** 미션 템플릿 각 필드별 허용 변수 목록 (프론트엔드 유효성 검사 및 안내 UI용) */
export const MISSION_TEMPLATE_VARS = {
  titleTemplate: ['{totalCount}'],
  headerTemplate: ['{totalCount}', '{inProgressCount}', '{completedCount}', '{failedCount}'],
  itemTemplate: [
    '{username}', '{mention}', '{startDate}', '{endDate}',
    '{statusEmoji}', '{statusText}',
    '{playtimeHour}', '{playtimeMin}', '{playtimeSec}', '{playtime}',
    '{playCount}', '{targetPlaytime}', '{daysLeft}',
  ],
  footerTemplate: ['{updatedAt}'],
} as const;

/** 모코코 템플릿 각 필드별 허용 변수 목록 */
export const MOCO_TEMPLATE_VARS = {
  titleTemplate: ['{rank}', '{hunterName}'],
  bodyTemplate: ['{totalMinutes}', '{mocoList}'],
  itemTemplate: ['{newbieName}', '{minutes}'],
  footerTemplate: ['{currentPage}', '{totalPages}', '{interval}'],
} as const;

/** 특정 변수 허용 목록을 기반으로 입력값의 유효성을 검사 */
export function validateTemplateVars(template: string, allowedVars: readonly string[]): string[] {
  const matches = template.match(/\{(\w+)\}/g) ?? [];
  const allowedSet = new Set(allowedVars);
  return matches.filter((m) => !allowedSet.has(m));
}
```

---

## 3. 기존 파일 수정 상세

### 3-1. `MissionService` 수정

**파일**: `apps/api/src/newbie/mission/mission.service.ts`

`buildMissionEmbed` 메서드의 동작을 `NewbieConfig.missionEmbed*` 필드 기반에서 `NewbieMissionTemplate` 기반으로 교체한다.
`applyTemplate` private 메서드를 제거하고 `newbie-template.util.ts`의 `applyTemplate`을 import한다.

변경 핵심:
- `NewbieMissionTemplateRepository`를 생성자에 추가 주입
- `buildMissionEmbed` 내부에서 `templateRepo.findByGuildId(guildId)` 호출 후 템플릿이 null이면 `MISSION_TEMPLATE_DEFAULTS`를 사용
- 제목: `titleTemplate ?? MISSION_TEMPLATE_DEFAULTS.titleTemplate`로 결정 후 `{totalCount}` 치환
- 헤더: `headerTemplate ?? MISSION_TEMPLATE_DEFAULTS.headerTemplate`로 결정 후 `{totalCount}`, `{inProgressCount}`, `{completedCount}`, `{failedCount}` 치환
- 항목: `itemTemplate ?? MISSION_TEMPLATE_DEFAULTS.itemTemplate`를 미션별로 반복 치환
- 푸터: `footerTemplate ?? MISSION_TEMPLATE_DEFAULTS.footerTemplate`로 `{updatedAt}` 치환
- 상태 이모지/텍스트: `statusMapping ?? MISSION_TEMPLATE_DEFAULTS.statusMapping`에서 참조
- private `applyTemplate` 메서드 삭제 (공통 유틸 사용)

### 3-2. `MocoService` 수정

**파일**: `apps/api/src/newbie/moco/moco.service.ts`

`buildHunterEmbed` 메서드의 동작을 `NewbieConfig.mocoEmbed*` 필드 기반에서 `NewbieMocoTemplate` 기반으로 교체한다.
`applyTemplate` private 메서드를 제거하고 `newbie-template.util.ts`의 `applyTemplate`을 import한다.

변경 핵심:
- `NewbieMocoTemplateRepository`를 생성자에 추가 주입
- `buildRankPayload` 내부에서 `templateRepo.findByGuildId(guildId)` 호출 후 템플릿이 null이면 `MOCO_TEMPLATE_DEFAULTS`를 사용
- 제목: `titleTemplate ?? MOCO_TEMPLATE_DEFAULTS.titleTemplate`로 결정 후 `{rank}`, `{hunterName}` 치환
- 항목 목록: `itemTemplate ?? MOCO_TEMPLATE_DEFAULTS.itemTemplate`을 newbie별로 반복 치환 후 줄 이음
- 본문: `bodyTemplate ?? MOCO_TEMPLATE_DEFAULTS.bodyTemplate`에서 `{mocoList}` 위치에 항목 목록 삽입, `{totalMinutes}` 치환
- 푸터: `footerTemplate ?? MOCO_TEMPLATE_DEFAULTS.footerTemplate`로 `{currentPage}`, `{totalPages}`, `{interval}` 치환
- private `applyTemplate` 메서드 삭제 (공통 유틸 사용)

### 3-3. `NewbieController` 수정

**파일**: `apps/api/src/newbie/newbie.controller.ts`

아래 4개 엔드포인트를 추가한다. 기존 엔드포인트와 동일한 `JwtAuthGuard` 보호 하에 동작한다.

| 메서드 | 경로 | 설명 |
|--------|------|------|
| `GET` | `/api/guilds/:guildId/newbie/mission-template` | 미션 템플릿 조회. 레코드 없으면 `null` 반환 |
| `POST` | `/api/guilds/:guildId/newbie/mission-template` | 미션 템플릿 저장. 허용 변수 유효성 검사 후 upsert. 실패 시 400 응답 (오류 필드 및 허용 변수 목록 반환) |
| `GET` | `/api/guilds/:guildId/newbie/moco-template` | 모코코 템플릿 조회. 레코드 없으면 `null` 반환 |
| `POST` | `/api/guilds/:guildId/newbie/moco-template` | 모코코 템플릿 저장. 허용 변수 유효성 검사 후 upsert. 실패 시 400 응답 (오류 필드 및 허용 변수 목록 반환) |

유효성 검사 실패 시 응답 형식:
```typescript
// HTTP 400
{
  message: '허용되지 않는 변수가 포함되어 있습니다.',
  errors: [
    { field: 'itemTemplate', invalidVars: ['{unknownVar}'], allowedVars: ['{username}', ...] }
  ]
}
```

생성자에 `NewbieMissionTemplateRepository`, `NewbieMocoTemplateRepository` 추가 주입.

### 3-4. `NewbieModule` 수정

**파일**: `apps/api/src/newbie/newbie.module.ts`

`NewbieMissionTemplateRepository`와 `NewbieMocoTemplateRepository`를 providers 및 exports에 추가한다.
두 엔티티는 이미 `TypeOrmModule.forFeature()`에 등록되어 있으므로 엔티티 목록은 변경하지 않는다.

```typescript
providers: [
  // 기존 저장소
  NewbieConfigRepository,
  NewbieMissionRepository,
  NewbiePeriodRepository,
  NewbieRedisRepository,
  // 신규 추가
  NewbieMissionTemplateRepository,
  NewbieMocoTemplateRepository,
  // ... 나머지 provider
]

exports: [
  // 기존
  NewbieConfigRepository,
  NewbieMissionRepository,
  NewbiePeriodRepository,
  NewbieRedisRepository,
  MissionService,
  MocoService,
  // 신규 추가
  NewbieMissionTemplateRepository,
  NewbieMocoTemplateRepository,
]
```

---

## 4. 구현 단위(Unit) 분류

| 단위 | 기능 | 포함 파일 |
|------|------|-----------|
| A (공통 선행) | Repository, DTO, 유틸, 상수, Module 수정 | `newbie-mission-template.repository.ts`, `newbie-moco-template.repository.ts`, `newbie-mission-template-save.dto.ts`, `newbie-moco-template-save.dto.ts`, `newbie-template.util.ts`, `newbie-template-validator.util.ts`, `newbie-mission.constants.ts` (기본값 상수 추가), `newbie.module.ts` (수정) |
| B (백엔드 API) | 컨트롤러 엔드포인트 추가 및 서비스 교체 | `newbie.controller.ts` (수정), `mission/mission.service.ts` (수정), `moco/moco.service.ts` (수정) |
| C (프론트엔드) | 탭 2, 탭 3 템플릿 설정 UI | `apps/web/app/lib/newbie-template-api.ts` (신규), `apps/web/app/lib/newbie-template-vars.ts` (신규), 탭 2/3 페이지 컴포넌트 |

단위 A 완성 후 단위 B와 C를 병렬 진행할 수 있다.

---

## 5. 파일 경로 전체 목록 (충돌 방지용 사전 확정)

### 신규 생성

```
apps/api/src/newbie/
  infrastructure/
    newbie-mission-template.repository.ts                         (2-3, 단위 A)
    newbie-moco-template.repository.ts                            (2-4, 단위 A)
    newbie-template.util.ts                                       (2-1, 단위 A)
    newbie-template-validator.util.ts                             (2-2, 단위 A)
  dto/
    newbie-mission-template-save.dto.ts                           (2-5, 단위 A)
    newbie-moco-template-save.dto.ts                              (2-6, 단위 A)

apps/web/app/lib/
  newbie-template-api.ts                                          (2-8, 단위 C)
  newbie-template-vars.ts                                         (2-9, 단위 C)
```

### 기존 수정

```
apps/api/src/newbie/
  infrastructure/
    newbie-mission.constants.ts     기본값 상수 2개 추가 (2-7, 단위 A)
  mission/
    mission.service.ts              buildMissionEmbed 교체, applyTemplate 제거 (3-1, 단위 B)
  moco/
    moco.service.ts                 buildHunterEmbed 교체, applyTemplate 제거 (3-2, 단위 B)
  newbie.controller.ts              엔드포인트 4개 추가 (3-3, 단위 B)
  newbie.module.ts                  Repository 2개 추가 (3-4, 단위 A)
```

### 이미 존재하는 파일 (수정 없음, 확인만)

```
apps/api/src/newbie/domain/newbie-mission-template.entity.ts     (이미 생성됨)
apps/api/src/newbie/domain/newbie-moco-template.entity.ts        (이미 생성됨)
```

---

## 6. 검증 체크리스트

이 문서가 "페이지 단위 병렬 개발 시 코드 conflict가 생길 공통 모듈을 모두 포함하는가"를 3회 확인한다.

### 1차 확인

- [x] **Repository 인터페이스 사전 확정**: `NewbieMissionTemplateRepository`(2-3)와 `NewbieMocoTemplateRepository`(2-4)의 메서드 시그니처(`findByGuildId`, `upsert`) 확정 — 단위 B의 서비스 수정과 컨트롤러가 동일 인터페이스 참조
- [x] **DTO 구조 사전 확정**: `NewbieMissionTemplateSaveDto`(2-5)와 `NewbieMocoTemplateSaveDto`(2-6) 확정 — 단위 B 컨트롤러와 단위 C 프론트엔드가 동일 필드 구조 기반
- [x] **유효성 검사 허용 변수 목록 사전 확정**: 백엔드 `MISSION_TEMPLATE_ALLOWED_VARS`, `MOCO_TEMPLATE_ALLOWED_VARS`(2-2)와 프론트엔드 `MISSION_TEMPLATE_VARS`, `MOCO_TEMPLATE_VARS`(2-9) 모두 PRD 기준으로 확정 — 단위 B(백엔드 검사)와 단위 C(프론트엔드 실시간 검사) 간 허용 변수 불일치 방지
- [x] **템플릿 기본값 상수 사전 확정**: `MISSION_TEMPLATE_DEFAULTS`, `MOCO_TEMPLATE_DEFAULTS`(2-7) 확정 — 단위 B의 `MissionService`와 `MocoService`가 동일 기본값 사용
- [x] **`applyTemplate` 유틸 추출 사전 확정**: `newbie-template.util.ts`(2-1)에 단일 구현, 두 서비스에서 중복 제거(3-1, 3-2) — 단위 B에서 두 서비스를 각각 수정할 때 동일 유틸 참조
- [x] **API 응답 스키마 사전 확정**: `GET mission-template`, `GET moco-template` 응답 타입이 2-8절 프론트엔드 인터페이스에 명세 — 단위 C가 단위 B 완료 전에도 목 데이터 기반 개발 가능
- [x] **400 오류 응답 형식 사전 확정**: 3-3절에서 `{ message, errors: [{ field, invalidVars, allowedVars }] }` 형식 확정 — 단위 C의 에러 처리 UI가 이 형식 기반
- [x] **파일 경로 전체 목록**: 5절에서 사전 확정 — 단위 A, B, C 간 동일 파일 동시 생성/수정 충돌 없음
- [x] **`NewbieModule` 수정 내용 사전 확정**: 3-4절에서 추가할 providers/exports 목록 확정 — 단위 A에서 모듈 수정 완료 후 단위 B가 Repository를 서비스에 주입 가능

### 2차 확인

- [x] **단위 A (공통 선행)** 가 생성/수정하는 파일: `newbie-mission-template.repository.ts`, `newbie-moco-template.repository.ts`, `newbie-mission-template-save.dto.ts`, `newbie-moco-template-save.dto.ts`, `newbie-template.util.ts`, `newbie-template-validator.util.ts`, `newbie-mission.constants.ts` (기본값 추가), `newbie.module.ts` (Repository 등록) — 이 모두 단위 B, C 착수 전에 완성되어야 함
- [x] **단위 B (백엔드 API)** 가 수정하는 파일: `newbie.controller.ts`, `mission/mission.service.ts`, `moco/moco.service.ts` — 이 3개 파일은 단위 A와 단위 C가 수정하지 않음 (충돌 없음)
- [x] **단위 C (프론트엔드)** 가 생성하는 파일: `newbie-template-api.ts`, `newbie-template-vars.ts`, 탭 2/3 페이지 컴포넌트 — 단위 A, B가 수정하는 백엔드 파일과 완전히 독립
- [x] **단위 A가 수정하는 `newbie.module.ts`를 단위 B나 C가 추가 수정하는가**: 단위 B는 서비스/컨트롤러 파일만 수정하며 모듈 파일은 수정하지 않음. 단위 C는 프론트엔드 파일만 다룸 — `newbie.module.ts`는 단위 A에서만 수정
- [x] **`newbie-mission.constants.ts`에 기본값 상수를 추가할 때 기존 상수(`MISSION_STATUS_EMOJI`, `MISSION_STATUS_TEXT`)와 충돌이 없는가**: 신규 추가할 `MISSION_TEMPLATE_DEFAULTS`, `MOCO_TEMPLATE_DEFAULTS`는 새로운 이름이므로 기존 상수와 충돌 없음

### 3차 확인

- [x] **단위 A~C 간에 동일 파일을 동시에 신규 생성하는 경우가 없는가**: 5절 파일 경로 목록 기준으로 신규 파일은 단위 A(`repository` 2개, `util` 2개, `dto` 2개)와 단위 C(`newbie-template-api.ts`, `newbie-template-vars.ts`)에 귀속되며, 동일 파일이 두 단위에 중복되지 않음
- [x] **단위 A~C 간에 동일 파일을 동시에 수정하는 경우가 없는가**: `newbie-mission.constants.ts`와 `newbie.module.ts`는 단위 A에서만 수정. `newbie.controller.ts`, `mission.service.ts`, `moco.service.ts`는 단위 B에서만 수정. 프론트엔드 파일은 단위 C에서만 수정 — 충돌 없음
- [x] **엔티티 파일이 이미 존재하므로 중복 생성하지 않는가**: `newbie-mission-template.entity.ts`와 `newbie-moco-template.entity.ts` 모두 이미 존재하며 `NewbieModule`에 등록됨. 어느 단위에서도 재생성하지 않음
- [x] **백엔드 유효성 검사 허용 변수 목록과 프론트엔드 허용 변수 목록이 PRD와 일치하는가**: `MISSION_TEMPLATE_ALLOWED_VARS`(2-2)와 `MISSION_TEMPLATE_VARS`(2-9)의 각 필드별 변수 목록을 PRD F-NEWBIE-002-TMPL 표와 대조 완료. `MOCO_TEMPLATE_ALLOWED_VARS`(2-2)와 `MOCO_TEMPLATE_VARS`(2-9)도 PRD F-NEWBIE-003-TMPL 표와 대조 완료
- [x] **`MocoService.buildHunterEmbed`에서 `mocoEmbedTitle/Description` 대신 `NewbieMocoTemplate` 참조로 변경 시 `buildRankPayload`의 config 조회 로직과 충돌이 없는가**: `buildRankPayload`는 이미 `configRepo.findByGuildId`를 호출하고 있다. 템플릿 기반으로 전환 시 `templateRepo.findByGuildId`를 추가 호출하면 되며, `config` 조회는 `mocoAutoRefreshMinutes`, `mocoRankChannelId` 확인 용도로 여전히 필요하여 유지됨 — 의존성 충돌 없음

---

# General 도메인 — 공통 모듈 판단 문서

## 목적

General 도메인 구현에 필요한 공통 모듈을 식별하고 설계 방향을 확정한다.
이 문서에 정의된 모듈은 모든 개발 단위 작업보다 선행하여 완성되어야 하며, 이후 단위 작업들이 conflict 없이 병렬로 진행될 수 있도록 공통 인터페이스와 파일 경로를 명시한다.

---

## 1. 기존 모듈 중 General 도메인에서 재사용 가능한 것

### 1-1. 재사용 (수정 없음)

| 모듈 | 파일 | 재사용 이유 |
|------|------|-------------|
| `JwtAuthGuard` | `apps/api/src/auth/jwt-auth.guard.ts` | `GuildInfoController`의 기존 엔드포인트와 동일하게 신규 `getCommands` 엔드포인트에도 적용 |
| `GuildInfoController` | `apps/api/src/gateway/guild-info.controller.ts` | `GET /api/guilds/:guildId/commands` 엔드포인트를 이 컨트롤러에 추가 메서드로 삽입 — 컨트롤러 자체는 이미 존재하며 클래스 레벨 `@UseGuards(JwtAuthGuard)` 및 `@InjectDiscordClient()` 주입이 완비되어 있음 |
| `GatewayModule` | `apps/api/src/gateway/gateway.module.ts` | `GuildInfoController`를 포함하는 모듈이며, `DiscordModule.forFeature()` import가 이미 구성되어 있어 추가 모듈 변경 없음 |
| Next.js 프록시 라우트 | `apps/web/app/api/guilds/[...path]/route.ts` | catch-all 패턴(`[...path]`)으로 `/api/guilds/:guildId/commands` 요청을 이미 백엔드로 프록시함 — 수정 불필요 |
| `fetchGuildChannels` 패턴 | `apps/web/app/lib/discord-api.ts` | 동일한 fetch 패턴(try/catch, 빈 배열 반환)으로 `fetchGuildCommands` 함수 추가 |

### 1-2. 재사용하되 수정이 필요한 것

| 모듈 | 파일 | 필요한 수정 내용 |
|------|------|-----------------|
| `discord.config.ts` | `apps/api/src/config/discord.config.ts` | `commands` 배열 전체 및 7개 커맨드 클래스의 `import` 구문 제거. `discordClientOptions`, `registerCommandOptions`, `failOnLogin`, `token` 설정은 그대로 유지 |
| `GuildInfoController` | `apps/api/src/gateway/guild-info.controller.ts` | `getCommands(guildId)` 메서드 추가 (`@Get('commands')` 데코레이터). `Client.application.commands.fetch({ guildId })` 호출 및 `id`, `name`, `description` 필드 배열 반환. 오류 시 빈 배열 반환 |
| `discord-api.ts` | `apps/web/app/lib/discord-api.ts` | `SlashCommand` 인터페이스 및 `fetchGuildCommands(guildId)` 함수 추가. 기존 `fetchGuildChannels` 패턴과 동일하게 구현 |
| `page.tsx` (일반설정) | `apps/web/app/settings/guild/[guildId]/page.tsx` | 컴포넌트 상단의 하드코딩 `commands` 배열 제거, `'use client'` 지시어 추가, `useState`/`useEffect`로 API 동적 로딩으로 전환, 로딩 상태 처리, 커맨드 이름 기반 아이콘 매핑 함수 추가 |

---

## 2. 새로 만들어야 할 모듈/서비스/핸들러 목록

General 도메인은 DB 엔티티, Redis, 이벤트 시스템이 없다. 새로 만들 파일은 최소화된다.

### 2-1. `SlashCommand` 인터페이스 및 `fetchGuildCommands` 함수

**파일**: `apps/web/app/lib/discord-api.ts` (기존 파일에 추가)

PRD F-GENERAL-003에 정의된 API 클라이언트 함수를 기존 `discord-api.ts`에 추가한다. 별도 파일 생성 없이 기존 패턴과 통일한다.

```typescript
export interface SlashCommand {
  id: string;
  name: string;
  description: string;
}

export async function fetchGuildCommands(guildId: string): Promise<SlashCommand[]> {
  try {
    const url = `/api/guilds/${guildId}/commands`;
    const res = await fetch(url);
    if (!res.ok) return [];
    return res.json() as Promise<SlashCommand[]>;
  } catch {
    return [];
  }
}
```

---

## 3. 수정이 필요한 기존 파일 목록 및 수정 내용

### 3-1. `discord.config.ts` 수정

**파일**: `apps/api/src/config/discord.config.ts`

현재 `commands` 배열에 7개 커맨드 클래스가 수동 등록되어 있으며, `discord-nestjs v5.5.1`의 `DiscordModuleOption` 인터페이스에 `commands` 속성이 존재하지 않아 해당 배열은 이미 라이브러리에 의해 무시되고 있다. 따라서 `commands` 배열과 관련 `import` 7개를 제거한다.

유지할 설정:
- `token`
- `discordClientOptions.intents` (5개 인텐트)
- `registerCommandOptions: [{ removeCommandsBefore: true }]`
- `failOnLogin: true`

제거할 내용:
```
import { CommunityHealthCommand } from '../gemini/commands/community-health.command';
import { MyVoiceStatsCommand } from '../gemini/commands/my-voice-stats.command';
import { VoiceLeaderboardCommand } from '../gemini/commands/voice-leaderboard.command';
import { VoiceStatsCommand } from '../gemini/commands/voice-stats.command';
import { MusicPlayCommand } from '../music/music-play.command';
import { MusicSkipCommand } from '../music/music-skip.command';
import { MusicStopCommand } from '../music/music-stop.command';

commands: [ ... ],   // DiscordModuleOption에 존재하지 않는 속성
```

이 변경으로 `AppModule`, `GatewayModule`, `DiscordEventsModule` 등 다른 파일에 추가 수정은 불필요하다.

### 3-2. `GuildInfoController` 수정

**파일**: `apps/api/src/gateway/guild-info.controller.ts`

기존 `getChannels`, `getRoles`, `getEmojis` 메서드 패턴을 그대로 따르는 `getCommands` 메서드를 추가한다.

```typescript
@Get('commands')
async getCommands(@Param('guildId') guildId: string) {
  try {
    const commands = await this.client.application?.commands.fetch({ guildId });
    if (!commands) return [];
    return commands.map((cmd) => ({
      id: cmd.id,
      name: cmd.name,
      description: cmd.description,
    }));
  } catch {
    return [];
  }
}
```

추가 의존성 없음. 이미 `@InjectDiscordClient()` 로 `Client`가 주입되어 있다.

### 3-3. `discord-api.ts` 수정 (프론트엔드)

**파일**: `apps/web/app/lib/discord-api.ts`

2-1절에 정의된 `SlashCommand` 인터페이스와 `fetchGuildCommands` 함수를 기존 파일 말미에 추가한다. 기존 함수(`fetchGuildChannels`, `fetchGuildRoles`, `fetchGuildEmojis`)와 동일한 try/catch 패턴 및 오류 시 빈 배열 반환 동작을 따른다.

### 3-4. `page.tsx` (일반설정 페이지) 수정

**파일**: `apps/web/app/settings/guild/[guildId]/page.tsx`

현재 서버 컴포넌트(파일 상단에 `'use client'` 없음)이므로 클라이언트 컴포넌트로 전환해야 한다.

수정 내용:
1. 파일 상단에 `'use client'` 추가
2. `useState<SlashCommand[]>`, `useState<boolean>` (로딩 상태) 선언
3. `useEffect`에서 `fetchGuildCommands(guildId)` 호출 (URL 파라미터로 `guildId` 획득)
4. 컴포넌트 상단 하드코딩 `commands` 배열 제거
5. 커맨드 이름 기반 아이콘 매핑 함수 추가:

```typescript
function getCommandIcon(name: string): LucideIcon {
  if (['play', 'stop', 'skip'].includes(name)) return Music;
  if (['voice-stats', 'my-voice-stats', 'voice-leaderboard'].includes(name)) return Mic;
  if (name === 'community-health') return Bot;
  return Hash;
}
```

6. 로딩 중 스켈레톤 또는 로딩 인디케이터 표시
7. API 응답 길이로 "등록된 명령어" 카운트 동적 갱신
8. API 응답 `name` 필드에 `/` 접두어 붙여 표시

`guildId`는 `useParams()`로 획득한다 (`next/navigation`). 기존 레이아웃(`apps/web/app/settings/guild/[guildId]/layout.tsx`)의 `params.guildId`를 참고한다.

---

## 4. 구현 단위(Unit) 분류

General 도메인은 3개의 독립 단위로 분리된다. 각 단위는 다른 단위와 파일이 겹치지 않아 병렬 진행 가능하다.

| 단위 | 기능 | 포함 파일 |
|------|------|-----------|
| A | discord.config.ts 수동 배열 제거 (F-GENERAL-001) | `apps/api/src/config/discord.config.ts` |
| B | 커맨드 목록 API 엔드포인트 추가 (F-GENERAL-002) | `apps/api/src/gateway/guild-info.controller.ts` |
| C | 프론트엔드 동적 커맨드 목록 (F-GENERAL-003) | `apps/web/app/settings/guild/[guildId]/page.tsx`, `apps/web/app/lib/discord-api.ts` |

단위 A와 B는 서로 다른 파일을 수정하므로 완전히 병렬 진행 가능하다. 단위 C는 단위 B의 엔드포인트 명세(`GET /api/guilds/:guildId/commands`, 응답 스키마)에 의존하지만, 명세가 이 문서에서 확정되었으므로 B 구현 완료 전에도 C를 병렬 착수할 수 있다.

---

## 5. 파일 경로 전체 목록 (충돌 방지용 사전 확정)

### 기존 수정 (신규 파일 없음)

```
apps/api/src/config/discord.config.ts                          (3-1, 단위 A)
apps/api/src/gateway/guild-info.controller.ts                  (3-2, 단위 B)
apps/web/app/lib/discord-api.ts                                (3-3, 단위 C)
apps/web/app/settings/guild/[guildId]/page.tsx                 (3-4, 단위 C)
```

신규 파일은 없다. `libs/shared` 변경도 불필요하다. `AppModule`, `GatewayModule`, `DiscordEventsModule`, Next.js 프록시 라우트는 수정 대상이 아니다.

---

## 6. `libs/shared` 변경 필요 여부 판단

General 도메인은 `SlashCommand` 타입을 백엔드와 프론트엔드 간에 공유하지 않는다. 백엔드는 Discord.js `ApplicationCommand` 객체에서 `id`, `name`, `description`을 직접 추출하여 반환하고, 프론트엔드는 `apps/web/app/lib/discord-api.ts`에 로컬 인터페이스를 정의한다. 따라서 `libs/shared`에 타입 추가는 불필요하다.

---

## 7. 검증 체크리스트

이 문서가 "페이지 단위 병렬 개발 시 코드 conflict가 생길 공통 모듈을 모두 포함하는가"를 3회 확인한다.

### 1차 확인

- [x] **단위 A 수정 파일**: `discord.config.ts` 1개 — 단위 B, C와 중복 없음
- [x] **단위 B 수정 파일**: `guild-info.controller.ts` 1개 — 단위 A, C와 중복 없음
- [x] **단위 C 수정 파일**: `discord-api.ts`, `page.tsx` 2개 — 단위 A, B와 중복 없음
- [x] **`GuildInfoController`의 엔드포인트 명세 사전 확정**: 3-2절에서 메서드 시그니처, 응답 필드(`id`, `name`, `description`), 오류 처리(빈 배열) 모두 확정 — 단위 C가 이 명세를 기반으로 독립 착수 가능
- [x] **`fetchGuildCommands` 함수 시그니처 사전 확정**: 2-1절에서 확정 — 단위 C의 `page.tsx`가 이 함수에 의존하며, 동일 파일(`discord-api.ts`)에 추가하므로 충돌 없음
- [x] **`getCommandIcon` 아이콘 매핑 규칙 사전 확정**: 3-4절에서 커맨드 이름별 아이콘 매핑 함수 확정 — 단위 C에서 단일 구현
- [x] **`AppModule` 수정 불필요 확인**: General 도메인은 별도 NestJS 모듈을 추가하지 않는다. `GatewayModule`은 이미 `AppModule`에 등록되어 있으며, `GuildInfoController`에 메서드만 추가하므로 `AppModule` 변경 불필요
- [x] **`GatewayModule` 수정 불필요 확인**: `GuildInfoController`는 이미 `GatewayModule`의 `controllers`에 등록되어 있으므로 모듈 변경 없이 메서드 추가만으로 충분
- [x] **Next.js 프록시 수정 불필요 확인**: `apps/web/app/api/guilds/[...path]/route.ts`의 catch-all 패턴이 `/api/guilds/:guildId/commands`를 이미 처리함

### 2차 확인

- [x] **단위 A (discord.config.ts)** 가 수정하는 파일이 단위 B, C에서도 수정되는가**: `discord.config.ts`는 단위 A에서만 수정. 단위 B는 `guild-info.controller.ts`, 단위 C는 `discord-api.ts`와 `page.tsx`를 수정 — 중복 없음
- [x] **단위 B (GuildInfoController)** 가 수정하는 파일이 단위 A, C에서도 수정되는가**: `guild-info.controller.ts`는 단위 B에서만 수정 — 중복 없음
- [x] **단위 C (프론트엔드)** 가 수정하는 파일이 단위 A, B에서도 수정되는가**: `discord-api.ts`와 `page.tsx`는 단위 C에서만 수정 — 중복 없음
- [x] **단위 C가 단위 B의 API 응답 스키마에 의존하는가**: 의존한다. 그러나 응답 스키마(`id: string`, `name: string`, `description: string`)가 이 문서 3-2절에서 확정되었으므로 단위 B 구현 완료 전에도 단위 C를 착수할 수 있음
- [x] **`discord-api.ts`에 추가되는 `SlashCommand` 인터페이스가 기존 인터페이스(`DiscordChannel`, `DiscordRole`, `DiscordEmoji`)와 이름 충돌이 없는가**: 기존 인터페이스 목록(`DiscordChannel`, `DiscordRole`, `DiscordEmoji`) 확인 완료 — `SlashCommand`는 신규 이름이므로 충돌 없음
- [x] **`page.tsx`가 `'use client'` 전환 시 부모 레이아웃(`layout.tsx`)과 충돌이 없는가**: `apps/web/app/settings/guild/[guildId]/layout.tsx`는 서버 컴포넌트로 유지되며 `page.tsx`만 클라이언트 컴포넌트로 전환하므로 Next.js App Router의 클라이언트 경계 규칙에 부합함

### 3차 확인

- [x] **General 도메인에 새로 만들 파일이 없는가 (기존 파일 수정만인가)**: 5절 파일 목록 기준 신규 파일 없음. 4개 기존 파일을 각각 수정하는 방식이며 단위 간 동일 파일 수정 중복 없음
- [x] **`libs/shared` 변경이 필요하지 않은가**: 6절에서 판단 완료. `SlashCommand` 타입은 프론트엔드 전용으로 `discord-api.ts`에 로컬 정의하며 공유 타입 등록 불필요
- [x] **`DiscordEventsModule`, `AppModule`에 변경이 없는가**: General 도메인은 이벤트 핸들러, 신규 NestJS 모듈을 추가하지 않으므로 두 파일 모두 수정 불필요. `discord.config.ts` 변경은 import 제거이며 이 파일들에 영향 없음
- [x] **단위 A~C 중 동일 파일을 동시에 수정하는 경우가 없는가**: 5절 파일 경로 목록에서 각 파일은 단 하나의 단위에만 귀속됨 — 충돌 없음
- [x] **`GuildInfoController`에 `getCommands` 메서드 추가 시 기존 `getChannels`, `getRoles`, `getEmojis` 메서드와 라우트 충돌이 없는가**: 신규 라우트 `@Get('commands')`는 기존 `channels`, `roles`, `emojis` 라우트와 경로가 다르므로 충돌 없음

---

# Sticky Message 도메인 — 공통 모듈 판단 문서

## 목적

Sticky Message 도메인 구현에 필요한 공통 모듈을 식별하고 설계 방향을 확정한다.
이 문서에 정의된 모듈은 모든 개발 단위 작업보다 선행하여 완성되어야 하며, 이후 단위 작업들이 conflict 없이 병렬로 진행될 수 있도록 공통 인터페이스와 파일 경로를 명시한다.

---

## 1. 기존 모듈 중 Sticky Message 도메인에서 재사용 가능한 것

### 1-1. 재사용 (수정 없음)

| 모듈 | 파일 | 재사용 이유 |
|------|------|-------------|
| `RedisService` | `apps/api/src/redis/redis.service.ts` | `get`, `set`, `del`, `exists` 등 sticky-message Redis 키 패턴에 필요한 기능이 구현되어 있음. 디바운스 TTL 리셋은 `set(key, value, ttl)` 호출로 처리 가능 |
| `RedisModule` | `apps/api/src/redis/redis.module.ts` | `@Global()` 모듈이므로 `StickyMessageModule`에서 별도 import 없이 `RedisService` 주입 가능 |
| `JwtAuthGuard` | `apps/api/src/auth/jwt-auth.guard.ts` | 웹 대시보드 설정 API 엔드포인트 보호 |
| `StickyMessageConfig` entity | `apps/api/src/sticky-message/domain/sticky-message-config.entity.ts` | 이미 생성 완료. TypeORM 인덱스 포함 |
| Next.js 프록시 라우트 | `apps/web/app/api/guilds/[...path]/route.ts` | catch-all 패턴(`[...path]`)으로 `/api/guilds/:guildId/sticky-message` 및 `/api/guilds/:guildId/sticky-message/:id` 요청을 이미 백엔드로 프록시함 — 수정 불필요 |
| `fetchGuildTextChannels` | `apps/web/app/lib/discord-api.ts` | 텍스트 채널 선택 드롭다운에 채널 목록 제공. 수정 불필요 |
| `fetchGuildEmojis` | `apps/web/app/lib/discord-api.ts` | 길드 이모지 피커에 이모지 목록 제공. 수정 불필요 |
| `GuildEmojiPicker` | `apps/web/app/components/GuildEmojiPicker.tsx` | Embed 설명 커서 위치에 이모지 삽입 — status-prefix, auto-channel 설정 페이지와 동일하게 재사용 |
| `useSettings` hook | `apps/web/app/settings/SettingsContext.tsx` | `selectedGuildId` 조회에 사용. 수정 불필요 |

### 1-2. 재사용하되 수정이 필요한 것

| 모듈 | 파일 | 필요한 수정 내용 |
|------|------|-----------------|
| `AppModule` | `apps/api/src/app.module.ts` | `StickyMessageModule`을 imports 목록에 추가 |
| `DiscordEventsModule` | `apps/api/src/event/discord-events.module.ts` | `StickyMessageModule` import 추가. `StickyMessageGateway`(`messageCreate` 핸들러)가 `DiscordModule.forFeature()` 컨텍스트 안에서 동작하도록 모듈 연결 |
| `SettingsSidebar` | `apps/web/app/components/SettingsSidebar.tsx` | `menuItems` 배열에 고정메세지 설정 메뉴 항목 추가: `{ href: '/settings/guild/[guildId]/sticky-message', label: '고정메세지', icon: Pin }` |

---

## 2. 새로 만들어야 할 모듈/서비스/핸들러 목록

### 2-1. Sticky Message Redis 키 정의

**파일**: `apps/api/src/sticky-message/infrastructure/sticky-message-cache.keys.ts`

PRD에 정의된 Redis 키 패턴을 중앙화한다. 모든 단위가 이 파일의 키 생성 함수를 참조한다.

```typescript
export const StickyMessageKeys = {
  /**
   * 설정 캐시: sticky_message:config:{guildId}
   * TTL 1시간 (설정 저장/삭제 시 명시적 갱신 또는 무효화)
   */
  config: (guildId: string) => `sticky_message:config:${guildId}`,

  /**
   * 디바운스 타이머: sticky_message:debounce:{channelId}
   * TTL 3초 (새 메시지 수신마다 TTL 리셋)
   */
  debounce: (channelId: string) => `sticky_message:debounce:${channelId}`,
} as const;
```

### 2-2. Sticky Message Redis 저장소

**파일**: `apps/api/src/sticky-message/infrastructure/sticky-message-redis.repository.ts`

Sticky Message 도메인 관련 Redis CRUD를 한 곳에서 관리한다. `StatusPrefixRedisRepository`와 동일한 패턴으로 설계한다.

TTL 상수:
- `CONFIG`: 3,600초 (1시간)
- `DEBOUNCE`: 3초

메서드 목록:

| 메서드 | 설명 | Redis 명령 |
|--------|------|-----------|
| `getConfig(guildId)` | 설정 캐시 조회 (StickyMessageConfig[] JSON) | `GET` |
| `setConfig(guildId, configs)` | 설정 캐시 저장 (TTL 1시간) | `SET EX 3600` |
| `deleteConfig(guildId)` | 설정 캐시 무효화 | `DEL` |
| `setDebounce(channelId)` | 디바운스 타이머 설정 또는 TTL 리셋 (TTL 3초) | `SET EX 3` |
| `existsDebounce(channelId)` | 디바운스 타이머 존재 여부 확인 | `EXISTS` |
| `deleteDebounce(channelId)` | 디바운스 타이머 삭제 (재전송 완료 후) | `DEL` |

### 2-3. Sticky Message DB 저장소

**파일**: `apps/api/src/sticky-message/infrastructure/sticky-message-config.repository.ts`

TypeORM Repository 래퍼. `StickyMessageConfig` 엔티티에 대한 DB CRUD를 캡슐화한다.

메서드 목록:

| 메서드 | 설명 |
|--------|------|
| `findByGuildId(guildId)` | guildId로 전체 설정 목록 조회 (sortOrder 오름차순) |
| `findByGuildAndChannel(guildId, channelId)` | guildId + channelId로 채널 내 enabled 설정 목록 조회 (sortOrder 오름차순) |
| `findById(id)` | id로 단건 조회 (삭제 시 messageId, channelId 확인용) |
| `save(config)` | 설정 저장 (신규 insert 또는 기존 update — id 기준) |
| `updateMessageId(id, messageId)` | Discord 메시지 ID 갱신 (전송 후 호출) |
| `delete(id)` | id로 단건 삭제 |
| `deleteByGuildAndChannel(guildId, channelId)` | guildId + channelId로 해당 채널의 모든 설정 삭제 (슬래시 커맨드 /고정메세지삭제 시 사용) |

### 2-4. Sticky Message 설정 서비스

**파일**: `apps/api/src/sticky-message/application/sticky-message-config.service.ts`

설정 조회/저장/삭제 및 Discord Embed 메시지 즉시 전송 로직을 담당한다.

메서드 목록:

| 메서드 | 설명 |
|--------|------|
| `getConfigs(guildId)` | Redis 캐시 우선 조회, 미스 시 DB 조회 후 캐시 저장 |
| `saveConfig(guildId, dto)` | DB upsert → Redis 캐시 갱신 → enabled 시 Discord 채널에 Embed 즉시 전송 |
| `deleteConfig(guildId, id)` | Discord 메시지 삭제 → DB 삭제 → Redis 캐시 무효화 |

### 2-5. Sticky Message 재전송 서비스

**파일**: `apps/api/src/sticky-message/application/sticky-message-refresh.service.ts`

디바운스 만료 후 채널의 고정메세지를 삭제하고 재전송하는 로직을 담당한다. `StickyMessageGateway`에서 호출한다.

메서드 목록:

| 메서드 | 설명 |
|--------|------|
| `refresh(guildId, channelId)` | 채널의 enabled 설정을 sortOrder 순으로 조회 → 각 설정에 대해 기존 messageId 삭제 → Embed 재전송 → DB messageId 갱신 |

### 2-6. Sticky Message Gateway (messageCreate 이벤트 핸들러)

**파일**: `apps/api/src/sticky-message/gateway/sticky-message.gateway.ts`

Discord.js `messageCreate` 이벤트 리스너. `@On('messageCreate')`로 수신한다.
디바운스 로직을 포함하며, 만료 후 `StickyMessageRefreshService.refresh()`를 호출한다.

```typescript
@On('messageCreate')
async handleMessageCreate(message: Message): Promise<void>
```

처리 순서:
1. `message.author.bot === true` 이면 처리 중단
2. `sticky_message:config:{guildId}` Redis 캐시 조회 (미스 시 DB 조회 후 캐시 저장)
3. 해당 `channelId`에 `enabled = true` 설정이 없으면 처리 중단
4. `sticky_message:debounce:{channelId}` 키 TTL 리셋 (`SET EX 3`)
5. `setTimeout(3000)` 기반으로 3초 후 `StickyMessageRefreshService.refresh()` 호출

디바운스 구현 방식: `setTimeout`을 사용하며, 연속 메시지 수신 시 이전 타이머를 `clearTimeout`하고 새 타이머를 시작한다. 채널별 타이머 Map(`Map<channelId, NodeJS.Timeout>`)을 Gateway 내부 상태로 관리한다.

### 2-7. Sticky Message 슬래시 커맨드

**파일**: `apps/api/src/sticky-message/command/sticky-message.command.ts`

3개의 슬래시 커맨드를 하나의 파일에 정의하거나, 커맨드별로 분리한다. 분리 시 디렉토리 구조:

```
apps/api/src/sticky-message/command/
  sticky-message-register.command.ts   (F-STICKY-005: /고정메세지등록)
  sticky-message-list.command.ts       (F-STICKY-006: /고정메세지목록)
  sticky-message-delete.command.ts     (F-STICKY-007: /고정메세지삭제)
```

공통 사항:
- 권한: `MANAGE_GUILD` 또는 `ADMINISTRATOR` (인터랙션 핸들러에서 `interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)` 확인)
- 응답: 모두 Ephemeral

각 커맨드 동작:
- `/고정메세지등록`: Ephemeral 웹 설정 페이지 안내 메시지 반환
- `/고정메세지목록`: DB 조회 후 Ephemeral Embed 반환
- `/고정메세지삭제`: `채널` 파라미터(Channel 타입, 필수) 수신 → 해당 채널 설정 전체 삭제 → Ephemeral 결과 반환

### 2-8. Sticky Message 설정 컨트롤러 (웹 API)

**파일**: `apps/api/src/sticky-message/presentation/sticky-message.controller.ts`

경로: `GET/POST /api/guilds/:guildId/sticky-message`, `DELETE /api/guilds/:guildId/sticky-message/:id`

`JwtAuthGuard`로 인증을 보호한다.

엔드포인트 목록:

| 메서드 | 경로 | 설명 |
|--------|------|------|
| `GET` | `/api/guilds/:guildId/sticky-message` | 설정 목록 조회 (F-STICKY-001) |
| `POST` | `/api/guilds/:guildId/sticky-message` | 설정 저장/수정 및 Discord 메시지 즉시 전송 (F-STICKY-002) |
| `DELETE` | `/api/guilds/:guildId/sticky-message/:id` | 설정 삭제 및 Discord 메시지 제거 (F-STICKY-003) |

### 2-9. Sticky Message 설정 DTO

**파일**: `apps/api/src/sticky-message/dto/sticky-message-save.dto.ts`

웹 API `POST` 요청 바디 DTO.

```typescript
export class StickyMessageSaveDto {
  @IsOptional()
  @IsInt()
  id?: number | null;           // null이면 신규 생성, 양의 정수이면 수정

  @IsString()
  @IsNotEmpty()
  channelId: string;

  @IsOptional()
  @IsString()
  embedTitle?: string | null;

  @IsOptional()
  @IsString()
  embedDescription?: string | null;

  @IsOptional()
  @IsString()
  embedColor?: string | null;

  @IsBoolean()
  enabled: boolean;

  @IsInt()
  sortOrder: number;
}
```

### 2-10. Sticky Message 메인 NestJS 모듈

**파일**: `apps/api/src/sticky-message/sticky-message.module.ts`

Sticky Message 도메인 관련 모든 provider를 등록하고, 의존 모듈을 import한다.

```typescript
@Module({
  imports: [
    DiscordModule.forFeature(),
    TypeOrmModule.forFeature([StickyMessageConfig]),
    AuthModule,
  ],
  controllers: [StickyMessageController],
  providers: [
    StickyMessageConfigRepository,
    StickyMessageRedisRepository,
    StickyMessageConfigService,
    StickyMessageRefreshService,
    StickyMessageGateway,
    StickyMessageRegisterCommand,
    StickyMessageListCommand,
    StickyMessageDeleteCommand,
  ],
  exports: [
    StickyMessageConfigService,
  ],
})
export class StickyMessageModule {}
```

`RedisModule`은 `@Global()` 모듈이므로 import 불필요.

### 2-11. 웹 API 클라이언트 함수

**파일**: `apps/web/app/lib/sticky-message-api.ts`

`status-prefix-api.ts`와 동일한 패턴으로 설계한다.

```typescript
export interface StickyMessageConfig {
  id: number;
  channelId: string;
  channelName?: string;
  embedTitle: string | null;
  embedDescription: string | null;
  embedColor: string | null;
  messageId: string | null;
  enabled: boolean;
  sortOrder: number;
}

export interface StickyMessageSavePayload {
  id: number | null;
  channelId: string;
  embedTitle: string | null;
  embedDescription: string | null;
  embedColor: string | null;
  enabled: boolean;
  sortOrder: number;
}

export async function fetchStickyMessages(guildId: string): Promise<StickyMessageConfig[]>
export async function saveStickyMessage(guildId: string, payload: StickyMessageSavePayload): Promise<void>
export async function deleteStickyMessage(guildId: string, id: number): Promise<void>
```

### 2-12. 웹 설정 페이지

**파일**: `apps/web/app/settings/guild/[guildId]/sticky-message/page.tsx`

`status-prefix/page.tsx`와 동일한 설계 패턴(Client Component, `useSettings`, `fetchGuildTextChannels`, `fetchGuildEmojis`, `GuildEmojiPicker`)을 따른다.

페이지 구성:
- 초기 로드: `fetchStickyMessages(guildId)` + `fetchGuildTextChannels(guildId)` + `fetchGuildEmojis(guildId)` 병렬 호출
- 카드 목록 렌더링: 각 `StickyMessageConfig`를 카드로 표시
- 카드별 필드: 텍스트 채널 드롭다운, 활성화 토글, Embed 제목, Embed 설명(멀티라인 + GuildEmojiPicker), Embed 색상(color picker + HEX 입력), 실시간 미리보기(Discord 다크모드 스타일)
- 카드 추가 버튼: 저장되지 않은 신규 카드 추가 (id = null 임시 음수 키)
- 카드 삭제 버튼: 확인 모달 후 `deleteStickyMessage` 호출
- 카드별 저장 버튼: `saveStickyMessage` 호출, 성공 시 3초 인라인 성공 메시지, 실패 시 오류 토스트
- 채널 새로고침 버튼: `fetchGuildTextChannels(guildId, true)` + `fetchGuildEmojis(guildId, true)` 재호출

---

## 3. 수정이 필요한 기존 파일 목록 및 수정 내용

### 3-1. `AppModule` 수정

**파일**: `apps/api/src/app.module.ts`

`StickyMessageModule`을 imports 목록에 추가한다.

```typescript
// imports에 추가
StickyMessageModule,
```

### 3-2. `DiscordEventsModule` 수정

**파일**: `apps/api/src/event/discord-events.module.ts`

`StickyMessageModule` import 추가. `StickyMessageGateway`는 `StickyMessageModule` 내부 provider로 등록되므로, `DiscordEventsModule`은 `StickyMessageModule`을 import만 하면 된다.

```typescript
// imports에 추가
StickyMessageModule,
```

`StickyMessageGateway`가 `@On('messageCreate')` 데코레이터를 사용하려면 `DiscordModule.forFeature()`가 적용된 컨텍스트에서 동작해야 한다. `StickyMessageModule`에서 `DiscordModule.forFeature()`를 import하므로 별도 처리 불필요.

### 3-3. `SettingsSidebar` 수정

**파일**: `apps/web/app/components/SettingsSidebar.tsx`

`menuItems` 배열에 고정메세지 설정 메뉴 항목을 추가한다. 기존 status-prefix 항목 다음에 위치한다.

```typescript
// 기존 menuItems에 추가 (status-prefix 다음)
{ href: `sticky-message`, label: '고정메세지', icon: Pin }
```

Lucide React의 `Pin` 아이콘을 import하여 사용한다.

---

## 4. 구현 단위(Unit) 분류

이후 병렬 개발을 위해 다음 3개의 단위로 분리한다. 각 단위는 이 문서에서 정의된 공통 모듈 완성 후 병렬 진행 가능하다.

| 단위 | 기능 | 포함 서비스/파일 |
|------|------|-----------------|
| A | 백엔드 코어 모듈 | `sticky-message.module.ts`, 엔티티(이미 존재), 저장소 2종(config/redis), `sticky-message-cache.keys.ts`, `sticky-message-save.dto.ts`, `sticky-message.controller.ts`, `sticky-message-config.service.ts`, `sticky-message-refresh.service.ts`, `sticky-message.gateway.ts`, 슬래시 커맨드 3종, `AppModule`/`DiscordEventsModule` 수정 |
| B | Discord 슬래시 커맨드 구현 (F-STICKY-005~007) | 슬래시 커맨드 3종 내부 로직 구현 (파일은 단위 A에서 생성) |
| C | 웹 대시보드 (F-WEB-005) | `apps/web/app/lib/sticky-message-api.ts` (신규), `apps/web/app/settings/guild/[guildId]/sticky-message/page.tsx` (신규), `SettingsSidebar.tsx` 수정 |

단위 A에서 생성한 파일을 기반으로 단위 B와 C가 병렬 진행 가능하다.

---

## 5. 파일 경로 전체 목록 (충돌 방지용 사전 확정)

### 신규 생성

```
apps/api/src/sticky-message/
  sticky-message.module.ts                                          (2-10, 단위 A)
  application/
    sticky-message-config.service.ts                               (2-4, 단위 A)
    sticky-message-refresh.service.ts                              (2-5, 단위 A)
  gateway/
    sticky-message.gateway.ts                                      (2-6, 단위 A)
  command/
    sticky-message-register.command.ts                             (2-7, 단위 A/B)
    sticky-message-list.command.ts                                 (2-7, 단위 A/B)
    sticky-message-delete.command.ts                               (2-7, 단위 A/B)
  presentation/
    sticky-message.controller.ts                                   (2-8, 단위 A)
  infrastructure/
    sticky-message-cache.keys.ts                                   (2-1, 단위 A)
    sticky-message-redis.repository.ts                             (2-2, 단위 A)
    sticky-message-config.repository.ts                            (2-3, 단위 A)
  dto/
    sticky-message-save.dto.ts                                     (2-9, 단위 A)

apps/web/app/
  lib/
    sticky-message-api.ts                                          (2-11, 단위 C)
  settings/guild/[guildId]/
    sticky-message/
      page.tsx                                                     (2-12, 단위 C)
```

### 기존 수정

```
apps/api/src/app.module.ts                                         (3-1, 단위 A)
apps/api/src/event/discord-events.module.ts                        (3-2, 단위 A)
apps/web/app/components/SettingsSidebar.tsx                        (3-3, 단위 C)
```

### 이미 존재하는 파일 (수정 없음, 확인만)

```
apps/api/src/sticky-message/domain/sticky-message-config.entity.ts        (이미 생성됨)
apps/api/src/migrations/1773900000000-AddStickyMessage.ts                  (이미 생성됨)
```

---

## 6. Discord customId 네이밍 규칙

Sticky Message 슬래시 커맨드는 버튼 인터랙션을 사용하지 않는다. 슬래시 커맨드 파라미터(Channel 선택)만 사용하므로 customId 정의는 불필요하다.

기존 도메인의 customId 접두사와 충돌하지 않음을 확인한다:
- `auto_btn:`, `auto_sub:` — auto-channel
- `newbie_mission:`, `newbie_moco:` — newbie
- `status_prefix:`, `status_reset:` — status-prefix
- sticky-message: 버튼 없음 (충돌 없음)

---

## 7. 검증 체크리스트

이 문서가 "페이지 단위 병렬 개발 시 코드 conflict가 생길 공통 모듈을 모두 포함하는가"를 3회 확인한다.

### 1차 확인

- [x] **Redis 키 네이밍**: `StickyMessageKeys` (2-1)에서 중앙화 — 단위 A/B/C 모두 동일 키 패턴 참조. `config`, `debounce` 두 키가 PRD 정의와 일치
- [x] **Redis 저장소 인터페이스**: `StickyMessageRedisRepository` (2-2)에서 메서드 시그니처 사전 확정 — `getConfig`, `setConfig`, `deleteConfig`, `setDebounce`, `existsDebounce`, `deleteDebounce` 모두 명세됨
- [x] **DB 저장소 인터페이스**: `StickyMessageConfigRepository` (2-3)에서 메서드 사전 확정 — `findByGuildId`, `findByGuildAndChannel`, `findById`, `save`, `updateMessageId`, `delete`, `deleteByGuildAndChannel` 모두 명세됨
- [x] **DTO 구조**: `StickyMessageSaveDto` (2-9)에서 사전 확정 — 웹 API 요청 구조 단일화. `id: null`이면 신규, 양의 정수이면 수정
- [x] **모듈 등록**: `StickyMessageModule` (2-10)에서 providers/exports/imports 목록 사전 확정 — 단위 B가 의존하는 커맨드 파일, 단위 A에서 생성
- [x] **`AppModule` 수정**: 3-1에서 수정 내용 확정 — `StickyMessageModule` import 추가
- [x] **`DiscordEventsModule` 수정**: 3-2에서 수정 내용 확정 — `StickyMessageModule` import 추가
- [x] **`SettingsSidebar` 수정**: 3-3에서 수정 내용 확정 — 웹 사이드바 메뉴 항목 추가
- [x] **파일 경로 전체 목록**: 5절에서 사전 확정 — 단위 간 동일 파일 동시 생성 충돌 없음
- [x] **웹 API 클라이언트**: `sticky-message-api.ts` (2-11)에서 함수 및 타입 시그니처 사전 확정 — 단위 C의 페이지 파일이 이 함수에 의존
- [x] **Embed 미리보기 컴포넌트**: 별도 공통 컴포넌트로 추출하지 않고 `status-prefix/page.tsx`와 동일한 인라인 JSX 패턴을 `sticky-message/page.tsx`에서 독립 구현 — 두 도메인 간 컴포넌트 파일 공유 없음 (충돌 없음)
- [x] **GuildEmojiPicker 재사용**: `apps/web/app/components/GuildEmojiPicker.tsx`를 수정 없이 재사용 — 단위 C에서 import만 수행

### 2차 확인

- [x] **단위 A (백엔드 코어)** 가 생성하는 파일 목록: `sticky-message.module.ts`, `sticky-message-config.service.ts`, `sticky-message-refresh.service.ts`, `sticky-message.gateway.ts`, 슬래시 커맨드 3종, `sticky-message.controller.ts`, `sticky-message-cache.keys.ts`, `sticky-message-redis.repository.ts`, `sticky-message-config.repository.ts`, `sticky-message-save.dto.ts` — 이 모두 단위 B, C 착수 전에 완성되어야 함
- [x] **단위 A가 수정하는 기존 파일**: `apps/api/src/app.module.ts`, `apps/api/src/event/discord-events.module.ts` — 단위 B, C는 이 파일들을 수정하지 않음 (충돌 없음)
- [x] **단위 B (슬래시 커맨드)** 가 의존하는 공통 모듈: `StickyMessageKeys` (2-1), `StickyMessageRedisRepository` (2-2), `StickyMessageConfigRepository.findByGuildId/findByGuildAndChannel/deleteByGuildAndChannel` (2-3), `StickyMessageConfigService` (2-4), `StickyMessageModule` (2-10) — 모두 단위 A에서 생성, 이 문서에 포함됨
- [x] **단위 C (웹 대시보드)** 가 의존하는 공통 모듈: `StickyMessageSaveDto` (2-9), `StickyMessageController` API 엔드포인트 명세 (2-8), `sticky-message-api.ts` (2-11), `fetchGuildTextChannels` (재사용), `fetchGuildEmojis` (재사용), `GuildEmojiPicker` (재사용), `useSettings` hook (재사용), 수정된 `SettingsSidebar` (3-3) — 모두 이 문서에 포함됨
- [x] **단위 C가 수정하는 기존 파일**: `SettingsSidebar.tsx` 1개뿐 — 단위 A가 수정하는 백엔드 파일과 중복 없음
- [x] **`StickyMessageGateway`의 `messageCreate` 이벤트가 다른 Gateway와 충돌하지 않는가**: discord-nestjs는 동일 이벤트에 여러 핸들러 등록을 지원한다. `@On('messageCreate')` 핸들러가 여러 곳에 있어도 각각 독립적으로 호출된다. 기존 `VoiceStateDispatcher`의 `@On('voiceStateUpdate')`와 동일한 패턴이므로 충돌 없음

### 3차 확인

- [x] **단위 A~C 간에 동일 파일을 동시에 신규 생성하는 경우가 없는가**: 5절 파일 경로 목록 기준으로 신규 파일은 단위 A(백엔드 9개 파일)와 단위 C(웹 2개 파일)에 귀속되며, 동일 파일이 두 단위에 중복되지 않음. 슬래시 커맨드 3개 파일은 단위 A에서 골격을 생성하고 단위 B에서 내부 로직을 구현하므로 파일 자체는 단위 A에서 먼저 생성 — 충돌 없음
- [x] **단위 A~C 간에 동일 파일을 동시에 수정하는 경우가 없는가**: `app.module.ts`, `discord-events.module.ts`는 단위 A에서만 수정. `SettingsSidebar.tsx`는 단위 C에서만 수정. 단위 B는 기존 파일을 수정하지 않음 — 충돌 없음
- [x] **엔티티 파일이 이미 존재하므로 중복 생성하지 않는가**: `sticky-message-config.entity.ts`가 이미 `apps/api/src/sticky-message/domain/`에 존재함. 어느 단위에서도 재생성하지 않으며, `StickyMessageModule.TypeOrmModule.forFeature([StickyMessageConfig])`에 등록만 수행
- [x] **마이그레이션 파일이 필요한가**: `apps/api/src/migrations/1773900000000-AddStickyMessage.ts`가 이미 존재한다. 단위 A에서 마이그레이션 파일 신규 생성 불필요. 5절 "이미 존재하는 파일" 목록에 포함.
- [x] **`DiscordEventsModule`에 `StickyMessageModule` import 추가 시 순환 의존이 생기지 않는가**: `StickyMessageModule`은 voice 도메인, newbie 도메인, status-prefix 도메인에 의존하지 않는다. `DiscordEventsModule` → `StickyMessageModule` 방향 단방향 의존이므로 순환 의존 없음
- [x] **디바운스 구현(채널별 타이머 Map)이 Gateway 인스턴스 수명과 일치하는가**: NestJS 싱글턴 provider이므로 Gateway 인스턴스가 애플리케이션 수명 동안 유지된다. `Map<string, NodeJS.Timeout>` 채널별 타이머 상태가 인스턴스에 안전하게 유지됨. 단위 A 설계 시 이 점을 반영하여 Gateway를 싱글턴 provider로 등록

---

# 음성 시간 제외 채널 (Voice Excluded Channel) — 공통 모듈 판단 문서

## 목적

음성 시간 제외 채널 기능(F-VOICE-013~016, F-WEB-006) 구현에 필요한 공통 모듈을 식별하고 설계 방향을 확정한다.
이 문서에 정의된 모듈은 모든 개발 단위 작업보다 선행하여 완성되어야 하며, 이후 단위 작업들이 conflict 없이 병렬로 진행될 수 있도록 공통 인터페이스와 파일 경로를 명시한다.

---

## VEC-1. 기존 모듈 중 재사용 가능한 것

### VEC-1-1. 재사용 (수정 없음)

| 모듈 | 파일 | 재사용 이유 |
|------|------|-------------|
| `RedisService` | `apps/api/src/redis/redis.service.ts` | `get`, `set`, `del` 메서드로 `voice:excluded:{guildId}` 키 CRUD 가능 |
| `JwtAuthGuard` | `apps/api/src/auth/jwt-auth.guard.ts` | 제외 채널 REST API 엔드포인트 인증 보호 |
| `VoiceExcludedChannel` 엔티티 | `apps/api/src/channel/voice/domain/voice-excluded-channel.entity.ts` | 이미 생성됨. `id`, `guildId`, `discordChannelId`, `type(CHANNEL/CATEGORY)`, `createdAt`, `updatedAt` |
| `VoiceExcludedChannelType` enum | `apps/api/src/channel/voice/domain/voice-excluded-channel.entity.ts` | `CHANNEL`, `CATEGORY` 값 정의됨 |
| 마이그레이션 파일 | `apps/api/src/migrations/1774100000000-AddVoiceExcludedChannel.ts` | 이미 생성됨. `up`/`down` 완비 |
| `fetchGuildChannels` | `apps/web/app/lib/discord-api.ts` | 음성 채널 및 카테고리 목록 조회에 재사용. `type=2(GUILD_VOICE)`, `type=4(GUILD_CATEGORY)` 필터링 |
| `DiscordChannel` 인터페이스 | `apps/web/app/lib/discord-api.ts` | `id`, `name`, `type` 필드 포함. 프론트엔드 채널 표현에 그대로 사용 |
| `useSettings` hook | `apps/web/app/settings/SettingsContext.tsx` | `selectedGuildId` 획득 |

### VEC-1-2. 재사용하되 수정이 필요한 것

| 모듈 | 파일 | 필요한 수정 내용 |
|------|------|-----------------|
| `VoiceStateDispatcher` | `apps/api/src/event/voice/voice-state.dispatcher.ts` | `isJoin`, `isLeave`, `isMove` 세 분기 진입 직전에 `VoiceExcludedChannelService.isExcluded(guildId, channelId)` 호출 결과로 필터링. F-VOICE-016 이동 이벤트 세부 규칙(A 제외+B 일반 → B 입장만, A 일반+B 제외 → A 퇴장만, 둘 다 제외 → 전체 무시)을 이 파일에서 처리 |
| `VoiceChannelModule` | `apps/api/src/channel/voice/voice-channel.module.ts` | `VoiceExcludedChannelRepository`, `VoiceExcludedChannelService`를 providers에 추가. `VoiceExcludedChannelService`를 exports에 추가 (Dispatcher가 사용하기 위함) |
| `SettingsSidebar` | `apps/web/app/components/SettingsSidebar.tsx` | "음성 설정" 메뉴 항목 추가. `Mic` 또는 `Volume2` 아이콘 사용. href: `/settings/guild/${selectedGuildId}/voice` |

---

## VEC-2. 새로 만들어야 할 모듈/서비스/핸들러 목록

### VEC-2-1. Redis 캐시 키 정의 — `VoiceKeys` 확장

**파일**: `apps/api/src/channel/voice/infrastructure/voice-cache.keys.ts` (기존 파일 수정)

기존 `VoiceKeys` 객체에 제외 채널 캐시 키를 추가한다.

```typescript
// 기존 VoiceKeys에 추가
excludedChannels: (guildId: string) => `voice:excluded:${guildId}`,
```

TTL: 3,600초 (1시간). PRD F-VOICE-016 캐시 미스 시 DB 조회 후 재저장 패턴에 사용.

### VEC-2-2. VoiceExcludedChannel Repository

**파일**: `apps/api/src/channel/voice/infrastructure/voice-excluded-channel.repository.ts`

TypeORM Repository 래퍼. `VoiceExcludedChannel` 엔티티에 대한 DB CRUD를 캡슐화한다.

메서드 목록:

| 메서드 | 설명 |
|--------|------|
| `findByGuildId(guildId: string): Promise<VoiceExcludedChannel[]>` | guildId 기준 전체 조회. F-VOICE-013, F-VOICE-016 캐시 미스 시 사용 |
| `create(guildId: string, discordChannelId: string, type: VoiceExcludedChannelType): Promise<VoiceExcludedChannel>` | 제외 채널 레코드 생성. F-VOICE-014 |
| `deleteById(id: number, guildId: string): Promise<void>` | id + guildId 일치 검증 후 삭제. F-VOICE-015 |
| `existsByGuildAndChannel(guildId: string, discordChannelId: string): Promise<boolean>` | 중복 등록 검증. F-VOICE-014의 409 응답 판단에 사용 |

### VEC-2-3. VoiceExcludedChannelService

**파일**: `apps/api/src/channel/voice/application/voice-excluded-channel.service.ts`

비즈니스 로직 + Redis 캐시 관리를 담당한다.

메서드 목록:

| 메서드 | 설명 |
|--------|------|
| `getExcludedChannels(guildId: string): Promise<VoiceExcludedChannel[]>` | F-VOICE-013. Redis 캐시 우선 조회 → 미스 시 DB 조회 후 캐시 저장 (TTL 1시간) |
| `addExcludedChannel(guildId: string, discordChannelId: string, type: VoiceExcludedChannelType): Promise<VoiceExcludedChannel>` | F-VOICE-014. 중복 검증(409) → DB 생성 → Redis 캐시 무효화 |
| `removeExcludedChannel(guildId: string, id: number): Promise<void>` | F-VOICE-015. DB 삭제(404 포함) → Redis 캐시 무효화 |
| `replaceExcludedChannels(guildId: string, entries: Array<{discordChannelId: string, type: VoiceExcludedChannelType}>): Promise<void>` | F-WEB-006 저장 동작(전체 교체). 기존 전체 삭제 후 신규 목록 일괄 insert → Redis 캐시 무효화 |
| `isExcluded(guildId: string, discordChannelId: string, parentCategoryId: string \| null): Promise<boolean>` | F-VOICE-016 필터링 판단. Redis 캐시 조회 → `CHANNEL` 타입은 직접 일치, `CATEGORY` 타입은 `parentCategoryId` 일치 확인 |

캐시 무효화는 `redis.del(VoiceKeys.excludedChannels(guildId))` 호출.

### VEC-2-4. VoiceExcludedChannel Controller

**파일**: `apps/api/src/channel/voice/presentation/voice-excluded-channel.controller.ts`

경로: `@Controller('api/guilds/:guildId/voice/excluded-channels')`, `@UseGuards(JwtAuthGuard)`

엔드포인트 목록:

| 메서드 | 경로 | 설명 | 응답 |
|--------|------|------|------|
| `GET` | `/api/guilds/:guildId/voice/excluded-channels` | 제외 채널 목록 조회 (F-VOICE-013). `getExcludedChannels` 호출 | `{ excludedChannelIds: string[] }` |
| `POST` | `/api/guilds/:guildId/voice/excluded-channels` | 제외 채널 목록 저장 - 전체 교체 (F-WEB-006). `replaceExcludedChannels` 호출 | `{ ok: boolean }` |

참고: 웹 PRD(F-WEB-006)는 단건 추가/삭제 대신 전체 교체(replace) 방식을 사용한다. 개별 추가/삭제 엔드포인트(F-VOICE-014/015)는 나중에 필요 시 추가.

### VEC-2-5. 웹 API 클라이언트

**파일**: `apps/web/app/lib/voice-api.ts`

웹 페이지에서 사용할 API 호출 함수 및 타입 정의.

```typescript
/** GET /api/guilds/{guildId}/voice/excluded-channels 응답 형식 */
export interface VoiceExcludedChannelsResponse {
  excludedChannelIds: string[];
}

/** POST /api/guilds/{guildId}/voice/excluded-channels 요청 바디 */
export interface VoiceExcludedChannelsSaveDto {
  excludedChannelIds: string[];
}

/**
 * 제외 채널 목록 조회 (F-VOICE-013).
 * 실패 시 빈 배열 반환.
 */
export async function fetchVoiceExcludedChannels(
  guildId: string,
): Promise<string[]>

/**
 * 제외 채널 목록 저장 — 전체 교체 방식 (F-WEB-006).
 * 실패 시 Error throw.
 */
export async function saveVoiceExcludedChannels(
  guildId: string,
  excludedChannelIds: string[],
): Promise<void>
```

---

## VEC-3. 수정이 필요한 기존 파일 목록 및 수정 내용

### VEC-3-1. `VoiceKeys` 확장

**파일**: `apps/api/src/channel/voice/infrastructure/voice-cache.keys.ts`

기존 `VoiceKeys` 객체에 다음 항목을 추가한다.

```typescript
excludedChannels: (guildId: string) => `voice:excluded:${guildId}`,
```

### VEC-3-2. `VoiceChannelModule` 수정

**파일**: `apps/api/src/channel/voice/voice-channel.module.ts`

- `TypeOrmModule.forFeature([..., VoiceExcludedChannel])` 에 `VoiceExcludedChannel` 엔티티 추가
- providers에 `VoiceExcludedChannelRepository`, `VoiceExcludedChannelService`, `VoiceExcludedChannelController` 추가
- exports에 `VoiceExcludedChannelService` 추가 (`VoiceStateDispatcher`가 이를 사용하기 위함)

### VEC-3-3. `VoiceStateDispatcher` 수정

**파일**: `apps/api/src/event/voice/voice-state.dispatcher.ts`

F-VOICE-016에 따라 세 분기(`isJoin`, `isLeave`, `isMove`) 진입 전에 제외 채널 필터링 로직을 추가한다.
기존 NEWBIE, AUTO_CHANNEL 이벤트 발행 로직은 변경 없음 (append-only 수정).

수정 개요:
- constructor에 `VoiceExcludedChannelService` 주입 추가
- `isJoin` 분기: `newState.channelId`가 제외 채널이면 해당 분기 전체 건너뜀
- `isLeave` 분기: `oldState.channelId`가 제외 채널이면 해당 분기 전체 건너뜀
- `isMove` 분기: 이동 이벤트 세부 규칙 적용
  - oldChannelId 제외 + newChannelId 일반 → `isMove` 이벤트를 `isJoin`으로 대체 처리
  - oldChannelId 일반 + newChannelId 제외 → `isMove` 이벤트를 `isLeave`로 대체 처리
  - 둘 다 제외 → 해당 분기 전체 건너뜀

`isExcluded` 호출 시 `parentCategoryId`는 `state.channel?.parentId ?? null`로 전달.

### VEC-3-4. `SettingsSidebar` 수정

**파일**: `apps/web/app/components/SettingsSidebar.tsx`

`menuItems` 배열에 음성 설정 항목을 추가한다.

```typescript
{ href: `/settings/guild/${selectedGuildId}/voice`, label: "음성 설정", icon: Mic },
```

`Mic` 아이콘을 lucide-react에서 import 추가.

---

## VEC-4. 신규 페이지 파일 — 단위 작업에서 생성

다음 파일은 이 공통 모듈 작업 완료 후 단위 개발에서 생성한다. 충돌 방지를 위해 경로만 사전 확정한다.

| 파일 경로 | 생성 단위 | 설명 |
|-----------|-----------|------|
| `apps/web/app/settings/guild/[guildId]/voice/page.tsx` | 웹 페이지 단위 | 음성 설정 페이지 (F-WEB-006) |

---

## VEC-5. 전체 파일 경로 목록

### 이미 존재하는 파일 (수정 대상)

| 파일 경로 | 수정 내용 |
|-----------|-----------|
| `apps/api/src/channel/voice/domain/voice-excluded-channel.entity.ts` | 수정 없음, 재사용 |
| `apps/api/src/migrations/1774100000000-AddVoiceExcludedChannel.ts` | 수정 없음, 재사용 |
| `apps/api/src/channel/voice/infrastructure/voice-cache.keys.ts` | `excludedChannels` 키 추가 |
| `apps/api/src/channel/voice/voice-channel.module.ts` | 엔티티/provider/exports 추가 |
| `apps/api/src/event/voice/voice-state.dispatcher.ts` | 제외 채널 필터링 로직 추가 |
| `apps/web/app/components/SettingsSidebar.tsx` | "음성 설정" 메뉴 항목 추가 |

### 새로 만드는 파일

| 파일 경로 | 소속 단위 |
|-----------|-----------|
| `apps/api/src/channel/voice/infrastructure/voice-excluded-channel.repository.ts` | 백엔드 공통 |
| `apps/api/src/channel/voice/application/voice-excluded-channel.service.ts` | 백엔드 공통 |
| `apps/api/src/channel/voice/presentation/voice-excluded-channel.controller.ts` | 백엔드 공통 |
| `apps/web/app/lib/voice-api.ts` | 웹 공통 |
| `apps/web/app/settings/guild/[guildId]/voice/page.tsx` | 웹 페이지 단위 (후행) |

---

## VEC-6. 검증 체크리스트

이 문서가 "페이지 단위 병렬 개발 시 코드 conflict가 생길 공통 모듈을 모두 포함하는가"를 3회 확인한다.

### 1차 확인

- [x] **Redis 캐시 키**: `VoiceKeys.excludedChannels(guildId)` (VEC-2-1)에서 중앙화. 백엔드 Service와 Dispatcher 모두 이 키를 참조하며 동일 패턴 사용
- [x] **Repository 인터페이스**: `VoiceExcludedChannelRepository` (VEC-2-2)에서 메서드 시그니처 사전 확정. Service와 Controller가 이 인터페이스에 의존
- [x] **Service 인터페이스**: `VoiceExcludedChannelService` (VEC-2-3)에서 메서드 시그니처 사전 확정. Controller(VEC-2-4)와 Dispatcher 수정(VEC-3-3)이 이 Service에 의존
- [x] **Controller API 명세**: `VoiceExcludedChannelController` (VEC-2-4)에서 엔드포인트 경로, HTTP 메서드, 요청/응답 형식 사전 확정. 웹 `voice-api.ts`가 이 명세에 의존
- [x] **웹 API 클라이언트**: `voice-api.ts` (VEC-2-5)에서 함수 및 타입 시그니처 사전 확정. 웹 페이지(`voice/page.tsx`)가 이 함수에 의존
- [x] **모듈 등록**: `VoiceChannelModule` 수정 (VEC-3-2)에서 `VoiceExcludedChannelService` exports 확정. `VoiceStateDispatcher`가 이를 주입받기 위해 필요
- [x] **`SettingsSidebar` 수정**: VEC-3-4에서 수정 내용 확정. 웹 페이지 단위 개발과 동시에 이 파일을 건드리면 충돌 발생하므로 공통 작업에서 선행 수정
- [x] **전체 교체(replace) 방식 통일**: F-WEB-006은 개별 추가/삭제 대신 `excludedChannelIds` 배열을 전체 교체하는 방식. `replaceExcludedChannels` 메서드(VEC-2-3)와 `POST` 엔드포인트(VEC-2-4)가 이 방식을 구현

### 2차 확인

- [x] **백엔드 공통 단위가 생성하는 파일 목록**: `voice-excluded-channel.repository.ts`, `voice-excluded-channel.service.ts`, `voice-excluded-channel.controller.ts` (VEC-5). 웹 페이지 단위 착수 전에 완성되어야 함
- [x] **백엔드 공통 단위가 수정하는 기존 파일**: `voice-cache.keys.ts`, `voice-channel.module.ts`, `voice-state.dispatcher.ts`. 웹 페이지 단위는 이 파일들을 수정하지 않음 (충돌 없음)
- [x] **웹 공통 단위가 생성하는 파일**: `voice-api.ts`. 웹 페이지 단위에서 import하므로 선행 생성 필요
- [x] **웹 공통 단위가 수정하는 기존 파일**: `SettingsSidebar.tsx`. 웹 페이지 단위는 이 파일을 수정하지 않음 (충돌 없음)
- [x] **웹 페이지 단위가 생성하는 파일**: `voice/page.tsx`. 백엔드 및 웹 공통 단위와 중복 없음
- [x] **`AppModule` 수정 불필요 여부**: `VoiceExcludedChannel`은 기존 `VoiceChannelModule` 내부에서 등록되며, `AppModule`은 이미 `VoiceChannelModule`을 import하고 있음. `AppModule` 수정 불필요
- [x] **`DiscordEventsModule` 수정 불필요 여부**: `VoiceExcludedChannelService`는 `VoiceChannelModule`이 export하며, `DiscordEventsModule`은 이미 `VoiceChannelModule`을 import하고 있음. `DiscordEventsModule` 수정 불필요

### 3차 확인

- [x] **모든 단위 간 동일 파일 동시 신규 생성 충돌이 없는가**: VEC-5 파일 경로 목록 기준으로 각 파일이 하나의 단위에만 귀속됨. `voice/page.tsx`는 웹 페이지 단위, 나머지 3개 백엔드 파일과 `voice-api.ts`는 공통 단위에서 생성 — 중복 없음
- [x] **동일 파일 동시 수정 충돌이 없는가**: `voice-cache.keys.ts`, `voice-channel.module.ts`, `voice-state.dispatcher.ts`는 백엔드 공통 단위에서만 수정. `SettingsSidebar.tsx`는 웹 공통 단위에서만 수정. 웹 페이지 단위는 기존 파일을 수정하지 않음 — 충돌 없음
- [x] **엔티티 및 마이그레이션 파일이 이미 존재함을 반영하였는가**: `voice-excluded-channel.entity.ts`와 `1774100000000-AddVoiceExcludedChannel.ts`는 VEC-5 "이미 존재하는 파일" 목록에 포함. 어느 단위에서도 재생성하지 않음
- [x] **`VoiceStateDispatcher`에 `VoiceExcludedChannelService` 주입 시 순환 의존이 생기지 않는가**: `VoiceExcludedChannelService`는 `RedisService`와 `VoiceExcludedChannelRepository`에만 의존한다. `DiscordEventsModule` → `VoiceChannelModule`(export `VoiceExcludedChannelService`) 방향이며, 기존 의존 구조와 동일하게 단방향 — 순환 없음
- [x] **전체 교체(replace) 방식이 F-VOICE-013/014/015 개별 엔드포인트와 혼재하지 않는가**: 웹 PRD(F-WEB-006)는 `POST` 1개로 전체 교체 방식을 사용한다. `replaceExcludedChannels`는 내부적으로 기존 전체 삭제 후 신규 insert로 구현한다. F-VOICE-014/015 개별 단건 API는 필요 시 추후 추가하는 것으로 이번 구현 범위에서 제외 — 현재 WebUI 요구사항 충족에 충분
