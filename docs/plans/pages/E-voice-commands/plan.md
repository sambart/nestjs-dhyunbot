# Unit E: Voice 커맨드 확장 구현 계획

> 작성일: 2026-03-08
> 범위: `/voice-time`, `/voice-rank` 신규 커맨드 추가 + 기존 Gemini 커맨드 4개 관리자 제한

---

## 1. 개요

두 가지 독립된 작업으로 구성된다.

**작업 1 — 신규 커맨드 2개** (voice 도메인)
- `/voice-time`: 본인의 음성 채널 참여 시간 조회 (ephemeral)
- `/voice-rank`: 서버 음성 채널 이용 순위 Top 10 + 본인 순위

**작업 2 — 기존 커맨드 4개 관리자 제한 추가** (gemini 도메인)
- `/voice-stats`, `/my-voice-stats`, `/community-health`, `/voice-leaderboard`

### 파일 목록

| 구분 | 파일 경로 | 작업 |
|------|-----------|------|
| 신규 | `apps/api/src/channel/voice/application/voice-days.dto.ts` | DTO |
| 신규 | `apps/api/src/channel/voice/application/voice-stats-query.service.ts` | DB 쿼리 서비스 |
| 신규 | `apps/api/src/channel/voice/application/voice-time.command.ts` | `/voice-time` 커맨드 |
| 신규 | `apps/api/src/channel/voice/application/voice-rank.command.ts` | `/voice-rank` 커맨드 |
| 수정 | `apps/api/src/channel/voice/voice-channel.module.ts` | providers 등록 |
| 수정 | `apps/api/src/gemini/commands/voice-stats.command.ts` | 관리자 제한 |
| 수정 | `apps/api/src/gemini/commands/my-voice-stats.command.ts` | 관리자 제한 |
| 수정 | `apps/api/src/gemini/commands/community-health.command.ts` | 관리자 제한 |
| 수정 | `apps/api/src/gemini/commands/voice-leaderboard.command.ts` | 관리자 제한 |

---

## 2. 데이터 모델 이해

`voice_daily` 테이블의 `channelId` 값에 따라 데이터 의미가 다르다.

| channelId 값 | 저장되는 데이터 |
|---|---|
| `'GLOBAL'` | `micOnSec`, `micOffSec`, `aloneSec` (마이크 집계) |
| 실제 채널 ID | `channelDurationSec` (채널별 체류 시간) |

따라서:
- **총 음성 시간** = `channelId != 'GLOBAL'`인 `channelDurationSec` 합산
- **마이크 ON 시간** = `channelId = 'GLOBAL'`인 `micOnSec` 합산
- **마이크 OFF 시간** = `channelId = 'GLOBAL'`인 `micOffSec` 합산

날짜 범위 계산은 `VoiceAnalyticsService.getDateRange(days)` 정적 메서드를 재사용한다. 이 메서드는 `VoiceAnalyticsModule`에 속해 있으므로, `VoiceChannelModule`에서 직접 import할 수 없다. 대신 동일한 로직을 `VoiceStatsQueryService` 내부 private 메서드로 복제한다 (단순 날짜 계산이므로 유틸 의존성 없음).

---

## 3. 파일별 상세 구현 계획

### 파일 1: `voice-days.dto.ts`

**경로**: `apps/api/src/channel/voice/application/voice-days.dto.ts`

기존 `apps/api/src/gemini/commands/analytics-days.dto.ts`와 완전히 동일한 구조이나, voice 도메인 내부에 위치시켜 모듈 간 의존성을 만들지 않는다.

```typescript
import { Param, ParamType } from '@discord-nestjs/core';

export class VoiceDaysDto {
  @Param({
    name: 'days',
    description: '조회할 기간 (일)',
    required: false,
    type: ParamType.INTEGER,
    minValue: 1,
    maxValue: 90,
  })
  days: number = 7;
}
```

**주의**: `AnalyticsDaysDto`를 cross-module import하면 `VoiceAnalyticsModule` 의존성이 생긴다. DRY 원칙보다 모듈 경계를 우선한다. DTO는 순수 데코레이터 클래스이므로 중복이 무해하다.

---

### 파일 2: `voice-stats-query.service.ts`

