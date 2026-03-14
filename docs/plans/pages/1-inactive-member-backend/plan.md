# 구현 계획: 비활동 회원 관리 — 백엔드

> 기능: F-INACTIVE-001, F-INACTIVE-002, F-INACTIVE-003, F-INACTIVE-004, F-INACTIVE-005
> 대상 서비스: apps/api

---

## 1. 현황 파악

### 기존 코드베이스와의 관계

**재사용 (수정 없음)**

| 모듈 | 파일 | 재사용 이유 |
|------|------|-------------|
| `VoiceDailyEntity` | `apps/api/src/channel/voice/domain/voice-daily.entity.ts` | `channelId = 'GLOBAL'` 조건 + `channelDurationSec` 집계에 사용. `TypeOrmModule.forFeature()`에 직접 등록 |
| `JwtAuthGuard` | `apps/api/src/auth/jwt-auth.guard.ts` | 모든 컨트롤러 엔드포인트 보호 |
| `DiscordModule.forFeature()` | `@discord-nestjs/core` | Discord Client 주입(`@InjectDiscordClient()`)을 위해 모듈에서 import |

**참고 패턴**

- 엔티티: `NewbieConfig` — `@Entity({ schema: 'public' })`, `@Index(이름, [컬럼], { unique })`, `@PrimaryGeneratedColumn()`, `@CreateDateColumn()`, `@UpdateDateColumn()` 패턴
- 저장소: `NewbieConfigRepository` — `@Injectable()`, `@InjectRepository(Entity)`, `Repository<Entity>` 래퍼 패턴
- 스케줄러: `MissionScheduler`, `MocoResetScheduler` — `@Cron('0 0 * * *', { name, timeZone: 'Asia/Seoul' })`, `private readonly logger = new Logger(ClassName.name)`, try-catch + `this.logger.error(msg, (err as Error).stack)` 패턴
- 컨트롤러: `NewbieController` — `@Controller('api/guilds/:guildId/...')`, `@UseGuards(JwtAuthGuard)` 클래스 레벨 적용 패턴
- 모듈: `NewbieModule` — `DiscordModule.forFeature()`, `TypeOrmModule.forFeature([...엔티티])`, `AuthModule` import 패턴

### VoiceDailyEntity 구조 확인

`voice_daily` 테이블의 PK: `(guildId, userId, date, channelId)`.
`channelId = 'GLOBAL'`인 행이 유저별 일별 전체 집계 행이다.
`date` 컬럼은 `string` 타입, `'YYYYMMDD'` 포맷.
비활동 분류는 이 `GLOBAL` 행의 `channelDurationSec`을 합산해 사용한다.

### 신규 도메인 디렉터리

`apps/api/src/inactive-member/` 전체가 신규 생성이므로 기존 코드와 경로 충돌 없음.

---

## 2. 개발 태스크 목록

### 태스크 1: 엔티티 3개 (domain/)

#### 1-A. `inactive-member-config.entity.ts`

**파일**: `apps/api/src/inactive-member/domain/inactive-member-config.entity.ts`

PRD의 `InactiveMemberConfig (inactive_member_config)` 테이블을 TypeORM 엔티티로 구현한다.

설계 결정:
- `@Entity({ schema: 'public' })` 유지 (`NewbieConfig` 동일 패턴)
- `guildId`에 UNIQUE 인덱스: `@Index('UQ_inactive_member_config_guild', ['guildId'], { unique: true })`
- `excludedRoleIds`: `@Column({ type: 'json', default: '[]' })` — 역할 ID 문자열 배열
- `periodDays` 허용값: 7 / 14 / 30. 엔티티 레벨에서 enum 강제 없이 DTO에서 `@IsIn([7, 14, 30])`으로 검증
- boolean 컬럼 3개(`autoActionEnabled`, `autoRoleAdd`, `autoDm`): `@Column({ default: false })`
- nullable 컬럼(`inactiveRoleId`, `removeRoleId`, `dmEmbedTitle`, `dmEmbedColor`): `@Column({ nullable: true })`
- `dmEmbedBody`: `@Column({ type: 'text', nullable: true })` — 긴 문자열 대응

```typescript
@Entity({ schema: 'public' })
@Index('UQ_inactive_member_config_guild', ['guildId'], { unique: true })
export class InactiveMemberConfig {
  @PrimaryGeneratedColumn() id: number;
  @Column() guildId: string;
  @Column({ type: 'int', default: 30 }) periodDays: number;
  @Column({ type: 'int', default: 30 }) lowActiveThresholdMin: number;
  @Column({ type: 'int', default: 50 }) decliningPercent: number;
  @Column({ default: false }) autoActionEnabled: boolean;
  @Column({ default: false }) autoRoleAdd: boolean;
  @Column({ default: false }) autoDm: boolean;
  @Column({ nullable: true }) inactiveRoleId: string | null;
  @Column({ nullable: true }) removeRoleId: string | null;
  @Column({ type: 'json', default: '[]' }) excludedRoleIds: string[];
  @Column({ nullable: true }) dmEmbedTitle: string | null;
  @Column({ type: 'text', nullable: true }) dmEmbedBody: string | null;
  @Column({ nullable: true }) dmEmbedColor: string | null;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
```

