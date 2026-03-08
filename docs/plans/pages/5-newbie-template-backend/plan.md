# 신입 미션/모코코 Embed 템플릿 커스터마이징 — 백엔드 구현 계획

## 개요

| 항목 | 내용 |
|------|------|
| 관련 PRD | F-NEWBIE-002-TMPL, F-NEWBIE-003-TMPL (`/docs/specs/prd/newbie.md`) |
| 관련 DB 스키마 | NewbieMissionTemplate, NewbieMocoTemplate (`/docs/specs/database/_index.md` §11, §12) |
| 대상 경로 | `apps/api/src/newbie/` |

### 목적

현재 `mission.service.ts`와 `moco.service.ts`의 Embed 생성 로직은 `NewbieConfig`의 `missionEmbedTitle`, `missionEmbedDescription` 등 단순 문자열 필드에 의존한다. 이 계획은 이를 `NewbieMissionTemplate` / `NewbieMocoTemplate` 테이블 기반의 세분화된 템플릿 시스템으로 교체한다.

### 선행 확인 사항 (기존 코드 분석)

1. `NewbieMissionTemplate` / `NewbieMocoTemplate` Entity 파일이 이미 존재한다 (`domain/` 디렉토리).
2. `newbie.module.ts`의 `TypeOrmModule.forFeature`에 두 Entity가 이미 등록되어 있다.
3. 두 Entity에 대한 Repository 클래스는 아직 존재하지 않는다.
4. `NewbieConfig` Entity에는 `missionEmbedTitle`, `missionEmbedDescription`, `missionEmbedColor`, `missionEmbedThumbnailUrl`, `mocoEmbedTitle`, `mocoEmbedDescription`, `mocoEmbedColor`, `mocoEmbedThumbnailUrl` 필드가 남아 있으나, 이번 작업 범위에서는 제거하지 않고 Embed 빌드 시 무시한다 (마이그레이션 범위 최소화).
5. `mission.service.ts`의 `buildMissionEmbed`는 하드코딩된 문자열과 `config.missionEmbedTitle` 등을 조합하며, 내부에 `applyTemplate` 유틸이 `private` 메서드로 중복 구현되어 있다. `moco.service.ts`도 동일하다.
6. `newbie-mission.constants.ts`에 `MISSION_STATUS_EMOJI`, `MISSION_STATUS_TEXT` 상수가 이미 존재한다. 이를 기본값 상수 파일로 통합한다.

---

## 생성/수정 파일 목록

### 신규 생성

```
apps/api/src/newbie/infrastructure/
  newbie-mission-template.repository.ts
  newbie-moco-template.repository.ts
  newbie-template.constants.ts          (기본값 상수)

apps/api/src/newbie/util/
  newbie-template.util.ts               (applyTemplate 공통 유틸)
  newbie-template-validator.util.ts     (허용 변수 목록 + findInvalidVars)

apps/api/src/newbie/dto/
  newbie-mission-template-save.dto.ts
  newbie-moco-template-save.dto.ts
```

### 기존 수정

```
apps/api/src/newbie/newbie.module.ts            — Repository 2개 providers/exports 등록
apps/api/src/newbie/newbie.controller.ts        — 엔드포인트 4개 추가
apps/api/src/newbie/mission/mission.service.ts  — buildMissionEmbed 템플릿 기반으로 교체
apps/api/src/newbie/moco/moco.service.ts        — buildHunterEmbed 템플릿 기반으로 교체
```

---

## 단계별 구현 상세

### 1단계: `newbie-template.constants.ts` — 기본값 및 허용 변수 상수

**경로**: `apps/api/src/newbie/infrastructure/newbie-template.constants.ts`

기존 `newbie-mission.constants.ts`의 `MISSION_STATUS_EMOJI` / `MISSION_STATUS_TEXT`와 충돌하지 않도록, 이 파일은 템플릿 전용 기본값과 허용 변수 목록만 정의한다. 기존 상수는 그대로 유지한다.

