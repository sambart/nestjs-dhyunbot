# J-user-detail-backend 구현 계획: 유저 상세 페이지 백엔드 API

> 작성일: 2026-03-09

## 개요

**기능**: F-VOICE-018 / F-VOICE-019 / F-VOICE-020
**참조 PRD**: `/docs/specs/prd/voice.md` § F-VOICE-018 ~ F-VOICE-020

### 기능 요약

| 기능 ID | 엔드포인트 | 설명 |
|---------|-----------|------|
| F-VOICE-018 | `GET /api/guilds/:guildId/voice/daily?userId=` | 기존 API에 `userId` 필터 추가 |
| F-VOICE-019 | `GET /api/guilds/:guildId/members/search?q=` | voice_daily 기반 멤버 검색 |
| F-VOICE-020 | `GET /api/guilds/:guildId/voice/history/:userId` | 유저 입퇴장 이력 페이지네이션 |

---

## 1. 파일 목록 (전체 변경 대상)

### 기존 수정

| 파일 | 수정 내용 |
|------|-----------|
| `apps/api/src/channel/voice/dto/voice-daily-query.dto.ts` | `userId?: string` 필드 추가 |
| `apps/api/src/channel/voice/infrastructure/voice-daily.repository.ts` | `findByGuildIdAndDateRange`에 `userId` 조건 추가 |
| `apps/api/src/channel/voice/application/voice-daily.service.ts` | `getDailyRecords`에 `userId` 파라미터 전달 |
| `apps/api/src/channel/voice/presentation/voice-daily.controller.ts` | `userId`를 `query`에서 꺼내 서비스로 전달 |
| `apps/api/src/channel/voice/voice-channel.module.ts` | 신규 컨트롤러·서비스·리포지토리 등록 |

### 신규 생성

| 파일 | 역할 |
|------|------|
| `apps/api/src/channel/voice/dto/member-search-result.dto.ts` | F-VOICE-019 응답 DTO |
| `apps/api/src/channel/voice/dto/voice-history-query.dto.ts` | F-VOICE-020 쿼리 파라미터 DTO |
| `apps/api/src/channel/voice/dto/voice-history-page.dto.ts` | F-VOICE-020 응답 DTO (페이지네이션 래퍼 + 항목) |
| `apps/api/src/channel/voice/application/member-search.service.ts` | F-VOICE-019 서비스 |
| `apps/api/src/channel/voice/application/voice-history.service.ts` | F-VOICE-020 서비스 |
| `apps/api/src/channel/voice/presentation/member-search.controller.ts` | F-VOICE-019 컨트롤러 |
| `apps/api/src/channel/voice/presentation/voice-history.controller.ts` | F-VOICE-020 컨트롤러 |

### 수정 없음 (참조 전용)

| 파일 | 이유 |
|------|------|
| `apps/api/src/channel/voice/domain/voice-daily.entity.ts` | 스키마 변경 없음 |
| `apps/api/src/channel/voice/domain/voice-channel-history.entity.ts` | 스키마 변경 없음, 조회만 |
| `apps/api/src/channel/channel.entity.ts` | `guildId` 컬럼 이미 존재 |
| `apps/api/src/member/member.entity.ts` | `discordMemberId` 컬럼 이미 존재 |
| `apps/api/src/auth/jwt-auth.guard.ts` | 그대로 사용 |

---

## 2. 파일별 구현 계획

### 2-1. F-VOICE-018: `dto/voice-daily-query.dto.ts` (기존 수정)

**경로**: `apps/api/src/channel/voice/dto/voice-daily-query.dto.ts`

기존 `from`, `to` 두 필드에 선택적 `userId` 필드를 추가한다.

```typescript
import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class VoiceDailyQueryDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{8}$/, { message: 'from은 YYYYMMDD 형식이어야 합니다' })
  from: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{8}$/, { message: 'to는 YYYYMMDD 형식이어야 합니다' })
  to: string;

  /** 특정 유저 필터. 미제공 시 전체 유저 조회 (F-VOICE-018) */
  @IsString()
  @IsOptional()
  userId?: string;
}
```

- `@IsOptional()` + `@IsString()` 조합: 파라미터가 없으면 검증 스킵, 있으면 문자열 검증
- `userId` 포맷 검증(`@Matches`)은 PRD에 명시 없으므로 추가하지 않음

---

### 2-2. F-VOICE-018: `infrastructure/voice-daily.repository.ts` (기존 수정)

