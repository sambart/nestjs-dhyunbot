# G-voice-excluded-channel-backend 구현 계획

## 1. 개요

음성 시간 제외 채널(Voice Time Excluded Channels) 기능의 백엔드 구현 계획이다.
프론트엔드는 이 계획의 범위에 포함되지 않는다.

### 구현 대상 기능

| 기능 ID | 설명 |
|---------|------|
| F-VOICE-013 | 제외 채널 설정 조회 — GET /api/guilds/:guildId/voice/excluded-channels |
| F-VOICE-014 | 제외 채널 등록 — POST /api/guilds/:guildId/voice/excluded-channels |
| F-VOICE-015 | 제외 채널 삭제 — DELETE /api/guilds/:guildId/voice/excluded-channels/:id |
| F-VOICE-016 | 음성 이벤트 처리 시 제외 채널 필터링 (VoiceStateDispatcher 수정) |

---

## 2. 기존 코드베이스 확인

### 이미 존재하는 파일 (수정/재생성 불필요)

| 파일 | 상태 |
|------|------|
| `apps/api/src/channel/voice/domain/voice-excluded-channel.entity.ts` | 완성. `VoiceExcludedChannelType` enum(CHANNEL/CATEGORY), `@Unique('UQ_voice_excluded_channel_guild_discord', ['guildId', 'discordChannelId'])` 포함 |
| `apps/api/src/migrations/1774100000000-AddVoiceExcludedChannel.ts` | 완성. `voice_excluded_channel` 테이블 + unique constraint 생성 |

### 수정이 필요한 기존 파일

| 파일 | 수정 내용 |
|------|-----------|
| `apps/api/src/channel/voice/infrastructure/voice-cache.keys.ts` | `excludedChannels` 키 함수 추가 |
| `apps/api/src/channel/voice/voice-channel.module.ts` | `VoiceExcludedChannel` 엔티티, `VoiceExcludedChannelRepository`, `VoiceExcludedChannelService`, `VoiceExcludedChannelController` 등록 |
| `apps/api/src/event/voice/voice-state.dispatcher.ts` | 제외 채널 필터링 로직 주입 및 이벤트 발행 분기 추가 |

### 의존하는 기존 공통 모듈 (수정 없음)

| 모듈 | 사용 이유 |
|------|-----------|
| `RedisService` (`apps/api/src/redis/redis.service.ts`) | `@Global()` 모듈. `get`, `set`, `del` 메서드 사용. `VoiceChannelModule`에 별도 import 불필요 |
| `JwtAuthGuard` (`apps/api/src/auth/jwt-auth.guard.ts`) | Controller 엔드포인트 보호. `AuthModule` import 또는 직접 참조 |
| `VoiceStateDto` (`apps/api/src/channel/voice/infrastructure/voice-state.dto.ts`) | 이미 `parentCategoryId: string \| null` 필드를 포함함. 수정 불필요 |

---

## 3. 구현할 파일 목록 및 순서

```
apps/api/src/channel/voice/
  infrastructure/
    voice-cache.keys.ts                           (Step 1 — 기존 파일 수정)
    voice-excluded-channel.repository.ts          (Step 2 — 신규)
  dto/
    voice-excluded-channel-save.dto.ts            (Step 3 — 신규)
  application/
    voice-excluded-channel.service.ts             (Step 4 — 신규)
  presentation/
    voice-excluded-channel.controller.ts          (Step 5 — 신규)
  voice-channel.module.ts                         (Step 6 — 기존 파일 수정)

apps/api/src/event/voice/
  voice-state.dispatcher.ts                       (Step 7 — 기존 파일 수정)
```

---

## 4. 각 파일 상세 구현 계획

### Step 1: `voice-cache.keys.ts` 수정

**파일**: `apps/api/src/channel/voice/infrastructure/voice-cache.keys.ts`

기존 `VoiceKeys` 객체에 `excludedChannels` 키 함수를 추가한다.