**경로**: `apps/api/src/channel/voice/application/voice-stats-query.service.ts`

`VoiceDailyRepository`는 현재 쓰기 전용 메서드만 가지고 있으므로, 읽기 전용 집계 쿼리는 이 서비스에서 `InjectRepository(VoiceDailyEntity)`를 직접 사용한다. `VoiceChannelModule`은 이미 `TypeOrmModule.forFeature([VoiceChannelHistory, VoiceDailyEntity])`를 import하고 있어 추가 설정이 불필요하다.

**공개 메서드 2개**:

#### `getUserVoiceStats(guildId, userId, days)`

개인 음성 통계를 반환한다.

```typescript
async getUserVoiceStats(
  guildId: string,
  userId: string,
  days: number,
): Promise<{ totalSec: number; micOnSec: number; micOffSec: number }>
```

쿼리 로직:
1. `getDateRange(days)`로 날짜 범위 계산
2. `channelId != 'GLOBAL'` 조건으로 `channelDurationSec` 합산 → `totalSec`
3. `channelId = 'GLOBAL'` 조건으로 `micOnSec`, `micOffSec` 합산

TypeORM `Repository`의 `createQueryBuilder`를 사용한 집계 쿼리:

```sql
-- 총 음성 시간
SELECT COALESCE(SUM("channelDurationSec"), 0) AS total
FROM voice_daily
WHERE "guildId" = $1 AND "userId" = $2 AND "channelId" != 'GLOBAL'
  AND "date" BETWEEN $3 AND $4

-- 마이크 시간
SELECT COALESCE(SUM("micOnSec"), 0) AS "micOn",
       COALESCE(SUM("micOffSec"), 0) AS "micOff"
FROM voice_daily
WHERE "guildId" = $1 AND "userId" = $2 AND "channelId" = 'GLOBAL'
  AND "date" BETWEEN $3 AND $4
```

#### `getGuildVoiceRank(guildId, days)`

서버 전체 사용자 순위를 반환한다.

```typescript
async getGuildVoiceRank(
  guildId: string,
  days: number,
): Promise<Array<{ userId: string; userName: string; totalSec: number; micOnSec: number; micOffSec: number }>>
```

쿼리 로직:
1. `channelId != 'GLOBAL'` 그룹별 `channelDurationSec` 합산으로 `totalSec` + 최신 `userName` 획득
2. `channelId = 'GLOBAL'` 그룹별 `micOnSec`, `micOffSec` 합산
3. `userId`로 LEFT JOIN 병합 후 `totalSec DESC` 정렬

단일 raw SQL로 처리:

```sql
SELECT
  c."userId",
  c."userName",
  COALESCE(c.total, 0) AS "totalSec",
  COALESCE(g."micOnSec", 0) AS "micOnSec",
  COALESCE(g."micOffSec", 0) AS "micOffSec"
FROM (
  SELECT "userId",
         MAX("userName") AS "userName",
         SUM("channelDurationSec") AS total
  FROM voice_daily
  WHERE "guildId" = $1 AND "channelId" != 'GLOBAL'
    AND "date" BETWEEN $2 AND $3
  GROUP BY "userId"
) c
LEFT JOIN (
  SELECT "userId",
         SUM("micOnSec") AS "micOnSec",
         SUM("micOffSec") AS "micOffSec"
  FROM voice_daily
  WHERE "guildId" = $1 AND "channelId" = 'GLOBAL'
    AND "date" BETWEEN $2 AND $3
  GROUP BY "userId"
) g ON c."userId" = g."userId"
ORDER BY "totalSec" DESC
```

#### `getDateRange(days)` — private 유틸

`VoiceAnalyticsService.getDateRange`와 동일한 로직. YYYYMMDD 형식 문자열 반환.

