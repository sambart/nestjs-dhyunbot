# Unit A: Newbie 백엔드 코어 모듈 구현 계획

> 작성일: 2026-03-08
> 범위: Unit A — B~F 단위 병렬 개발의 전제가 되는 공통 인프라 전체

---

## 1. 개요

Unit A는 Newbie 도메인의 모든 하위 기능(B~E)이 의존하는 공통 인프라를 구성한다. 다음 파일을 생성하고, 기존 파일 2개를 수정한다.

### 생성 파일 목록 (11개)

| 번호 | 파일 경로 | 역할 |
|------|-----------|------|
| 1 | `apps/api/src/newbie/infrastructure/newbie-cache.keys.ts` | Redis 키 패턴 중앙화 |
| 2 | `apps/api/src/newbie/infrastructure/newbie-redis.repository.ts` | Redis CRUD |
| 3 | `apps/api/src/newbie/infrastructure/newbie-config.repository.ts` | NewbieConfig DB 저장소 |
| 4 | `apps/api/src/newbie/infrastructure/newbie-mission.repository.ts` | NewbieMission DB 저장소 |
| 5 | `apps/api/src/newbie/infrastructure/newbie-period.repository.ts` | NewbiePeriod DB 저장소 |
| 6 | `apps/api/src/newbie/infrastructure/newbie-mission.constants.ts` | 미션 상태 이모지 상수 |
| 7 | `apps/api/src/newbie/dto/newbie-config-save.dto.ts` | 설정 저장 DTO |
| 8 | `apps/api/src/newbie/newbie.controller.ts` | REST API 컨트롤러 |
| 9 | `apps/api/src/event/newbie/newbie-events.ts` | 이벤트 상수 및 클래스 |
| 10 | `apps/api/src/event/newbie/newbie-voice-state-changed.handler.ts` | 이벤트 핸들러 |
| 11 | `apps/api/src/newbie/newbie.module.ts` | NestJS 모듈 정의 |

### 수정 파일 목록 (2개)

| 번호 | 파일 경로 | 수정 내용 |
|------|-----------|-----------|
| 12 | `apps/api/src/event/discord-events.module.ts` | NewbieModule import + handler provider 추가 |
| 13 | `apps/api/src/app.module.ts` | NewbieModule import 추가 |

### 기존 존재 파일 (수정 없음, 확인만)

- `apps/api/src/newbie/domain/newbie-config.entity.ts` — 이미 올바르게 생성됨
- `apps/api/src/newbie/domain/newbie-mission.entity.ts` — 이미 올바르게 생성됨 (`MissionStatus` enum 포함)
- `apps/api/src/newbie/domain/newbie-period.entity.ts` — 이미 올바르게 생성됨

---

## 2. 파일별 상세 구현 계획

### 파일 1: `newbie-cache.keys.ts`

**경로**: `apps/api/src/newbie/infrastructure/newbie-cache.keys.ts`

기존 `AutoChannelKeys` 패턴과 동일하게 순수 객체 리터럴로 작성한다. `as const`로 타입 안정성을 보장한다.

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

**검증**: `AutoChannelKeys`는 `as const`를 사용하지 않지만 `NewbieKeys`는 사용한다. 이는 호환성 문제 없이 더 엄격한 타입 추론을 제공한다.

---

### 파일 2: `newbie-redis.repository.ts`

**경로**: `apps/api/src/newbie/infrastructure/newbie-redis.repository.ts`

`AutoChannelRedisRepository`와 동일한 구조를 따른다. `RedisService`를 생성자 주입하며, `@Injectable()` 데코레이터를 사용한다. Sorted Set(`ZINCRBY`, `ZREVRANGE WITH SCORES`, `ZCARD`)과 Hash(`HINCRBY`, `HGETALL`)는 `RedisService.client`에 직접 접근하지 않고, `RedisService`가 공개하는 `hIncrBy` 메서드 + `pipeline` 콜백을 활용하거나, `RedisService` 자체에 없는 명령은 `(redis as any).client` 없이 `RedisService`를 통한 `pipeline`으로 처리한다.

단, `RedisService`에 `ZINCRBY`, `ZREVRANGEBYSCORE`, `ZCARD`, `HGETALL` 등의 메서드가 없으므로, 이 저장소 내부에서 `@Inject(REDIS_CLIENT) private readonly client: Redis`를 직접 주입하는 방식을 채택한다. `AutoChannelRedisRepository`는 `RedisService`를 래핑하지만, 모코코 사냥 기능에 필요한 Sorted Set 및 Hash 전용 명령은 RedisService에 미구현되어 있다. 따라서 `NewbieRedisRepository`는 두 가지 의존성을 모두 주입한다:
- `RedisService` — String, Set 연산 (config 캐시, period 활성 멤버)
- `@Inject(REDIS_CLIENT) client: Redis` — Sorted Set, Hash 고급 연산 (모코코 사냥)

`REDIS_CLIENT` 상수는 `apps/api/src/redis/redis.constants.ts`에 정의되어 있다.

**TTL 상수 (파일 내 로컬 정의)**:

```typescript
const TTL = {
  CONFIG: 60 * 60,          // 1시간
  MISSION_ACTIVE: 60 * 30,  // 30분
  PERIOD_ACTIVE: 60 * 60,   // 1시간
} as const;
```

**전체 메서드 시그니처**:

```typescript
import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../../../redis/redis.constants';
import { RedisService } from '../../../redis/redis.service';
import { NewbieConfig } from '../domain/newbie-config.entity';
import { NewbieMission } from '../domain/newbie-mission.entity';
import { NewbieKeys } from './newbie-cache.keys';

@Injectable()
export class NewbieRedisRepository {
  constructor(
    private readonly redis: RedisService,
    @Inject(REDIS_CLIENT) private readonly client: Redis,
  ) {}

  // --- 설정 캐시 ---

  async getConfig(guildId: string): Promise<NewbieConfig | null>
  async setConfig(guildId: string, config: NewbieConfig): Promise<void>
  async deleteConfig(guildId: string): Promise<void>

  // --- 미션 목록 캐시 ---

  async getMissionActive(guildId: string): Promise<NewbieMission[] | null>
  async setMissionActive(guildId: string, missions: NewbieMission[]): Promise<void>
  async deleteMissionActive(guildId: string): Promise<void>

  // --- 신입기간 활성 멤버 집합 ---

  async getPeriodActiveMembers(guildId: string): Promise<string[]>
  async addPeriodActiveMember(guildId: string, memberId: string): Promise<void>
  async isPeriodActiveMember(guildId: string, memberId: string): Promise<boolean>
  async initPeriodActiveMembers(guildId: string, memberIds: string[]): Promise<void>
  async deletePeriodActive(guildId: string): Promise<void>

  // --- 모코코 사냥 ---

  async incrMocoMinutes(
    guildId: string,
    hunterId: string,
    newbieMemberId: string,
    minutes: number,
  ): Promise<void>

  async incrMocoRank(guildId: string, hunterId: string, minutes: number): Promise<void>

  async getMocoRankPage(
    guildId: string,
    page: number,
    pageSize: number,
  ): Promise<Array<{ hunterId: string; totalMinutes: number }>>

  async getMocoHunterDetail(
    guildId: string,
    hunterId: string,
  ): Promise<Record<string, number>>

  async getMocoRankCount(guildId: string): Promise<number>
}
```

**구현 세부사항**:

- `getConfig`: `redis.get<NewbieConfig>(NewbieKeys.config(guildId))` 호출
- `setConfig`: `redis.set(NewbieKeys.config(guildId), config, TTL.CONFIG)` 호출
- `deleteConfig`: `redis.del(NewbieKeys.config(guildId))` 호출
- `getMissionActive`: `redis.get<NewbieMission[]>(NewbieKeys.missionActive(guildId))` 호출
- `setMissionActive`: `redis.set(NewbieKeys.missionActive(guildId), missions, TTL.MISSION_ACTIVE)` 호출
- `deleteMissionActive`: `redis.del(NewbieKeys.missionActive(guildId))` 호출
- `getPeriodActiveMembers`: `client.smembers(NewbieKeys.periodActive(guildId))` — `string[]` 반환
- `addPeriodActiveMember`: `redis.sadd(NewbieKeys.periodActive(guildId), memberId)` 호출
- `isPeriodActiveMember`: `redis.sismember(NewbieKeys.periodActive(guildId), memberId)` 호출
- `initPeriodActiveMembers`: `redis.del(key)` 후 멤버가 있으면 `redis.sadd(key, memberIds)`, 그 후 `client.expire(key, TTL.PERIOD_ACTIVE)` 로 TTL 설정. `SADD`는 TTL을 갱신하지 않으므로 별도 `EXPIRE` 호출 필요.
- `deletePeriodActive`: `redis.del(NewbieKeys.periodActive(guildId))` 호출
- `incrMocoMinutes`: `client.hincrby(NewbieKeys.mocoTotal(guildId, hunterId), newbieMemberId, minutes)` 호출
- `incrMocoRank`: `client.zincrby(NewbieKeys.mocoRank(guildId), minutes, hunterId)` 호출
- `getMocoRankPage`: `client.zrevrange(key, start, end, 'WITHSCORES')` 결과를 `[hunterId, score, ...]` 배열로 파싱. `page`는 1-based. `start = (page - 1) * pageSize`, `end = start + pageSize - 1`
- `getMocoHunterDetail`: `client.hgetall(NewbieKeys.mocoTotal(guildId, hunterId))` — 반환값 `Record<string, string>`을 `Record<string, number>`로 변환
- `getMocoRankCount`: `client.zcard(NewbieKeys.mocoRank(guildId))` 호출

**주의**: `addPeriodActiveMember`로 개별 추가 시에는 TTL이 설정되지 않는다 (캐시 초기화 시에만 TTL 설정). 이는 신규 멤버 가입 시 기존 캐시가 살아있는 경우 TTL을 리셋하지 않도록 의도적으로 설계한 것이다.

---

### 파일 3: `newbie-config.repository.ts`

**경로**: `apps/api/src/newbie/infrastructure/newbie-config.repository.ts`

`AutoChannelConfigRepository`와 동일한 패턴: `@InjectRepository(NewbieConfig) private readonly repo: Repository<NewbieConfig>`. `DataSource`는 트랜잭션이 필요 없으므로 주입하지 않는다.

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NewbieConfig } from '../domain/newbie-config.entity';
import { NewbieConfigSaveDto } from '../dto/newbie-config-save.dto';

@Injectable()
export class NewbieConfigRepository {
  constructor(
    @InjectRepository(NewbieConfig)
    private readonly repo: Repository<NewbieConfig>,
  ) {}

  async findByGuildId(guildId: string): Promise<NewbieConfig | null>

  async upsert(guildId: string, dto: NewbieConfigSaveDto): Promise<NewbieConfig>

  async updateMissionNotifyMessageId(guildId: string, messageId: string): Promise<void>