#### 1-B. `inactive-member-record.entity.ts`

**파일**: `apps/api/src/inactive-member/domain/inactive-member-record.entity.ts`

PRD의 `InactiveMemberRecord (inactive_member_record)` 테이블.

설계 결정:
- `grade` enum: 별도 `InactiveMemberGrade` enum 상수 파일 없이 엔티티 파일 내에 `export enum InactiveMemberGrade` 선언 (다른 파일에서도 import 가능)
- `grade`: `@Column({ type: 'enum', enum: InactiveMemberGrade, nullable: true })` — NULL이면 활동 상태
- `lastVoiceDate`: `@Column({ type: 'date', nullable: true })` — PostgreSQL `date` 타입, TypeScript `string | null`로 표현 (`'YYYY-MM-DD'` 포맷으로 저장됨)
- `gradeChangedAt`: `@Column({ type: 'timestamp', nullable: true })`
- `classifiedAt`: `@Column({ type: 'timestamp' })` — NOT NULL
- 복합 UNIQUE 인덱스: `@Index('UQ_inactive_member_record_guild_user', ['guildId', 'userId'], { unique: true })`
- 조회용 인덱스 2개:
  - `@Index('IDX_inactive_member_record_guild_grade', ['guildId', 'grade'])`
  - `@Index('IDX_inactive_member_record_guild_last_voice', ['guildId', 'lastVoiceDate'])`

```typescript
export enum InactiveMemberGrade {
  FULLY_INACTIVE = 'FULLY_INACTIVE',
  LOW_ACTIVE = 'LOW_ACTIVE',
  DECLINING = 'DECLINING',
}

@Entity({ schema: 'public' })
@Index('UQ_inactive_member_record_guild_user', ['guildId', 'userId'], { unique: true })
@Index('IDX_inactive_member_record_guild_grade', ['guildId', 'grade'])
@Index('IDX_inactive_member_record_guild_last_voice', ['guildId', 'lastVoiceDate'])
export class InactiveMemberRecord {
  @PrimaryGeneratedColumn() id: number;
  @Column() guildId: string;
  @Column() userId: string;
  @Column({ type: 'enum', enum: InactiveMemberGrade, nullable: true })
  grade: InactiveMemberGrade | null;
  @Column({ type: 'int', default: 0 }) totalMinutes: number;
  @Column({ type: 'int', default: 0 }) prevTotalMinutes: number;
  @Column({ type: 'date', nullable: true }) lastVoiceDate: string | null;
  @Column({ type: 'timestamp', nullable: true }) gradeChangedAt: Date | null;
  @Column({ type: 'timestamp' }) classifiedAt: Date;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
```

#### 1-C. `inactive-member-action-log.entity.ts`

**파일**: `apps/api/src/inactive-member/domain/inactive-member-action-log.entity.ts`

PRD의 `InactiveMemberActionLog (inactive_member_action_log)` 테이블.

설계 결정:
- `actionType` enum: 엔티티 파일 내 `export enum InactiveMemberActionType` 선언
- `targetUserIds`: `@Column({ type: 'json' })` — 문자열 배열
- `executorUserId`: `@Column({ nullable: true })` — NULL이면 시스템 자동 조치
- `executedAt`: `@Column({ type: 'timestamp', default: () => 'NOW()' })` — NOT NULL, DEFAULT now()
- 인덱스: `@Index('IDX_inactive_action_log_guild_executed', ['guildId', 'executedAt'])`
  - `executedAt DESC` 정렬은 쿼리에서 처리; TypeORM `@Index`는 순서 지정을 직접 지원하지 않으므로 일반 복합 인덱스로 선언하고 쿼리에서 `ORDER BY executedAt DESC` 적용

```typescript
export enum InactiveMemberActionType {
  ACTION_DM = 'ACTION_DM',
  ACTION_ROLE_ADD = 'ACTION_ROLE_ADD',
  ACTION_ROLE_REMOVE = 'ACTION_ROLE_REMOVE',
}

@Entity({ schema: 'public' })
@Index('IDX_inactive_action_log_guild_executed', ['guildId', 'executedAt'])
export class InactiveMemberActionLog {
  @PrimaryGeneratedColumn() id: number;
  @Column() guildId: string;
  @Column({ type: 'enum', enum: InactiveMemberActionType })
  actionType: InactiveMemberActionType;
  @Column({ type: 'json' }) targetUserIds: string[];
  @Column({ nullable: true }) executorUserId: string | null;
  @Column({ type: 'int', default: 0 }) successCount: number;
  @Column({ type: 'int', default: 0 }) failCount: number;
  @Column({ type: 'text', nullable: true }) note: string | null;
  @Column({ type: 'timestamp', default: () => 'NOW()' }) executedAt: Date;
}
```

**충돌 검토**: 3개 엔티티 모두 신규 테이블. 기존 엔티티와 테이블명/컬럼 충돌 없음.

---