```typescript
import { MissionStatus } from '../domain/newbie-mission.entity';
import { StatusMapping } from '../domain/newbie-mission-template.entity';

// ---- 미션 템플릿 기본값 ----

export const DEFAULT_MISSION_TITLE_TEMPLATE = '🧑‍🌾 신입 미션 체크';

export const DEFAULT_MISSION_HEADER_TEMPLATE = '🧑‍🌾 뉴비 멤버 (총 인원: {totalCount}명)';

export const DEFAULT_MISSION_ITEM_TEMPLATE =
  '{mention} 🌱\n{startDate} ~ {endDate}\n{statusEmoji} {statusText} | 플레이타임: {playtime} | 플레이횟수: {playCount}회';

export const DEFAULT_MISSION_FOOTER_TEMPLATE = '마지막 갱신: {updatedAt}';

export const DEFAULT_STATUS_MAPPING: StatusMapping = {
  [MissionStatus.IN_PROGRESS]: { emoji: '🟡', text: '진행중' },
  [MissionStatus.COMPLETED]: { emoji: '✅', text: '완료' },
  [MissionStatus.FAILED]: { emoji: '❌', text: '실패' },
};

// ---- 미션 템플릿 허용 변수 ----

export const MISSION_TITLE_ALLOWED_VARS = ['{totalCount}'] as const;

export const MISSION_HEADER_ALLOWED_VARS = [
  '{totalCount}',
  '{inProgressCount}',
  '{completedCount}',
  '{failedCount}',
] as const;

export const MISSION_ITEM_ALLOWED_VARS = [
  '{username}',
  '{mention}',
  '{startDate}',
  '{endDate}',
  '{statusEmoji}',
  '{statusText}',
  '{playtimeHour}',
  '{playtimeMin}',
  '{playtimeSec}',
  '{playtime}',
  '{playCount}',
  '{targetPlaytime}',
  '{daysLeft}',
] as const;

export const MISSION_FOOTER_ALLOWED_VARS = ['{updatedAt}'] as const;

// ---- 모코코 템플릿 기본값 ----

export const DEFAULT_MOCO_TITLE_TEMPLATE = '모코코 사냥 TOP {rank} — {hunterName} 🌱';

export const DEFAULT_MOCO_BODY_TEMPLATE =
  '총 모코코 사냥 시간: {totalMinutes}분\n\n도움을 받은 모코코들:\n{mocoList}';

export const DEFAULT_MOCO_ITEM_TEMPLATE = '– {newbieName} 🌱: {minutes}분';

export const DEFAULT_MOCO_FOOTER_TEMPLATE = '페이지 {currentPage}/{totalPages} | 자동 갱신 {interval}분';

// ---- 모코코 템플릿 허용 변수 ----

export const MOCO_TITLE_ALLOWED_VARS = ['{rank}', '{hunterName}'] as const;

export const MOCO_BODY_ALLOWED_VARS = ['{totalMinutes}', '{mocoList}'] as const;

export const MOCO_ITEM_ALLOWED_VARS = ['{newbieName}', '{minutes}'] as const;

export const MOCO_FOOTER_ALLOWED_VARS = ['{currentPage}', '{totalPages}', '{interval}'] as const;
```

**충돌 검토**: `newbie-mission.constants.ts`의 `MISSION_STATUS_EMOJI` / `MISSION_STATUS_TEXT`는 그대로 유지하고, `mission.service.ts`는 계속 이를 import한다. 새 상수 파일은 이를 덮어쓰지 않는다.

---

### 2단계: `newbie-template.util.ts` — 공통 템플릿 적용 유틸

**경로**: `apps/api/src/newbie/util/newbie-template.util.ts`

현재 `mission.service.ts`와 `moco.service.ts` 양쪽에 동일한 `applyTemplate` private 메서드가 중복 구현되어 있다. 이를 순수 함수로 추출한다. NestJS Injectable이 아닌 순수 함수로 구현하여 테스트 용이성을 높인다.

```typescript
/**
 * 템플릿 문자열의 {key} 플레이스홀더를 vars 맵의 값으로 전부 치환한다.
 * 존재하지 않는 키는 그대로 남긴다 (유효성 검사는 별도 유틸에서 수행).
 */
export function applyTemplate(template: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (result, [key, value]) => result.replace(new RegExp(`\\{${key}\\}`, 'g'), value),
    template,
  );
}
```

**충돌 검토**: 기존 서비스의 `private applyTemplate` 메서드는 이 함수로 교체된다. 동일한 로직이므로 동작 변경 없음.

---

### 3단계: `newbie-template-validator.util.ts` — 허용 변수 검증 유틸

**경로**: `apps/api/src/newbie/util/newbie-template-validator.util.ts`

PRD 명세: "유효성 검사: 존재하지 않는 변수 사용 시 저장 차단 (백엔드)". Controller에서 DTO 저장 전 호출한다.

```typescript
/**
 * 템플릿 문자열에서 {xxx} 패턴을 모두 추출하여,
 * allowedVars에 포함되지 않는 변수 목록을 반환한다.
 * 반환값이 빈 배열이면 유효.
 */
export function findInvalidVars(template: string, allowedVars: readonly string[]): string[] {
  const found = template.match(/\{[^}]+\}/g) ?? [];
  const allowedSet = new Set(allowedVars);
  return found.filter((v) => !allowedSet.has(v));
}
```