  async updateMocoRankMessageId(guildId: string, messageId: string): Promise<void>
}
```

**구현 세부사항**:

- `findByGuildId`: `repo.findOne({ where: { guildId } })` 호출
- `upsert`: TypeORM `save()` 기반 upsert. 먼저 `findOne({ where: { guildId } })`로 기존 레코드 조회 후, 있으면 필드 업데이트 후 `save()`, 없으면 `create()` 후 `save()`. DTO의 모든 필드를 엔티티에 복사. `missionNotifyMessageId`와 `mocoRankMessageId`는 DTO에 포함하지 않으므로 upsert 시 건드리지 않는다.
- `updateMissionNotifyMessageId`: `repo.update({ guildId }, { missionNotifyMessageId: messageId })` 호출
- `updateMocoRankMessageId`: `repo.update({ guildId }, { mocoRankMessageId: messageId })` 호출

**upsert 시 보존할 필드**: `missionNotifyMessageId`, `mocoRankMessageId` — 설정 저장 시 이 값을 덮어쓰지 않는다. Dispatcher가 Discord 메시지 ID를 별도 메서드로만 갱신한다.

---

### 파일 4: `newbie-mission.repository.ts`

**경로**: `apps/api/src/newbie/infrastructure/newbie-mission.repository.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { MissionStatus, NewbieMission } from '../domain/newbie-mission.entity';

@Injectable()
export class NewbieMissionRepository {
  constructor(
    @InjectRepository(NewbieMission)
    private readonly repo: Repository<NewbieMission>,
  ) {}

  async create(
    guildId: string,
    memberId: string,
    startDate: string,
    endDate: string,
    targetPlaytimeSec: number,
  ): Promise<NewbieMission>

  async findActiveByGuild(guildId: string): Promise<NewbieMission[]>

  async findActiveByMember(
    guildId: string,
    memberId: string,
  ): Promise<NewbieMission | null>

  async findExpired(today: string): Promise<NewbieMission[]>

  async updateStatus(id: number, status: MissionStatus): Promise<void>
}
```

**구현 세부사항**:

- `create`: `repo.create({ guildId, memberId, startDate, endDate, targetPlaytimeSec, status: MissionStatus.IN_PROGRESS })` 후 `repo.save()` 반환
- `findActiveByGuild`: `repo.find({ where: { guildId, status: MissionStatus.IN_PROGRESS } })` — `IDX_newbie_mission_guild_status` 인덱스 활용
- `findActiveByMember`: `repo.findOne({ where: { guildId, memberId, status: MissionStatus.IN_PROGRESS } })` — `IDX_newbie_mission_guild_member` 인덱스 활용
- `findExpired`: `repo.find({ where: { status: MissionStatus.IN_PROGRESS, endDate: LessThan(today) } })` — `IDX_newbie_mission_status_end_date` 인덱스 활용. `today`는 `YYYYMMDD` 형식 문자열
- `updateStatus`: `repo.update(id, { status })` 호출

---

### 파일 5: `newbie-period.repository.ts`

**경로**: `apps/api/src/newbie/infrastructure/newbie-period.repository.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { NewbiePeriod } from '../domain/newbie-period.entity';

@Injectable()
export class NewbiePeriodRepository {
  constructor(
    @InjectRepository(NewbiePeriod)
    private readonly repo: Repository<NewbiePeriod>,
  ) {}

  async create(
    guildId: string,
    memberId: string,
    startDate: string,
    expiresDate: string,
  ): Promise<NewbiePeriod>

  async findActiveByGuild(guildId: string): Promise<NewbiePeriod[]>

  async findActiveMemberByGuild(
    guildId: string,
    memberId: string,
  ): Promise<NewbiePeriod | null>

  async findExpired(today: string): Promise<NewbiePeriod[]>

  async markExpired(id: number): Promise<void>
}
```

**구현 세부사항**:

- `create`: `repo.create({ guildId, memberId, startDate, expiresDate, isExpired: false })` 후 `repo.save()` 반환
- `findActiveByGuild`: `repo.find({ where: { guildId, isExpired: false } })` — `IDX_newbie_period_guild_active` 인덱스 활용. 모코코 사냥 캐시 워밍업 시 사용
- `findActiveMemberByGuild`: `repo.findOne({ where: { guildId, memberId, isExpired: false } })` — `IDX_newbie_period_guild_member` 인덱스 활용
- `findExpired`: `repo.find({ where: { isExpired: false, expiresDate: LessThan(today) } })` — `IDX_newbie_period_expires` 인덱스 활용. `today`는 `YYYYMMDD` 형식
- `markExpired`: `repo.update(id, { isExpired: true })` 호출

---

### 파일 6: `newbie-mission.constants.ts`

**경로**: `apps/api/src/newbie/infrastructure/newbie-mission.constants.ts`

Unit C, D에서 공통으로 참조하는 상수를 정의한다.

```typescript
import { MissionStatus } from '../domain/newbie-mission.entity';

/** 미션 상태별 Discord Embed 표시 이모지 */
export const MISSION_STATUS_EMOJI: Record<MissionStatus, string> = {
  [MissionStatus.IN_PROGRESS]: '🟡',
  [MissionStatus.COMPLETED]: '✅',
  [MissionStatus.FAILED]: '❌',
} as const;

/** 미션 상태별 한국어 텍스트 */
export const MISSION_STATUS_TEXT: Record<MissionStatus, string> = {
  [MissionStatus.IN_PROGRESS]: '진행중',
  [MissionStatus.COMPLETED]: '완료',
  [MissionStatus.FAILED]: '실패',
} as const;
```

**설계 근거**: `MissionStatus` enum이 `newbie-mission.entity.ts`에 정의되어 있으므로 해당 파일에서 import한다. `Record<MissionStatus, string>` 타입으로 타입 안전성을 보장하여 새로운 enum 값 추가 시 컴파일 오류로 검출된다.

---

### 파일 7: `newbie-config-save.dto.ts`

**경로**: `apps/api/src/newbie/dto/newbie-config-save.dto.ts`

`AutoChannelSaveDto`와 동일하게 `class-validator` 데코레이터를 사용한다. 선택적 필드에 `@IsOptional()`을 적용한다.

```typescript
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
} from 'class-validator';

export class NewbieConfigSaveDto {
  // 환영인사
  @IsBoolean()
  welcomeEnabled: boolean;