### 태스크 2: DTO 3개 (dto/)

#### 2-A. `inactive-member-query.dto.ts`

**파일**: `apps/api/src/inactive-member/dto/inactive-member-query.dto.ts`

`GET /api/guilds/:guildId/inactive-members` 쿼리 파라미터 DTO.

```typescript
export class InactiveMemberQueryDto {
  @IsOptional()
  @IsIn(['FULLY_INACTIVE', 'LOW_ACTIVE', 'DECLINING'])
  grade?: string;

  @IsOptional()
  @IsIn([7, 14, 30])
  @Type(() => Number)
  periodDays?: number;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(['lastVoiceDate', 'totalMinutes'])
  sortBy?: string;           // 기본값: 'lastVoiceDate'

  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  sortOrder?: string;        // 기본값: 'ASC'

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number;             // 기본값: 1

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number;            // 기본값: 20
}
```

주의: `@Type(() => Number)`는 쿼리 파라미터가 문자열로 수신되므로 `class-transformer`의 타입 변환을 사용한다. `ValidationPipe({ transform: true })`가 전역 파이프로 등록되어 있는지 확인이 필요하다. 기존 코드베이스(`NewbieController`)를 보면 `parseInt`로 직접 변환하므로 전역 파이프가 없을 수 있다. 이 경우 컨트롤러에서 직접 파싱하거나 `@Query()`에서 직접 처리하는 방식으로 전환한다 (아래 태스크 6에서 상세 기술).

#### 2-B. `inactive-member-action.dto.ts`

**파일**: `apps/api/src/inactive-member/dto/inactive-member-action.dto.ts`

`POST /api/guilds/:guildId/inactive-members/actions` 요청 본문 DTO.

```typescript
export class InactiveMemberActionDto {
  @IsIn(['ACTION_DM', 'ACTION_ROLE_ADD', 'ACTION_ROLE_REMOVE'])
  actionType: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsString({ each: true })
  targetUserIds: string[];
}
```

#### 2-C. `inactive-member-config-save.dto.ts`

**파일**: `apps/api/src/inactive-member/dto/inactive-member-config-save.dto.ts`

`PUT /api/guilds/:guildId/inactive-members/config` 요청 본문 DTO. 부분 업데이트 허용 — 모든 필드 `@IsOptional()`.

```typescript
export class InactiveMemberConfigSaveDto {
  @IsOptional() @IsIn([7, 14, 30]) periodDays?: number;
  @IsOptional() @IsInt() @Min(1) lowActiveThresholdMin?: number;
  @IsOptional() @IsInt() @Min(0) @Max(100) decliningPercent?: number;
  @IsOptional() @IsBoolean() autoActionEnabled?: boolean;
  @IsOptional() @IsBoolean() autoRoleAdd?: boolean;
  @IsOptional() @IsBoolean() autoDm?: boolean;
  @IsOptional() @IsString() inactiveRoleId?: string | null;
  @IsOptional() @IsString() removeRoleId?: string | null;
  @IsOptional() @IsArray() @IsString({ each: true }) excludedRoleIds?: string[];
  @IsOptional() @IsString() dmEmbedTitle?: string | null;
  @IsOptional() @IsString() dmEmbedBody?: string | null;
  @IsOptional() @IsString() dmEmbedColor?: string | null;
}
```

**충돌 검토**: 신규 DTO 파일, 기존 파일과 충돌 없음.

---

### 태스크 3: 저장소 2개 (infrastructure/)

#### 3-A. `inactive-member.repository.ts`

**파일**: `apps/api/src/inactive-member/infrastructure/inactive-member.repository.ts`

`InactiveMemberConfig`와 `InactiveMemberRecord` 쓰기/단건 조회를 담당하는 저장소.

메서드:

| 메서드 | 설명 |
|--------|------|
| `findConfigByGuildId(guildId)` | 설정 단건 조회 |
| `saveConfig(config)` | 설정 저장 (`repo.save`) |
| `createDefaultConfig(guildId)` | 기본값으로 설정 신규 생성 후 저장 |
| `upsertConfig(guildId, dto)` | 설정 조회 후 dto 필드 merge, save 반환 |
| `batchUpsertRecords(records)` | `InactiveMemberRecord` 배열 배치 저장 (루프 `repo.save`) |
| `findRecordByGuildUser(guildId, userId)` | 레코드 단건 조회 (등급 변경 감지용) |
| `saveActionLog(log)` | `InactiveMemberActionLog` 저장 |