```typescript
export const VoiceKeys = {
  // ...기존 키들 유지...

  /** 제외 채널 목록 캐시: voice:excluded:{guildId} — TTL 1시간 */
  excludedChannels: (guildId: string) => `voice:excluded:${guildId}`,
};
```

- PRD 및 DB 스키마에 정의된 키 패턴 `voice:excluded:{guildId}`와 정확히 일치해야 한다.
- 기존 키 함수(`session`, `channelDuration`, `micDuration`, `aloneDuration`, `channelName`, `userName`)는 그대로 유지한다.

---

### Step 2: `voice-excluded-channel.repository.ts` (신규)

**파일**: `apps/api/src/channel/voice/infrastructure/voice-excluded-channel.repository.ts`

**참조 패턴**: `apps/api/src/sticky-message/infrastructure/sticky-message-config.repository.ts`

**의존성 주입**:
- `@InjectRepository(VoiceExcludedChannel)` → `Repository<VoiceExcludedChannel>`

**메서드 목록**:

| 메서드 | 쿼리 | 설명 |
|--------|------|------|
| `findByGuildId(guildId: string): Promise<VoiceExcludedChannel[]>` | `WHERE guildId = ?` | 길드의 제외 채널 전체 조회. 캐시 미스 워밍업용 |
| `create(guildId: string, discordChannelId: string, type: VoiceExcludedChannelType): Promise<VoiceExcludedChannel>` | `INSERT` | 신규 레코드 생성. unique constraint 위반 시 DB 에러가 상위로 전파됨 — 서비스 레이어에서 409 변환 |
| `findByIdAndGuildId(id: number, guildId: string): Promise<VoiceExcludedChannel \| null>` | `WHERE id = ? AND guildId = ?` | 삭제 전 소유권 검증용 단건 조회 |
| `delete(id: number): Promise<void>` | `DELETE WHERE id = ?` | 단건 삭제 |

**구현 세부**:
- `create`는 `configRepo.create({...}).save()` 패턴 대신 `this.repo.save(this.repo.create({...}))` 패턴 사용.
- `findByIdAndGuildId`에서 `guildId`를 함께 검증하는 이유: 타 길드의 레코드를 삭제하는 권한 초과 요청 방지.

---

### Step 3: `voice-excluded-channel-save.dto.ts` (신규)

**파일**: `apps/api/src/channel/voice/dto/voice-excluded-channel-save.dto.ts`

**참조 패턴**: `apps/api/src/sticky-message/dto/sticky-message-save.dto.ts`

```typescript
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { VoiceExcludedChannelType } from '../domain/voice-excluded-channel.entity';

export class VoiceExcludedChannelSaveDto {
  @IsString()
  @IsNotEmpty()
  channelId: string;

  @IsEnum(VoiceExcludedChannelType)
  type: VoiceExcludedChannelType;
}
```

- PRD F-VOICE-014 요청 바디: `{ "channelId": "...", "type": "CHANNEL" | "CATEGORY" }` 와 일치.
- `class-validator` 데코레이터는 전역 `ValidationPipe`가 이미 설정되어 있으므로 별도 파이프 설정 불필요.

---

### Step 4: `voice-excluded-channel.service.ts` (신규)

**파일**: `apps/api/src/channel/voice/application/voice-excluded-channel.service.ts`

**참조 패턴**: `apps/api/src/sticky-message/application/sticky-message-config.service.ts`

**의존성 주입**:
- `VoiceExcludedChannelRepository`
- `RedisService` (글로벌 모듈, 직접 주입)

**TTL 상수** (파일 상단):
```typescript
const TTL = {
  /** 제외 채널 캐시: 1시간 */
  EXCLUDED: 60 * 60,
} as const;
```

**메서드 목록**:

#### `getExcludedChannels(guildId: string): Promise<VoiceExcludedChannel[]>`