  @IsOptional()
  @IsString()
  welcomeChannelId?: string | null;

  @IsOptional()
  @IsString()
  welcomeEmbedTitle?: string | null;

  @IsOptional()
  @IsString()
  welcomeEmbedDescription?: string | null;

  @IsOptional()
  @IsString()
  welcomeEmbedColor?: string | null;

  @IsOptional()
  @IsUrl()
  welcomeEmbedThumbnailUrl?: string | null;

  // 미션
  @IsBoolean()
  missionEnabled: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  missionDurationDays?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  missionTargetPlaytimeHours?: number | null;

  @IsOptional()
  @IsString()
  missionNotifyChannelId?: string | null;

  // 모코코 사냥
  @IsBoolean()
  mocoEnabled: boolean;

  @IsOptional()
  @IsString()
  mocoRankChannelId?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1440)
  mocoAutoRefreshMinutes?: number | null;

  // 신입기간 역할
  @IsBoolean()
  roleEnabled: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  roleDurationDays?: number | null;

  @IsOptional()
  @IsString()
  newbieRoleId?: string | null;
}
```

**설계 근거**:
- `missionNotifyMessageId`, `mocoRankMessageId`는 DTO에 포함하지 않는다. Discord 메시지 ID는 봇이 자체적으로 관리하며 웹에서 입력받지 않는다.
- `welcomeEmbedThumbnailUrl`에 `@IsUrl()` 적용으로 유효하지 않은 URL을 거부한다. 단, `null`을 허용하기 위해 `@IsOptional()`을 선행 배치한다.
- `mocoAutoRefreshMinutes`의 `@Max(1440)`은 24시간(분)을 초과하는 값을 방지한다.

---

### 파일 8: `newbie.controller.ts`

**경로**: `apps/api/src/newbie/newbie.controller.ts`

`AutoChannelController`와 동일한 패턴을 따른다: `@Controller('api/guilds/:guildId/newbie')`, `@UseGuards(JwtAuthGuard)`.

```typescript
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NewbieConfigSaveDto } from './dto/newbie-config-save.dto';
import { NewbieConfigRepository } from './infrastructure/newbie-config.repository';
import { NewbieMissionRepository } from './infrastructure/newbie-mission.repository';
import { NewbieRedisRepository } from './infrastructure/newbie-redis.repository';

@Controller('api/guilds/:guildId/newbie')
@UseGuards(JwtAuthGuard)
export class NewbieController {
  constructor(
    private readonly configRepo: NewbieConfigRepository,
    private readonly missionRepo: NewbieMissionRepository,
    private readonly redisRepo: NewbieRedisRepository,
  ) {}

  /**
   * GET /api/guilds/:guildId/newbie/config
   * 설정 조회. Redis 캐시 우선, 미스 시 DB 조회 후 캐시 저장.
   */
  @Get('config')
  async getConfig(@Param('guildId') guildId: string)

  /**
   * POST /api/guilds/:guildId/newbie/config
   * 설정 저장. DB upsert 후 Redis 캐시 갱신.
   * 처리 순서:
   *   1. DB upsert (NewbieConfig)
   *   2. Redis config 캐시 갱신 (setConfig)
   * 반환: { ok: boolean }
   */
  @Post('config')
  @HttpCode(HttpStatus.OK)
  async saveConfig(
    @Param('guildId') guildId: string,
    @Body() dto: NewbieConfigSaveDto,
  )

  /**
   * GET /api/guilds/:guildId/newbie/missions
   * 길드의 IN_PROGRESS 미션 목록 조회.
   * Redis 캐시 우선, 미스 시 DB 조회 후 캐시 저장.
   * 반환: NewbieMission[]
   */
  @Get('missions')
  async getMissions(@Param('guildId') guildId: string)

  /**
   * GET /api/guilds/:guildId/newbie/moco?page=1&pageSize=10
   * 모코코 사냥 순위 페이지 조회.
   * page 기본값: 1, pageSize 기본값: 10
   * 반환: { items: Array<{ hunterId, totalMinutes }>, total: number, page: number, pageSize: number }
   */
  @Get('moco')
  async getMocoRank(
    @Param('guildId') guildId: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  )
}
```

**`getConfig` 구현 세부사항**:
1. `redisRepo.getConfig(guildId)` 조회
2. 캐시 히트 시 즉시 반환
3. 캐시 미스 시 `configRepo.findByGuildId(guildId)` 조회
4. DB 결과가 있으면 `redisRepo.setConfig(guildId, config)` 후 반환
5. DB에도 없으면 `null` 반환

**`saveConfig` 구현 세부사항**:
1. `configRepo.upsert(guildId, dto)` 호출
2. `redisRepo.setConfig(guildId, savedConfig)` 로 캐시 갱신 (delete 후 set이 아닌 직접 set)
3. `{ ok: true }` 반환

**`getMissions` 구현 세부사항**:
1. `redisRepo.getMissionActive(guildId)` 조회
2. 캐시 히트 시 즉시 반환
3. 캐시 미스 시 `missionRepo.findActiveByGuild(guildId)` 조회 후 `redisRepo.setMissionActive` 저장 및 반환

**`getMocoRank` 구현 세부사항**:
1. `page`, `pageSize` 쿼리 파라미터를 `parseInt`로 변환, 유효하지 않으면 기본값(1, 10) 사용
2. `redisRepo.getMocoRankPage(guildId, page, pageSize)` 조회
3. `redisRepo.getMocoRankCount(guildId)` 로 전체 수 조회
4. `{ items, total, page, pageSize }` 형태로 반환

---

### 파일 9: `newbie-events.ts`

**경로**: `apps/api/src/event/newbie/newbie-events.ts`

기존 `voice-events.ts`, `auto-channel-events.ts`와 동일한 패턴으로 작성한다.

```typescript
export const NEWBIE_EVENTS = {
  /** voiceStateUpdate 발생 시 MocoService 처리용 — Dispatcher에서 추가 발행 */
  VOICE_STATE_CHANGED: 'newbie.voice-state-changed',
} as const;