`batchUpsertRecords` 구현 방식:
- TypeORM의 `save([])`는 `RETURNING`이 필요한 upsert를 일괄 처리하기 어렵고 N+1 쿼리가 발생한다.
- 대신 raw SQL의 `INSERT ... ON CONFLICT DO UPDATE`를 사용한다:
  ```sql
  INSERT INTO inactive_member_record
    ("guildId","userId","grade","totalMinutes","prevTotalMinutes","lastVoiceDate","gradeChangedAt","classifiedAt")
  VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
  ON CONFLICT ("guildId","userId")
  DO UPDATE SET
    "grade" = EXCLUDED."grade",
    "totalMinutes" = EXCLUDED."totalMinutes",
    "prevTotalMinutes" = EXCLUDED."prevTotalMinutes",
    "lastVoiceDate" = EXCLUDED."lastVoiceDate",
    "gradeChangedAt" = CASE
      WHEN inactive_member_record."grade" IS DISTINCT FROM EXCLUDED."grade"
      THEN NOW()
      ELSE inactive_member_record."gradeChangedAt"
    END,
    "classifiedAt" = EXCLUDED."classifiedAt",
    "updatedAt" = NOW()
  ```
  이 쿼리는 등급이 변경된 경우에만 `gradeChangedAt`을 갱신하므로 서비스 레이어에서 별도로 이전 등급을 추적할 필요가 없다.
- 레코드 배열이 클 수 있으므로 `repo.query`를 레코드별로 루프 호출한다 (스케줄러가 하루 1회 실행되므로 성능 허용 범위).

`upsertConfig` 구현:
- `findConfigByGuildId`로 조회 → 없으면 `repo.create({ guildId, ...기본값, ...dto })`
- 있으면 dto의 defined 필드만 병합 (`dto.field !== undefined`로 조건 체크)
- `repo.save` 후 반환

#### 3-B. `inactive-member-query.repository.ts`

**파일**: `apps/api/src/inactive-member/infrastructure/inactive-member-query.repository.ts`

읽기 전용 쿼리를 담당하는 저장소. `InactiveMemberRecord`와 `VoiceDailyEntity` 집계 쿼리.

메서드:

| 메서드 | 설명 |
|--------|------|
| `findRecordList(guildId, query)` | 목록 조회 (필터/정렬/페이지네이션). 반환: `{ items: InactiveMemberRecord[], total: number }` |
| `countByGrade(guildId)` | 등급별 카운트 집계. 반환: `{ fullyInactiveCount, lowActiveCount, decliningCount }` |
| `findReturnedCount(guildId)` | 직전 분류에서 비활동이었다가 이번 분류에서 grade=NULL로 바뀐 회원 수 (단순화: `grade IS NULL`이고 `gradeChangedAt`이 당일인 레코드 수) |
| `findTrend(guildId)` | `classifiedAt` 날짜별 등급 카운트 집계 (주/월별 추이) |
| `sumVoiceDurationByUser(guildId, fromDate, toDate)` | `voice_daily`에서 기간 내 userId별 총 `channelDurationSec` 합산. 반환: `Map<string, number>` |
| `findLastVoiceDateByUser(guildId, fromDate)` | 기간 시작일 이후 userId별 최신 `date` 조회. 반환: `Map<string, string>` |
| `findActionLogs(guildId, page, limit)` | 이력 페이지네이션 조회. 반환: `{ items: InactiveMemberActionLog[], total: number }` |

`findRecordList` 구현 상세:
- QueryBuilder 사용
- `guildId` WHERE 조건 필수
- `grade` 필터: `@IsOptional`이므로 undefined이면 grade 조건 미적용 (NULL 제외 — grade가 NULL인 활동 상태 회원은 목록에 표시 안 함)
  - grade 필터 미제공 시 `grade IS NOT NULL` 조건 추가 (비활동 회원만 표시)
- `search` 필터: `InactiveMemberRecord`에는 nickName 없으므로 별도 처리 불필요 (nickName은 Discord API에서 실시간 조회하는 구조가 아닌, `userId`를 기준으로 반환하고 프론트에서 멤버 정보와 join하는 방식으로 설계)
  - PRD 응답에 `nickName` 필드가 있으나, 서버에서 모든 멤버를 Discord API로 조회하면 비용이 크다. 컨트롤러에서 Discord `guild.members.fetch()`로 닉네임 맵을 구성해 enrichment하는 방식 채택. `search` 파라미터는 컨트롤러에서 enrichment 후 필터링
- `sortBy`: `lastVoiceDate` 또는 `totalMinutes`, 기본값 `lastVoiceDate`
- `sortOrder`: `ASC` / `DESC`, 기본값 `ASC`
- `page`, `limit`: `skip = (page-1) * limit`, `take = limit`

`sumVoiceDurationByUser` 구현:
```sql
SELECT "userId", SUM("channelDurationSec") as "totalSec"
FROM voice_daily
WHERE "guildId" = :guildId
  AND "channelId" = 'GLOBAL'
  AND "date" BETWEEN :fromDate AND :toDate
GROUP BY "userId"
```
반환값을 `Map<string, number>`로 변환 (`userId` → `totalSec`).

`findLastVoiceDateByUser` 구현:
```sql
SELECT "userId", MAX("date") as "lastDate"
FROM voice_daily
WHERE "guildId" = :guildId
  AND "channelId" = 'GLOBAL'
  AND "date" >= :fromDate
GROUP BY "userId"
```
반환값을 `Map<string, string>`으로 변환 (`userId` → `lastDate`).

`InjectRepository` 대상: `InactiveMemberRecord`, `InactiveMemberActionLog`, `VoiceDailyEntity` (3개).

