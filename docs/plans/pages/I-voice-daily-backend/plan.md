# VD-1 구현 계획: 음성 일별 통계 조회 API (백엔드)

> 작성일: 2026-03-09

## 개요

**기능**: F-VOICE-017 — `GET /api/guilds/:guildId/voice/daily?from=YYYYMMDD&to=YYYYMMDD`
**단위**: VD-1 (단일 단위 구현)
**참조 PRD**: `/docs/specs/prd/voice.md` § F-VOICE-017
**참조 공통모듈**: `/docs/specs/common-modules.md` § VD-1 섹션 (lines 2379–2589)

---

## 1. 파일 목록 (변경 대상 전체)

### 신규 생성

| 파일 | 역할 |
|------|------|
| `apps/api/src/channel/voice/dto/voice-daily-record.dto.ts` | 응답 DTO |
| `apps/api/src/channel/voice/dto/voice-daily-query.dto.ts` | 쿼리 파라미터 DTO |
| `apps/api/src/channel/voice/application/voice-daily.service.ts` | 서비스 |
| `apps/api/src/channel/voice/presentation/voice-daily.controller.ts` | 컨트롤러 |

### 기존 수정

| 파일 | 수정 내용 |
|------|-----------|
| `apps/api/src/channel/voice/infrastructure/voice-daily.repository.ts` | `findByGuildIdAndDateRange` 메서드 추가 |
| `apps/api/src/channel/voice/voice-channel.module.ts` | `VoiceDailyController`, `VoiceDailyService` 등록 |

### 수정 없음 (참조 전용)

| 파일 | 이유 |
|------|------|
| `apps/api/src/channel/voice/domain/voice-daily.entity.ts` | 스키마 변경 없음 |
| `apps/api/src/auth/jwt-auth.guard.ts` | 그대로 사용 |

---

## 2. 파일별 구현 계획

### 2-1. `dto/voice-daily-record.dto.ts`

**경로**: `apps/api/src/channel/voice/dto/voice-daily-record.dto.ts`

FE와 계약하는 응답 형식. `VoiceDailyEntity`의 컬럼과 1:1 대응하며 필드명 변환 없음.
class-transformer/class-validator 데코레이터 불필요 (응답 직렬화 전용).

```typescript
export class VoiceDailyRecordDto {
  guildId: string;
  userId: string;
  userName: string;
  date: string;             // YYYYMMDD
  channelId: string;        // 'GLOBAL' 포함
  channelName: string;
  channelDurationSec: number;
  micOnSec: number;
  micOffSec: number;
  aloneSec: number;
}
```

- import 없음 (순수 클래스)
- 기존 dto 파일(`voice-excluded-channel-save.dto.ts`, `voice-excluded-channel-sync.dto.ts`)과 파일명 충돌 없음

---

### 2-2. `dto/voice-daily-query.dto.ts`

**경로**: `apps/api/src/channel/voice/dto/voice-daily-query.dto.ts`

`@Query()` 바인딩용 DTO. `from`, `to` 모두 필수이며 YYYYMMDD 8자리 숫자 형식 검증.

```typescript
import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class VoiceDailyQueryDto {
  /** 조회 시작 날짜 (YYYYMMDD, 필수) */
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{8}$/, { message: 'from은 YYYYMMDD 형식이어야 합니다' })
  from: string;

  /** 조회 종료 날짜 (YYYYMMDD, 필수) */
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{8}$/, { message: 'to는 YYYYMMDD 형식이어야 합니다' })
  to: string;
}
```

- `class-validator`의 `IsString`, `IsNotEmpty`, `Matches` 사용 (기존 save.dto.ts와 동일한 라이브러리)
- `@Matches(/^\d{8}$/)` — 8자리 숫자(YYYYMMDD) 포맷 검증
- ValidationPipe는 이미 전역 설정되어 있으므로 별도 파이프 등록 불필요

---

### 2-3. `infrastructure/voice-daily.repository.ts` (기존 파일 수정)

**경로**: `apps/api/src/channel/voice/infrastructure/voice-daily.repository.ts`

기존 write 메서드 3종(`accumulateChannelDuration`, `accumulateMicDuration`, `accumulateAloneDuration`)은 그대로 유지하고, 파일 맨 아래에 조회 메서드를 추가한다.

추가할 메서드:

