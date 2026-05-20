# user-privacy 도메인 모듈 신설 구현 계획

> 작성일: 2026-05-04
> 상위 문서:
> - PRD: `docs/specs/prd/voice-co-presence.md` F-COPRESENCE-017
> - DB 스키마: `docs/specs/database/_index.md` §31
> - 공통 모듈: `docs/specs/common-modules.md` D-2
> - 검토안: `docs/plans/best-friend-discord-feature.md`

---

## 1. 작업 목적

Voice Co-Presence Phase 5(F-COPRESENCE-014~017)에서 도입되는 사용자 친밀도 노출 opt-out 정책을 처리할 **`user-privacy` 도메인 모듈**을 신설한다.

본 모듈은 다음 4개 도메인이 공통으로 의존한다.

| 소비 위치 | 사용 메서드 |
|-----------|-------------|
| `BestFriendCardRenderer` (F-COPRESENCE-014) | `filterPeers(guildId, peerIds)` |
| `AffinityCardRenderer` (F-COPRESENCE-015) | `isPrivate(guildId, userId)` |
| `WeeklyReportService` (F-COPRESENCE-016) | `filterPeers(guildId, allPairUserIds)` |
| `/privacy` 슬래시 커맨드 + 웹 PUT API (F-COPRESENCE-017) | `upsert(guildId, userId, dto)` |

본 plan은 **user-privacy 도메인 단독 작업**만 다룬다. 위 4개 도메인의 통합 작업은 별도 plan에서 처리한다.

---

## 2. 변경 대상 파일 목록 (신규)

`UserPrivacyConfigOrm` 엔티티 및 마이그레이션은 이미 적용되어 있으므로 제외한다.

| # | 파일 경로 | 역할 |
|---|-----------|------|
| 1 | `apps/api/src/user-privacy/infrastructure/user-privacy-config.repository.ts` | TypeORM Repository (find/findManyByPeers/upsert) |
| 2 | `apps/api/src/user-privacy/application/user-privacy-config.cache.ts` | Redis 키 빌더 + MGET/SET/DEL 캡슐화, TTL 상수 |
| 3 | `apps/api/src/user-privacy/application/user-privacy-config.service.ts` | 외부 도메인 노출 진입점 (isPrivate / filterPeers / upsert) |
| 4 | `apps/api/src/user-privacy/dto/user-privacy.dto.ts` | `UserPrivacyDto`, `UpdateUserPrivacyDto` (class-validator) |
| 5 | `apps/api/src/user-privacy/presentation/user-privacy.controller.ts` | 웹 API (`GET/PUT /api/users/me/privacy`) |
| 6 | `apps/api/src/bot-api/user-privacy/bot-user-privacy.controller.ts` | Bot 슬래시 커맨드 연동 (`POST /bot-api/user-privacy/upsert`) |
| 7 | `apps/api/src/user-privacy/user-privacy.module.ts` | NestJS 모듈 정의 (Service만 export) |

기존 파일 변경:

| # | 파일 경로 | 변경 내용 |
|---|-----------|-----------|
| 8 | `apps/api/src/app.module.ts` | `UserPrivacyModule` import 추가 |
| 9 | `apps/api/src/bot-api/bot-api.module.ts` | `UserPrivacyModule` import + `BotUserPrivacyController` 등록 |

기존 자산 (변경 없음):

- `apps/api/src/user-privacy/infrastructure/user-privacy-config.orm-entity.ts` (이미 존재)
- `apps/api/src/migrations/1777100000000-AddBestFriendCanvasConfig.ts` (이미 적용)

---

## 3. 디렉터리 구조

기존 도메인 컨벤션(`apps/api/src/inactive-member/`, `apps/api/src/sticky-message/` 등)과 동일한 4계층 구조를 따른다.

```
apps/api/src/user-privacy/
├── user-privacy.module.ts
├── application/
│   ├── user-privacy-config.service.ts
│   └── user-privacy-config.cache.ts
├── infrastructure/
│   ├── user-privacy-config.orm-entity.ts        (기존)
│   └── user-privacy-config.repository.ts
├── presentation/
│   └── user-privacy.controller.ts
└── dto/
    └── user-privacy.dto.ts

apps/api/src/bot-api/user-privacy/
└── bot-user-privacy.controller.ts                (Bot API 측 진입점)
```

