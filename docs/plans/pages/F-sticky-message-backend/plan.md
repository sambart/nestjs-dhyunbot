# F-sticky-message-backend 구현 계획

## 1. 개요

`sticky-message` 도메인 백엔드 NestJS 모듈 구현 계획이다.
슬래시 커맨드와 프론트엔드는 이 계획의 범위에 포함되지 않는다.

### 구현 대상 기능

| 기능 ID | 설명 |
|---------|------|
| F-STICKY-001 | 설정 목록 조회 — GET /api/guilds/:guildId/sticky-message |
| F-STICKY-002 | 설정 저장/수정 — POST /api/guilds/:guildId/sticky-message |
| F-STICKY-003 | 설정 삭제 — DELETE /api/guilds/:guildId/sticky-message/:id |
| F-STICKY-004 | messageCreate 감지 및 디바운스 재전송 |

---

## 2. 기존 코드베이스 확인

### 이미 존재하는 파일 (수정/재생성 불필요)

| 파일 | 상태 |
|------|------|
| `apps/api/src/sticky-message/domain/sticky-message-config.entity.ts` | 완성. `@Index` 2개(IDX_sticky_message_guild, IDX_sticky_message_guild_channel_sort) 포함 |
| `apps/api/src/migrations/1773900000000-AddStickyMessage.ts` | 완성. `sticky_message_config` 테이블 + 인덱스 2개 생성 |

### 수정이 필요한 기존 파일

| 파일 | 수정 내용 |
|------|-----------|
| `apps/api/src/app.module.ts` | `StickyMessageModule` import 추가 |
| `apps/api/src/event/discord-events.module.ts` | `StickyMessageModule` import 추가 |

### 의존하는 기존 공통 모듈 (수정 없음)

| 모듈 | 사용 이유 |
|------|-----------|
| `RedisService` (`apps/api/src/redis/redis.service.ts`) | `@Global()` 모듈. `get`, `set`, `del`, `exists` 메서드 사용. `StickyMessageModule`에 별도 import 불필요 |
| `JwtAuthGuard` (`apps/api/src/auth/jwt-auth.guard.ts`) | Controller 엔드포인트 보호. `AuthModule` import로 사용 |
| `REDIS_CLIENT` (`apps/api/src/redis/redis.constants.ts`) | `setDebounce`에서 직접 ioredis 클라이언트 사용 필요 없음 — `RedisService.set(key, value, ttl)`으로 충분 |

---

## 3. 구현할 파일 목록 및 순서

```
apps/api/src/sticky-message/
  infrastructure/
    sticky-message-cache.keys.ts          (Step 1)
    sticky-message-redis.repository.ts    (Step 2)
    sticky-message-config.repository.ts   (Step 3)
  dto/
    sticky-message-save.dto.ts            (Step 4)
  application/
    sticky-message-config.service.ts      (Step 5)
    sticky-message-refresh.service.ts     (Step 6)
  gateway/
    sticky-message.gateway.ts             (Step 7)
  presentation/
    sticky-message.controller.ts          (Step 8)
  sticky-message.module.ts               (Step 9)
```

기존 파일 수정:
```
apps/api/src/app.module.ts               (Step 10)
apps/api/src/event/discord-events.module.ts (Step 11)
```

---

## 4. 각 파일 상세 구현 계획

### Step 1: `sticky-message-cache.keys.ts`

**참조 패턴**: `apps/api/src/status-prefix/infrastructure/status-prefix-cache.keys.ts`

```typescript
export const StickyMessageKeys = {
  config: (guildId: string) => `sticky_message:config:${guildId}`,
  debounce: (channelId: string) => `sticky_message:debounce:${channelId}`,
} as const;
```

- 키 패턴은 DB 스키마 문서(`sticky_message:config:{guildId}`, `sticky_message:debounce:{channelId}`)와 일치해야 한다.
- `as const`로 타입을 좁힌다.

---

### Step 2: `sticky-message-redis.repository.ts`

**참조 패턴**: `apps/api/src/status-prefix/infrastructure/status-prefix-redis.repository.ts`

**의존성 주입**:
- `RedisService` (글로벌 모듈, 자동 주입)

**TTL 상수**:
```typescript
const TTL = {
  CONFIG: 60 * 60,   // 1시간
  DEBOUNCE: 3,       // 3초
} as const;
```