**충돌 검토**: `VoiceDailyEntity`를 `TypeOrmModule.forFeature()`에 등록해야 하며, `NewbieModule`도 동일 엔티티를 등록한다. TypeORM은 동일 엔티티를 여러 모듈에서 중복 등록해도 충돌 없이 처리한다 (`autoLoadEntities: true` 환경).

---

### 태스크 4: 분류 서비스 (application/)

#### 4-A. `inactive-member.service.ts`

**파일**: `apps/api/src/inactive-member/application/inactive-member.service.ts`

길드별 비활동 회원 분류 핵심 로직. 스케줄러와 수동 요청 모두에서 호출된다.

의존성:
- `InactiveMemberRepository` (설정 조회/레코드 upsert)
- `InactiveMemberQueryRepository` (voice_daily 집계)
- `@InjectDiscordClient() private readonly discord: Client`

핵심 메서드:

**`classifyGuild(guildId: string): Promise<InactiveMemberRecord[]>`**

반환: upsert된 레코드 배열 (자동 조치 판단에 사용).

구현 단계:
1. `InactiveMemberRepository.findConfigByGuildId`로 설정 조회. 없으면 `createDefaultConfig`로 기본값 생성.
2. 오늘 KST 날짜 계산 → `periodDays` 기준으로 `fromDate`, `toDate` 계산 (YYYYMMDD 형식)
   - `toDate`: 어제 (오늘 자정 분류 시 어제까지 데이터가 완성됨)
   - `fromDate`: `toDate` 기준 `periodDays`일 전
   - 이전 기간: `prevToDate = fromDate - 1일`, `prevFromDate = prevToDate - periodDays + 1일`
3. Discord Client로 길드 멤버 목록 조회:
   ```typescript
   const guild = await this.discord.guilds.fetch(guildId);
   const members = await guild.members.fetch();
   ```
4. 봇 및 `excludedRoleIds` 보유 멤버 제외:
   ```typescript
   const targetMembers = members.filter(
     (m) => !m.user.bot && !config.excludedRoleIds.some((roleId) => m.roles.cache.has(roleId))
   );
   ```
5. `InactiveMemberQueryRepository.sumVoiceDurationByUser`로 현재 기간 집계 → `Map<userId, totalSec>`
6. `InactiveMemberQueryRepository.sumVoiceDurationByUser`로 이전 기간 집계 → `Map<userId, prevTotalSec>`
7. `InactiveMemberQueryRepository.findLastVoiceDateByUser`로 마지막 음성 날짜 → `Map<userId, lastDate>`
8. targetMembers를 순회하며 등급 판정:
   ```
   totalSec = currentMap.get(userId) ?? 0
   totalMinutes = Math.floor(totalSec / 60)
   prevTotalSec = prevMap.get(userId) ?? 0
   prevTotalMinutes = Math.floor(prevTotalSec / 60)

   if totalMinutes === 0 → FULLY_INACTIVE
   else if totalMinutes < config.lowActiveThresholdMin → LOW_ACTIVE
   else if prevTotalMinutes > 0 &&
     (prevTotalMinutes - totalMinutes) / prevTotalMinutes * 100 >= config.decliningPercent → DECLINING
   else → null (활동)
   ```
   판정 우선순위: `FULLY_INACTIVE > LOW_ACTIVE > DECLINING`
9. `InactiveMemberRepository.batchUpsertRecords`로 배치 저장
10. upsert된 레코드 반환

**`getOrCreateConfig(guildId: string): Promise<InactiveMemberConfig>`**

`findConfigByGuildId` 조회 → null이면 `createDefaultConfig` 호출 후 반환.

**`getStats(guildId: string)`**

통계 집계. `InactiveMemberQueryRepository`의 `countByGrade`, `findReturnedCount`, `findTrend`를 조합. Discord Client로 전체 멤버 수 조회 (`guild.memberCount`).

#### 4-B. `inactive-member-action.service.ts`

**파일**: `apps/api/src/inactive-member/application/inactive-member-action.service.ts`

조치 실행(DM/역할) 및 이력 기록 담당.

의존성:
- `InactiveMemberRepository` (설정 조회, ActionLog 저장)
- `InactiveMemberQueryRepository` (레코드 조회 — DM 템플릿 변수용 `totalMinutes`)
- `@InjectDiscordClient() private readonly discord: Client`

핵심 메서드:

**`executeAction(guildId, dto, executorUserId?): Promise<{ actionType, successCount, failCount, logId }>`**