`domain/` 디렉터리는 본 모듈에서 도입하지 않는다 — 사용자 단위 boolean 플래그 1개만 다루며 도메인 객체나 enum이 필요한 비즈니스 규칙이 없다.

---

## 4. 단계별 구현 순서

선후 의존성을 고려하여 순차적으로 진행한다.

### Step 1 — Cache 레이어 (`user-privacy-config.cache.ts`)

```typescript
import { Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';

import { REDIS_CLIENT } from '../../redis/redis.constants';

export const USER_PRIVACY_CACHE_PREFIX = 'friend:privacy';
export const USER_PRIVACY_CACHE_TTL_SEC = 30 * 60;

export const buildPrivacyCacheKey = (guildId: string, userId: string): string =>
  `${USER_PRIVACY_CACHE_PREFIX}:${guildId}:${userId}`;

@Injectable()
export class UserPrivacyConfigCache {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async getMany(guildId: string, userIds: string[]): Promise<Map<string, boolean | null>>;
  async setMany(guildId: string, entries: Map<string, boolean>): Promise<void>;
  async invalidate(guildId: string, userId: string): Promise<void>;
}
```

- `RedisService.mget()`은 내부에서 `JSON.parse`를 수행해 `"0"`/`"1"` 원시값과 호환되지 않으므로, 본 클래스는 `REDIS_CLIENT`(`ioredis` 인스턴스)를 직접 주입받아 raw `MGET`/`SET`/`DEL`을 호출한다.
- 직렬화 규약: `"0"` = 공개, `"1"` = 비공개.

### Step 2 — Repository (`user-privacy-config.repository.ts`)

```typescript
@Injectable()
export class UserPrivacyConfigRepository {
  constructor(
    @InjectRepository(UserPrivacyConfigOrm)
    private readonly repo: Repository<UserPrivacyConfigOrm>,
  ) {}

  async findOne(guildId: string, userId: string): Promise<UserPrivacyConfigOrm | null>;

  async findManyByPeers(
    guildId: string,
    userIds: string[],
  ): Promise<Map<string, boolean>>;
  // SELECT "userId", "disableRelationshipShare"
  // WHERE "guildId" = $1 AND "userId" = ANY($2)

  async upsert(
    guildId: string,
    userId: string,
    disableRelationshipShare: boolean,
  ): Promise<void>;
  // INSERT ... ON CONFLICT ("guildId", "userId") DO UPDATE
  //   SET "disableRelationshipShare" = EXCLUDED.<...>, "updatedAt" = now()
}
```

- 모든 쿼리는 PK 또는 `IDX_user_privacy_config_user` 인덱스를 사용한다.
- `findManyByPeers`는 빈 배열 입력 시 `new Map()` 즉시 반환 (빈 IN 절 회피).

### Step 3 — Service (`user-privacy-config.service.ts`)

```typescript
@Injectable()
export class UserPrivacyConfigService {
  constructor(
    private readonly repo: UserPrivacyConfigRepository,
    private readonly cache: UserPrivacyConfigCache,
  ) {}

  async isPrivate(guildId: string, userId: string): Promise<boolean>;

  async filterPeers(
    guildId: string,
    peerIds: string[],
  ): Promise<Map<string, { isAnonymous: boolean }>>;

  async upsert(
    guildId: string,
    userId: string,
    disableRelationshipShare: boolean,
  ): Promise<void>;

  async getOne(
    guildId: string,
    userId: string,
  ): Promise<{ disableRelationshipShare: boolean }>;
}
```

분기 로직:

- **`isPrivate`**: 캐시 GET → 미스 시 DB 조회 → 캐시 SET(레코드 없으면 `"0"`) → boolean 반환.
- **`filterPeers`**: MGET 배치 조회 → 캐시 미스 ID만 모아 `repo.findManyByPeers()` 호출 → 결과를 캐시에 SET(존재하지 않은 사용자도 `"0"`으로 캐시) → 호출자에게 `Map<peerId, { isAnonymous }>` 반환.
- **`upsert`**: `repo.upsert()` 후 `cache.invalidate()` 즉시 호출.
- **`getOne`**: 컨트롤러 응답 전용. 캐시 우회 후 항상 DB 조회 (관리 화면 정합성 우선). 레코드 없으면 `{ disableRelationshipShare: false }` 반환.

