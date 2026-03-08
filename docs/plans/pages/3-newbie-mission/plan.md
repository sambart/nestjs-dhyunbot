# Unit C: 미션 추적 (F-NEWBIE-002) — 구현 계획

## 범위

PRD F-NEWBIE-002 구현.
신규 멤버 가입 시 미션 레코드 생성, VoiceDailyEntity 기반 플레이타임/플레이횟수 조회, 미션 현황 Embed 생성 및 갱신, 매일 자정 만료 처리 스케줄러, 갱신 버튼 인터랙션 핸들러를 구현한다.

---

## 전제 조건 (Unit A 공통 모듈 완성 상태 가정)

이 단위는 아래 공통 모듈이 이미 존재한다고 가정하고 작성된다.
공통 모듈은 `docs/specs/common-modules.md` 2절에 정의된 파일들이다.

| 파일 | 설명 |
|------|------|
| `apps/api/src/newbie/infrastructure/newbie-cache.keys.ts` | Redis 키 팩토리 (`NewbieKeys`) |
| `apps/api/src/newbie/infrastructure/newbie-redis.repository.ts` | Redis CRUD (`NewbieRedisRepository`) |
| `apps/api/src/newbie/infrastructure/newbie-config.repository.ts` | NewbieConfig DB CRUD |
| `apps/api/src/newbie/infrastructure/newbie-mission.repository.ts` | NewbieMission DB CRUD |
| `apps/api/src/newbie/infrastructure/newbie-mission.constants.ts` | `MISSION_STATUS_EMOJI` 상수 |
| `apps/api/src/newbie/domain/newbie-mission.entity.ts` | `NewbieMission` 엔티티 (이미 존재) |
| `apps/api/src/newbie/domain/newbie-config.entity.ts` | `NewbieConfig` 엔티티 (이미 존재) |
| `apps/api/src/newbie/newbie.module.ts` | `NewbieModule` — provider 등록 완료 상태 |
| `apps/api/src/event/newbie/newbie-events.ts` | `NEWBIE_EVENTS` 상수 + 이벤트 클래스 |

이 단위가 새로 생성하는 파일만 아래에 기술한다.

---

## 생성할 파일

### 1. `apps/api/src/newbie/mission/mission.service.ts`

미션 생성, 플레이타임 조회, Embed 메시지 생성 및 갱신을 담당하는 핵심 서비스.

#### 1-1. 의존성

```typescript
import { InjectDiscordClient } from '@discord-nestjs/core';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  EmbedBuilder,
  TextChannel,
} from 'discord.js';
import { Repository } from 'typeorm';

import { VoiceChannelHistory } from '../../channel/voice/domain/voice-channel-history.entity';
import { VoiceDailyEntity } from '../../channel/voice/domain/voice-daily.entity';
import { NewbieConfig } from '../domain/newbie-config.entity';
import { MissionStatus, NewbieMission } from '../domain/newbie-mission.entity';
import { NewbieConfigRepository } from '../infrastructure/newbie-config.repository';
import { NewbieMissionRepository } from '../infrastructure/newbie-mission.repository';
import { NewbieRedisRepository } from '../infrastructure/newbie-redis.repository';
import { MISSION_STATUS_EMOJI } from '../infrastructure/newbie-mission.constants';
```

#### 1-2. 생성자

```typescript
@Injectable()
export class MissionService {
  private readonly logger = new Logger(MissionService.name);

  constructor(
    private readonly missionRepo: NewbieMissionRepository,
    private readonly configRepo: NewbieConfigRepository,
    private readonly newbieRedis: NewbieRedisRepository,
    @InjectRepository(VoiceDailyEntity)
    private readonly voiceDailyRepo: Repository<VoiceDailyEntity>,
    @InjectRepository(VoiceChannelHistory)
    private readonly voiceHistoryRepo: Repository<VoiceChannelHistory>,
    @InjectDiscordClient()
    private readonly discord: Client,
  ) {}
```

`VoiceDailyEntity`와 `VoiceChannelHistory`는 `NewbieModule`에서 `TypeOrmModule.forFeature()`로 직접 등록하므로 `@InjectRepository`로 주입 가능하다. `VoiceChannelModule` import 불필요.

#### 1-3. `createMission(member: GuildMember, config: NewbieConfig): Promise<void>`

`guildMemberAdd` 이벤트에서 `NewbieGateway`가 호출한다.