```
1. redis.get<VoiceExcludedChannel[]>(VoiceKeys.excludedChannels(guildId)) 조회
2. 캐시 히트: 반환
3. 캐시 미스: repository.findByGuildId(guildId) 조회
4. 결과가 있으면 redis.set(VoiceKeys.excludedChannels(guildId), items, TTL.EXCLUDED) 저장
5. 반환 (빈 배열 포함)
```

#### `saveExcludedChannel(guildId: string, dto: VoiceExcludedChannelSaveDto): Promise<VoiceExcludedChannel>`

```
1. repository.create(guildId, dto.channelId, dto.type)
   - unique constraint(guildId + discordChannelId) 위반 시 TypeORM이 던지는
     QueryFailedError의 code가 '23505'(PostgreSQL unique violation)이면
     ConflictException('이미 등록된 채널입니다') 으로 변환하여 throw
2. 캐시 무효화: redis.del(VoiceKeys.excludedChannels(guildId))
3. 생성된 엔티티 반환
```

**QueryFailedError 처리**:
```typescript
import { QueryFailedError } from 'typeorm';
// ...
try {
  const item = await this.repository.create(guildId, dto.channelId, dto.type);
  await this.redis.del(VoiceKeys.excludedChannels(guildId));
  return item;
} catch (err) {
  if (err instanceof QueryFailedError && (err as any).code === '23505') {
    throw new ConflictException('이미 등록된 채널입니다');
  }
  throw err;
}
```

#### `deleteExcludedChannel(guildId: string, id: number): Promise<void>`

```
1. repository.findByIdAndGuildId(id, guildId)
   - null이면 NotFoundException('제외 채널을 찾을 수 없습니다') throw
2. repository.delete(id)
3. 캐시 무효화: redis.del(VoiceKeys.excludedChannels(guildId))
```

#### `isExcludedChannel(guildId: string, channelId: string, parentCategoryId: string | null): Promise<boolean>`

이 메서드는 VoiceStateDispatcher에서 이벤트 필터링 시 사용한다.

```
1. Redis 캐시 조회: redis.get<VoiceExcludedChannel[]>(VoiceKeys.excludedChannels(guildId))
2. 캐시 미스:
   a. repository.findByGuildId(guildId) 조회
   b. redis.set(VoiceKeys.excludedChannels(guildId), items, TTL.EXCLUDED) 저장
3. items 순회:
   a. item.type === CHANNEL && item.discordChannelId === channelId → true 반환
   b. item.type === CATEGORY && parentCategoryId !== null && item.discordChannelId === parentCategoryId → true 반환
4. 모두 불일치 → false 반환
```

**설계 결정**: `isExcludedChannel`은 캐시된 배열을 메모리에서 순회한다. 제외 채널 수가 적으므로(길드당 수십 개 이하) DB 인덱스 조회 없이 캐시 배열 순회로 충분하다. `parentCategoryId`는 `VoiceStateDto.parentCategoryId`에서 직접 가져오므로 Discord API 추가 호출이 불필요하다.

---

### Step 5: `voice-excluded-channel.controller.ts` (신규)

**파일**: `apps/api/src/channel/voice/presentation/voice-excluded-channel.controller.ts`

**참조 패턴**: `apps/api/src/sticky-message/presentation/sticky-message.controller.ts`

```typescript
@Controller('api/guilds/:guildId/voice/excluded-channels')
@UseGuards(JwtAuthGuard)
export class VoiceExcludedChannelController {
  constructor(
    private readonly excludedChannelService: VoiceExcludedChannelService,
  ) {}

  /**
   * GET /api/guilds/:guildId/voice/excluded-channels
   * 제외 채널 목록 조회 (F-VOICE-013).
   */
  @Get()
  async getExcludedChannels(
    @Param('guildId') guildId: string,
  ): Promise<VoiceExcludedChannel[]>

  /**
   * POST /api/guilds/:guildId/voice/excluded-channels
   * 제외 채널 등록 (F-VOICE-014).
   * 201 Created 반환.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async saveExcludedChannel(
    @Param('guildId') guildId: string,
    @Body() dto: VoiceExcludedChannelSaveDto,
  ): Promise<VoiceExcludedChannel>

  /**
   * DELETE /api/guilds/:guildId/voice/excluded-channels/:id
   * 제외 채널 삭제 (F-VOICE-015).
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async deleteExcludedChannel(
    @Param('guildId') guildId: string,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ ok: boolean }>
}
```