### Step 4 — DTO (`user-privacy.dto.ts`)

```typescript
import { IsBoolean, IsString } from 'class-validator';

export class UpdateUserPrivacyDto {
  @IsString()
  guildId: string;

  @IsBoolean()
  disableRelationshipShare: boolean;
}

export class UserPrivacyDto {
  guildId: string;
  userId: string;
  disableRelationshipShare: boolean;
}

// Bot API 전용 — slash command에서 호출
export class BotUpsertPrivacyDto {
  @IsString()
  guildId: string;

  @IsString()
  userId: string;

  @IsBoolean()
  disableRelationshipShare: boolean;
}
```

### Step 5 — 웹 컨트롤러 (`user-privacy.controller.ts`)

`api/users/me` 경로는 이미 `DataDeletionController`(`apps/api/src/channel/voice/presentation/data-deletion.controller.ts`)가 사용 중이며, NestJS는 컨트롤러 단위로 라우트를 분리하므로 충돌 없음.

- `GET /api/users/me/privacy?guildId=...`
- `PUT /api/users/me/privacy?guildId=...` (body: `{ disableRelationshipShare }`)

guildId는 query string으로 전달한다 (사용자 1명 ↔ 다중 길드 N:N 구조이므로 path에 포함 불가).

```typescript
@Controller('api/users/me/privacy')
@UseGuards(JwtAuthGuard)
export class UserPrivacyController {
  @Get()
  async getMyPrivacy(
    @Query('guildId') guildId: string,
    @Req() req: Request,
  ): Promise<UserPrivacyDto>;

  @Put()
  async updateMyPrivacy(
    @Query('guildId') guildId: string,
    @Body() dto: UpdateUserPrivacyDto,
    @Req() req: Request,
  ): Promise<UserPrivacyDto>;
}
```

- `req.user.discordId` (JwtUser)에서 `userId` 추출. 본인만 변경 가능 — 다른 사용자 ID를 path/body로 받지 않는다.
- `UpdateUserPrivacyDto.guildId`와 query `guildId`가 다를 경우 400 에러 (방어적 검증).

### Step 6 — Bot 컨트롤러 (`bot-user-privacy.controller.ts`)

`/privacy` 슬래시 커맨드 처리용. Bot 프로세스가 `BotApiClientService`를 통해 호출한다.

```typescript
@Controller('bot-api/user-privacy')
@UseGuards(BotApiAuthGuard)
export class BotUserPrivacyController {
  @Post('upsert')
  @HttpCode(HttpStatus.OK)
  async upsert(@Body() dto: BotUpsertPrivacyDto): Promise<{ ok: true }>;
}
```

조회 엔드포인트는 추가하지 않는다 — `/privacy` 슬래시 커맨드는 토글 결과만 응답하면 충분하며, 현재 상태가 필요하면 토글 응답 메시지에 변경 후 값을 함께 반환하도록 Service 시그니처를 조정한다 (구현 단계 결정).

### Step 7 — Module (`user-privacy.module.ts`)

```typescript
@Module({
  imports: [
    TypeOrmModule.forFeature([UserPrivacyConfigOrm]),
    AuthModule, // JwtAuthGuard 사용
    // RedisModule은 @Global이므로 명시 import 불필요
  ],
  controllers: [UserPrivacyController],
  providers: [
    UserPrivacyConfigRepository,
    UserPrivacyConfigCache,
    UserPrivacyConfigService,
  ],
  exports: [UserPrivacyConfigService], // ⚠ Service만 노출 (D-2 명시)
})
export class UserPrivacyModule {}
```

`BotUserPrivacyController`는 `BotApiModule` 측에 등록한다 — `BotApiAuthGuard`가 `BotApiModule`에 정의되어 있어 guard 충돌 회피가 단순함.

### Step 8 — 모듈 통합