```typescript
async createMission(member: GuildMember, config: NewbieConfig): Promise<void> {
  if (!config.missionEnabled) return;
  if (!config.missionDurationDays || !config.missionTargetPlaytimeHours) {
    this.logger.warn(
      `[MISSION] Mission config incomplete: guild=${member.guild.id}`,
    );
    return;
  }

  const today = this.toDateString(new Date());
  const endDate = this.toDateString(
    new Date(Date.now() + config.missionDurationDays * 24 * 60 * 60 * 1000),
  );
  const targetPlaytimeSec = config.missionTargetPlaytimeHours * 3600;

  await this.missionRepo.create(
    member.guild.id,
    member.id,
    today,
    endDate,
    targetPlaytimeSec,
  );

  // 미션 목록 캐시 무효화
  await this.newbieRedis.deleteMissionActive(member.guild.id);

  this.logger.log(
    `[MISSION] Created: guild=${member.guild.id} member=${member.id} end=${endDate}`,
  );

  // 미션 현황 Embed 갱신 (알림 채널이 설정된 경우)
  if (config.missionNotifyChannelId) {
    await this.refreshMissionEmbed(member.guild.id, config).catch((err) => {
      this.logger.error(
        `[MISSION] Failed to refresh embed after create: guild=${member.guild.id}`,
        (err as Error).stack,
      );
    });
  }
}
```

#### 1-4. `getPlaytimeSec(guildId: string, memberId: string, startDate: string, endDate: string): Promise<number>`

`VoiceDailyEntity`에서 기간 내 `channelDurationSec` 합산. `channelId = 'GLOBAL'` 레코드는 전체 집계 레코드이므로 제외한다.

```typescript
async getPlaytimeSec(
  guildId: string,
  memberId: string,
  startDate: string,
  endDate: string,
): Promise<number> {
  const result = await this.voiceDailyRepo
    .createQueryBuilder('vd')
    .select('COALESCE(SUM(vd.channelDurationSec), 0)', 'total')
    .where('vd.guildId = :guildId', { guildId })
    .andWhere('vd.userId = :memberId', { memberId })
    .andWhere('vd.date BETWEEN :startDate AND :endDate', { startDate, endDate })
    .andWhere("vd.channelId != 'GLOBAL'")
    .getRawOne<{ total: string }>();

  return parseInt(result?.total ?? '0', 10);
}
```

PRD의 쿼리 조건을 그대로 반영한다:
- `guildId = :guildId`
- `userId = :memberId`
- `date BETWEEN :startDate AND :endDate`
- `channelId != 'GLOBAL'`

#### 1-5. `getPlayCount(guildId: string, memberId: string, startDate: string, endDate: string): Promise<number>`

`VoiceChannelHistory`에서 기간 내 세션 수 COUNT. PRD의 쿼리 조건을 정확히 따른다.

`VoiceChannelHistory`는 `Member` 엔티티 FK(내부 int PK)를 통해 연결된다. `memberId`(Discord ID)를 기준으로 조회하려면 `member.discordMemberId`와 JOIN이 필요하다.

```typescript
async getPlayCount(
  guildId: string,
  memberId: string,
  startDate: string,
  endDate: string,
): Promise<number> {
  // startDate/endDate (YYYYMMDD)를 날짜 범위로 변환
  // startDatetime: startDate 00:00:00 KST
  // endDatetime:   endDate 23:59:59 KST
  const startDatetime = this.yyyymmddToKSTDate(startDate, 'start');
  const endDatetime = this.yyyymmddToKSTDate(endDate, 'end');

  const result = await this.voiceHistoryRepo
    .createQueryBuilder('vch')
    .select('COUNT(*)', 'count')
    .innerJoin('vch.member', 'm')
    .where('m.discordMemberId = :memberId', { memberId })
    .andWhere('vch.joinedAt BETWEEN :startDatetime AND :endDatetime', {
      startDatetime,
      endDatetime,
    })
    .getRawOne<{ count: string }>();

  return parseInt(result?.count ?? '0', 10);
}
```

주의: `VoiceChannelHistory`에는 `guildId` 컬럼이 없다. PRD 쿼리 조건에도 guildId 조건이 없다(서버별 멤버 분리는 discordMemberId의 고유성으로 보장). 따라서 guildId 필터 없이 memberId 기준으로만 조회한다.

`joinedAt` 컬럼명: 엔티티에서 `@Column({ name: 'joinAt' })`이지만 TypeScript 프로퍼티명은 `joinedAt`이다. QueryBuilder는 프로퍼티명 기준으로 동작하므로 `vch.joinedAt`으로 접근한다.

#### 1-6. `refreshMissionEmbed(guildId: string, config?: NewbieConfig): Promise<void>`

미션 현황 Embed를 채널에 전송하거나 기존 메시지를 수정한다. 갱신 버튼 인터랙션과 스케줄러 모두 이 메서드를 호출한다.