---

### 4단계: DTO 파일 2개

#### 4-1. `newbie-mission-template-save.dto.ts`

**경로**: `apps/api/src/newbie/dto/newbie-mission-template-save.dto.ts`

`NewbieConfigSaveDto`의 패턴을 따른다. `class-validator` 데코레이터 사용. `statusMapping`은 내부 구조가 복잡하므로 `IsObject()` + 타입 선언으로 처리한다. 백엔드 허용 변수 검증은 Controller에서 수행하므로 DTO 자체에는 포함하지 않는다.

```typescript
import { IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { StatusMapping } from '../domain/newbie-mission-template.entity';

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
  statusMapping?: StatusMapping | null;
}
```

#### 4-2. `newbie-moco-template-save.dto.ts`

**경로**: `apps/api/src/newbie/dto/newbie-moco-template-save.dto.ts`

```typescript
import { IsOptional, IsString } from 'class-validator';

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

---

### 5단계: Repository 파일 2개

#### 5-1. `newbie-mission-template.repository.ts`

**경로**: `apps/api/src/newbie/infrastructure/newbie-mission-template.repository.ts`

`NewbieConfigRepository`의 패턴을 동일하게 따른다: `@Injectable()` + `@InjectRepository()` 생성자 + `findByGuildId` + `upsert`.

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { NewbieMissionTemplate } from '../domain/newbie-mission-template.entity';
import { NewbieMissionTemplateSaveDto } from '../dto/newbie-mission-template-save.dto';

@Injectable()
export class NewbieMissionTemplateRepository {
  constructor(
    @InjectRepository(NewbieMissionTemplate)
    private readonly repo: Repository<NewbieMissionTemplate>,
  ) {}

  /** guildId로 미션 템플릿 단건 조회. 레코드 없으면 null 반환. */
  async findByGuildId(guildId: string): Promise<NewbieMissionTemplate | null> {
    return this.repo.findOne({ where: { guildId } });
  }

  /**
   * 미션 템플릿 생성 또는 갱신 (guildId 기준).
   * 레코드 없으면 INSERT, 있으면 UPDATE.
   */
  async upsert(guildId: string, dto: NewbieMissionTemplateSaveDto): Promise<NewbieMissionTemplate> {
    let tmpl = await this.repo.findOne({ where: { guildId } });

    if (tmpl) {
      tmpl.titleTemplate = dto.titleTemplate ?? null;
      tmpl.headerTemplate = dto.headerTemplate ?? null;
      tmpl.itemTemplate = dto.itemTemplate ?? null;
      tmpl.footerTemplate = dto.footerTemplate ?? null;
      tmpl.statusMapping = dto.statusMapping ?? null;
    } else {
      tmpl = this.repo.create({
        guildId,
        titleTemplate: dto.titleTemplate ?? null,
        headerTemplate: dto.headerTemplate ?? null,
        itemTemplate: dto.itemTemplate ?? null,
        footerTemplate: dto.footerTemplate ?? null,
        statusMapping: dto.statusMapping ?? null,
      });
    }

    return this.repo.save(tmpl);
  }
}
```

#### 5-2. `newbie-moco-template.repository.ts`

**경로**: `apps/api/src/newbie/infrastructure/newbie-moco-template.repository.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { NewbieMocoTemplate } from '../domain/newbie-moco-template.entity';
import { NewbieMocoTemplateSaveDto } from '../dto/newbie-moco-template-save.dto';

@Injectable()
export class NewbieMocoTemplateRepository {
  constructor(
    @InjectRepository(NewbieMocoTemplate)
    private readonly repo: Repository<NewbieMocoTemplate>,
  ) {}

  /** guildId로 모코코 템플릿 단건 조회. 레코드 없으면 null 반환. */
  async findByGuildId(guildId: string): Promise<NewbieMocoTemplate | null> {
    return this.repo.findOne({ where: { guildId } });
  }

  /**
   * 모코코 템플릿 생성 또는 갱신 (guildId 기준).
   * 레코드 없으면 INSERT, 있으면 UPDATE.
   */
  async upsert(guildId: string, dto: NewbieMocoTemplateSaveDto): Promise<NewbieMocoTemplate> {
    let tmpl = await this.repo.findOne({ where: { guildId } });

    if (tmpl) {
      tmpl.titleTemplate = dto.titleTemplate ?? null;
      tmpl.bodyTemplate = dto.bodyTemplate ?? null;
      tmpl.itemTemplate = dto.itemTemplate ?? null;
      tmpl.footerTemplate = dto.footerTemplate ?? null;
    } else {
      tmpl = this.repo.create({
        guildId,
        titleTemplate: dto.titleTemplate ?? null,
        bodyTemplate: dto.bodyTemplate ?? null,
        itemTemplate: dto.itemTemplate ?? null,
        footerTemplate: dto.footerTemplate ?? null,
      });
    }

    return this.repo.save(tmpl);
  }
}
```