export class NewbieVoiceStateChangedEvent {
  constructor(
    public readonly guildId: string,
    /** 이동 후 또는 입장한 채널 ID. 퇴장 시 null */
    public readonly channelId: string | null,
    /** 이동 전 또는 퇴장한 채널 ID. 입장 시 null */
    public readonly oldChannelId: string | null,
    /** 현재 채널(channelId)의 모든 멤버 ID 목록. channelId가 null이면 빈 배열 */
    public readonly channelMemberIds: string[],
  ) {}
}
```

**설계 근거**: `channelMemberIds`는 `voiceStateUpdate` 이벤트 발생 시점의 `channel.members.keys()`로부터 수집한다. 이벤트 발행 시점에 이미 멤버 상태가 반영된 `newState.channel`을 기준으로 한다.

---

### 파일 10: `newbie-voice-state-changed.handler.ts`

**경로**: `apps/api/src/event/newbie/newbie-voice-state-changed.handler.ts`

`AutoChannelTriggerJoinHandler`와 동일한 패턴을 따른다.

```typescript
import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NEWBIE_EVENTS, NewbieVoiceStateChangedEvent } from './newbie-events';

@Injectable()
export class NewbieVoiceStateChangedHandler {
  constructor(private readonly mocoService: MocoService) {}

  @OnEvent(NEWBIE_EVENTS.VOICE_STATE_CHANGED)
  async handle(event: NewbieVoiceStateChangedEvent): Promise<void> {
    await this.mocoService.handleVoiceStateChanged(event);
  }
}
```

**주의**: `MocoService`는 Unit D에서 구현한다. Unit A에서는 이 핸들러 파일을 생성하되, `MocoService`를 forward reference 없이 일반 생성자 주입으로 선언한다. `NewbieModule`에 `MocoService`도 함께 등록되므로 NestJS DI가 런타임에 해결한다.

**실제 import 경로**: `MocoService`는 `../../newbie/moco/moco.service`에서 import한다. 이 핸들러는 `apps/api/src/event/newbie/` 경로에 있으므로 상대 경로는 `../../newbie/moco/moco.service`가 된다.

```typescript
import { MocoService } from '../../newbie/moco/moco.service';
```

---

### 파일 11: `newbie.module.ts`

**경로**: `apps/api/src/newbie/newbie.module.ts`

`AutoChannelModule`과 동일한 구조를 따른다.

```typescript
import { DiscordModule } from '@discord-nestjs/core';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { RedisModule } from '../redis/redis.module';
import { VoiceChannelHistory } from '../channel/voice/domain/voice-channel-history.entity';
import { VoiceDailyEntity } from '../channel/voice/domain/voice-daily.entity';
import { NewbieVoiceStateChangedHandler } from '../event/newbie/newbie-voice-state-changed.handler';
import { MocoService } from './moco/moco.service';
import { MissionScheduler } from './mission/mission.scheduler';
import { MissionService } from './mission/mission.service';
import { NewbieRoleScheduler } from './role/newbie-role.scheduler';
import { NewbieRoleService } from './role/newbie-role.service';
import { WelcomeService } from './welcome/welcome.service';
import { NewbieController } from './newbie.controller';
import { NewbieGateway } from './newbie.gateway';
import { NewbieConfig } from './domain/newbie-config.entity';
import { NewbieMission } from './domain/newbie-mission.entity';
import { NewbiePeriod } from './domain/newbie-period.entity';
import { NewbieConfigRepository } from './infrastructure/newbie-config.repository';
import { NewbieMissionRepository } from './infrastructure/newbie-mission.repository';
import { NewbiePeriodRepository } from './infrastructure/newbie-period.repository';
import { NewbieRedisRepository } from './infrastructure/newbie-redis.repository';

@Module({
  imports: [
    DiscordModule.forFeature(),
    TypeOrmModule.forFeature([
      NewbieConfig,
      NewbieMission,
      NewbiePeriod,
      VoiceDailyEntity,
      VoiceChannelHistory,
    ]),
    RedisModule,
    AuthModule,
  ],
  controllers: [NewbieController],
  providers: [
    // 저장소
    NewbieConfigRepository,
    NewbieMissionRepository,
    NewbiePeriodRepository,
    NewbieRedisRepository,
    // 핵심 (Unit A)
    NewbieGateway,
    // Unit B
    WelcomeService,
    // Unit C
    MissionService,
    MissionScheduler,
    // Unit D
    MocoService,
    NewbieVoiceStateChangedHandler,
    // Unit E
    NewbieRoleService,
    NewbieRoleScheduler,
  ],
  exports: [
    NewbieConfigRepository,
    NewbieMissionRepository,
    NewbiePeriodRepository,
    NewbieRedisRepository,
    MocoService,
  ],
})
export class NewbieModule {}
```

**설계 근거**:
- `VoiceDailyEntity`, `VoiceChannelHistory`를 `TypeOrmModule.forFeature()`로 직접 등록한다. `VoiceChannelModule`을 import하면 불필요한 voice 도메인 서비스들이 함께 로드된다. `VoiceChannelModule`의 `exports`에 `TypeOrmModule`이 포함되어 있지만 재사용 가능 서비스가 필요 없으므로 엔티티만 직접 등록하는 방식을 채택한다.
- `RedisModule`을 import해야 `REDIS_CLIENT` 토큰이 해결된다. `NewbieRedisRepository`가 직접 `REDIS_CLIENT`를 주입하기 때문이다.
- `NewbieGateway`는 Unit A에서 골격을 생성하지만, 호출하는 서비스(`WelcomeService`, `MissionService`, `NewbieRoleService`)는 Unit B, C, E에서 구현한다. Unit A에서는 서비스 인터페이스를 stub 없이 직접 import하여, Unit B~E 구현 전까지는 컴파일만 통과하는 상태로 둔다.
- `MocoService`는 `DiscordEventsModule`의 `NewbieVoiceStateChangedHandler`가 의존하므로 exports에 포함한다.

---

### 파일 12: `discord-events.module.ts` 수정

**경로**: `apps/api/src/event/discord-events.module.ts`

기존 파일에 두 가지를 추가한다:

1. `NewbieModule` import
2. `NewbieVoiceStateChangedHandler` providers 추가

```typescript
// 추가할 import
import { NewbieModule } from '../newbie/newbie.module';
import { NewbieVoiceStateChangedHandler } from './newbie/newbie-voice-state-changed.handler';