**응답 형식**:
- `GET`: `VoiceExcludedChannel[]` — PRD F-VOICE-013 형식과 일치 (`id`, `channelId`(=`discordChannelId`), `type`)
- `POST`: 생성된 `VoiceExcludedChannel` 엔티티 (201)
- `DELETE`: `{ ok: true }` (200)

**예외 처리**: 서비스 레이어에서 throw한 `ConflictException`(409), `NotFoundException`(404)은 NestJS의 기본 Exception Filter가 처리하므로 컨트롤러에서 추가 처리 불필요.

**주의**: PRD F-VOICE-013 응답의 `channelId` 필드는 엔티티 컬럼명 `discordChannelId`와 다르다. 컨트롤러에서 DTO 변환 없이 엔티티를 그대로 반환할 경우 `discordChannelId`로 노출된다. 프론트엔드와 합의가 필요하나, 일관성을 위해 엔티티 그대로 반환(`discordChannelId`)하고 PRD의 `channelId`는 설계상 alias로 해석한다.

---

### Step 6: `voice-channel.module.ts` 수정

**파일**: `apps/api/src/channel/voice/voice-channel.module.ts`

**추가 내용**:
- `TypeOrmModule.forFeature([...])` 배열에 `VoiceExcludedChannel` 추가
- `providers` 배열에 `VoiceExcludedChannelRepository`, `VoiceExcludedChannelService` 추가
- `controllers` 배열 추가 (현재 없음): `[VoiceExcludedChannelController]`
- `exports` 배열에 `VoiceExcludedChannelService` 추가 — `DiscordEventsModule`의 `VoiceStateDispatcher`가 이 서비스를 주입받기 위해 필요

**수정 후 구조**:
```typescript
@Module({
  imports: [
    DiscordModule.forFeature(),
    TypeOrmModule.forFeature([
      VoiceChannelHistory,
      VoiceDailyEntity,
      VoiceExcludedChannel,   // 추가
    ]),
    MemberModule,
    ChannelModule,
  ],
  controllers: [
    VoiceExcludedChannelController,   // 추가
  ],
  providers: [
    // ...기존 providers...
    VoiceExcludedChannelRepository,   // 추가
    VoiceExcludedChannelService,      // 추가
  ],
  exports: [
    VoiceChannelService,
    VoiceSessionService,
    VoiceDailyFlushService,
    VoiceRedisRepository,
    DiscordVoiceGateway,
    TypeOrmModule,
    VoiceExcludedChannelService,      // 추가
  ],
})
export class VoiceChannelModule {}
```

**충돌 확인**: `DiscordEventsModule`은 이미 `VoiceChannelModule`을 import한다. `VoiceExcludedChannelService`를 exports에 추가하면 `VoiceStateDispatcher`가 주입받을 수 있다. 순환 의존 없음.

---

### Step 7: `voice-state.dispatcher.ts` 수정

**파일**: `apps/api/src/event/voice/voice-state.dispatcher.ts`

**변경 범위**: `VoiceExcludedChannelService` 주입 추가 및 `dispatch` 메서드 내 필터링 로직 추가.

**의존성 주입 추가**:
```typescript
constructor(
  private readonly eventEmitter: EventEmitter2,
  private readonly excludedChannelService: VoiceExcludedChannelService,   // 추가
) {}
```

**필터링 헬퍼 (private 메서드)**:
```typescript
private async isExcluded(
  guildId: string,
  channelId: string | null,
  parentCategoryId: string | null,
): Promise<boolean> {
  if (!channelId) return false;
  return this.excludedChannelService.isExcludedChannel(guildId, channelId, parentCategoryId);
}
```