**메서드 목록**:

| 메서드 | Redis 명령 | 설명 |
|--------|-----------|------|
| `getConfig(guildId)` | `GET` | `StickyMessageConfig[] \| null` 반환 (JSON 역직렬화) |
| `setConfig(guildId, configs)` | `SET EX 3600` | `StickyMessageConfig[]` 직렬화하여 저장 |
| `deleteConfig(guildId)` | `DEL` | 설정 캐시 무효화 |
| `setDebounce(channelId)` | `SET EX 3` | 디바운스 타이머 설정 또는 TTL 리셋. 값은 `'1'` (더미) |
| `deleteDebounce(channelId)` | `DEL` | 디바운스 타이머 삭제 (재전송 완료 후) |

**주의**: `setDebounce`는 `RedisService.set(key, 1, TTL.DEBOUNCE)`로 구현한다. 키 존재 여부 확인(`existsDebounce`)은 Gateway의 `Map<channelId, NodeJS.Timeout>` 타이머 관리 방식에서 불필요하므로 제외한다. (공통 모듈 문서에는 `existsDebounce`가 명시되어 있으나, 디바운스를 `setTimeout`+`clearTimeout` 방식으로 구현하면 Redis 키 존재 확인이 불필요해진다. 단, Redis `setDebounce`는 재시작 후 키 만료로 인한 좀비 타이머 방지용으로 유지한다.)

실제로는 Gateway에서 `setDebounce`를 호출하여 Redis에 키를 남기고, 재시작 시 Redis 키 만료가 타이머 상태 진실의 근원이 된다. Gateway `Map`은 단순히 `clearTimeout` 참조용이다.

---

### Step 3: `sticky-message-config.repository.ts`

**참조 패턴**: `apps/api/src/status-prefix/infrastructure/status-prefix-config.repository.ts`

**의존성 주입**:
- `@InjectRepository(StickyMessageConfig)` → `Repository<StickyMessageConfig>`
- `DataSource` (트랜잭션 불필요 — 단순 CRUD이므로 생략 가능)

`StickyMessageConfig`는 연관 엔티티가 없으므로 `DataSource` 주입 없이 단순 `Repository<StickyMessageConfig>`만 사용한다.

**메서드 목록**:

| 메서드 | 쿼리 | 설명 |
|--------|------|------|
| `findByGuildId(guildId)` | `WHERE guildId = ? ORDER BY sortOrder ASC` | 길드 전체 설정 목록 (캐시 미스 워밍업, 슬래시 커맨드용) |
| `findByGuildAndChannel(guildId, channelId)` | `WHERE guildId = ? AND channelId = ? AND enabled = true ORDER BY sortOrder ASC` | 채널별 활성 설정 목록 (디바운스 만료 후 재전송용) |
| `findById(id)` | `WHERE id = ?` | 단건 조회 (삭제 시 messageId, channelId 확인) |
| `save(config)` | `INSERT` 또는 `UPDATE` | `id` 없으면 신규 생성, 있으면 갱신. `configRepo.save(entity)` 사용 |
| `updateMessageId(id, messageId)` | `UPDATE SET messageId WHERE id = ?` | Discord 메시지 ID 갱신 |
| `delete(id)` | `DELETE WHERE id = ?` | 단건 삭제 |
| `deleteByGuildAndChannel(guildId, channelId)` | `DELETE WHERE guildId = ? AND channelId = ?` | 채널 내 전체 설정 삭제 (슬래시 커맨드 /고정메세지삭제) |

**`save` 구현 세부**:
- DTO의 `id`가 `null` 또는 `undefined`이면 `configRepo.create({...fields})`로 새 엔티티를 생성한 뒤 `save` 한다.
- `id`가 양의 정수이면 `configRepo.findOne({ where: { id } })`로 조회 후 필드를 갱신하고 `save` 한다. 존재하지 않으면 `NotFoundException`을 던진다.
- `messageId`는 `save`에서 건드리지 않는다 (`updateMessageId`만으로 변경).

---

### Step 4: `sticky-message-save.dto.ts`

**참조 패턴**: `apps/api/src/status-prefix/presentation/status-prefix-config-save.dto.ts`