**경로**: `apps/api/src/channel/voice/infrastructure/voice-daily.repository.ts`

`findByGuildIdAndDateRange` 메서드 시그니처에 `userId?: string`을 추가하고, 제공된 경우 WHERE 조건을 추가한다. 기존 write 메서드 3종은 변경하지 않는다.

```typescript
async findByGuildIdAndDateRange(
  guildId: string,
  from: string,
  to: string,
  userId?: string,
): Promise<VoiceDailyEntity[]> {
  const qb = this.repo
    .createQueryBuilder('vd')
    .where('vd."guildId" = :guildId', { guildId })
    .andWhere('vd.date BETWEEN :from AND :to', { from, to });

  if (userId) {
    qb.andWhere('vd."userId" = :userId', { userId });
  }

  return qb.getMany();
}
```

- `userId`는 선택적이므로 조건 없을 때는 기존 F-VOICE-017과 동일하게 동작
- 새 import 불필요 (이미 `Repository`, `VoiceDailyEntity` import 존재)

---

### 2-3. F-VOICE-018: `application/voice-daily.service.ts` (기존 수정)

**경로**: `apps/api/src/channel/voice/application/voice-daily.service.ts`

`getDailyRecords` 메서드에 `userId?: string` 파라미터를 추가하고 리포지토리로 전달한다.

```typescript
async getDailyRecords(
  guildId: string,
  from: string,
  to: string,
  userId?: string,
): Promise<VoiceDailyRecordDto[]> {
  const entities = await this.voiceDailyRepository.findByGuildIdAndDateRange(
    guildId,
    from,
    to,
    userId,
  );
  return entities.map((e) => ({
    guildId: e.guildId,
    userId: e.userId,
    userName: e.userName,
    date: e.date,
    channelId: e.channelId,
    channelName: e.channelName,
    channelDurationSec: e.channelDurationSec,
    micOnSec: e.micOnSec,
    micOffSec: e.micOffSec,
    aloneSec: e.aloneSec,
  }));
}
```

- 매핑 로직은 변경 없음, 시그니처만 확장

---

### 2-4. F-VOICE-018: `presentation/voice-daily.controller.ts` (기존 수정)

**경로**: `apps/api/src/channel/voice/presentation/voice-daily.controller.ts`

`query.userId`를 서비스로 전달한다. `VoiceDailyQueryDto` 자체에 `userId` 필드가 추가되므로 컨트롤러 import 변경 없음.

```typescript
@Get('daily')
async getDailyRecords(
  @Param('guildId') guildId: string,
  @Query() query: VoiceDailyQueryDto,
): Promise<VoiceDailyRecordDto[]> {
  return this.voiceDailyService.getDailyRecords(
    guildId,
    query.from,
    query.to,
    query.userId,
  );
}
```

- `query.userId`는 `undefined`일 수 있으므로 서비스 시그니처와 타입 일치

---

### 2-5. F-VOICE-019: `dto/member-search-result.dto.ts` (신규)

**경로**: `apps/api/src/channel/voice/dto/member-search-result.dto.ts`

```typescript
export class MemberSearchResultDto {
  userId: string;
  userName: string;
}
```

- import 없음 (순수 클래스)

---

### 2-6. F-VOICE-019: `application/member-search.service.ts` (신규)

**경로**: `apps/api/src/channel/voice/application/member-search.service.ts`

PRD § F-VOICE-019에 따라 `voice_daily` 테이블의 `userName` 컬럼에 LIKE 검색 후 `userId` 중복 제거, `userName` 오름차순, 최대 20개 반환.

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { VoiceDailyEntity } from '../domain/voice-daily.entity';
import { MemberSearchResultDto } from '../dto/member-search-result.dto';

@Injectable()
export class MemberSearchService {
  constructor(
    @InjectRepository(VoiceDailyEntity)
    private readonly voiceDailyRepo: Repository<VoiceDailyEntity>,
  ) {}