```typescript
async findByGuildIdAndDateRange(
  guildId: string,
  from: string,
  to: string,
): Promise<VoiceDailyEntity[]> {
  return this.repo
    .createQueryBuilder('vd')
    .where('vd."guildId" = :guildId', { guildId })
    .andWhere('vd.date BETWEEN :from AND :to', { from, to })
    .getMany();
}
```

- 신규 import 불필요 (이미 `Repository`, `VoiceDailyEntity` import 존재)
- `date` 컬럼은 `string` 타입(`YYYYMMDD`)이므로 문자열 비교로 BETWEEN 정렬이 올바르게 동작
- `channelId = 'GLOBAL'` 포함 — 필터링 없이 전체 반환 (FE에서 분류)

---

### 2-4. `application/voice-daily.service.ts` (신규)

**경로**: `apps/api/src/channel/voice/application/voice-daily.service.ts`

대시보드 API 전용 서비스. `VoiceStatsQueryService`(봇 슬래시 명령용)와 역할이 분리되며 의존성이 없음.

```typescript
import { Injectable } from '@nestjs/common';

import { VoiceDailyRecordDto } from '../dto/voice-daily-record.dto';
import { VoiceDailyRepository } from '../infrastructure/voice-daily.repository';

@Injectable()
export class VoiceDailyService {
  constructor(
    private readonly voiceDailyRepository: VoiceDailyRepository,
  ) {}

  /**
   * 음성 일별 통계 조회 (F-VOICE-017).
   * guildId + date BETWEEN from AND to 조건으로 전체 레코드 반환.
   */
  async getDailyRecords(
    guildId: string,
    from: string,
    to: string,
  ): Promise<VoiceDailyRecordDto[]> {
    const entities = await this.voiceDailyRepository.findByGuildIdAndDateRange(
      guildId,
      from,
      to,
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
}
```

- 의존성: `VoiceDailyRepository`만 사용
- `VoiceDailyEntity[]`를 plain object 매핑으로 `VoiceDailyRecordDto[]`로 변환한다. TypeORM 엔티티 인스턴스를 그대로 반환하면 직렬화 시 예상치 못한 프로토타입 프로퍼티가 포함될 수 있으므로 명시적 매핑을 사용한다.
- `VoiceDailyFlushService`에 의존하지 않음 (실시간 flush는 API 요구사항 외)
- Redis 캐시 없음 (PRD F-VOICE-017에 캐싱 명시 없음)

---

### 2-5. `presentation/voice-daily.controller.ts` (신규)

**경로**: `apps/api/src/channel/voice/presentation/voice-daily.controller.ts`

`VoiceExcludedChannelController` 패턴과 동일하게 작성.

```typescript
import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../../../auth/jwt-auth.guard';
import { VoiceDailyService } from '../application/voice-daily.service';
import { VoiceDailyQueryDto } from '../dto/voice-daily-query.dto';
import { VoiceDailyRecordDto } from '../dto/voice-daily-record.dto';

@Controller('api/guilds/:guildId/voice')
@UseGuards(JwtAuthGuard)
export class VoiceDailyController {
  constructor(private readonly voiceDailyService: VoiceDailyService) {}

  /**
   * GET /api/guilds/:guildId/voice/daily?from=YYYYMMDD&to=YYYYMMDD
   * 음성 일별 통계 조회 (F-VOICE-017).
   */
  @Get('daily')
  async getDailyRecords(
    @Param('guildId') guildId: string,
    @Query() query: VoiceDailyQueryDto,
  ): Promise<VoiceDailyRecordDto[]> {
    return this.voiceDailyService.getDailyRecords(guildId, query.from, query.to);
  }
}
```

- `@Controller('api/guilds/:guildId/voice')` — 기존 excluded-channels 컨트롤러는 `api/guilds/:guildId/voice/excluded-channels`이므로 경로 충돌 없음
- `@Get('daily')` — 최종 경로: `GET /api/guilds/:guildId/voice/daily`
- `@UseGuards(JwtAuthGuard)` — 클래스 레벨 적용 (excluded-channel.controller.ts와 동일)
- `@Query() query: VoiceDailyQueryDto` — ValidationPipe 전역 등록으로 자동 검증

---

### 2-6. `voice-channel.module.ts` (기존 파일 수정)

**경로**: `apps/api/src/channel/voice/voice-channel.module.ts`

`controllers` 배열에 `VoiceDailyController` 추가, `providers` 배열에 `VoiceDailyService` 추가. 나머지 기존 항목은 변경 없음.