```typescript
private getDateRange(days: number): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);
  const fmt = (d: Date) =>
    `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return { start: fmt(start), end: fmt(end) };
}
```

---

### 파일 3: `voice-time.command.ts`

**경로**: `apps/api/src/channel/voice/application/voice-time.command.ts`

`VoiceFlushCommand`와 동일한 파일 구조를 따른다.

**커맨드 스펙**:
- name: `voice-time`
- description: `내 음성 채널 참여 시간을 조회합니다`
- `defaultMemberPermissions` 없음 (모두 사용 가능)
- 응답: `ephemeral: true`

**핸들러 흐름**:
1. `interaction.guildId` 검증 (없으면 ephemeral 에러)
2. `interaction.deferReply({ ephemeral: true })`
3. `voiceStatsQueryService.getUserVoiceStats(guildId, userId, days)` 호출
4. 데이터 없으면 `editReply`로 안내 메시지
5. 있으면 `EmbedBuilder`로 응답

**Embed 구성**:
```
제목: 🎤 {displayName}님의 음성 시간 (최근 {days}일)
색상: Colors.Green
필드:
  ⏱️ 총 음성 시간: N시간 N분
  🎙️ 마이크 ON: N시간 N분
  🔇 마이크 OFF: N시간 N분
타임스탬프: 있음
```

**시간 포맷 함수**: `formatTime(sec: number): string`
- 1시간 이상: `N시간 N분`
- 1시간 미만: `N분`
- 0초: `0분`

---

### 파일 4: `voice-rank.command.ts`

**경로**: `apps/api/src/channel/voice/application/voice-rank.command.ts`

**커맨드 스펙**:
- name: `voice-rank`
- description: `음성 채널 이용 순위를 조회합니다`
- `defaultMemberPermissions` 없음 (모두 사용 가능)
- 응답: 공개 (ephemeral 아님)

**핸들러 흐름**:
1. `interaction.guildId` 검증
2. `interaction.deferReply()` (공개)
3. `voiceStatsQueryService.getGuildVoiceRank(guildId, days)` 호출
4. 빈 결과이면 안내 메시지
5. Top 10 슬라이스 + 본인 순위 계산

**본인 순위 계산**:
- `rankList.findIndex(u => u.userId === interaction.user.id)` + 1
- Top 10 안에 없으면 별도 필드로 표시

**Embed 구성**:
```
제목: 🏆 음성 채널 순위 (최근 {days}일)
색상: Colors.Gold
설명: Top 10 사용자 목록 (줄바꿈 구분)
  예: 🥇 **userName** — ⏱️ N시간 N분 | 🎙️ ON N분 | 🔇 OFF N분
      🥈 ...
      4. ...
추가 필드(조건부):
  이름: 📍 내 순위
  값: {rank}위 (총 N명) — ⏱️ N시간 N분 | 🎙️ ON N분 | 🔇 OFF N분
타임스탬프: 있음
```

**순위 메달**: 1~3위는 `['🥇', '🥈', '🥉']`, 4위 이후는 `**{n}.**`

**본인이 Top 10 밖인 경우**: 순위 목록 아래에 `addFields`로 별도 표시. 데이터가 없으면 "기록 없음" 표시.

**Embed description 길이 주의**: Top 10 항목은 각각 약 60~80자. 최대 약 800자로 4096 제한을 초과하지 않는다.

---

### 파일 5: `voice-channel.module.ts` 수정

**추가 import 3개**:
```typescript
import { VoiceStatsQueryService } from './application/voice-stats-query.service';
import { VoiceTimeCommand } from './application/voice-time.command';
import { VoiceRankCommand } from './application/voice-rank.command';
```

**providers 배열에 추가** (기존 목록 끝에 이어서):
```typescript
VoiceStatsQueryService,
VoiceTimeCommand,
VoiceRankCommand,
```

`TypeOrmModule.forFeature([VoiceChannelHistory, VoiceDailyEntity])`는 이미 등록되어 있으므로 `VoiceStatsQueryService`의 `@InjectRepository(VoiceDailyEntity)`가 정상 동작한다.

`exports`는 수정하지 않는다 (`VoiceStatsQueryService`는 모듈 외부 노출 불필요).

---

### 파일 6~9: Gemini 커맨드 4개 관리자 제한 추가

4개 파일 모두 동일한 패턴을 적용한다. 변경 사항:

#### 1. `@Command` 데코레이터에 `defaultMemberPermissions` 추가

```typescript
import { PermissionFlagsBits } from 'discord.js';