// @Module imports 배열에 추가
NewbieModule,

// @Module providers 배열에 추가
NewbieVoiceStateChangedHandler,
```

**변경 후 전체 모듈**:

```typescript
import { DiscordModule } from '@discord-nestjs/core';
import { Module } from '@nestjs/common';

import { AutoChannelModule } from '../channel/auto/auto-channel.module';
import { ChannelModule } from '../channel/channel.module';
import { VoiceChannelModule } from '../channel/voice/voice-channel.module';
import { NewbieModule } from '../newbie/newbie.module';
import { ChannelStateHandler } from './channel/channel-state.handler';
import { NewbieVoiceStateChangedHandler } from './newbie/newbie-voice-state-changed.handler';
import { VoiceAloneHandler } from './voice/voice-alone.handler';
import { VoiceJoinHandler } from './voice/voice-join.handler';
import { VoiceLeaveHandler } from './voice/voice-leave.handler';
import { MicToggleHandler } from './voice/voice-mic-toggle.handler';
import { VoiceMoveHandler } from './voice/voice-move.handler';
import { VoiceStateDispatcher } from './voice/voice-state.dispatcher';

@Module({
  imports: [
    AutoChannelModule,
    ChannelModule,
    VoiceChannelModule,
    NewbieModule,
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
    NewbieVoiceStateChangedHandler,
  ],
})
export class DiscordEventsModule {}
```

**주의**: `NewbieVoiceStateChangedHandler`는 `NewbieModule`에도 providers로 등록되어 있다. `DiscordEventsModule`에서도 providers 배열에 추가하는 것은 중복 등록처럼 보이나, 이 핸들러가 `@OnEvent` 데코레이터로 이벤트를 수신하려면 해당 모듈의 DI 컨텍스트에서 인스턴스화되어야 한다. 기존 `AutoChannelTriggerJoinHandler`도 `AutoChannelModule` providers와 `DiscordEventsModule` providers 양쪽에 등록되어 있다.

실제로 `AutoChannelTriggerJoinHandler.ts`를 확인하면 `AutoChannelModule`의 providers에 없고 `DiscordEventsModule` providers에만 등록된다. 따라서 `NewbieVoiceStateChangedHandler`도 동일 패턴으로: `NewbieModule` providers에서 제거하고 `DiscordEventsModule` providers에만 등록한다.

**수정된 `NewbieModule` providers** (handler 제외):

```typescript
providers: [
  NewbieConfigRepository,
  NewbieMissionRepository,
  NewbiePeriodRepository,
  NewbieRedisRepository,
  NewbieGateway,
  WelcomeService,
  MissionService,
  MissionScheduler,
  MocoService,
  NewbieRoleService,
  NewbieRoleScheduler,
],
```

---

### 파일 13: `app.module.ts` 수정

**경로**: `apps/api/src/app.module.ts`

```typescript
// 추가할 import
import { NewbieModule } from './newbie/newbie.module';