**`dispatch` 메서드 수정 계획**:

이벤트 분기별 처리 규칙 (PRD F-VOICE-016):

##### isJoin 분기

```typescript
if (isJoin) {
  // parentCategoryId는 VoiceStateDto.fromVoiceState(newState)에서 얻을 수 있으나,
  // DTO 생성 전에 필터링하기 위해 newState.channel.parentId를 직접 사용
  const excluded = await this.isExcluded(
    newState.guild.id,
    newState.channelId,
    newState.channel?.parentId ?? null,
  );
  if (excluded) {
    // 입장 처리 생략 — 단, NEWBIE_EVENTS와 ALONE_CHANGED는 여전히 발행
    // (제외 채널은 세션 추적만 제외. NEWBIE/ALONE은 별도 판단)
    // 아래 참고: NEWBIE_EVENTS는 제외 채널에도 발행한다(모코코 사냥은 별도 도메인)
    return; // 또는 goto-style로 NEWBIE_EVENTS/ALONE_CHANGED 부분만 실행
  }
  // 기존 join 처리 유지
  const dto = VoiceStateDto.fromVoiceState(newState);
  await this.eventEmitter.emitAsync(VOICE_EVENTS.JOIN, new VoiceJoinEvent(dto));
  this.emitAloneChanged(newState);
  // NEWBIE_EVENTS 발행 (기존 유지)
  ...
}
```

**중요 설계 결정 — NEWBIE_EVENTS 처리**:

PRD F-VOICE-016은 "VoiceChannelHistory 미생성, VoiceDailyEntity 미누적, Redis 세션 미생성"을 보장하면 된다. `VOICE_EVENTS.JOIN/LEAVE/MOVE` 이벤트 발행을 막으면 이 조건이 충족된다. `NEWBIE_EVENTS.VOICE_STATE_CHANGED`와 `VOICE_EVENTS.ALONE_CHANGED`는 음성 세션 추적과 무관한 별도 이벤트이므로 제외 채널이더라도 계속 발행한다.

단, `VOICE_EVENTS.JOIN/LEAVE/MOVE` 발행 전 제외 여부 확인이 핵심이므로, 기존 코드 구조를 다음과 같이 재배치한다:

**수정 후 `dispatch` 메서드 구조 (전체 흐름)**:

```
isMove 분기:
  oldExcluded = await isExcluded(guildId, oldState.channelId, oldState.channel?.parentId)
  newExcluded = await isExcluded(guildId, newState.channelId, newState.channel?.parentId)

  경우 A: 둘 다 제외 → VOICE_EVENTS.MOVE 발행 안 함
  경우 B: old만 제외 → VOICE_EVENTS.JOIN(newState)만 발행 (leave 생략)
  경우 C: new만 제외 → VOICE_EVENTS.LEAVE(oldState)만 발행 (join 생략)
  경우 D: 둘 다 일반 → VOICE_EVENTS.MOVE 발행 (기존 동작)

  모든 경우: emitAloneChanged(oldState), emitAloneChanged(newState) 발행
  모든 경우: AUTO_CHANNEL_EVENTS.CHANNEL_EMPTY 처리 (기존 유지)
  모든 경우: NEWBIE_EVENTS.VOICE_STATE_CHANGED 발행 (기존 유지)

isJoin 분기:
  excluded = await isExcluded(guildId, newState.channelId, newState.channel?.parentId)
  excluded → VOICE_EVENTS.JOIN 발행 안 함 (emitAloneChanged, NEWBIE_EVENTS는 그대로 발행)
  일반 → 기존 동작 유지

isLeave 분기:
  excluded = await isExcluded(guildId, oldState.channelId, oldState.channel?.parentId)
  excluded → VOICE_EVENTS.LEAVE 발행 안 함 (emitAloneChanged, AUTO_CHANNEL_EVENTS, NEWBIE_EVENTS는 그대로 발행)
  일반 → 기존 동작 유지

isMuteChanged 분기: 제외 채널 필터링 없음 (MIC_TOGGLE은 세션이 없으면 핸들러에서 무시됨)
```