```typescript
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class StickyMessageSaveDto {
  @IsOptional()
  @IsInt()
  id?: number | null;

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

**배치 위치**: `apps/api/src/sticky-message/dto/sticky-message-save.dto.ts`

공통 모듈 문서에는 `dto/` 하위가 아닌 `dto/`로 명시되어 있다. 기존 `status-prefix`의 DTO는 `presentation/` 하위에 있으나, 이 도메인은 별도 `dto/` 디렉토리를 사용한다. (공통 모듈 문서 §2-9 파일 경로 준수)

---

### Step 5: `sticky-message-config.service.ts`

**참조 패턴**: `apps/api/src/status-prefix/application/status-prefix-config.service.ts`

**의존성 주입**:
- `StickyMessageConfigRepository`
- `StickyMessageRedisRepository`
- `@InjectDiscordClient() Client`

**메서드 목록**:

#### `getConfigs(guildId: string): Promise<StickyMessageConfig[]>`

```
1. redisRepo.getConfig(guildId) 조회
2. 캐시 히트: 반환
3. 캐시 미스: configRepo.findByGuildId(guildId) 조회
4. 결과 있으면 redisRepo.setConfig(guildId, configs) 저장
5. 반환 (빈 배열 포함)
```

#### `saveConfig(guildId: string, dto: StickyMessageSaveDto): Promise<StickyMessageConfig>`

```
1. configRepo.save(guildId, dto) — id 기준 upsert
2. redisRepo.setConfig(guildId, 전체 목록) — 캐시 갱신
   - 갱신 시 findByGuildId(guildId)를 다시 조회하여 최신 목록으로 캐시 저장
3. enabled = true이면:
   a. 기존 messageId 존재 시: Discord API로 메시지 삭제 시도 (실패 시 warn 로그 후 계속)
   b. Discord API로 Embed 메시지 신규 전송
   c. configRepo.updateMessageId(config.id, newMessageId)
4. 저장된 config 반환
```

**Discord Embed 전송 로직** (private `sendEmbed` 메서드):
- `client.channels.fetch(channelId)` → TextChannel 확인
- `EmbedBuilder` 생성: title, description, color 적용
- `(channel as TextChannel).send({ embeds: [embed] })` → messageId 반환
- 채널 없거나 텍스트 채널이 아닌 경우: `Error` throw → 컨트롤러까지 전파하여 400/500 반환

**기존 메시지 삭제 로직** (private `tryDeleteMessage` 메서드):
- `client.channels.fetch(channelId)` → TextChannel 확인
- `channel.messages.fetch(messageId)` → `message.delete()`
- 실패 시: `warn` 로그만 남기고 조용히 무시

#### `deleteConfig(guildId: string, id: number): Promise<void>`

```
1. configRepo.findById(id) — messageId, channelId 확인
2. messageId 존재 시: tryDeleteMessage(channelId, messageId) 호출 (실패 시 계속)
3. configRepo.delete(id)
4. redisRepo.deleteConfig(guildId)
```

---

### Step 6: `sticky-message-refresh.service.ts`

**의존성 주입**:
- `StickyMessageConfigRepository`
- `@InjectDiscordClient() Client`

**메서드**:

#### `refresh(guildId: string, channelId: string): Promise<void>`

```
1. configRepo.findByGuildAndChannel(guildId, channelId)
   → enabled=true, sortOrder ASC 목록
2. 목록이 비어 있으면 반환
3. 각 config에 대해 (sortOrder 순):
   a. messageId 존재 시: Discord API 메시지 삭제 시도 (실패 시 warn 로그 후 계속)
   b. Discord API에 Embed 메시지 신규 전송 → newMessageId 획득
   c. configRepo.updateMessageId(config.id, newMessageId)
   d. 전송 실패 시: error 로그 후 해당 config 건너뜀