```typescript
async refreshMissionEmbed(guildId: string, config?: NewbieConfig): Promise<void> {
  // config가 없으면 DB에서 조회 (Redis 캐시 우선)
  const resolvedConfig = config ?? await this.configRepo.findByGuildId(guildId);
  if (!resolvedConfig?.missionEnabled || !resolvedConfig.missionNotifyChannelId) {
    return;
  }

  // 진행중 미션 목록 조회 (Redis 캐시 우선)
  const missions = await this.getActiveMissions(guildId);

  const embed = await this.buildMissionEmbed(guildId, missions);
  const row = this.buildRefreshButton(guildId);

  const channel = await this.discord.channels
    .fetch(resolvedConfig.missionNotifyChannelId)
    .catch(() => null);

  if (!channel || !channel.isTextBased()) {
    this.logger.warn(
      `[MISSION] Notify channel not found or not text-based: guild=${guildId} channel=${resolvedConfig.missionNotifyChannelId}`,
    );
    return;
  }

  const textChannel = channel as TextChannel;

  if (resolvedConfig.missionNotifyMessageId) {
    // 기존 메시지 수정 시도
    const message = await textChannel.messages
      .fetch(resolvedConfig.missionNotifyMessageId)
      .catch(() => null);

    if (message) {
      await message.edit({ embeds: [embed], components: [row] });
      return;
    }
    // 메시지가 삭제된 경우 신규 전송으로 진행
  }

  // 신규 메시지 전송 후 messageId 저장
  const sent = await textChannel.send({ embeds: [embed], components: [row] });
  await this.configRepo.updateMissionNotifyMessageId(guildId, sent.id);
}
```

#### 1-7. `getActiveMissions(guildId: string): Promise<NewbieMission[]>`

Redis 캐시 우선 조회. 미스 시 DB에서 조회 후 캐시에 저장한다.

```typescript
private async getActiveMissions(guildId: string): Promise<NewbieMission[]> {
  const cached = await this.newbieRedis.getMissionActive(guildId);
  if (cached) return cached;

  const missions = await this.missionRepo.findActiveByGuild(guildId);
  await this.newbieRedis.setMissionActive(guildId, missions);
  return missions;
}
```

#### 1-8. `buildMissionEmbed(guildId: string, missions: NewbieMission[]): Promise<EmbedBuilder>`

PRD Embed 형식을 그대로 구현한다.

```
제목: 🧑‍🌾 신입 미션 체크
설명:
🧑‍🌾 뉴비 멤버 (총 인원: N명)

@{username} 🌱
{startDate} ~ {endDate}
{statusEmoji} {statusText} | 플레이타임: {H}시간 {M}분 {S}초 | 플레이횟수: {N}회
```

```typescript
private async buildMissionEmbed(
  guildId: string,
  missions: NewbieMission[],
): Promise<EmbedBuilder> {
  const lines: string[] = [
    `🧑‍🌾 뉴비 멤버 (총 인원: ${missions.length}명)`,
    '',
  ];

  for (const mission of missions) {
    const [playtimeSec, playCount] = await Promise.all([
      this.getPlaytimeSec(guildId, mission.memberId, mission.startDate, mission.endDate),
      this.getPlayCount(guildId, mission.memberId, mission.startDate, mission.endDate),
    ]);

    const userName = await this.fetchMemberDisplayName(guildId, mission.memberId);
    const statusEmoji = MISSION_STATUS_EMOJI[mission.status];
    const statusText = this.getStatusText(mission.status);
    const playtimeStr = this.formatSeconds(playtimeSec);

    lines.push(`@${userName} 🌱`);
    lines.push(`${this.formatDate(mission.startDate)} ~ ${this.formatDate(mission.endDate)}`);
    lines.push(
      `${statusEmoji} ${statusText} | 플레이타임: ${playtimeStr} | 플레이횟수: ${playCount}회`,
    );
    lines.push('');
  }

  return new EmbedBuilder()
    .setTitle('🧑‍🌾 신입 미션 체크')
    .setDescription(lines.join('\n'))
    .setColor(0x57f287)
    .setTimestamp();
}
```

#### 1-9. `buildRefreshButton(guildId: string): ActionRowBuilder<ButtonBuilder>`

customId 패턴은 `common-modules.md` 6절에 정의된 `newbie_mission:refresh:{guildId}`를 사용한다.

```typescript
private buildRefreshButton(guildId: string): ActionRowBuilder<ButtonBuilder> {
  const button = new ButtonBuilder()
    .setCustomId(`newbie_mission:refresh:${guildId}`)
    .setLabel('갱신')
    .setEmoji('🔄')
    .setStyle(ButtonStyle.Secondary);

  return new ActionRowBuilder<ButtonBuilder>().addComponents(button);
}
```

#### 1-10. 보조 메서드

```typescript
/** 멤버 표시 이름 조회. Discord API 실패 시 memberId 일부 반환 */
private async fetchMemberDisplayName(
  guildId: string,
  memberId: string,
): Promise<string> {
  try {
    const guild = await this.discord.guilds.fetch(guildId);
    const member = await guild.members.fetch(memberId).catch(() => null);
    return member?.displayName ?? `User-${memberId.slice(0, 6)}`;
  } catch {
    return `User-${memberId.slice(0, 6)}`;
  }
}

/** MissionStatus → 한국어 텍스트 */
private getStatusText(status: MissionStatus): string {
  const map: Record<MissionStatus, string> = {
    [MissionStatus.IN_PROGRESS]: '진행중',
    [MissionStatus.COMPLETED]: '완료',
    [MissionStatus.FAILED]: '실패',
  };
  return map[status];
}

/** 초 단위를 'H시간 M분 S초' 형식으로 변환 */
private formatSeconds(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h}시간 ${m}분 ${s}초`;
}