---

### 6단계: `newbie.module.ts` 수정

`TypeOrmModule.forFeature`에 두 Entity는 이미 등록되어 있으므로 수정 불필요.
`providers` 배열과 `exports` 배열에 두 Repository를 추가한다.

**추가할 import 2개:**
```typescript
import { NewbieMissionTemplateRepository } from './infrastructure/newbie-mission-template.repository';
import { NewbieMocoTemplateRepository } from './infrastructure/newbie-moco-template.repository';
```

**providers 배열 — `// 저장소` 섹션에 추가:**
```typescript
NewbieMissionTemplateRepository,
NewbieMocoTemplateRepository,
```

**exports 배열에 추가:**
```typescript
NewbieMissionTemplateRepository,
NewbieMocoTemplateRepository,
```

---

### 7단계: `newbie.controller.ts` 수정 — 엔드포인트 4개 추가

기존 컨트롤러 패턴(`@Get`, `@Post`, `@Param`, `@Body`, `@HttpCode`)을 그대로 따른다.

**추가할 의존성 (생성자에 주입):**
```typescript
private readonly missionTmplRepo: NewbieMissionTemplateRepository,
private readonly mocoTmplRepo: NewbieMocoTemplateRepository,
```

**추가할 엔드포인트 4개:**

```typescript
/**
 * GET /api/guilds/:guildId/newbie/mission-template
 * 미션 템플릿 조회. 레코드 없으면 null 반환 (프론트에서 기본값 표시).
 */
@Get('mission-template')
async getMissionTemplate(@Param('guildId') guildId: string) {
  return this.missionTmplRepo.findByGuildId(guildId);
}

/**
 * POST /api/guilds/:guildId/newbie/mission-template
 * 미션 템플릿 저장. 허용 변수 검증 후 upsert.
 * 검증 실패 시 400 응답.
 */
@Post('mission-template')
@HttpCode(HttpStatus.OK)
async saveMissionTemplate(
  @Param('guildId') guildId: string,
  @Body() dto: NewbieMissionTemplateSaveDto,
): Promise<{ ok: boolean }> {
  // 허용 변수 유효성 검사
  this.validateMissionTemplate(dto);
  await this.missionTmplRepo.upsert(guildId, dto);
  return { ok: true };
}

/**
 * GET /api/guilds/:guildId/newbie/moco-template
 * 모코코 템플릿 조회. 레코드 없으면 null 반환.
 */
@Get('moco-template')
async getMocoTemplate(@Param('guildId') guildId: string) {
  return this.mocoTmplRepo.findByGuildId(guildId);
}

/**
 * POST /api/guilds/:guildId/newbie/moco-template
 * 모코코 템플릿 저장. 허용 변수 검증 후 upsert.
 * 검증 실패 시 400 응답.
 */
@Post('moco-template')
@HttpCode(HttpStatus.OK)
async saveMocoTemplate(
  @Param('guildId') guildId: string,
  @Body() dto: NewbieMocoTemplateSaveDto,
): Promise<{ ok: boolean }> {
  this.validateMocoTemplate(dto);
  await this.mocoTmplRepo.upsert(guildId, dto);
  return { ok: true };
}
```

**유효성 검증 private 메서드 (컨트롤러 내부):**

`findInvalidVars`를 import하여 사용한다. 오류 발생 시 NestJS `BadRequestException`을 throw한다. `BadRequestException`의 message에 오류 필드명과 잘못된 변수 목록을 포함하여 프론트가 필드별 오류를 표시할 수 있게 한다.