// @Module imports 배열에 추가 (AutoChannelModule 다음)
NewbieModule,
```

**변경 후 imports 배열**:

```typescript
imports: [
  ConfigModule.forRoot(BaseConfig),
  EventEmitterModule.forRoot(),
  DiscordModule.forRootAsync(DiscordConfig),
  TypeOrmModule.forRootAsync(TypeORMConfig),
  ChannelModule,
  VoiceChannelModule,
  AutoChannelModule,
  NewbieModule,
  MusicModule,
  DiscordEventsModule,
  RedisModule,
  VoiceAnalyticsModule,
  AuthModule,
],
```

---

## 3. `VoiceStateDispatcher` 수정 계획

`VoiceStateDispatcher`의 수정은 Unit A 범위에 포함된다 (common-modules.md 3-1 참조). 수정 내용은 `isJoin`, `isLeave`, `isMove` 세 분기 모두에 `NEWBIE_EVENTS.VOICE_STATE_CHANGED` 이벤트를 추가 발행하는 것이다.

**수정 파일**: `apps/api/src/event/voice/voice-state.dispatcher.ts`

**추가할 import**:

```typescript
import { NEWBIE_EVENTS, NewbieVoiceStateChangedEvent } from '../newbie/newbie-events';
```

**`isMove` 분기 수정** (기존 코드 이후 추가):

```typescript
if (isMove) {
  // 기존 코드 유지
  const oldDto = VoiceStateDto.fromVoiceState(oldState);
  const newDto = VoiceStateDto.fromVoiceState(newState);
  await this.eventEmitter.emitAsync(VOICE_EVENTS.MOVE, new VoiceMoveEvent(oldDto, newDto));
  this.emitAloneChanged(oldState);
  this.emitAloneChanged(newState);

  if (oldState.channel && oldState.channel.members.size === 0) {
    this.eventEmitter.emit(
      AUTO_CHANNEL_EVENTS.CHANNEL_EMPTY,
      new AutoChannelChannelEmptyEvent(oldState.guild.id, oldState.channelId!),
    );
  }

  // 추가: 모코코 사냥 이벤트 (이동 후 새 채널 기준)
  if (newState.channelId && newState.channel) {
    const memberIds = [...newState.channel.members.keys()];
    this.eventEmitter.emit(
      NEWBIE_EVENTS.VOICE_STATE_CHANGED,
      new NewbieVoiceStateChangedEvent(
        newState.guild.id,
        newState.channelId,
        oldState.channelId ?? null,
        memberIds,
      ),
    );
  }
}
```

**`isJoin` 분기 수정** (일반 입장 else 블록 내 추가):

```typescript
// 기존 일반 입장 처리
} else {
  const dto = VoiceStateDto.fromVoiceState(newState);
  await this.eventEmitter.emitAsync(VOICE_EVENTS.JOIN, new VoiceJoinEvent(dto));
  this.emitAloneChanged(newState);

  // 추가: 모코코 사냥 이벤트
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
}
```

**`isLeave` 분기 수정** (기존 코드 이후 추가):

```typescript
if (isLeave) {
  // 기존 코드 유지
  const dto = VoiceStateDto.fromVoiceState(oldState);
  await this.eventEmitter.emitAsync(VOICE_EVENTS.LEAVE, new VoiceLeaveEvent(dto));
  this.emitAloneChanged(oldState);

  if (oldState.channel && oldState.channel.members.size === 0) {
    this.eventEmitter.emit(
      AUTO_CHANNEL_EVENTS.CHANNEL_EMPTY,
      new AutoChannelChannelEmptyEvent(oldState.guild.id, oldState.channelId!),
    );
  }

  // 추가: 모코코 사냥 이벤트 (퇴장 후 이전 채널 기준)
  // channelId = null (퇴장), oldChannelId = 퇴장한 채널
  // channelMemberIds = 퇴장 후 남은 멤버 목록 (oldState.channel.members에서 현재 멤버)
  if (oldState.channelId && oldState.channel) {
    const memberIds = [...oldState.channel.members.keys()];
    this.eventEmitter.emit(
      NEWBIE_EVENTS.VOICE_STATE_CHANGED,
      new NewbieVoiceStateChangedEvent(
        oldState.guild.id,
        null,
        oldState.channelId,
        memberIds,
      ),
    );
  }
}
```

**설계 근거**: 트리거 채널 입장(`isTrigger` 분기)에서는 `NEWBIE_EVENTS.VOICE_STATE_CHANGED`를 발행하지 않는다. 대기방은 모코코 사냥 대상이 아니기 때문이다. 이는 common-modules.md 3-1의 명세를 따른다.

**`VoiceStateDispatcher` DI 변경 없음**: 이벤트 발행은 `this.eventEmitter.emit()`으로 처리하며 `NewbieRedisRepository` 같은 추가 의존성을 주입하지 않는다. 이벤트 기반 분리를 통해 `VoiceStateDispatcher`가 newbie 도메인을 직접 참조하지 않는다.

---

## 4. `NewbieGateway` 골격 구현

**경로**: `apps/api/src/newbie/newbie.gateway.ts`

Unit B~E의 서비스가 구현된 후 완전히 동작하지만, Unit A에서 파일 자체를 생성해야 `NewbieModule`이 컴파일된다.

```typescript
import { On } from '@discord-nestjs/core';
import { Injectable, Logger } from '@nestjs/common';
import { GuildMember } from 'discord.js';

import { MissionService } from './mission/mission.service';
import { NewbieRoleService } from './role/newbie-role.service';
import { WelcomeService } from './welcome/welcome.service';
import { NewbieConfigRepository } from './infrastructure/newbie-config.repository';
import { NewbieRedisRepository } from './infrastructure/newbie-redis.repository';

@Injectable()
export class NewbieGateway {
  private readonly logger = new Logger(NewbieGateway.name);

  constructor(
    private readonly configRepo: NewbieConfigRepository,
    private readonly redisRepo: NewbieRedisRepository,
    private readonly welcomeService: WelcomeService,
    private readonly missionService: MissionService,
    private readonly roleService: NewbieRoleService,
  ) {}