/** YYYYMMDD 문자열을 'YYYY-MM-DD' 형식으로 변환 */
private formatDate(yyyymmdd: string): string {
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
}

/** 현재 날짜를 YYYYMMDD 형식으로 반환 (KST 기준) */
private toDateString(date: Date): string {
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10).replace(/-/g, '');
}

/**
 * YYYYMMDD 문자열을 KST 기준 Date 객체로 변환.
 * bound='start': 해당일 00:00:00.000 KST
 * bound='end':   해당일 23:59:59.999 KST
 */
private yyyymmddToKSTDate(yyyymmdd: string, bound: 'start' | 'end'): Date {
  const year = parseInt(yyyymmdd.slice(0, 4), 10);
  const month = parseInt(yyyymmdd.slice(4, 6), 10) - 1; // 0-indexed
  const day = parseInt(yyyymmdd.slice(6, 8), 10);
  const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
  const utcBase = Date.UTC(year, month, day);
  if (bound === 'start') {
    return new Date(utcBase - KST_OFFSET_MS);
  }
  return new Date(utcBase - KST_OFFSET_MS + 24 * 60 * 60 * 1000 - 1);
}
```

---

### 2. `apps/api/src/newbie/mission/mission.scheduler.ts`

매일 자정(KST) 만료된 IN_PROGRESS 미션을 COMPLETED 또는 FAILED로 갱신하는 스케줄러.

#### 2-1. 의존성 및 구조

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { MissionStatus } from '../domain/newbie-mission.entity';
import { NewbieMissionRepository } from '../infrastructure/newbie-mission.repository';
import { NewbieRedisRepository } from '../infrastructure/newbie-redis.repository';
import { MissionService } from './mission.service';
```

#### 2-2. `runDailyExpiry(): Promise<void>`

```typescript
@Injectable()
export class MissionScheduler {
  private readonly logger = new Logger(MissionScheduler.name);

  constructor(
    private readonly missionRepo: NewbieMissionRepository,
    private readonly newbieRedis: NewbieRedisRepository,
    private readonly missionService: MissionService,
  ) {}

  /**
   * 매일 자정 KST 실행.
   * '0 0 * * *' 은 서버 로컬 시각 기준이므로, 서버 타임존이 Asia/Seoul로 설정되어
   * 있어야 한다. TypeORM 설정에 `timezone: 'Asia/Seoul'`이 있으므로 일관성을 위해
   * 같은 타임존 기준으로 동작하도록 한다.
   */
  @Cron('0 0 * * *', { name: 'mission-daily-expiry', timeZone: 'Asia/Seoul' })
  async runDailyExpiry(): Promise<void> {
    this.logger.log('[MISSION SCHEDULER] Starting daily expiry check...');
    try {
      await this.processExpiredMissions();
    } catch (err) {
      this.logger.error(
        '[MISSION SCHEDULER] Unhandled error during expiry check',
        (err as Error).stack,
      );
    }
  }

  private async processExpiredMissions(): Promise<void> {
    const today = this.toDateString(new Date());

    // 1. endDate < today 이고 status = 'IN_PROGRESS' 인 미션 전체 조회
    //    IDX_newbie_mission_status_end_date 인덱스 활용
    const expiredMissions = await this.missionRepo.findExpired(today);

    if (expiredMissions.length === 0) {
      this.logger.log('[MISSION SCHEDULER] No expired missions found.');
      return;
    }

    this.logger.log(
      `[MISSION SCHEDULER] Found ${expiredMissions.length} expired missions.`,
    );

    // guildId별로 캐시 무효화가 필요한 집합
    const affectedGuildIds = new Set<string>();

    for (const mission of expiredMissions) {
      try {
        // 2. 해당 기간 동안의 플레이타임 조회
        const playtimeSec = await this.missionService.getPlaytimeSec(
          mission.guildId,
          mission.memberId,
          mission.startDate,
          mission.endDate,
        );

        // 3. 목표 달성 여부 판별
        const newStatus =
          playtimeSec >= mission.targetPlaytimeSec
            ? MissionStatus.COMPLETED
            : MissionStatus.FAILED;

        // 4. 상태 갱신
        await this.missionRepo.updateStatus(mission.id, newStatus);

        affectedGuildIds.add(mission.guildId);

        this.logger.log(
          `[MISSION SCHEDULER] Updated: id=${mission.id} member=${mission.memberId} ` +
            `playtime=${playtimeSec}s target=${mission.targetPlaytimeSec}s status=${newStatus}`,
        );
      } catch (err) {
        this.logger.error(
          `[MISSION SCHEDULER] Failed to process mission id=${mission.id}`,
          (err as Error).stack,
        );
        // 개별 실패는 로그 후 다음 미션 계속 처리
      }
    }

    // 5. 영향받은 길드의 미션 캐시 무효화
    for (const guildId of affectedGuildIds) {
      await this.newbieRedis.deleteMissionActive(guildId);
    }

    // 6. 영향받은 길드의 Embed 갱신
    for (const guildId of affectedGuildIds) {
      await this.missionService.refreshMissionEmbed(guildId).catch((err) => {
        this.logger.error(
          `[MISSION SCHEDULER] Failed to refresh embed: guild=${guildId}`,
          (err as Error).stack,
        );
      });
    }

    this.logger.log(
      `[MISSION SCHEDULER] Completed. Affected guilds: [${[...affectedGuildIds].join(', ')}]`,
    );
  }

  private toDateString(date: Date): string {
    const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
    return kst.toISOString().slice(0, 10).replace(/-/g, '');
  }
}
```