```typescript
private validateMissionTemplate(dto: NewbieMissionTemplateSaveDto): void {
  const errors: Record<string, string[]> = {};

  if (dto.titleTemplate) {
    const invalid = findInvalidVars(dto.titleTemplate, MISSION_TITLE_ALLOWED_VARS);
    if (invalid.length > 0) errors['titleTemplate'] = invalid;
  }
  if (dto.headerTemplate) {
    const invalid = findInvalidVars(dto.headerTemplate, MISSION_HEADER_ALLOWED_VARS);
    if (invalid.length > 0) errors['headerTemplate'] = invalid;
  }
  if (dto.itemTemplate) {
    const invalid = findInvalidVars(dto.itemTemplate, MISSION_ITEM_ALLOWED_VARS);
    if (invalid.length > 0) errors['itemTemplate'] = invalid;
  }
  if (dto.footerTemplate) {
    const invalid = findInvalidVars(dto.footerTemplate, MISSION_FOOTER_ALLOWED_VARS);
    if (invalid.length > 0) errors['footerTemplate'] = invalid;
  }

  if (Object.keys(errors).length > 0) {
    throw new BadRequestException({ message: '허용되지 않은 변수가 포함되어 있습니다.', errors });
  }
}

private validateMocoTemplate(dto: NewbieMocoTemplateSaveDto): void {
  const errors: Record<string, string[]> = {};

  if (dto.titleTemplate) {
    const invalid = findInvalidVars(dto.titleTemplate, MOCO_TITLE_ALLOWED_VARS);
    if (invalid.length > 0) errors['titleTemplate'] = invalid;
  }
  if (dto.bodyTemplate) {
    const invalid = findInvalidVars(dto.bodyTemplate, MOCO_BODY_ALLOWED_VARS);
    if (invalid.length > 0) errors['bodyTemplate'] = invalid;
  }
  if (dto.itemTemplate) {
    const invalid = findInvalidVars(dto.itemTemplate, MOCO_ITEM_ALLOWED_VARS);
    if (invalid.length > 0) errors['itemTemplate'] = invalid;
  }
  if (dto.footerTemplate) {
    const invalid = findInvalidVars(dto.footerTemplate, MOCO_FOOTER_ALLOWED_VARS);
    if (invalid.length > 0) errors['footerTemplate'] = invalid;
  }

  if (Object.keys(errors).length > 0) {
    throw new BadRequestException({ message: '허용되지 않은 변수가 포함되어 있습니다.', errors });
  }
}
```

**추가할 import:**
```typescript
import { BadRequestException } from '@nestjs/common';
import { NewbieMissionTemplateSaveDto } from './dto/newbie-mission-template-save.dto';
import { NewbieMocoTemplateSaveDto } from './dto/newbie-moco-template-save.dto';
import { NewbieMissionTemplateRepository } from './infrastructure/newbie-mission-template.repository';
import { NewbieMocoTemplateRepository } from './infrastructure/newbie-moco-template.repository';
import { findInvalidVars } from './util/newbie-template-validator.util';
import {
  MISSION_TITLE_ALLOWED_VARS,
  MISSION_HEADER_ALLOWED_VARS,
  MISSION_ITEM_ALLOWED_VARS,
  MISSION_FOOTER_ALLOWED_VARS,
  MOCO_TITLE_ALLOWED_VARS,
  MOCO_BODY_ALLOWED_VARS,
  MOCO_ITEM_ALLOWED_VARS,
  MOCO_FOOTER_ALLOWED_VARS,
} from './infrastructure/newbie-template.constants';
```

---

### 8단계: `mission.service.ts` 수정 — `buildMissionEmbed` 템플릿 기반으로 교체

#### 8-1. 의존성 추가

생성자에 `NewbieMissionTemplateRepository`를 주입한다.

```typescript
constructor(
  // ... 기존 의존성 ...
  private readonly missionTmplRepo: NewbieMissionTemplateRepository,
) {}
```

#### 8-2. `buildMissionEmbed` 시그니처 변경

현재 시그니처: `private async buildMissionEmbed(guildId, missions, config)`

새 시그니처는 동일하게 유지하되, 내부 로직을 전면 교체한다.

#### 8-3. `buildMissionEmbed` 새 로직

PRD F-NEWBIE-002-TMPL 명세를 정확히 구현한다.