- `apps/api/src/app.module.ts`: `UserPrivacyModule` import 추가.
- `apps/api/src/bot-api/bot-api.module.ts`:
  - `imports`에 `UserPrivacyModule` 추가
  - `controllers`에 `BotUserPrivacyController` 추가

---

## 5. API 엔드포인트 명세

### 5.1. `GET /api/users/me/privacy`

**인증**: `JwtAuthGuard`

**쿼리**:
- `guildId` (필수): 디스코드 서버 ID

**응답 예시**:
```json
{
  "guildId": "1108800000000000000",
  "userId": "987654321098765432",
  "disableRelationshipShare": false
}
```

**비즈니스 로직**: `UserPrivacyConfigService.getOne(guildId, jwtUser.discordId)`. 레코드 없으면 `disableRelationshipShare: false` 반환 (DB INSERT 안 함).

### 5.2. `PUT /api/users/me/privacy`

**인증**: `JwtAuthGuard`

**쿼리**:
- `guildId` (필수)

**요청 본문**:
```json
{
  "guildId": "1108800000000000000",
  "disableRelationshipShare": true
}
```

**응답 예시**:
```json
{
  "guildId": "1108800000000000000",
  "userId": "987654321098765432",
  "disableRelationshipShare": true
}
```

**비즈니스 로직**:
1. query `guildId`와 body `guildId` 동일성 검증 (불일치 시 400)
2. `UserPrivacyConfigService.upsert(guildId, jwtUser.discordId, dto.disableRelationshipShare)`
3. 응답에 갱신된 값 echo

### 5.3. `POST /bot-api/user-privacy/upsert`

**인증**: `BotApiAuthGuard`

**요청 본문**:
```json
{
  "guildId": "1108800000000000000",
  "userId": "987654321098765432",
  "disableRelationshipShare": true
}
```

**응답**: `{ "ok": true }`

**비즈니스 로직**: `UserPrivacyConfigService.upsert(...)` 후 ok 반환. 슬래시 커맨드의 ephemeral 응답 텍스트는 Bot 측에서 조립한다.

---

## 6. Redis 캐시 흐름도

### 6.1. 키 정책

| 항목 | 값 |
|------|-----|
| 키 패턴 | `friend:privacy:{guildId}:{userId}` |
| 자료구조 | String |
| 직렬화 | `"0"` = 공개, `"1"` = 비공개 |
| TTL | 1800초 (30분) |
| 캡슐화 위치 | `UserPrivacyConfigCache` 클래스 내부 (외부 노출 금지) |

### 6.2. `isPrivate(guildId, userId)` 흐름

```
[isPrivate 호출]
   │
   ▼
[Redis GET friend:privacy:{guildId}:{userId}]
   │
   ├─ 히트 ("0") ──────────────► return false
   │
   ├─ 히트 ("1") ──────────────► return true
   │
   └─ 미스 (null)
        │
        ▼
   [DB SELECT user_privacy_config WHERE PK]
        │
        ├─ 레코드 있음 (true) ──► [SET "1" EX 1800] ──► return true
        │
        ├─ 레코드 있음 (false) ─► [SET "0" EX 1800] ──► return false
        │
        └─ 레코드 없음 ─────────► [SET "0" EX 1800] ──► return false
                                  (INSERT 안 함, 캐시만 채움)
```

### 6.3. `filterPeers(guildId, peerIds)` 흐름

```
[filterPeers(guildId, [p1, p2, p3, p4, p5])]
   │
   ▼
[Redis MGET friend:privacy:{guildId}:{p1..p5}]
   │
   │  [hit:p1="0"] [hit:p2="1"] [miss:p3] [miss:p4] [hit:p5="0"]
   │
   ▼
[DB SELECT WHERE userId = ANY([p3, p4])]
   │
   │  결과: { p3: false } (p4는 레코드 없음)
   │
   ▼
[Redis SET friend:privacy:{guildId}:{p3}=0, ...:{p4}=0]
   │
   ▼
[결과 Map 조립]
   p1: { isAnonymous: false }
   p2: { isAnonymous: true }
   p3: { isAnonymous: false }
   p4: { isAnonymous: false }
   p5: { isAnonymous: false }
```

### 6.4. `upsert` 흐름