`@Cron`은 `@nestjs/schedule`의 `ScheduleModule`이 `AppModule` 또는 `NewbieModule`에 import되어야 동작한다. `common-modules.md`에서 `NewbieModule`의 imports를 정의할 때 `ScheduleModule.forRoot()`를 포함하거나 `AppModule`에서 전역으로 등록해야 한다.

---

### 3. `apps/api/src/event/newbie/newbie-interaction.handler.ts`

Discord `interactionCreate` 이벤트를 수신하여 `newbie_mission:` 접두사를 가진 버튼 인터랙션을 처리한다. Unit D(모코코 사냥)의 `newbie_moco:` 접두사도 이 핸들러에서 함께 처리한다.

이 Unit C에서는 `newbie_mission:refresh:{guildId}` 처리만 구현하고, Unit D 연동 부분(모코코)은 빈 분기로 남긴다.

#### 3-1. 구조

```typescript
import { On } from '@discord-nestjs/core';
import { Injectable, Logger } from '@nestjs/common';
import { ButtonInteraction, Interaction } from 'discord.js';

import { MissionService } from '../../newbie/mission/mission.service';

/** Newbie 도메인 버튼 customId 접두사 */
const CUSTOM_ID_PREFIX = {
  MISSION: 'newbie_mission:',
  MOCO: 'newbie_moco:',
} as const;

@Injectable()
export class NewbieInteractionHandler {
  private readonly logger = new Logger(NewbieInteractionHandler.name);

  constructor(private readonly missionService: MissionService) {}

  /**
   * Discord interactionCreate 이벤트 수신.
   * newbie_mission: 또는 newbie_moco: 접두사를 가진 버튼 인터랙션만 처리한다.
   * AutoChannelInteractionHandler와 동일한 접두사 필터링 패턴 적용.
   */
  @On('interactionCreate')
  async handle(interaction: Interaction): Promise<void> {
    if (!interaction.isButton()) return;

    const customId = interaction.customId;

    if (
      !customId.startsWith(CUSTOM_ID_PREFIX.MISSION) &&
      !customId.startsWith(CUSTOM_ID_PREFIX.MOCO)
    ) {
      return;
    }

    try {
      if (customId.startsWith(CUSTOM_ID_PREFIX.MISSION)) {
        await this.handleMissionInteraction(interaction);
      }
      // MOCO 처리는 Unit D에서 추가 예정 (MocoService 주입 및 분기 구현)
    } catch (error) {
      this.logger.error(
        `[interactionCreate] Failed to handle newbie interaction: customId=${customId}`,
        (error as Error).stack,
      );

      try {
        const errorContent = '오류가 발생했습니다. 잠시 후 다시 시도하세요.';
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ ephemeral: true, content: errorContent });
        } else {
          await interaction.reply({ ephemeral: true, content: errorContent });
        }
      } catch (replyError) {
        this.logger.error(
          '[interactionCreate] Failed to send error reply',
          (replyError as Error).stack,
        );
      }
    }
  }

  /**
   * newbie_mission:refresh:{guildId} 버튼 처리.
   * Embed를 최신 데이터로 갱신한다.
   */
  private async handleMissionInteraction(interaction: ButtonInteraction): Promise<void> {
    const parts = interaction.customId.split(':');
    // customId: newbie_mission:refresh:{guildId}
    const action = parts[1]; // 'refresh'
    const guildId = parts[2];

    if (!guildId) {
      await interaction.reply({ ephemeral: true, content: '잘못된 요청입니다.' });
      return;
    }

    if (action === 'refresh') {
      // defer + Embed 갱신 (Redis 캐시 무효화 후 최신 데이터로 갱신)
      await interaction.deferReply({ ephemeral: true });

      // 캐시 무효화 후 Embed 갱신
      await this.missionService.newbieRedis.deleteMissionActive(guildId);
      await this.missionService.refreshMissionEmbed(guildId);

      await interaction.editReply({ content: '미션 현황이 갱신되었습니다.' });
    }
  }
}
```

`missionService.newbieRedis`에 직접 접근하는 대신, `MissionService`에 `invalidateAndRefresh(guildId)` 메서드를 추가하여 캡슐화한다.