```

**Discord 전송 로직**: `StickyMessageConfigService`의 private 메서드와 동일하나, 서비스 간 직접 의존을 피하기 위해 `RefreshService`에서 `Client`를 직접 주입받아 독립 구현한다. (DRY 원칙 관점에서 공통 Discord 유틸리티를 별도 gateway 파일로 추출할 수도 있으나, 공통 모듈 문서에 `sticky-message-discord.gateway.ts`가 명시되어 있지 않으므로 각 서비스에서 직접 구현한다. 단, private 헬퍼 메서드로 로직을 최소화한다.)

**Logger**: `new Logger(StickyMessageRefreshService.name)`

---

### Step 7: `sticky-message.gateway.ts`

**참조 패턴**: `apps/api/src/newbie/newbie.gateway.ts` (`@On` 데코레이터 패턴)

**의존성 주입**:
- `StickyMessageRedisRepository`
- `StickyMessageConfigRepository`
- `StickyMessageRefreshService`

**내부 상태**:
```typescript
private readonly timers = new Map<string, NodeJS.Timeout>();
```
채널별 디바운스 타이머를 추적한다. NestJS 싱글턴 provider이므로 애플리케이션 수명 동안 안전하게 유지된다.

**`handleMessageCreate(message: Message): Promise<void>`**

```typescript
@On('messageCreate')
async handleMessageCreate(message: Message): Promise<void>
```

처리 순서:
```
1. message.author.bot === true → return (봇 메시지 무시)
2. guildId = message.guildId, channelId = message.channelId 획득
   guildId가 null이면 → return (DM 메시지 무시)
3. Redis 설정 캐시 조회:
   - redisRepo.getConfig(guildId)
   - 캐시 미스: configRepo.findByGuildId(guildId) 조회 후 redisRepo.setConfig(guildId, configs)
4. configs에서 channelId 일치하고 enabled=true인 항목 필터링
5. 해당 채널 설정 없음 → return
6. 기존 타이머 존재 시 clearTimeout(timers.get(channelId))
7. redisRepo.setDebounce(channelId) — Redis에 디바운스 키 설정/리셋 (TTL 3초)
8. setTimeout(async () => {
     this.timers.delete(channelId);
     try {
       await this.refreshService.refresh(guildId, channelId);
     } catch (err) {
       this.logger.error(`[messageCreate] refresh failed: guild=${guildId} channel=${channelId}`, err.stack);
     }
   }, 3000)
9. timers.set(channelId, timer)
```

**오류 처리**: 전체 핸들러를 try-catch로 감싸 비정상 종료 방지.

---

### Step 8: `sticky-message.controller.ts`

**참조 패턴**: `apps/api/src/status-prefix/presentation/status-prefix.controller.ts`

```typescript
@Controller('api/guilds/:guildId/sticky-message')
@UseGuards(JwtAuthGuard)
export class StickyMessageController {
  constructor(private readonly configService: StickyMessageConfigService) {}

  @Get()
  async getConfigs(@Param('guildId') guildId: string): Promise<StickyMessageConfig[]>

  @Post()
  @HttpCode(HttpStatus.OK)
  async saveConfig(
    @Param('guildId') guildId: string,
    @Body() dto: StickyMessageSaveDto,
  ): Promise<{ ok: boolean }>

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async deleteConfig(
    @Param('guildId') guildId: string,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ ok: boolean }>
}
```

**엔드포인트**:
- `GET /api/guilds/:guildId/sticky-message` → `configService.getConfigs(guildId)` → 배열 반환
- `POST /api/guilds/:guildId/sticky-message` → `configService.saveConfig(guildId, dto)` → `{ ok: true }`
- `DELETE /api/guilds/:guildId/sticky-message/:id` → `configService.deleteConfig(guildId, id)` → `{ ok: true }`

`ParseIntPipe`: `@nestjs/common`에서 import. `id` path parameter를 `number`로 변환한다.

---

### Step 9: `sticky-message.module.ts`

**참조 패턴**: `apps/api/src/status-prefix/status-prefix.module.ts`, `apps/api/src/newbie/newbie.module.ts`

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
  ],
  exports: [
    StickyMessageConfigService,
    StickyMessageConfigRepository,
    StickyMessageRedisRepository,
  ],
})
export class StickyMessageModule {}
```

**설계 결정**:
- `RedisModule`은 `@Global()` 모듈이므로 import 불필요.
- `DiscordModule.forFeature()`는 `@InjectDiscordClient()`와 `@On()` 데코레이터 사용에 필요.
- `StickyMessageGateway`는 `@On('messageCreate')` 핸들러를 보유하므로 provider에 등록.
  - `DiscordEventsModule`에서 `StickyMessageModule`을 import하면 `StickyMessageGateway`가 활성화된다.
  - 이는 `NewbieModule`에서 `NewbieGateway`를 provider로 등록하고 `DiscordEventsModule`에서 `NewbieModule`을 import하는 기존 패턴과 동일하다.