```
[upsert(guildId, userId, dto)]
   │
   ▼
[DB INSERT ... ON CONFLICT DO UPDATE]
   │
   ▼
[Redis DEL friend:privacy:{guildId}:{userId}]
   │
   ▼
return void
```

캐시 갱신은 `DEL` 단순 무효화 방식만 사용. `SET 새 값`을 사용하지 않는 이유: TypeORM upsert와 Redis SET 사이 race condition을 회피하기 위해 — 다음 `isPrivate` 호출 시 자연스럽게 최신 DB 값으로 캐시가 채워진다.

---

## 7. 테스트 케이스 목록

### 7.1. 단위 테스트 — `user-privacy-config.service.spec.ts`

| # | 케이스 | 시나리오 |
|---|--------|----------|
| U-1 | `isPrivate` 캐시 히트 — 공개 | Redis가 `"0"` 반환 → DB 조회 호출 0회, `false` 반환 |
| U-2 | `isPrivate` 캐시 히트 — 비공개 | Redis가 `"1"` 반환 → DB 조회 호출 0회, `true` 반환 |
| U-3 | `isPrivate` 캐시 미스 + 레코드 있음(false) | DB → false, Redis SET `"0"`, `false` 반환 |
| U-4 | `isPrivate` 캐시 미스 + 레코드 있음(true) | DB → true, Redis SET `"1"`, `true` 반환 |
| U-5 | `isPrivate` 캐시 미스 + 레코드 없음 | DB → null, Redis SET `"0"`, `false` 반환 |
| U-6 | `filterPeers` 빈 배열 | 즉시 빈 Map 반환, Redis/DB 호출 0회 |
| U-7 | `filterPeers` 전부 캐시 히트 | DB 조회 0회, 결과 Map 정확성 확인 |
| U-8 | `filterPeers` 일부 미스 | 미스 ID만 DB IN 절로 조회, 결과 Map에 누락 없음 |
| U-9 | `filterPeers` 미스 ID 중 DB 레코드 없는 사용자 | 해당 ID도 `isAnonymous: false`로 매핑되고 캐시에 `"0"` 저장 |
| U-10 | `upsert` true | DB upsert 호출, Redis DEL 호출 |
| U-11 | `upsert` false | DB upsert 호출, Redis DEL 호출 |
| U-12 | `getOne` 레코드 없음 | `{ disableRelationshipShare: false }` 반환, 캐시 미사용 |

### 7.2. 단위 테스트 — `user-privacy-config.cache.spec.ts`

| # | 케이스 |
|---|--------|
| C-1 | `buildPrivacyCacheKey` 포맷 검증 (`friend:privacy:G:U`) |
| C-2 | `getMany` 빈 배열 입력 → 빈 Map, MGET 호출 안 함 |
| C-3 | `setMany` TTL 1800 검증 |
| C-4 | `invalidate` DEL 호출 |

### 7.3. 단위 테스트 — `user-privacy-config.repository.spec.ts`

| # | 케이스 |
|---|--------|
| R-1 | `findOne` PK 기반 단건 조회 |
| R-2 | `findManyByPeers` IN 절 + Map 변환 |
| R-3 | `findManyByPeers` 빈 배열 → 빈 Map (DB 호출 회피) |
| R-4 | `upsert` ON CONFLICT 동작 — 신규 INSERT |
| R-5 | `upsert` ON CONFLICT 동작 — 기존 UPDATE |

### 7.4. 통합 테스트 (선택, NestJS `Test.createTestingModule`)

| # | 케이스 |
|---|--------|
| I-1 | `GET /api/users/me/privacy` JWT 미인증 → 401 |
| I-2 | `GET /api/users/me/privacy` 정상 응답 |
| I-3 | `PUT /api/users/me/privacy` query/body guildId 불일치 → 400 |
| I-4 | `PUT /api/users/me/privacy` 정상 갱신 후 `GET`이 새 값 반환 |
| I-5 | `POST /bot-api/user-privacy/upsert` BotApiAuth 미인증 → 401 |
| I-6 | `POST /bot-api/user-privacy/upsert` 정상 응답 |

---

## 8. 코드 스타일 준수 사항

`CLAUDE.md` 및 `docs/guides/code-style-guide.md` 준수.