#### 3-2. `MissionService`에 추가할 공개 메서드

```typescript
/** 갱신 버튼 클릭 시 호출. 캐시 무효화 후 Embed 갱신. */
async invalidateAndRefresh(guildId: string): Promise<void> {
  await this.newbieRedis.deleteMissionActive(guildId);
  await this.refreshMissionEmbed(guildId);
}
```

#### 3-3. 수정된 `handleMissionInteraction`

```typescript
private async handleMissionInteraction(interaction: ButtonInteraction): Promise<void> {
  const parts = interaction.customId.split(':');
  const action = parts[1];
  const guildId = parts[2];

  if (!guildId) {
    await interaction.reply({ ephemeral: true, content: '잘못된 요청입니다.' });
    return;
  }

  if (action === 'refresh') {
    await interaction.deferReply({ ephemeral: true });
    await this.missionService.invalidateAndRefresh(guildId);
    await interaction.editReply({ content: '미션 현황이 갱신되었습니다.' });
  }
}
```

---

## 수정할 파일

### 4. `apps/api/src/newbie/newbie.module.ts`

Unit A(공통 모듈)에서 이미 생성된 파일에 Unit C의 provider를 추가한다. `ScheduleModule`을 import하고 `MissionService`, `MissionScheduler`를 등록한다.

추가 내용:

```typescript
import { ScheduleModule } from '@nestjs/schedule';
import { MissionService } from './mission/mission.service';
import { MissionScheduler } from './mission/mission.scheduler';

// imports 배열에 추가:
ScheduleModule.forRoot(),

// providers 배열에 추가:
MissionService,
MissionScheduler,
```

`ScheduleModule.forRoot()`는 앱당 1회만 호출해야 한다. `AppModule`에 이미 등록된 경우 중복 등록 없이 `NewbieModule`에서는 생략 가능하다. 현재 `app.module.ts`를 확인한 결과 `ScheduleModule`이 등록되어 있지 않으므로 `AppModule`에 추가한다.

### 5. `apps/api/src/app.module.ts`

```typescript
import { ScheduleModule } from '@nestjs/schedule';
// ...
import { NewbieModule } from './newbie/newbie.module';

@Module({
  imports: [
    ConfigModule.forRoot(BaseConfig),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),   // 추가 — MissionScheduler 활성화
    DiscordModule.forRootAsync(DiscordConfig),
    TypeOrmModule.forRootAsync(TypeORMConfig),
    ChannelModule,
    VoiceChannelModule,
    AutoChannelModule,
    NewbieModule,               // Unit A에서 추가됨
    MusicModule,
    DiscordEventsModule,
    RedisModule,
    VoiceAnalyticsModule,
    AuthModule,
  ],
  ...
})
```

### 6. `apps/api/src/event/discord-events.module.ts`

`NewbieInteractionHandler`는 `NewbieModule`에 등록되므로 `DiscordEventsModule`에 추가할 필요는 없다. 단, `NewbieModule`이 `@On('interactionCreate')` 이벤트를 수신하려면 `DiscordModule.forFeature()`가 `NewbieModule` 내에 import되어 있어야 한다.

Unit A 공통 모듈에서 `NewbieModule`에 `DiscordModule.forFeature()`를 import로 등록하도록 명시되어 있으므로, 이 파일에는 추가 변경 없다.

---

## 전체 파일 변경 요약

| 파일 | 신규/수정 | 담당 내용 |
|------|-----------|-----------|
| `newbie/mission/mission.service.ts` | 신규 생성 | 미션 생성, 플레이타임 조회, Embed 생성/갱신, 캐시 무효화 |
| `newbie/mission/mission.scheduler.ts` | 신규 생성 | 매일 자정 만료 처리, 상태 갱신, Embed 갱신 |
| `event/newbie/newbie-interaction.handler.ts` | 신규 생성 | `newbie_mission:refresh:{guildId}` 버튼 인터랙션 처리 |
| `newbie/newbie.module.ts` | 수정 | `MissionService`, `MissionScheduler` provider 등록 추가 |
| `app.module.ts` | 수정 | `ScheduleModule.forRoot()` import 추가 |

---

## 핵심 로직 흐름

### 미션 생성 (guildMemberAdd)

```
Discord guildMemberAdd 이벤트
    │
    ▼
NewbieGateway.handleMemberJoin(member)
    │
    ├─ config = NewbieConfigRepository.findByGuildId(guildId)
    │    └─ Redis 캐시 미스 → DB 조회 → Redis set (TTL 1h)
    │
    └─ missionEnabled = true 이면
           MissionService.createMission(member, config)
               │
               ├─ today = YYYYMMDD (KST 기준)
               ├─ endDate = today + missionDurationDays
               ├─ targetPlaytimeSec = missionTargetPlaytimeHours * 3600
               ├─ NewbieMissionRepository.create(...) → INSERT INTO newbie_mission
               ├─ NewbieRedisRepository.deleteMissionActive(guildId) → Redis DEL
               └─ missionNotifyChannelId 있으면
                      MissionService.refreshMissionEmbed(guildId, config)
```