```
1. NewbieMissionTemplate 조회 (missionTmplRepo.findByGuildId)
2. 각 필드가 null이면 DEFAULT_* 상수로 fallback
3. statusMapping이 null이면 DEFAULT_STATUS_MAPPING으로 fallback
4. 카운트 집계: totalCount, inProgressCount, completedCount, failedCount
   → 현재 missions는 IN_PROGRESS 목록만이므로: inProgressCount = missions.length,
     completedCount / failedCount는 0 (PRD 명세: Embed에 활성 미션만 표시)
     — 단, headerTemplate에 {completedCount}, {failedCount}가 있을 수 있으므로
       전체 미션 수가 필요하다면 별도 조회가 필요하다.
   → 현재 getActiveMissions()는 IN_PROGRESS만 반환하므로,
     headerTemplate 변수 {completedCount} / {failedCount}를 위해 전체 미션 카운트 쿼리를 추가하거나
     아니면 Embed에 표시되는 미션 범위를 IN_PROGRESS로만 한정한다.
   → PRD 명세: "항목 템플릿 — 멤버별 미션 현황 항목 (반복 렌더링)", "헤더 템플릿 — 허용 변수: totalCount, inProgressCount, completedCount, failedCount"
   → 결론: headerTemplate의 {completedCount} / {failedCount} 지원을 위해 상태별 집계 쿼리를 별도로 추가한다.
5. 각 미션에 대해 itemTemplate 렌더링 (반복):
   - playtimeSec → playtimeHour, playtimeMin, playtimeSec, playtime 계산
   - targetPlaytimeSec → targetPlaytime 포맷 ('H시간' 또는 'H시간 M분')
   - daysLeft: endDate(YYYYMMDD)와 오늘(YYYYMMDD) 차이 (일수, 음수이면 0)
   - startDate/endDate: 'YYYY-MM-DD' 형식으로 포맷 (PRD: "날짜 포맷: 고정 YYYY-MM-DD")
     → 현재 formatDate()는 'M월 D일' 형식을 반환하므로, 새 포맷 함수 필요
   - username: fetchMemberDisplayName 결과
   - mention: `<@${memberId}>`
   - statusEmoji, statusText: statusMapping[status]
6. itemLines를 '\n\n' 구분으로 join
7. description = header + '\n\n' + itemLines
8. footerTemplate 렌더링: {updatedAt} → new Date().toLocaleString('ko-KR', ...)
9. EmbedBuilder 구성:
   - setTitle(resolvedTitle)
   - setDescription(resolvedDesc)
   - setColor(config.missionEmbedColor ?? 0x57f287)  ← NewbieConfig의 색상 필드는 유지
   - setFooter({ text: resolvedFooter })
   - setTimestamp 제거 (PRD에 timestamp 명세 없음)
```

#### 8-4. 새 헬퍼 메서드 추가

`private`으로 구현:

- `formatDateYYYYMMDD(yyyymmdd: string): string` — `YYYYMMDD` → `YYYY-MM-DD` 변환
- `formatTargetPlaytime(sec: number): string` — 목표 플레이타임 포맷 ('H시간' 또는 'H시간 M분')
- `calcDaysLeft(endDate: string): number` — 오늘 ~ endDate 일수 차이 (음수이면 0)

기존 `formatSeconds()`, `formatDate()`, `applyTemplate()` private 메서드는 제거하고 공통 유틸(`newbie-template.util.ts`의 `applyTemplate`)로 교체한다.

#### 8-5. 상태별 집계를 위한 Repository 메서드 추가

`NewbieMissionRepository.countByStatusForGuild(guildId: string): Promise<Record<MissionStatus, number>>`

```typescript
async countByStatusForGuild(guildId: string): Promise<Record<MissionStatus, number>> {
  const rows = await this.repo
    .createQueryBuilder('m')
    .select('m.status', 'status')
    .addSelect('COUNT(*)', 'count')
    .where('m.guildId = :guildId', { guildId })
    .groupBy('m.status')
    .getRawMany<{ status: MissionStatus; count: string }>();

  const result: Record<MissionStatus, number> = {
    [MissionStatus.IN_PROGRESS]: 0,
    [MissionStatus.COMPLETED]: 0,
    [MissionStatus.FAILED]: 0,
  };
  for (const row of rows) {
    result[row.status] = parseInt(row.count, 10);
  }
  return result;
}
```

이 메서드를 `buildMissionEmbed` 내부에서 호출하여 `{totalCount}`, `{inProgressCount}`, `{completedCount}`, `{failedCount}` 변수를 채운다.

#### 8-6. import 변경 사항

- 추가: `NewbieMissionTemplateRepository`, `applyTemplate`, `DEFAULT_MISSION_*`, `DEFAULT_STATUS_MAPPING`
- 제거 대상 내부 메서드: `private applyTemplate` (공통 유틸로 교체)
- 유지: `MISSION_STATUS_EMOJI`, `MISSION_STATUS_TEXT` (기존 `newbie-mission.constants.ts`)
  → 단, 이제 statusMapping은 DB에서 로드하므로 실제로는 fallback용으로만 참조된다.
  → 더 정확히는, `DEFAULT_STATUS_MAPPING`이 이를 대체하므로 `newbie-mission.constants.ts` import를 제거하고 `DEFAULT_STATUS_MAPPING`만 사용한다.