  @On('guildMemberAdd')
  async handleMemberJoin(member: GuildMember): Promise<void> {
    try {
      const guildId = member.guild.id;

      // 1. 설정 조회 (Redis 캐시 우선)
      let config = await this.redisRepo.getConfig(guildId);
      if (!config) {
        config = await this.configRepo.findByGuildId(guildId);
        if (config) {
          await this.redisRepo.setConfig(guildId, config);
        }
      }

      if (!config) return;

      // 2. 환영인사
      if (config.welcomeEnabled) {
        try {
          await this.welcomeService.sendWelcomeMessage(member, config);
        } catch (err) {
          this.logger.error(`[welcome] guild=${guildId} member=${member.id}`, (err as Error).stack);
        }
      }

      // 3. 미션 생성
      if (config.missionEnabled) {
        try {
          await this.missionService.createMission(member, config);
        } catch (err) {
          this.logger.error(`[mission] guild=${guildId} member=${member.id}`, (err as Error).stack);
        }
      }

      // 4. 신입기간 역할 부여
      if (config.roleEnabled) {
        try {
          await this.roleService.assignRole(member, config);
        } catch (err) {
          this.logger.error(`[role] guild=${guildId} member=${member.id}`, (err as Error).stack);
        }
      }
    } catch (err) {
      this.logger.error(
        `[guildMemberAdd] unhandled error: guild=${member.guild.id} member=${member.id}`,
        (err as Error).stack,
      );
    }
  }
}
```

**설계 근거**: `@On('guildMemberAdd')` 데코레이터는 `@discord-nestjs/core`의 `On` 데코레이터이다. `DiscordModule.forFeature()`가 `NewbieModule`에 import되어 있으므로 정상 동작한다. 각 서비스 호출을 개별 `try-catch`로 감싸 하나 실패해도 나머지가 실행된다.

---

## 5. 구현 순서

다음 순서로 구현한다. 의존성 그래프에 따라 하위 레이어부터 시작한다.

```
1. newbie-cache.keys.ts           (의존성 없음)
2. newbie-mission.constants.ts    (domain/newbie-mission.entity.ts 의존)
3. newbie-events.ts               (의존성 없음)
4. newbie-config-save.dto.ts      (의존성 없음)
5. newbie-redis.repository.ts     (keys, RedisService, REDIS_CLIENT 의존)
6. newbie-config.repository.ts    (entity, dto 의존)
7. newbie-mission.repository.ts   (entity 의존)
8. newbie-period.repository.ts    (entity 의존)
9. newbie-voice-state-changed.handler.ts  (newbie-events.ts, MocoService 의존)
10. newbie.controller.ts          (저장소 3개 의존)
11. newbie.gateway.ts             (저장소, 서비스 의존 — stub으로 생성)
12. newbie.module.ts              (모든 파일 의존)
13. discord-events.module.ts 수정  (newbie.module.ts 의존)
14. app.module.ts 수정             (newbie.module.ts 의존)
15. voice-state.dispatcher.ts 수정 (newbie-events.ts 의존)
```

---

## 6. 기존 코드베이스 충돌 검토

| 항목 | 판단 | 근거 |
|------|------|------|
| `RedisService` 재사용 | 충돌 없음 | String/Set 연산은 기존 메서드 그대로 사용. 추가 메서드 불필요 |
| `REDIS_CLIENT` 직접 주입 | 충돌 없음 | `redis.constants.ts`에 이미 정의됨. `AutoChannelRedisRepository`는 사용 안 하지만 다른 서비스에서 활용하는 패턴 |
| `VoiceDailyEntity` 중복 등록 | 충돌 없음 | TypeORM `autoLoadEntities: true` 환경에서 동일 엔티티를 여러 모듈의 `forFeature()`에 등록해도 중복 테이블 생성 없음 |
| `VoiceStateDispatcher` 수정 | 충돌 없음 | 기존 분기 로직 변경 없이 append-only로 이벤트 발행 추가. 기존 voice 기능 영향 없음 |
| `DiscordEventsModule` 수정 | 충돌 없음 | imports/providers 배열에 추가만 하며 기존 항목 제거 없음 |
| `AppModule` 수정 | 충돌 없음 | imports 배열에 `NewbieModule` 추가만. 순서는 `AutoChannelModule` 다음 |
| `MissionStatus` enum | 충돌 없음 | `newbie-mission.entity.ts`에 이미 정의됨. constants 파일에서 import만 |
| `@On('guildMemberAdd')` | 충돌 없음 | 현재 코드베이스에 `guildMemberAdd` 핸들러가 없음을 확인함 |
| `NewbieVoiceStateChangedHandler` 등록 위치 | 주의 필요 | `AutoChannelTriggerJoinHandler`는 `DiscordEventsModule` providers에만 등록됨. 동일 패턴으로 `NewbieVoiceStateChangedHandler`도 `DiscordEventsModule` providers에만 등록하고 `NewbieModule` providers에서 제외해야 함. 단, `MocoService`는 `NewbieModule`에 등록되어 있으므로 handler가 `DiscordEventsModule` 컨텍스트에서 `MocoService`를 주입받으려면 `NewbieModule`을 `DiscordEventsModule`의 imports에 추가하고 `MocoService`를 exports에 포함해야 함 |

---

## 7. 미해결 사항 (Unit B~E 구현 시 결정)

- `WelcomeService.sendWelcomeMessage(member, config)` — Unit B에서 메서드 시그니처 확정
- `MissionService.createMission(member, config)` — Unit C에서 메서드 시그니처 확정
- `NewbieRoleService.assignRole(member, config)` — Unit E에서 메서드 시그니처 확정
- `MocoService.handleVoiceStateChanged(event)` — Unit D에서 메서드 시그니처 확정
- `newbie-interaction.handler.ts` 파일 생성 위치: Unit C 또는 D에서 담당

---

## 8. 검증 체크리스트

- [ ] `newbie-cache.keys.ts` — 5개 키 함수 모두 PRD Redis 키 패턴과 일치
- [ ] `newbie-redis.repository.ts` — `REDIS_CLIENT` import 경로가 `../../../redis/redis.constants` 인지 확인
- [ ] `newbie-redis.repository.ts` — `initPeriodActiveMembers`에서 `client.expire()` 호출로 TTL 설정
- [ ] `newbie-config.repository.ts` — `upsert` 시 `missionNotifyMessageId`, `mocoRankMessageId` 필드를 건드리지 않음
- [ ] `newbie-mission.repository.ts` — `findExpired`에서 `LessThan` 연산자를 typeorm에서 import
- [ ] `newbie-period.repository.ts` — `findExpired`에서 `LessThan` 연산자를 typeorm에서 import
- [ ] `newbie-config-save.dto.ts` — `missionNotifyMessageId`, `mocoRankMessageId` 필드 없음
- [ ] `newbie.module.ts` — `NewbieVoiceStateChangedHandler`가 providers에서 제외됨
- [ ] `newbie.module.ts` — `MocoService`가 exports에 포함됨
- [ ] `discord-events.module.ts` — `NewbieModule`이 imports에, `NewbieVoiceStateChangedHandler`가 providers에 추가됨
- [ ] `app.module.ts` — `NewbieModule`이 imports에 추가됨
- [ ] `voice-state.dispatcher.ts` — 트리거 채널 입장 분기(`isTrigger = true`)에서 `NEWBIE_EVENTS.VOICE_STATE_CHANGED` 미발행 확인
- [ ] `NewbieGateway` — `@On('guildMemberAdd')` 각 서비스 호출이 개별 `try-catch`로 격리됨