### 플레이타임/플레이횟수 조회

```
MissionService.getPlaytimeSec(guildId, memberId, startDate, endDate)
    │
    └─ SELECT COALESCE(SUM("channelDurationSec"), 0) AS total
       FROM voice_daily
       WHERE "guildId" = :guildId
         AND "userId" = :memberId
         AND "date" BETWEEN :startDate AND :endDate
         AND "channelId" != 'GLOBAL'
       → 반환: number (초)

MissionService.getPlayCount(guildId, memberId, startDate, endDate)
    │
    ├─ startDatetime = startDate 00:00:00 KST → UTC Date
    ├─ endDatetime   = endDate 23:59:59.999 KST → UTC Date
    └─ SELECT COUNT(*) AS count
       FROM voice_channel_history vch
       INNER JOIN member m ON m.id = vch."memberId"
       WHERE m."discordMemberId" = :memberId
         AND vch."joinAt" BETWEEN :startDatetime AND :endDatetime
       → 반환: number (횟수)
```

### Embed 갱신 흐름

```
MissionService.refreshMissionEmbed(guildId, config?)
    │
    ├─ config 없으면 configRepo.findByGuildId(guildId)
    ├─ getActiveMissions(guildId)
    │    ├─ Redis 캐시 히트 → 반환
    │    └─ 미스 → missionRepo.findActiveByGuild(guildId) → Redis set (TTL 30분)
    │
    ├─ buildMissionEmbed(guildId, missions)
    │    └─ 각 미션마다 getPlaytimeSec + getPlayCount 병렬 조회
    │
    ├─ buildRefreshButton(guildId)
    │    └─ customId: newbie_mission:refresh:{guildId}
    │
    └─ missionNotifyMessageId 있으면
           channel.messages.fetch(messageId) → message.edit(...)
       없으면
           channel.send(...) → configRepo.updateMissionNotifyMessageId(guildId, sent.id)
```

### 갱신 버튼 클릭 인터랙션

```
Discord interactionCreate 이벤트
    │
    ▼
NewbieInteractionHandler.handle(interaction)
    │
    ├─ isButton() 확인
    ├─ customId.startsWith('newbie_mission:') 확인
    │
    └─ handleMissionInteraction(interaction)
           │
           ├─ customId = 'newbie_mission:refresh:{guildId}'
           ├─ guildId 파싱
           ├─ interaction.deferReply({ ephemeral: true })
           ├─ MissionService.invalidateAndRefresh(guildId)
           │    ├─ newbieRedis.deleteMissionActive(guildId) → Redis DEL
           │    └─ refreshMissionEmbed(guildId)
           └─ interaction.editReply({ content: '미션 현황이 갱신되었습니다.' })
```

### 스케줄러 (매일 자정)

```
MissionScheduler.runDailyExpiry() [Cron: '0 0 * * *' KST]
    │
    ├─ today = YYYYMMDD (KST 기준)
    ├─ missionRepo.findExpired(today)
    │    └─ SELECT * FROM newbie_mission
    │       WHERE status = 'IN_PROGRESS' AND "endDate" < :today
    │       (IDX_newbie_mission_status_end_date 활용)
    │
    └─ 각 만료 미션에 대해:
           ├─ getPlaytimeSec(guildId, memberId, startDate, endDate)
           ├─ playtimeSec >= targetPlaytimeSec ? COMPLETED : FAILED
           └─ missionRepo.updateStatus(mission.id, newStatus)
               → UPDATE newbie_mission SET status = :status WHERE id = :id

    ├─ 영향받은 guildId별 Redis DEL (newbie:mission:active:{guildId})
    └─ 영향받은 guildId별 refreshMissionEmbed(guildId) (오류 시 로그 후 계속)
```

---

## DB 쿼리 상세

### 플레이타임 합산 쿼리

```sql
SELECT COALESCE(SUM("channelDurationSec"), 0) AS total
FROM voice_daily
WHERE "guildId" = $1
  AND "userId" = $2
  AND "date" BETWEEN $3 AND $4
  AND "channelId" != 'GLOBAL'
```

- 파라미터: `[$guildId, $memberId, $startDate, $endDate]`
- 인덱스: `IDX_voice_daily_guild_user_date` (`guildId`, `userId`, `date`) 활용
- `channelId != 'GLOBAL'` 필터는 인덱스 후 필터링

### 플레이횟수 COUNT 쿼리

```sql
SELECT COUNT(*) AS count
FROM voice_channel_history vch
INNER JOIN member m ON m.id = vch."memberId"
WHERE m."discordMemberId" = $1
  AND vch."joinAt" BETWEEN $2 AND $3
```