  async search(guildId: string, q: string): Promise<MemberSearchResultDto[]> {
    const rows = await this.voiceDailyRepo
      .createQueryBuilder('vd')
      .select('vd."userId"', 'userId')
      .addSelect('MIN(vd."userName")', 'userName')
      .where('vd."guildId" = :guildId', { guildId })
      .andWhere('vd."userName" ILIKE :q', { q: `%${q}%` })
      .groupBy('vd."userId"')
      .orderBy('MIN(vd."userName")', 'ASC')
      .limit(20)
      .getRawMany<{ userId: string; userName: string }>();

    return rows.map((r) => ({ userId: r.userId, userName: r.userName }));
  }
}
```

- `ILIKE`를 사용해 대소문자 무관 검색 (PostgreSQL 전용, 프로젝트가 PostgreSQL만 사용하므로 적합)
- `GROUP BY userId + MIN(userName)`: 동일 userId의 여러 날짜 레코드를 중복 제거하면서 userName 하나를 선택
- `@InjectRepository(VoiceDailyEntity)` — 모듈에서 이미 `TypeOrmModule.forFeature([VoiceDailyEntity])` 등록되어 있으므로 추가 설정 불필요

---

### 2-7. F-VOICE-019: `presentation/member-search.controller.ts` (신규)

**경로**: `apps/api/src/channel/voice/presentation/member-search.controller.ts`

```typescript
import { BadRequestException, Controller, Get, Param, Query, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../../../auth/jwt-auth.guard';
import { MemberSearchService } from '../application/member-search.service';
import { MemberSearchResultDto } from '../dto/member-search-result.dto';

@Controller('api/guilds/:guildId/members')
@UseGuards(JwtAuthGuard)
export class MemberSearchController {
  constructor(private readonly memberSearchService: MemberSearchService) {}

  /**
   * GET /api/guilds/:guildId/members/search?q=키워드
   * F-VOICE-019: voice_daily userName LIKE 검색
   */
  @Get('search')
  async search(
    @Param('guildId') guildId: string,
    @Query('q') q: string,
  ): Promise<MemberSearchResultDto[]> {
    if (!q || q.trim().length === 0) {
      throw new BadRequestException('q 파라미터는 필수입니다');
    }
    return this.memberSearchService.search(guildId, q.trim());
  }
}
```

- PRD: `q` 누락 시 400 응답 → 컨트롤러에서 직접 검증 (`ValidationPipe`는 `@Query()` 바인딩 DTO가 아닌 단순 string에는 자동 검증 불가하므로 수동 검증)
- `q.trim()` 후 서비스에 전달하여 공백만 있는 경우도 400 처리
- `@Controller('api/guilds/:guildId/members')` — 기존 컨트롤러들(`voice`, `excluded-channels`)과 prefix 충돌 없음

---

### 2-8. F-VOICE-020: `dto/voice-history-query.dto.ts` (신규)

**경로**: `apps/api/src/channel/voice/dto/voice-history-query.dto.ts`

```typescript
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

export class VoiceHistoryQueryDto {
  /** 조회 시작 날짜 (YYYYMMDD, 선택) */
  @IsString()
  @IsOptional()
  @Matches(/^\d{8}$/, { message: 'from은 YYYYMMDD 형식이어야 합니다' })
  from?: string;

  /** 조회 종료 날짜 (YYYYMMDD, 선택) */
  @IsString()
  @IsOptional()
  @Matches(/^\d{8}$/, { message: 'to는 YYYYMMDD 형식이어야 합니다' })
  to?: string;

  /** 페이지 번호 (1부터 시작, 기본값: 1) */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  /** 페이지당 항목 수 (기본값: 20, 최대: 100) */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
```

- `@Type(() => Number)`: 쿼리 파라미터는 문자열로 수신되므로 class-transformer로 숫자 변환 필요
- `from`, `to` 모두 선택적 — 미제공 시 날짜 범위 제한 없음
- 글로벌 ValidationPipe에 `transform: true` 설정 여부 확인 필요 (아래 섹션 3-5 참조)

---

### 2-9. F-VOICE-020: `dto/voice-history-page.dto.ts` (신규)

**경로**: `apps/api/src/channel/voice/dto/voice-history-page.dto.ts`

```typescript
export class VoiceHistoryItemDto {
  id: number;
  channelId: string;
  channelName: string;
  joinAt: string;        // ISO 8601 문자열
  leftAt: string | null; // null이면 아직 퇴장 전
  durationSec: number | null;
}

export class VoiceHistoryPageDto {
  total: number;
  page: number;
  limit: number;
  items: VoiceHistoryItemDto[];
}
```

- `joinAt`, `leftAt`은 `Date` 객체가 아닌 ISO 문자열로 직렬화 — `toISOString()` 호출은 서비스에서 수행
- `durationSec`은 `leftAt`이 null일 때 null

---

### 2-10. F-VOICE-020: `application/voice-history.service.ts` (신규)

**경로**: `apps/api/src/channel/voice/application/voice-history.service.ts`

PRD § F-VOICE-020에 따라 `VoiceChannelHistory`를 `member.discordMemberId = userId AND channel.guildId = guildId` 조건으로 조회한다.

**엔티티 관계 파악**:
- `VoiceChannelHistory.member` → `Member` (ManyToOne, eager 아님 — 명시적 join 필요)
- `VoiceChannelHistory.channel` → `Channel` (ManyToOne, eager 아님 — 명시적 join 필요)
- `Channel.guildId` 컬럼 존재 (nullable)
- `Member.discordMemberId` 컬럼 존재

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { VoiceChannelHistory } from '../domain/voice-channel-history.entity';
import { VoiceHistoryItemDto, VoiceHistoryPageDto } from '../dto/voice-history-page.dto';
import { VoiceHistoryQueryDto } from '../dto/voice-history-query.dto';

@Injectable()
export class VoiceHistoryService {
  constructor(
    @InjectRepository(VoiceChannelHistory)
    private readonly historyRepo: Repository<VoiceChannelHistory>,
  ) {}

  async getHistory(
    guildId: string,
    userId: string,
    query: VoiceHistoryQueryDto,
  ): Promise<VoiceHistoryPageDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const qb = this.historyRepo
      .createQueryBuilder('h')
      .innerJoin('h.member', 'm')
      .innerJoin('h.channel', 'c')
      .addSelect(['m.discordMemberId', 'c.discordChannelId', 'c.channelName'])
      .where('m."discordMemberId" = :userId', { userId })
      .andWhere('c."guildId" = :guildId', { guildId })
      .orderBy('h."joinAt"', 'DESC')
      .skip(skip)
      .take(limit);

    if (query.from) {
      // from은 YYYYMMDD 형식 → DATE 캐스팅으로 joinAt 날짜 비교
      qb.andWhere("DATE(h.\"joinAt\" AT TIME ZONE 'Asia/Seoul') >= TO_DATE(:from, 'YYYYMMDD')", {
        from: query.from,
      });
    }
    if (query.to) {
      qb.andWhere("DATE(h.\"joinAt\" AT TIME ZONE 'Asia/Seoul') <= TO_DATE(:to, 'YYYYMMDD')", {
        to: query.to,
      });
    }

    const [items, total] = await qb.getManyAndCount();

    return {
      total,
      page,
      limit,
      items: items.map((h) => this.toItemDto(h)),
    };
  }

  private toItemDto(h: VoiceChannelHistory): VoiceHistoryItemDto {
    return {
      id: h.id,
      channelId: h.channel.discordChannelId,
      channelName: h.channel.channelName,
      joinAt: h.joinedAt.toISOString(),
      leftAt: h.leftAt ? h.leftAt.toISOString() : null,
      durationSec: h.duration,
    };
  }
}
```

**타임존 처리 근거**:
- DB는 `Asia/Seoul` 타임존 기준(TypeORM `timezone` 설정)
- `from`/`to`는 날짜(YYYYMMDD)이므로 `joinAt` timestamp를 서울 시간 기준 날짜로 캐스팅하여 비교
- `TO_DATE(:from, 'YYYYMMDD')` — PostgreSQL 내장 함수, 별도 라이브러리 불필요

**조인 전략**:
- `innerJoin` 사용: member/channel이 없는 이력 레코드는 데이터 정합성 이슈이므로 제외
- `addSelect`로 join된 엔티티의 필요 컬럼만 선택하여 불필요한 컬럼 조회 최소화
- `getManyAndCount()` 한 번의 쿼리 쌍으로 items + total 동시 조회 (TypeORM이 COUNT 서브쿼리 자동 생성)

---

### 2-11. F-VOICE-020: `presentation/voice-history.controller.ts` (신규)

**경로**: `apps/api/src/channel/voice/presentation/voice-history.controller.ts`

```typescript
import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../../../auth/jwt-auth.guard';
import { VoiceHistoryService } from '../application/voice-history.service';
import { VoiceHistoryPageDto } from '../dto/voice-history-page.dto';
import { VoiceHistoryQueryDto } from '../dto/voice-history-query.dto';

@Controller('api/guilds/:guildId/voice')
@UseGuards(JwtAuthGuard)
export class VoiceHistoryController {
  constructor(private readonly voiceHistoryService: VoiceHistoryService) {}

  /**
   * GET /api/guilds/:guildId/voice/history/:userId
   * F-VOICE-020: 유저 입퇴장 이력 페이지네이션 조회
   */
  @Get('history/:userId')
  async getHistory(
    @Param('guildId') guildId: string,
    @Param('userId') userId: string,
    @Query() query: VoiceHistoryQueryDto,
  ): Promise<VoiceHistoryPageDto> {
    return this.voiceHistoryService.getHistory(guildId, userId, query);
  }
}
```

- `@Controller('api/guilds/:guildId/voice')` — `VoiceDailyController`와 동일 prefix
- `@Get('history/:userId')` → 최종 경로: `GET /api/guilds/:guildId/voice/history/:userId`
- 기존 `@Get('daily')` 경로와 충돌 없음

---

### 2-12. `voice-channel.module.ts` (기존 수정)

**경로**: `apps/api/src/channel/voice/voice-channel.module.ts`

#### 추가할 import 구문

```typescript
import { MemberSearchService } from './application/member-search.service';
import { VoiceHistoryService } from './application/voice-history.service';
import { MemberSearchController } from './presentation/member-search.controller';
import { VoiceHistoryController } from './presentation/voice-history.controller';
```

#### `controllers` 배열 변경

```typescript
controllers: [
  VoiceExcludedChannelController,
  VoiceDailyController,
  MemberSearchController,   // 추가
  VoiceHistoryController,   // 추가
],
```

#### `providers` 배열 변경

```typescript
// 기존 VoiceDailyService 아래에 추가
MemberSearchService,
VoiceHistoryService,
```

#### `TypeOrmModule.forFeature` — 변경 없음

`VoiceChannelHistory`와 `VoiceDailyEntity`는 이미 등록되어 있다.

```typescript
TypeOrmModule.forFeature([VoiceChannelHistory, VoiceDailyEntity, VoiceExcludedChannel])
```

`MemberSearchService`는 `VoiceDailyEntity` 리포지토리를, `VoiceHistoryService`는 `VoiceChannelHistory` 리포지토리를 사용하므로 추가 등록 불필요.

#### `exports` 배열 — 변경 없음

신규 서비스들은 외부 모듈에서 사용하지 않는다.

---

## 3. 기존 코드와의 충돌 검증

### 3-1. 라우트 경로 충돌 없음

| 컨트롤러 | prefix | path | 최종 경로 |
|----------|--------|------|-----------|
| `VoiceExcludedChannelController` | `api/guilds/:guildId/voice` | `excluded-channels` | `GET/POST/DELETE /api/guilds/:guildId/voice/excluded-channels` |
| `VoiceDailyController` | `api/guilds/:guildId/voice` | `daily` | `GET /api/guilds/:guildId/voice/daily` |
| `VoiceHistoryController` | `api/guilds/:guildId/voice` | `history/:userId` | `GET /api/guilds/:guildId/voice/history/:userId` |
| `MemberSearchController` | `api/guilds/:guildId/members` | `search` | `GET /api/guilds/:guildId/members/search` |

모든 경로가 고유하며 충돌 없음.

### 3-2. Repository 기존 메서드 보존

`VoiceDailyRepository.findByGuildIdAndDateRange`의 기존 파라미터(`guildId`, `from`, `to`)는 그대로 유지하고 `userId?`를 선택적으로 추가하므로 기존 호출부(`VoiceDailyService`)와 호환된다. 다른 write 메서드 3종은 변경 없음.

### 3-3. VoiceChannelHistory 기존 서비스와 분리

`VoiceChannelHistoryService`는 write 전용(`logJoin`, `logLeave`)이며 `DataSource` 의존성을 가진다. 신규 `VoiceHistoryService`는 read 전용이며 `Repository<VoiceChannelHistory>`만 사용한다. 두 서비스는 독립적으로 공존한다.

### 3-4. MemberSearchService와 VoiceStatsQueryService 역할 분리

`VoiceStatsQueryService`는 봇 슬래시 명령(`/voice rank`)에서 SUM 집계를 수행한다. `MemberSearchService`는 웹 API 검색 전용이며 상호 의존성 없음.

### 3-5. ValidationPipe `transform: true` 확인 필요

`VoiceHistoryQueryDto`의 `page`, `limit` 필드에 `@Type(() => Number)` 데코레이터를 적용하기 위해서는 글로벌 ValidationPipe에 `transform: true`가 설정되어 있어야 한다. 설정이 없으면 쿼리 파라미터 숫자 변환이 되지 않는다.

확인 경로: `apps/api/src/main.ts` 또는 `AppModule`에서 `new ValidationPipe({ transform: true })`를 사용하는지 확인한다. 이미 설정되어 있다면 추가 작업 불필요.

### 3-6. VoiceChannelHistory join 컬럼명 검증

`VoiceChannelHistory` 엔티티에서:
- `joinedAt` — DB 컬럼명 `joinAt` (`@Column({ name: 'joinAt' })`), 엔티티 프로퍼티명 `joinedAt`
- QueryBuilder에서 `h."joinAt"` — DB 컬럼명 사용 (raw SQL 레벨)
- TypeORM createQueryBuilder에서는 엔티티 프로퍼티명 `joinedAt`을 사용해야 하므로 `orderBy('h.joinedAt', 'DESC')`로 작성

수정:
```typescript
.orderBy('h.joinedAt', 'DESC')
```

날짜 범위 필터에서 raw SQL 조각 내의 컬럼 참조도 동일하게 DB 컬럼명 `joinAt` 대신 TypeORM의 컬럼명 alias를 따른다:
```typescript
"DATE(h.joinedAt AT TIME ZONE 'Asia/Seoul') >= TO_DATE(:from, 'YYYYMMDD')"
```

> TypeORM QueryBuilder의 `andWhere` 내부 raw 조각에서도 엔티티 프로퍼티명(`joinedAt`)을 쓰면 TypeORM이 alias를 처리한다.

---

## 4. 구현 순서

의존 관계에 따라 아래 순서로 구현한다. 같은 번호는 병렬 작업 가능.

1. DTO 파일 4종 (의존성 없음, 병렬 작업 가능)
   - `dto/voice-daily-query.dto.ts` (수정)
   - `dto/member-search-result.dto.ts` (신규)
   - `dto/voice-history-query.dto.ts` (신규)
   - `dto/voice-history-page.dto.ts` (신규)

2. 리포지토리 수정 (DTO 완료 후)
   - `infrastructure/voice-daily.repository.ts` — `userId?` 파라미터 추가

3. 서비스 파일 3종 (DTO + 리포지토리 완료 후, 병렬 작업 가능)
   - `application/voice-daily.service.ts` (수정)
   - `application/member-search.service.ts` (신규)
   - `application/voice-history.service.ts` (신규)

4. 컨트롤러 파일 3종 (각 서비스 완료 후, 병렬 작업 가능)
   - `presentation/voice-daily.controller.ts` (수정)
   - `presentation/member-search.controller.ts` (신규)
   - `presentation/voice-history.controller.ts` (신규)

5. 모듈 등록
   - `voice-channel.module.ts` — 신규 컨트롤러·서비스 import 및 배열 추가

---

## 5. 검증 항목

### F-VOICE-018

- [ ] `GET /api/guilds/:guildId/voice/daily?from=20260301&to=20260309` — 기존과 동일하게 전체 유저 200 응답
- [ ] `GET /api/guilds/:guildId/voice/daily?from=20260301&to=20260309&userId=111` — 해당 userId만 필터된 배열 반환
- [ ] `userId=존재하지않는ID` — 빈 배열 `[]` 반환 (에러 없음)
- [ ] `userId` 없을 때 기존 F-VOICE-017 동작 유지
- [ ] JWT 없이 요청 시 401 Unauthorized

### F-VOICE-019

- [ ] `GET /api/guilds/:guildId/members/search?q=DHy` — userName LIKE 검색 결과 반환
- [ ] `q` 파라미터 누락 시 400 BadRequest
- [ ] `q=   ` (공백만) 시 400 BadRequest
- [ ] 동일 userId 중복 제거 확인 (여러 날짜 레코드가 1개로 집계)
- [ ] 결과가 `userName` 오름차순인지 확인
- [ ] 결과가 최대 20개인지 확인
- [ ] JWT 없이 요청 시 401 Unauthorized

### F-VOICE-020

- [ ] `GET /api/guilds/:guildId/voice/history/:userId` — 기본(page=1, limit=20) 응답
- [ ] `page`, `limit` 파라미터로 페이지네이션 동작 확인
- [ ] `from`, `to` 필터 적용 시 해당 날짜 범위만 반환
- [ ] `leftAt`이 null인 레코드 → 응답에서 `leftAt: null`, `durationSec: null`
- [ ] `total` 값이 실제 전체 건수와 일치
- [ ] `limit=101` 요청 시 400 BadRequest (Max(100) 검증)
- [ ] JWT 없이 요청 시 401 Unauthorized