- `exports`에 `StickyMessageConfigService`, `StickyMessageConfigRepository`, `StickyMessageRedisRepository`를 포함한다.
  - `StickyMessageConfigService`는 슬래시 커맨드(F-sticky-message-commands 단위)에서 사용.
  - `StickyMessageConfigRepository`, `StickyMessageRedisRepository`는 슬래시 커맨드에서 직접 접근 필요 시를 대비.

---

### Step 10: `app.module.ts` 수정

`StatusPrefixModule` 다음에 `StickyMessageModule`을 추가한다.

```typescript
import { StickyMessageModule } from './sticky-message/sticky-message.module';

// imports 배열에 추가:
StickyMessageModule,
```

**충돌 확인**: 현재 `app.module.ts`에 등록된 모듈 목록에 sticky-message 관련 항목 없음. 추가만 수행.

---

### Step 11: `discord-events.module.ts` 수정

`StatusPrefixModule` import 다음에 `StickyMessageModule`을 추가한다.

```typescript
import { StickyMessageModule } from '../sticky-message/sticky-message.module';

// imports 배열에 추가:
StickyMessageModule,
```

**활성화 이유**: `StickyMessageGateway`의 `@On('messageCreate')` 핸들러가 Discord 이벤트를 수신하려면 `DiscordModule.forFeature()`가 적용된 컨텍스트에서 동작해야 한다. `StickyMessageModule` 자체가 `DiscordModule.forFeature()`를 import하므로, `DiscordEventsModule`에서 `StickyMessageModule`을 import하면 Gateway가 활성화된다.

**충돌 확인**: 기존 `NewbieModule`, `StatusPrefixModule` 등과 동일한 패턴. 순환 의존 없음.

---

## 5. 디바운스 구현 세부 설계

### 설계 방식: `setTimeout` + `clearTimeout` + Redis TTL

```
채널 X에 메시지 수신:
  1. clearTimeout(timers.get(X)) — 이전 타이머 취소
  2. Redis SET sticky_message:debounce:X 1 EX 3 — Redis 키 리셋
  3. timer = setTimeout(3000, refresh(guildId, X)) — 새 타이머 등록
  4. timers.set(X, timer)

3초 경과 (마지막 메시지 기준):
  5. timers.delete(X)
  6. refresh(guildId, X) 실행
     - findByGuildAndChannel → enabled=true 설정 목록
     - 각 설정: 기존 메시지 삭제 → 새 메시지 전송 → messageId 갱신
```

### 봇 재시작 시 동작

봇 재시작 시 `timers` Map이 초기화된다. 재시작 전 설정된 Redis 디바운스 키(`EX 3`)는 이미 만료되어 있을 것이므로 좀비 상태가 남지 않는다. 재시작 후 새 메시지가 수신되면 정상적으로 타이머가 설정된다.

### 동시성 고려

NestJS는 단일 Node.js 프로세스로 동작하며, JavaScript 이벤트 루프는 단일 스레드다. 따라서 `timers` Map에 대한 동시 접근 경합이 발생하지 않는다.

---

## 6. Discord Embed 전송 로직 중복 최소화

`StickyMessageConfigService`와 `StickyMessageRefreshService` 두 곳에서 Embed 전송과 메시지 삭제 로직이 필요하다. 공통 모듈 문서에 별도 Discord gateway 파일이 명시되어 있지 않으므로, 두 서비스에서 각각 `private` 메서드로 구현한다.

**공통으로 필요한 private 메서드**:

```typescript
// 두 서비스 모두에 동일하게 작성
private async sendEmbed(
  channelId: string,
  config: { embedTitle: string | null; embedDescription: string | null; embedColor: string | null },
): Promise<string>

private async tryDeleteMessage(channelId: string, messageId: string): Promise<void>
```

두 메서드는 각 서비스에 독립적으로 구현한다. 내용이 동일하더라도 서비스 간 직접 의존을 추가하면 순환 의존 위험이 생기므로 분리 유지한다.

---

## 7. 충돌 검증

### 기존 코드와의 충돌 확인