구현 단계:
1. `getOrCreateConfig`로 설정 조회
2. `dto.actionType`별 분기:

   **ACTION_DM**:
   - 설정의 `dmEmbedTitle`, `dmEmbedBody`, `dmEmbedColor` 사용
   - `dto.targetUserIds` 순회:
     ```typescript
     const member = await guild.members.fetch(userId).catch(() => null);
     if (!member) { failCount++; continue; }
     const embed = buildDmEmbed(config, member, record);
     await member.send({ embeds: [embed] });
     ```
   - DM 실패(`DiscordAPIError` 코드 50007: Cannot send messages to this user) → `failCount++`, 계속 진행
   - `buildDmEmbed`: 템플릿 변수 `{nickName}`, `{serverName}`, `{periodDays}`, `{totalMinutes}` 치환

   **ACTION_ROLE_ADD**:
   - `config.inactiveRoleId`가 null이면 `NotFoundException` throw
   - `dto.targetUserIds` 순회: `member.roles.add(config.inactiveRoleId)`
   - 실패 시 `failCount++`, 계속 진행

   **ACTION_ROLE_REMOVE**:
   - `config.removeRoleId`가 null이면 `NotFoundException` throw
   - `dto.targetUserIds` 순회: `member.roles.remove(config.removeRoleId)`
   - 실패 시 `failCount++`, 계속 진행

3. `InactiveMemberRepository.saveActionLog`로 이력 저장
4. `{ actionType, successCount, failCount, logId }` 반환

**`executeAutoActions(guildId, newlyInactiveUserIds): Promise<void>`**

스케줄러의 자동 조치용. `autoRoleAdd`, `autoDm` 설정에 따라 조치 실행.
- `executorUserId = null` (시스템 자동 조치)
- 오류는 로깅 후 계속 진행 (스케줄러 전체 실패 방지)

---

### 태스크 5: 스케줄러 (application/)

#### `inactive-member.scheduler.ts`

**파일**: `apps/api/src/inactive-member/application/inactive-member.scheduler.ts`

의존성:
- `InactiveMemberService`
- `InactiveMemberActionService`
- `InactiveMemberRepository` (autoActionEnabled 조회)
- `@InjectDiscordClient() private readonly discord: Client`

```typescript
@Injectable()
export class InactiveMemberScheduler {
  private readonly logger = new Logger(InactiveMemberScheduler.name);

  @Cron('0 0 * * *', { name: 'inactive-member-classify', timeZone: 'Asia/Seoul' })
  async runDailyClassify(): Promise<void> {
    this.logger.log('[INACTIVE] Starting daily classify...');
    try {
      await this.processAllGuilds();
    } catch (err) {
      this.logger.error('[INACTIVE] Unhandled error', (err as Error).stack);
    }
  }
}
```

`processAllGuilds`:
1. Discord Client에서 캐시된 모든 길드 ID 조회: `this.discord.guilds.cache.map(g => g.id)`
2. 길드별로 순회:
   ```typescript
   for (const guildId of guildIds) {
     try {
       const records = await this.inactiveMemberService.classifyGuild(guildId);
       const config = await this.inactiveMemberService.getOrCreateConfig(guildId);
       if (config.autoActionEnabled) {
         const newlyFullyInactive = records
           .filter(r => r.grade === InactiveMemberGrade.FULLY_INACTIVE)
           .map(r => r.userId);
         await this.actionService.executeAutoActions(guildId, newlyFullyInactive);
       }
     } catch (err) {
       this.logger.error(`[INACTIVE] Failed guild=${guildId}`, (err as Error).stack);
     }
   }
   ```

**충돌 검토**: `@Cron` name `'inactive-member-classify'`는 기존 `'mission-daily-expiry'`, `'moco-period-reset'`과 중복 없음.

---

### 태스크 6: 컨트롤러 (presentation/)

#### `inactive-member.controller.ts`

**파일**: `apps/api/src/inactive-member/presentation/inactive-member.controller.ts`

```typescript
@Controller('api/guilds/:guildId/inactive-members')
@UseGuards(JwtAuthGuard)
export class InactiveMemberController {
  private readonly logger = new Logger(InactiveMemberController.name);
}
```

엔드포인트별 상세:

**`GET /api/guilds/:guildId/inactive-members`**

쿼리 파라미터 파싱: 기존 코드베이스 스타일(`NewbieController`)을 따라 `@Query()` 각 파라미터를 개별 수신 후 직접 파싱.

```typescript
@Get()
async getList(
  @Param('guildId') guildId: string,
  @Query('grade') grade?: string,
  @Query('periodDays') periodDaysRaw?: string,
  @Query('search') search?: string,
  @Query('sortBy') sortBy?: string,
  @Query('sortOrder') sortOrder?: string,
  @Query('page') pageRaw?: string,
  @Query('limit') limitRaw?: string,
)
```

파싱 후 `InactiveMemberQueryRepository.findRecordList` 호출.

nickName enrichment: Discord `guild.members.fetch()`로 멤버 맵 구성 → 레코드의 `userId`로 닉네임 조회. `search` 파라미터가 있으면 enrichment 후 닉네임 기준 필터링.

반환 형식:
```json
{
  "total": number,
  "page": number,
  "limit": number,
  "items": [{ "userId", "nickName", "grade", "totalMinutes", "lastVoiceDate", "gradeChangedAt", "classifiedAt" }]
}
```

**`GET /api/guilds/:guildId/inactive-members/stats`**

`InactiveMemberService.getStats(guildId)` 호출 후 반환.

**`POST /api/guilds/:guildId/inactive-members/actions`**