**isMove 경우 B/C 처리를 위한 분리 발행**:

경우 B (old만 제외, new는 일반): B채널 입장만 처리.
```typescript
const newDto = VoiceStateDto.fromVoiceState(newState);
await this.eventEmitter.emitAsync(VOICE_EVENTS.JOIN, new VoiceJoinEvent(newDto));
```

경우 C (old는 일반, new만 제외): A채널 퇴장만 처리.
```typescript
const oldDto = VoiceStateDto.fromVoiceState(oldState);
await this.eventEmitter.emitAsync(VOICE_EVENTS.LEAVE, new VoiceLeaveEvent(oldDto));
```

**`VoiceStateDto.fromVoiceState` 호출 위치 주의**: 이 함수는 `state.channelId`가 null이면 예외를 던진다. `isMove` 분기에서는 `oldState.channelId`와 `newState.channelId` 둘 다 반드시 존재하므로 안전하다. `isJoin`에서는 `newState`만, `isLeave`에서는 `oldState`만 사용한다.

---

## 5. 충돌 검증

### 기존 코드와의 충돌 확인

| 항목 | 판단 |
|------|------|
| `VoiceKeys` 기존 키와의 충돌 | 기존 키 패턴: `voice:session:`, `voice:duration:`, `voice:channel:name:`, `voice:user:name:`. 추가하는 `voice:excluded:` 패턴과 중복 없음 |
| `VoiceChannelModule` controllers 배열 | 현재 `controllers` 배열 자체가 없음. 새로 추가하는 것이므로 충돌 없음 |
| `VoiceChannelModule` TypeOrmModule 엔티티 | `[VoiceChannelHistory, VoiceDailyEntity]` 에 `VoiceExcludedChannel` 추가. 충돌 없음 |
| `VoiceStateDispatcher` constructor 변경 | 기존 `constructor(private readonly eventEmitter: EventEmitter2)`. `VoiceExcludedChannelService` 추가. `DiscordEventsModule`이 이미 `VoiceChannelModule`을 import하고 `VoiceExcludedChannelService`가 exports에 있으므로 주입 가능. 충돌 없음 |
| `GET /api/guilds/:guildId/voice/excluded-channels` 라우트 | 기존 등록된 voice 관련 HTTP 엔드포인트 없음(음성 기능은 Discord 이벤트 기반). 충돌 없음 |
| 마이그레이션 | `1774100000000-AddVoiceExcludedChannel.ts` 이미 존재. 신규 마이그레이션 불필요 |
| `VoiceExcludedChannel` 엔티티의 컬럼명 | `discordChannelId` (PRD의 `channelId`와 다름). 리포지토리/서비스/컨트롤러 전체에서 `discordChannelId`를 사용하여 일관성 유지. 프론트엔드에서는 `discordChannelId` 키로 수신 |
| `QueryFailedError` import | `typeorm` 패키지에서 직접 import. 기존 코드에서 사용 여부 무관하게 충돌 없음 |
| `isMove` 분기의 `VOICE_EVENTS.MOVE` 대신 `JOIN`/`LEAVE` 발행 | `VoiceMoveHandler`는 `VOICE_EVENTS.MOVE`를 리스닝. B/C 경우에는 이를 발행하지 않고 `JOIN` 또는 `LEAVE`만 발행. `VoiceJoinHandler`, `VoiceLeaveHandler`가 각각 처리하므로 기존 핸들러와 충돌 없음 |

### DRY 준수 확인