**주의**: `missionEmbedColor`, `missionEmbedThumbnailUrl`은 `NewbieConfig` 필드를 계속 사용한다. 템플릿 시스템 전환 이후에도 색상/썸네일은 Config에서 제어한다 (PRD 명세에 템플릿 필드로 색상이 포함되지 않음).

---

### 9단계: `moco.service.ts` 수정 — `buildHunterEmbed` 템플릿 기반으로 교체

#### 9-1. 의존성 추가

생성자에 `NewbieMocoTemplateRepository`를 주입한다.

#### 9-2. `buildHunterEmbed` 로직 교체

현재: `config.mocoEmbedTitle`, `config.mocoEmbedDescription` 필드를 사용.
신규: `NewbieMocoTemplate` 레코드의 `titleTemplate`, `bodyTemplate`, `itemTemplate`, `footerTemplate` 사용.

```
1. mocoTmplRepo.findByGuildId(guildId) 조회
2. 각 필드 null 시 DEFAULT_MOCO_* 상수로 fallback
3. itemTemplate 렌더링 (details 각 항목):
   - {newbieName}: newbieNames[newbieId] ?? newbieId
   - {minutes}: String(minutes)
4. itemLines = renderedItems.join('\n')
5. bodyTemplate 렌더링:
   - {totalMinutes}: String(totalMinutes)
   - {mocoList}: itemLines
6. titleTemplate 렌더링:
   - {rank}: String(rank)
   - {hunterName}: hunterName
7. footerTemplate 렌더링:
   - {currentPage}: String(currentPage)
   - {totalPages}: String(totalPages)
   - {interval}: String(config?.mocoAutoRefreshMinutes ?? '') — 설정 없으면 빈 문자열
     → interval이 없을 경우 DEFAULT_MOCO_FOOTER_TEMPLATE에 '자동 갱신 분' 같은 이상한 출력이 나올 수 있음.
     → 해결: footerTemplate이 null일 때 (기본값 사용 시) interval 없으면 '{interval}분' 부분을 truncate하거나,
            또는 footerTemplate 기본값을 조건부로 결정한다.
     → 구현 결정: footerTemplate 기본값을 mocoAutoRefreshMinutes 유무에 따라 분기한다.
       - interval 있음: `페이지 {currentPage}/{totalPages} | 자동 갱신 {interval}분`
       - interval 없음: `페이지 {currentPage}/{totalPages}`
       → 이를 `resolvedFooterTemplate` 계산 시 처리: DB에서 가져온 footerTemplate이 null이면
         interval 유무에 따라 다른 기본값을 적용한다.
8. EmbedBuilder 구성:
   - setTitle(resolvedTitle)
   - setDescription(resolvedBody)
   - setFooter({ text: resolvedFooter })
   - setColor(config?.mocoEmbedColor ?? 0x5865f2)  ← NewbieConfig 색상 유지
   - setThumbnail 조건부 (config?.mocoEmbedThumbnailUrl 유지)
```

#### 9-3. `buildHunterEmbed` 시그니처 변경

현재 시그니처: `private buildHunterEmbed(rank, hunterName, totalMinutes, details, newbieNames, currentPage, totalPages, config)`

`NewbieMocoTemplate` 조회가 async이므로 메서드를 `async`로 변경해야 한다.
호출부(`buildRankPayload`)도 `await` 추가.

현재 `buildRankPayload`는 `buildHunterEmbed`를 동기 호출하고 있으므로, async 변환 시 호출부에 `await` 추가가 필요하다.

#### 9-4. import 변경 사항

- 추가: `NewbieMocoTemplateRepository`, `applyTemplate`, `DEFAULT_MOCO_*`
- 제거: `private applyTemplate` 메서드 (공통 유틸로 교체)
- `config.mocoEmbedColor`, `config.mocoEmbedThumbnailUrl` 계속 사용 (Config 필드 유지)

---

## 충돌 및 주의사항 검토

### NewbieConfig의 Embed 필드 처리

`NewbieConfig`에는 `missionEmbedTitle`, `missionEmbedDescription`, `missionEmbedColor`, `missionEmbedThumbnailUrl`, `mocoEmbedTitle`, `mocoEmbedDescription`, `mocoEmbedColor`, `mocoEmbedThumbnailUrl` 필드가 존재한다.

이번 작업에서:
- `missionEmbedTitle`, `missionEmbedDescription`: 더 이상 Embed 빌드에 사용하지 않음 (NewbieMissionTemplate으로 대체)
- `mocoEmbedTitle`, `mocoEmbedDescription`: 더 이상 사용하지 않음 (NewbieMocoTemplate으로 대체)
- `missionEmbedColor`, `missionEmbedThumbnailUrl`: 계속 사용 (PRD에 color/thumbnail은 Config에서 관리)
- `mocoEmbedColor`, `mocoEmbedThumbnailUrl`: 계속 사용