- 파라미터: `[$memberId, $startDatetime, $endDatetime]`
- `member.discordMemberId`는 UNIQUE 인덱스 보유 → JOIN 효율적
- `vch.joinAt` (`joinedAt` TypeScript 프로퍼티, DB 컬럼명 `joinAt`) — QueryBuilder는 컬럼명이 아닌 TypeScript 프로퍼티명을 사용하므로 `vch.joinedAt`으로 접근

### 만료 미션 조회 쿼리 (스케줄러)

```sql
SELECT *
FROM newbie_mission
WHERE status = 'IN_PROGRESS'
  AND "endDate" < $1
```

- 파라미터: `[$today]`
- 인덱스: `IDX_newbie_mission_status_end_date` (`status`, `endDate`) 활용 — status 등치 후 endDate 범위 조건으로 효율적

---

## Redis 캐시 전략

| 동작 | Redis 조작 |
|------|-----------|
| 미션 생성 후 | `DEL newbie:mission:active:{guildId}` |
| Embed 갱신 버튼 클릭 | `DEL newbie:mission:active:{guildId}` → Embed 갱신 |
| 스케줄러 상태 갱신 후 | `DEL newbie:mission:active:{guildId}` (길드별) |
| 활성 미션 조회 (refreshMissionEmbed) | `GET newbie:mission:active:{guildId}` 히트 시 반환, 미스 시 DB 조회 후 `SET ... EX 1800` |

---

## 오류 처리 전략

| 시나리오 | 처리 방식 |
|----------|-----------|
| Discord 채널 조회 실패 (`refreshMissionEmbed`) | 채널 없거나 text-based 아님 → warn 로그 후 조용히 종료 |
| 기존 메시지 삭제됨 (`message.fetch` 실패) | null 처리 후 신규 메시지 전송으로 폴백 |
| 멤버 표시 이름 조회 실패 | `User-{memberId.slice(0,6)}` fallback |
| 스케줄러에서 개별 미션 처리 실패 | error 로그 후 다음 미션 계속 처리 (전체 롤백 없음) |
| Embed 갱신 중 오류 (`createMission`, 스케줄러) | error 로그 후 조용히 종료 (미션 생성/갱신 자체는 성공) |
| 인터랙션 응답 실패 | error 로그 후 에러 메시지 ephemeral 응답 시도 |

---

## 기존 코드와의 충돌 분석

| 항목 | 검토 결과 |
|------|-----------|
| `VoiceDailyEntity` 직접 등록 | `NewbieModule`에서 `TypeOrmModule.forFeature([VoiceDailyEntity, VoiceChannelHistory])`로 직접 등록. `VoiceChannelModule`도 동일 엔티티를 등록하지만 NestJS는 같은 엔티티 다중 등록을 허용(싱글턴 Repository 반환). 충돌 없음. |
| `VoiceChannelHistory`의 `joinedAt` 프로퍼티 | DB 컬럼명 `joinAt`, TypeScript 프로퍼티명 `joinedAt`. QueryBuilder에서 `vch.joinedAt`으로 접근하면 TypeORM이 `"joinAt"`으로 변환. 정상 동작. |
| `ScheduleModule.forRoot()` 중복 | `AppModule`에 1회만 등록. `NewbieModule` 내에서는 미등록. 충돌 없음. |
| `@On('interactionCreate')` 다중 핸들러 | `AutoChannelInteractionHandler`와 `NewbieInteractionHandler` 모두 `interactionCreate`를 수신. customId 접두사 필터링으로 충돌 없음. discord-nestjs의 `@On` 데코레이터는 이벤트 리스너를 모두 실행하므로 둘 다 호출되지만 접두사 불일치 시 즉시 return. |
| `NewbieGateway`의 `createMission` 호출 | Unit A의 `NewbieGateway`가 `MissionService.createMission`을 호출. `NewbieGateway`와 `MissionService`는 동일 모듈(`NewbieModule`)의 provider이므로 주입 가능. 충돌 없음. |
| `NewbieMissionRepository.findExpired` 시그니처 | `today` 파라미터 (`YYYYMMDD` 문자열). `endDate < today` 조건이 문자열 비교로 동작하는데, `YYYYMMDD` 형식은 사전식 정렬이 시간 순서와 일치하므로 정상 동작. |

---

## 구현 순서

1. `newbie-mission.constants.ts` — `MISSION_STATUS_EMOJI` 상수 (Unit A에서 생성, 확인만)
2. `mission.service.ts` — 의존: `NewbieMissionRepository`, `NewbieConfigRepository`, `NewbieRedisRepository`, `VoiceDailyEntity`, `VoiceChannelHistory`, Discord Client
3. `mission.scheduler.ts` — 의존: `NewbieMissionRepository`, `NewbieRedisRepository`, `MissionService`
4. `event/newbie/newbie-interaction.handler.ts` — 의존: `MissionService`
5. `newbie/newbie.module.ts` 수정 — `MissionService`, `MissionScheduler` 추가
6. `app.module.ts` 수정 — `ScheduleModule.forRoot()` 추가