- `any` 사용 금지 — `unknown` + 타입 가드 사용. ioredis 응답은 `string | null`로 명시.
- `import type { ... }` 분리.
- Boolean 변수명: `isPrivate`, `isAnonymous`, `hasRecord` 등 prefix 적용.
- 동사 시작 함수명: `findOne`, `findManyByPeers`, `buildPrivacyCacheKey`, `invalidate`.
- 공용 메서드(`filterPeers`, `isPrivate`, `upsert`)에 JSDoc 작성 (외부 도메인이 의존하므로 시그니처 변경 시 영향 범위가 큼).
- `as` 단언 회피 — 부득이한 경우(`req.user`) 주변에 한국어 주석으로 사유 명시.
- 매직 넘버 회피 — `USER_PRIVACY_CACHE_TTL_SEC` 상수화 완료. 다른 숫자 리터럴 도입 시도 금지.
- 함수 50줄 초과 회피 — Service 메서드는 캐시 분기 로직만 담당, 조립은 별도 private 메서드 분리.
- catch 블록은 사용하지 않는 방향. Repository/Cache 예외는 NestJS 글로벌 필터에 위임.

---

## 9. 충돌 방지 점검

| 위험 | 점검 결과 |
|------|-----------|
| `UserPrivacyConfigOrm` 재정의 | 기존 파일 변경 없음. 신규 정의 금지. |
| 마이그레이션 추가 | 이미 적용 완료된 `1777100000000-AddBestFriendCanvasConfig.ts`로 처리됨. 신규 추가 안 함. |
| `api/users/me/*` 경로 충돌 | `DataDeletionController`(`@Controller('api/users/me')` + `@Delete('data')`)와 `UserPrivacyController`(`@Controller('api/users/me/privacy')`)는 NestJS 라우터 레벨에서 분리 — 충돌 없음. |
| Redis 키 충돌 | `friend:privacy:*` prefix는 본 모듈 단독 점유. 다른 도메인의 `friend:llm:quota:*` (별도 plan에서 처리)와 prefix만 공유, 키 충돌 없음. |
| 모듈 export 노출 범위 | `UserPrivacyConfigService`만 export. Repository/Cache는 외부 미노출. D-2 명시 준수. |

---

## 10. 향후 통합 작업 (본 plan 범위 외)

본 모듈 완성 후, 다음 plan에서 소비처 통합을 처리한다.

| 후속 plan | 내용 |
|-----------|------|
| best-friend-backend.md (가칭) | `CoPresenceAnalyticsService.getMyTopPeers()` + `BestFriendCardRenderer`에서 `filterPeers()` 호출 |
| affinity-backend.md (가칭) | `AffinityCardRenderer` 분기에서 `isPrivate()` 양측 검증 |
| weekly-report-affinity.md (가칭) | `WeeklyReportService.collectReportData()`에서 `filterPeers()` 호출 |
| privacy-slash-command.md (가칭) | Bot 프로세스 `/privacy` 슬래시 커맨드 + `BotApiClientService.upsertPrivacy()` 메서드 추가 |
| privacy-web-page.md (가칭) | `apps/web/app/settings/me/privacy/page.tsx` + API 클라이언트 |

---

## 11. 검증 체크리스트

- [ ] `UserPrivacyConfigService` 단위 테스트 12케이스 전부 통과
- [ ] Repository/Cache 단위 테스트 9케이스 통과
- [ ] `pnpm --filter @nexus/api lint` 통과 (any/floating-promise/return-await 0건)
- [ ] `pnpm --filter @nexus/api build` 성공
- [ ] `app.module.ts`에 `UserPrivacyModule` 등록 확인
- [ ] `bot-api.module.ts`에 `UserPrivacyModule` import + Controller 등록 확인
- [ ] `UserPrivacyModule.exports`가 `UserPrivacyConfigService`만 포함하는지 확인
- [ ] Redis 키가 `friend:privacy:` prefix를 정확히 사용하는지 grep 검증
- [ ] `GET /api/users/me/privacy?guildId=...` → JwtAuthGuard 미인증 시 401 응답 수동 확인
- [ ] `POST /bot-api/user-privacy/upsert` → BotApiAuthGuard 미인증 시 401 응답 수동 확인