| 항목 | 판단 |
|------|------|
| Redis 키 | `VoiceKeys.excludedChannels`로 중앙화. `VoiceExcludedChannelService`와 `voice-cache.keys.ts`만 참조 |
| Redis 연산 | 서비스 레이어에서 `RedisService` 직접 사용. 제외 채널 전용 Redis 연산이 `get`/`set`/`del` 3개뿐이므로 별도 `VoiceExcludedRedisRepository`를 만들지 않고 서비스에서 직접 처리. `VoiceRedisRepository`는 세션/이름 캐시 전용이므로 제외 채널 키를 추가하지 않는다 |
| DB 연산 | `VoiceExcludedChannelRepository`로 캡슐화. 서비스에서 직접 TypeORM Repository 접근 없음 |
| 제외 여부 확인 | `isExcludedChannel` 메서드는 `VoiceExcludedChannelService` 한 곳에만 위치. `VoiceStateDispatcher`의 private `isExcluded` 헬퍼는 단순 null 가드 래퍼이며 실제 로직은 서비스에 위임 |

---

## 6. 단계별 개발 순서

의존 관계를 고려한 구현 순서:

```
Step 1: voice-cache.keys.ts 수정         (의존성 없음)
Step 2: voice-excluded-channel.repository.ts  (엔티티 의존 — 이미 존재)
Step 3: voice-excluded-channel-save.dto.ts    (enum 의존 — 이미 존재)
Step 4: voice-excluded-channel.service.ts     (Step 1, 2, 3 의존)
Step 5: voice-excluded-channel.controller.ts  (Step 3, 4 의존)
Step 6: voice-channel.module.ts 수정          (Step 2, 4, 5 의존)
Step 7: voice-state.dispatcher.ts 수정        (Step 4, 6 의존)
```

Step 1~3은 의존성이 없어 병렬 작성 가능하다. Step 4~5는 Step 1~3 완료 후 병렬 가능. Step 6~7은 순서대로 진행한다.

---

## 7. 주요 설계 결정 사항

| 결정 | 이유 |
|------|------|
| Redis 캐시 무효화: POST/DELETE 시 `del` | 변경 발생 시 전체 삭제 후 다음 조회 시 DB 재로드. `StickyMessageConfigService.deleteConfig` 패턴과 동일 |
| POST 후 캐시 재저장 안 함 | `saveExcludedChannel`에서 `del`만 수행. 다음 `isExcludedChannel` 또는 `getExcludedChannels` 호출 시 DB에서 캐시가 워밍업됨. 불필요한 DB 재조회를 즉시 실행하지 않음 |
| 별도 `VoiceExcludedRedisRepository` 미생성 | Redis 연산이 `get`/`set`/`del` 3개로 단순. 서비스에서 직접 처리하여 파일 수를 줄임. `StickyMessageConfigService` 패턴(redisRepo 분리)과 다르나, 제외 채널은 별도 Redis 리포지토리를 정당화할 만큼 Redis 연산이 많지 않음 |
| `isExcludedChannel`에서 parentCategoryId를 파라미터로 받음 | Discord API 추가 호출 없이 `VoiceStateDto.parentCategoryId`(이미 `VoiceState.channel.parentId`에서 추출됨)를 재사용. 단, Dispatcher에서는 DTO 생성 전이므로 `state.channel?.parentId` 직접 접근 |
| `isMove` B/C 경우에서 `VOICE_EVENTS.MOVE` 대신 `JOIN`/`LEAVE` 발행 | PRD F-VOICE-016 명시 규칙. 이동 이벤트를 두 개의 독립 이벤트로 분해하면 기존 `VoiceJoinHandler`/`VoiceLeaveHandler`를 수정 없이 재사용 가능 |
| MIC_TOGGLE 분기는 제외 채널 필터링 없음 | MIC_TOGGLE 핸들러(`MicToggleHandler`)는 내부적으로 세션이 없으면 무시하도록 구현되어 있다고 가정. 또한 PRD F-VOICE-016은 세션 생성/누적 방지를 목표로 하며, 마이크 토글 자체는 제외 채널에서 세션이 없으면 자동으로 무해함 |
| `discordChannelId` 컬럼명 유지 | 기존 엔티티 설계를 변경하지 않음. 프론트엔드와 API 계약에서 `discordChannelId` 키를 사용하는 것으로 통일 |