Entity 필드와 DTO 필드는 삭제하지 않는다 (마이그레이션 불필요, 하위 호환성 유지).

### `newbie-mission.constants.ts` 처리

기존 파일의 `MISSION_STATUS_EMOJI` / `MISSION_STATUS_TEXT`는 유지한다. `mission.service.ts`에서의 import는 `DEFAULT_STATUS_MAPPING`으로 교체하므로, 이 상수들의 직접 참조는 제거된다. 그러나 파일 자체는 삭제하지 않는다 (다른 곳에서 참조할 가능성 존재, 현재 코드베이스 grep 기준 `mission.service.ts`만 사용).

### `formatDate()` vs `formatDateYYYYMMDD()`

PRD F-NEWBIE-002-TMPL 명세: "날짜 포맷: 고정 (YYYY-MM-DD)".
기존 `formatDate()`는 'M월 D일' 형식이었으나, 템플릿 기반 렌더링에서는 'YYYY-MM-DD' 형식을 사용한다.
기존 `formatDate()`는 제거하고 `formatDateYYYYMMDD()`로 대체한다.

### `applyTemplate` 중복 제거

`mission.service.ts`와 `moco.service.ts` 양쪽의 `private applyTemplate` 메서드를 제거하고 `newbie-template.util.ts`의 순수 함수로 교체한다.

### 새 `util/` 디렉토리

`apps/api/src/newbie/util/` 디렉토리는 현재 존재하지 않으므로 신규 생성한다.

---

## 구현 순서 (의존성 순)

1. `newbie-template.constants.ts` (기본값 상수 — 다른 파일들이 import)
2. `newbie-template.util.ts` (applyTemplate 순수 함수)
3. `newbie-template-validator.util.ts` (findInvalidVars 순수 함수)
4. `newbie-mission-template-save.dto.ts`
5. `newbie-moco-template-save.dto.ts`
6. `newbie-mission-template.repository.ts` (DTO에 의존)
7. `newbie-moco-template.repository.ts` (DTO에 의존)
8. `newbie-mission.repository.ts` — `countByStatusForGuild` 메서드 추가 (기존 파일 수정)
9. `newbie.module.ts` — Repository 2개 등록 (Repository 파일에 의존)
10. `mission.service.ts` — buildMissionEmbed 교체 (Repository, util, constants에 의존)
11. `moco.service.ts` — buildHunterEmbed 교체 (Repository, util, constants에 의존)
12. `newbie.controller.ts` — 엔드포인트 4개 추가 (Repository, util, constants에 의존)

---

## 최종 파일별 요약

| 파일 | 작업 종류 | 핵심 내용 |
|------|-----------|-----------|
| `infrastructure/newbie-template.constants.ts` | 신규 | DEFAULT_* 기본값 상수, ALLOWED_VARS 허용 변수 목록 |
| `util/newbie-template.util.ts` | 신규 | `applyTemplate(template, vars)` 순수 함수 |
| `util/newbie-template-validator.util.ts` | 신규 | `findInvalidVars(template, allowedVars)` 순수 함수 |
| `dto/newbie-mission-template-save.dto.ts` | 신규 | 5개 선택 필드 (`titleTemplate`, `headerTemplate`, `itemTemplate`, `footerTemplate`, `statusMapping`) |
| `dto/newbie-moco-template-save.dto.ts` | 신규 | 4개 선택 필드 (`titleTemplate`, `bodyTemplate`, `itemTemplate`, `footerTemplate`) |
| `infrastructure/newbie-mission-template.repository.ts` | 신규 | `findByGuildId`, `upsert` |
| `infrastructure/newbie-moco-template.repository.ts` | 신규 | `findByGuildId`, `upsert` |
| `infrastructure/newbie-mission.repository.ts` | 수정 | `countByStatusForGuild` 메서드 추가 |
| `newbie.module.ts` | 수정 | providers/exports에 두 Repository 추가 |
| `mission/mission.service.ts` | 수정 | `buildMissionEmbed` 전면 교체, 헬퍼 메서드 추가, `private applyTemplate` 제거 |
| `moco/moco.service.ts` | 수정 | `buildHunterEmbed` async 전환 + 템플릿 기반 교체, `private applyTemplate` 제거 |
| `newbie.controller.ts` | 수정 | GET/POST `mission-template`, GET/POST `moco-template` 4개 엔드포인트 추가 |