| 항목 | 판단 |
|------|------|
| `@On('messageCreate')` 중복 핸들러 | discord-nestjs는 동일 이벤트에 여러 `@On` 핸들러 등록을 지원한다. 각 핸들러는 독립적으로 호출된다. 기존 코드에 `messageCreate` 핸들러 없음(grep 확인). 충돌 없음 |
| `GET/POST /api/guilds/:guildId/sticky-message` 라우트 | 기존 컨트롤러 라우트와 경로 중복 없음. `status-prefix`는 `/api/guilds/:guildId/status-prefix/config` 사용 |
| `DELETE /api/guilds/:guildId/sticky-message/:id` 라우트 | 기존에 없는 라우트. 충돌 없음 |
| `StickyMessageModule` → `AppModule` import | `StickyMessageModule`은 다른 기능 모듈(VoiceChannelModule 등)에 의존하지 않음. 순환 의존 없음 |
| `StickyMessageModule` → `DiscordEventsModule` import | `StickyMessageModule`은 `DiscordEventsModule`에 의존하지 않음. 단방향 의존. 순환 의존 없음 |
| 마이그레이션 | `1773900000000-AddStickyMessage.ts` 이미 존재. 신규 마이그레이션 불필요 |
| 엔티티 파일 | `sticky-message-config.entity.ts` 이미 존재. 재생성 불필요 |

### DRY 준수 확인

| 항목 | 판단 |
|------|------|
| Redis 키 | `StickyMessageKeys`로 중앙화. 모든 서비스/리포지토리에서 이 파일만 참조 |
| Redis 연산 | `StickyMessageRedisRepository`로 캡슐화. 서비스에서 직접 `RedisService` 호출 안함 |
| DB 연산 | `StickyMessageConfigRepository`로 캡슐화. 서비스에서 직접 TypeORM Repository 접근 안함 |
| Discord Embed 전송/삭제 | 두 서비스에 중복 private 메서드 존재. 별도 gateway 파일로 추출하지 않는 이유: 공통 모듈 문서 미명시, 현재 규모에서 두 메서드가 안정적이며 서비스 간 의존 추가보다 약간의 중복이 더 안전함 |

---

## 8. 단계별 개발 순서

의존 관계를 고려한 구현 순서:

```
Step 1: sticky-message-cache.keys.ts       (의존성 없음)
Step 2: sticky-message-redis.repository.ts  (Step 1 의존)
Step 3: sticky-message-config.repository.ts (엔티티만 의존, 이미 존재)
Step 4: sticky-message-save.dto.ts          (의존성 없음)
Step 5: sticky-message-config.service.ts    (Step 2, 3, 4 의존)
Step 6: sticky-message-refresh.service.ts   (Step 3 의존)
Step 7: sticky-message.gateway.ts           (Step 2, 3, 6 의존)
Step 8: sticky-message.controller.ts        (Step 4, 5 의존)
Step 9: sticky-message.module.ts            (Step 2~8 의존)
Step 10: app.module.ts 수정                 (Step 9 의존)
Step 11: discord-events.module.ts 수정      (Step 9 의존)
```

Step 1~4는 의존성이 없어 병렬 작성 가능하다. Step 5~8은 Step 1~4 완료 후 병렬 가능.

---

## 9. 주요 설계 결정 사항

| 결정 | 이유 |
|------|------|
| 디바운스: `setTimeout` + Redis TTL 병행 | `setTimeout`으로 인메모리 타이머 관리 (clearTimeout 가능), Redis로 봇 재시작 후 좀비 키 방지. PRD §F-STICKY-004 명시 방식 |
| Gateway를 `StickyMessageModule` provider로 등록 | `NewbieModule`-`NewbieGateway` 기존 패턴과 동일. `DiscordEventsModule`에서 import 시 자동 활성화 |
| `configRepo.save()`에서 `messageId` 미수정 | `messageId`는 Discord API 전송 결과에만 의존하므로 별도 `updateMessageId()`로 분리. `status-prefix` 패턴과 동일 |
| 캐시 갱신: POST 시 전체 목록 재조회 | 길드 단위로 캐시되므로, 단건 upsert 후 `findByGuildId()`로 최신 전체 목록을 Redis에 저장. 일관성 보장 |
| DELETE 시 Redis 무효화(`del`) | 목록이 변경되므로 캐시 무효화가 안전. 다음 조회 시 DB에서 재로드 |