`@Body() dto: InactiveMemberActionDto`로 수신. `JwtRequest`에서 executorUserId 추출 (JWT 페이로드의 `userId`).

기존 코드에서 Request 객체 접근 패턴 확인 필요. `@Req() req` + `(req.user as JwtPayload).userId` 형태로 추출.

```typescript
@Post('actions')
@HttpCode(HttpStatus.OK)
async executeAction(
  @Param('guildId') guildId: string,
  @Body() dto: InactiveMemberActionDto,
  @Req() req: Request,
)
```

반환: `{ actionType, successCount, failCount, logId }`

**`GET /api/guilds/:guildId/inactive-members/action-logs`**

```typescript
@Get('action-logs')
async getActionLogs(
  @Param('guildId') guildId: string,
  @Query('page') pageRaw?: string,
  @Query('limit') limitRaw?: string,
)
```

`InactiveMemberQueryRepository.findActionLogs` 호출. 반환: `{ total, page, limit, items }`

**`GET /api/guilds/:guildId/inactive-members/config`**

`InactiveMemberService.getOrCreateConfig(guildId)` 호출. 없으면 기본값 생성 후 반환.

**`PUT /api/guilds/:guildId/inactive-members/config`**

```typescript
@Put('config')
async saveConfig(
  @Param('guildId') guildId: string,
  @Body() dto: InactiveMemberConfigSaveDto,
)
```

`InactiveMemberRepository.upsertConfig(guildId, dto)` 호출. 갱신된 `InactiveMemberConfig` 반환.

**라우트 충돌 주의**: NestJS는 정적 경로를 동적 경로보다 우선 매칭한다. `GET /inactive-members/stats`와 `GET /inactive-members/action-logs`가 `GET /inactive-members/:id` 형태 경로보다 먼저 선언되어야 한다. 이 컨트롤러에는 `:id` 동적 경로가 없으므로 문제없음.

**`@Req()` 사용**: `Request` 타입은 `@nestjs/common`에서 임포트하지 않고 `express`에서 가져온다. 기존 코드베이스에서 JwtPayload 접근 방식 확인이 필요하지만, 표준 패턴으로 `(req as unknown as { user: { userId: string } }).user.userId` 형태 사용.

---

### 태스크 7: 모듈 (inactive-member.module.ts)

**파일**: `apps/api/src/inactive-member/inactive-member.module.ts`

```typescript
@Module({
  imports: [
    DiscordModule.forFeature(),
    TypeOrmModule.forFeature([
      InactiveMemberConfig,
      InactiveMemberRecord,
      InactiveMemberActionLog,
      VoiceDailyEntity,
    ]),
    AuthModule,
  ],
  controllers: [InactiveMemberController],
  providers: [
    InactiveMemberRepository,
    InactiveMemberQueryRepository,
    InactiveMemberService,
    InactiveMemberActionService,
    InactiveMemberScheduler,
  ],
})
export class InactiveMemberModule {}
```

설계 결정:
- `VoiceChannelModule`은 import하지 않는다. `VoiceDailyEntity`는 `TypeOrmModule.forFeature()`에 직접 등록해 `Repository<VoiceDailyEntity>`를 `InjectRepository`로 사용하는 방식이 더 단순하다. (NewbieModule도 VoiceDailyEntity를 직접 등록하고 있음)
- `RedisModule` import 없음 — inactive-member 도메인은 Redis를 사용하지 않는다.
- `MemberModule` import 없음 — Discord API로 멤버 정보를 직접 조회한다.

---

### 태스크 8: AppModule 수정

**파일**: `apps/api/src/app.module.ts`

`InactiveMemberModule` import 추가:

```typescript
import { InactiveMemberModule } from './inactive-member/inactive-member.module';

@Module({
  imports: [
    // ...기존 imports...
    InactiveMemberModule,
  ],
})
export class AppModule {}
```

**충돌 검토**: 기존 imports 배열에 추가만 하므로 충돌 없음.

---

## 3. 최종 생성/수정 파일 목록

### 신규 생성

| 파일 | 내용 |
|------|------|
| `apps/api/src/inactive-member/domain/inactive-member-config.entity.ts` | `InactiveMemberConfig` 엔티티 |
| `apps/api/src/inactive-member/domain/inactive-member-record.entity.ts` | `InactiveMemberRecord` 엔티티 + `InactiveMemberGrade` enum |
| `apps/api/src/inactive-member/domain/inactive-member-action-log.entity.ts` | `InactiveMemberActionLog` 엔티티 + `InactiveMemberActionType` enum |
| `apps/api/src/inactive-member/dto/inactive-member-query.dto.ts` | 목록 조회 쿼리 DTO |
| `apps/api/src/inactive-member/dto/inactive-member-action.dto.ts` | 조치 실행 요청 DTO |
| `apps/api/src/inactive-member/dto/inactive-member-config-save.dto.ts` | 설정 저장 DTO |
| `apps/api/src/inactive-member/infrastructure/inactive-member.repository.ts` | 쓰기/단건 조회 저장소 |
| `apps/api/src/inactive-member/infrastructure/inactive-member-query.repository.ts` | 읽기 전용 쿼리 저장소 |
| `apps/api/src/inactive-member/application/inactive-member.service.ts` | 분류 서비스 |
| `apps/api/src/inactive-member/application/inactive-member-action.service.ts` | 조치 서비스 |
| `apps/api/src/inactive-member/application/inactive-member.scheduler.ts` | 매일 00:00 KST 분류 스케줄러 |
| `apps/api/src/inactive-member/presentation/inactive-member.controller.ts` | REST API 컨트롤러 |
| `apps/api/src/inactive-member/inactive-member.module.ts` | NestJS 모듈 |