변경 위치:

```typescript
// import 추가 (기존 import 블록 하단)
import { VoiceDailyService } from './application/voice-daily.service';
import { VoiceDailyController } from './presentation/voice-daily.controller';

// controllers 배열
controllers: [VoiceExcludedChannelController, VoiceDailyController],

// providers 배열 (기존 VoiceDailyRepository 아래에 추가)
VoiceDailyService,
```

- `TypeOrmModule.forFeature([VoiceChannelHistory, VoiceDailyEntity, VoiceExcludedChannel])` — `VoiceDailyEntity`는 이미 등록되어 있으므로 변경 불필요
- `exports` 배열 변경 없음 (VoiceDailyService는 외부 모듈에서 사용 불필요)
- `AppModule`, `DiscordEventsModule` 수정 불필요

---

## 3. 기존 코드와의 충돌 검증

### 3-1. 파일명 충돌 없음

| 신규 파일 | 기존 파일 | 판정 |
|-----------|-----------|------|
| `voice-daily-record.dto.ts` | `voice-excluded-channel-save.dto.ts`, `voice-excluded-channel-sync.dto.ts` | 충돌 없음 |
| `voice-daily-query.dto.ts` | 위 동일 | 충돌 없음 |
| `voice-daily.service.ts` | `voice-daily-flush-service.ts`, `voice-stats-query.service.ts` | 충돌 없음 |
| `voice-daily.controller.ts` | `voice-excluded-channel.controller.ts` | 충돌 없음 |

### 3-2. 라우트 경로 충돌 없음

| 컨트롤러 | 경로 |
|----------|------|
| 기존 `VoiceExcludedChannelController` | `api/guilds/:guildId/voice/excluded-channels` |
| 신규 `VoiceDailyController` | `api/guilds/:guildId/voice/daily` |

두 경로의 마지막 세그먼트(`excluded-channels` vs `daily`)가 다르므로 충돌 없음.

### 3-3. Repository 기존 메서드 보존

`VoiceDailyRepository`의 기존 write 메서드 3종 시그니처는 변경하지 않는다.
`findByGuildIdAndDateRange`는 append-only 추가.

### 3-4. VoiceStatsQueryService와 역할 분리

`VoiceStatsQueryService`는 Discord 봇 슬래시 명령(`/voice time`, `/voice rank`)에서 SUM·랭킹 집계를 수행하며 `VoiceDailyFlushService`에 의존한다. `VoiceDailyService`는 대시보드 원시 레코드 조회만 수행하며 flush 의존성이 없다. 역할이 명확히 분리되어 중복 없음.

### 3-5. 상위 모듈 변경 불필요

`VoiceChannelModule`은 이미 `AppModule`에서 import 중이므로 `AppModule` 수정 불필요.
`VoiceDailyService`는 Discord 이벤트와 무관하므로 `DiscordEventsModule` 수정 불필요.

---

## 4. 구현 순서

의존성에 따라 아래 순서로 구현한다.

1. `voice-daily-record.dto.ts` — 의존성 없음
2. `voice-daily-query.dto.ts` — 의존성 없음 (`class-validator`만 사용)
3. `voice-daily.repository.ts` — 기존 파일에 메서드 추가 (`VoiceDailyEntity` 기존 import 재사용)
4. `voice-daily.service.ts` — DTO(1), Repository(3) 완료 후
5. `voice-daily.controller.ts` — DTO(1, 2), Service(4) 완료 후
6. `voice-channel.module.ts` — Controller(5), Service(4) 완료 후

단계 1–2는 병렬 작성 가능. 단계 3도 1–2와 병렬 가능.

---

## 5. 검증 항목

구현 완료 후 아래를 확인한다.

- [ ] `GET /api/guilds/:guildId/voice/daily?from=20260301&to=20260309` — 정상 200 응답, `VoiceDailyRecord[]` 반환
- [ ] `from` 또는 `to` 누락 시 400 BadRequest (ValidationPipe 동작)
- [ ] `from=2026030` (7자리) 전달 시 400 BadRequest (`@Matches` 동작)
- [ ] JWT 없이 요청 시 401 Unauthorized (JwtAuthGuard 동작)
- [ ] `channelId = 'GLOBAL'` 레코드도 결과에 포함되는지 확인
- [ ] `from > to` 범위(빈 결과) 시 빈 배열 `[]` 반환 (에러 없음)