@Command({
  name: 'voice-stats', // 각 커맨드명 유지
  description: '...',  // 기존 설명 유지
  defaultMemberPermissions: PermissionFlagsBits.Administrator,
})
```

#### 2. 핸들러 내부 권한 체크 추가

`deferReply` 호출 전에 삽입:

```typescript
if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
  await interaction.reply({ content: '관리자만 사용할 수 있는 명령어입니다.', ephemeral: true });
  return;
}
```

**4개 파일별 `deferReply` 방식 확인**:

| 파일 | 기존 deferReply | ephemeral |
|---|---|---|
| `voice-stats.command.ts` | `interaction.deferReply()` | false (공개) |
| `my-voice-stats.command.ts` | `interaction.deferReply({ ephemeral: true })` | true |
| `community-health.command.ts` | `interaction.deferReply()` | false (공개) |
| `voice-leaderboard.command.ts` | `interaction.deferReply()` | false (공개) |

권한 체크는 `deferReply` 이전이므로 반드시 `interaction.reply()`를 사용한다 (`editReply` 불가).

**`PermissionFlagsBits` import**: 각 파일에서 `discord.js` import 문에 `PermissionFlagsBits` 추가.

- `voice-stats.command.ts`: 기존 `import { Colors, CommandInteraction, EmbedBuilder } from 'discord.js'` → `PermissionFlagsBits` 추가
- `my-voice-stats.command.ts`: 기존 `import { Colors, CommandInteraction, EmbedBuilder } from 'discord.js'` → `PermissionFlagsBits` 추가
- `community-health.command.ts`: 기존 `import { Colors, CommandInteraction, EmbedBuilder } from 'discord.js'` → `PermissionFlagsBits` 추가
- `voice-leaderboard.command.ts`: 기존 `import { Colors, CommandInteraction, EmbedBuilder } from 'discord.js'` → `PermissionFlagsBits` 추가

---

## 4. 충돌 및 호환성 검토

| 항목 | 판단 |
|---|---|
| `VoiceDailyEntity`가 `VoiceChannelModule`에 이미 등록됨 | `VoiceStatsQueryService`에서 `@InjectRepository` 사용 가능. 충돌 없음 |
| `voice-rank` 커맨드명이 기존 `voice-leaderboard`와 기능 중복 | `voice-leaderboard`는 Gemini AI 분석 기반, `voice-rank`는 DB 직접 집계. 목적이 다르며 커맨드명도 다름 |
| `voice-time` vs `my-voice-stats` 중복 | `my-voice-stats`는 관리자 전용 + 상세 채널별 분석, `voice-time`은 일반 사용자용 단순 시간 조회. 역할 구분됨 |
| `VoiceDaysDto` vs `AnalyticsDaysDto` | 동일 구조이나 모듈 의존성 방지를 위해 분리. DTO 클래스는 순수 값 객체이므로 중복 허용 |
| `@discord-nestjs/core` 커맨드 등록 중복 | 커맨드명이 모두 다르므로 충돌 없음 |
| `PermissionFlagsBits` import | `discord.js`에서 직접 가져오므로 추가 패키지 불필요 |
| Gemini 커맨드 `defaultMemberPermissions` 변경 후 Discord 커맨드 재등록 | 봇 재시작 시 `@discord-nestjs/core`가 자동으로 커맨드를 재등록함. 별도 조치 불필요 |

---

## 5. 구현 순서

작업 간 의존 관계:

```
voice-days.dto.ts
  ↓
voice-stats-query.service.ts
  ↓
voice-time.command.ts, voice-rank.command.ts (병렬)
  ↓
voice-channel.module.ts (providers 등록)
```

Gemini 커맨드 수정 4개는 모두 독립적으로 병렬 처리 가능.

**구체적 순서**:
1. `voice-days.dto.ts` 생성
2. `voice-stats-query.service.ts` 생성
3. `voice-time.command.ts` 생성
4. `voice-rank.command.ts` 생성
5. `voice-channel.module.ts` 수정
6. `voice-stats.command.ts` 수정 (관리자 제한)
7. `my-voice-stats.command.ts` 수정 (관리자 제한)
8. `community-health.command.ts` 수정 (관리자 제한)
9. `voice-leaderboard.command.ts` 수정 (관리자 제한)