### 수정

| 파일 | 변경 내용 |
|------|-----------|
| `apps/api/src/app.module.ts` | `InactiveMemberModule` import 추가 |

---

## 4. 구현 순서

1. 엔티티 3개 (`inactive-member-config.entity.ts`, `inactive-member-record.entity.ts`, `inactive-member-action-log.entity.ts`)
2. DTO 3개 (`inactive-member-query.dto.ts`, `inactive-member-action.dto.ts`, `inactive-member-config-save.dto.ts`)
3. 저장소 2개 (`inactive-member.repository.ts`, `inactive-member-query.repository.ts`)
4. 서비스 2개 (`inactive-member.service.ts`, `inactive-member-action.service.ts`) — 저장소 의존
5. 스케줄러 1개 (`inactive-member.scheduler.ts`) — 서비스 의존
6. 컨트롤러 1개 (`inactive-member.controller.ts`) — 서비스/저장소 의존
7. 모듈 1개 (`inactive-member.module.ts`) — 전체 조립
8. `app.module.ts` 수정 — 모듈 등록

---

## 5. 주요 설계 결정 및 잠재적 위험

### 5-1. nickName 조회 전략

PRD 응답에 `nickName` 필드가 있으나 `InactiveMemberRecord`에는 저장하지 않는다. 컨트롤러의 `getList`에서 `guild.members.fetch()`로 현재 멤버 정보를 조회해 enrichment한다. 멤버 수가 많은 길드에서 성능 부담이 있을 수 있으나, 목록 API가 호출될 때마다 fetch하면 Discord API 레이트리밋 위험이 있다.

완화 방안: `guild.members.fetch()`는 Discord.js 내부 캐시를 먼저 확인하며, 봇이 `GuildMembers` intent를 활성화한 경우 캐시에 멤버가 이미 있다. 실시간 조회 비용은 캐시 미스 시에만 발생한다. 초기 구현에서는 이 방식을 채택하고, 성능 이슈 발생 시 `InactiveMemberRecord`에 `nickName` 컬럼을 추가하는 방향으로 개선한다.

### 5-2. `search` 파라미터 처리

`InactiveMemberRecord`에 닉네임이 없으므로 DB 레벨에서 LIKE 검색이 불가능하다. 컨트롤러에서 enrichment 후 in-memory 필터링으로 처리한다. 이 경우 DB 페이지네이션과 충돌 발생: DB에서 페이지네이션 적용 후 nickName 필터링하면 결과 수가 달라진다.

초기 구현 방향: `search`가 있을 때는 `limit`을 충분히 크게 설정하거나 전체 조회 후 필터링. 또는 `search` 쿼리가 있을 때는 페이지네이션 없이 전체 반환하는 방식으로 단순화. PRD에서 닉네임 검색과 페이지네이션이 동시에 요구되므로, 실용적 대안으로 검색 시에는 `limit = 1000` 상한으로 전체 조회 후 in-memory 필터/정렬/페이지네이션 수행.

### 5-3. `batchUpsertRecords`의 raw SQL

TypeORM `synchronize: false` 환경이므로 테이블 스키마는 마이그레이션으로 관리된다. raw SQL에서 참조하는 컬럼명이 실제 마이그레이션과 일치해야 한다. TypeORM의 camelCase → snake_case 변환 규칙(`"guildId"`, `"userId"` 등 실제 PostgreSQL 컬럼명은 camelCase 그대로 쌍따옴표로 감싸야 함)을 따른다. 이는 기존 `VoiceDailyRepository.accumulateChannelDuration`의 raw SQL 패턴과 동일하다.

### 5-4. `@Req()`와 JWT 페이로드

컨트롤러에서 실행자 userId 추출 시 `@Req()`를 사용한다. 기존 컨트롤러에서 `@Req()` 사용 사례가 없으면 `JwtAuthGuard`가 `req.user`에 주입하는 페이로드 형태를 확인해야 한다. `JwtAuthGuard`는 `AuthGuard('jwt')`를 extends하므로 Passport JWT 전략이 반환하는 user 객체가 `req.user`에 할당된다. `action-logs` 조회 등 executorUserId가 필요 없는 엔드포인트에서는 `@Req()` 불필요.

### 5-5. 마이그레이션

`synchronize: false` 환경이므로 3개의 신규 테이블에 대한 마이그레이션 파일이 필요하다. 구현 계획 범위에는 포함하지 않으나, 엔티티 구현 완료 후 마이그레이션 생성이 필수다.
