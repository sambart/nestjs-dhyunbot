# 단위 8: Status Prefix 인터랙션 + Voice 연계 — 구현 계획

## 범위

PRD 기능: F-STATUS-PREFIX-003 (접두사 적용), F-STATUS-PREFIX-004 (접두사 제거), F-STATUS-PREFIX-005 (음성 채널 퇴장 시 자동 복원)

이 단위에서 새로 생성하거나 수정하는 파일은 공통 모듈 판단 문서(`/docs/specs/common-modules.md`) Status Prefix 섹션 5절의 파일 경로 목록과 일치한다.

---

## 전제 조건 (공통 모듈 단계에서 선행 완료)

다음 파일들이 공통 모듈 단계(단위 A)에서 이미 생성되어 있어야 한다.

| 파일 | 상태 | 이유 |
|------|------|------|
| `apps/api/src/status-prefix/domain/status-prefix-config.entity.ts` | 이미 존재 | TypeORM 엔티티 |
| `apps/api/src/status-prefix/domain/status-prefix-button.entity.ts` | 이미 존재 | TypeORM 엔티티 + `StatusPrefixButtonType` enum |
| `apps/api/src/migrations/1773200000000-AddStatusPrefix.ts` | 이미 존재 | DB 스키마 마이그레이션 |
| `apps/api/src/status-prefix/infrastructure/status-prefix-cache.keys.ts` | 신규 (선행) | Redis 키 중앙화 |
| `apps/api/src/status-prefix/infrastructure/status-prefix-redis.repository.ts` | 신규 (선행) | Redis CRUD |
| `apps/api/src/status-prefix/infrastructure/status-prefix-config.repository.ts` | 신규 (선행) | DB CRUD |
| `apps/api/src/status-prefix/status-prefix.module.ts` | 신규 (선행) | 모듈 등록 |

---

## 생성/수정 파일 목록

### 신규 생성 (이 단위 전용)

```
apps/api/src/status-prefix/application/status-prefix-apply.service.ts
apps/api/src/status-prefix/application/status-prefix-reset.service.ts
apps/api/src/status-prefix/interaction/status-prefix-interaction.handler.ts
```

### 기존 수정

```
apps/api/src/event/voice/voice-leave.handler.ts      — restoreOnLeave() 호출 추가
apps/api/src/event/discord-events.module.ts          — StatusPrefixModule import 추가
apps/api/src/app.module.ts                           — StatusPrefixModule import 추가
```

---

## 구현 상세

### 1. `status-prefix-cache.keys.ts` (선행 단계 파일, 확인만)

**경로**: `apps/api/src/status-prefix/infrastructure/status-prefix-cache.keys.ts`

공통 모듈 문서 2-1에 정의된 대로 이 파일이 존재함을 확인한다. 이 단위에서 수정하지 않는다.

```typescript
export const StatusPrefixKeys = {
  /** 원래 닉네임 저장: status_prefix:original:{guildId}:{memberId} — TTL 없음 (퇴장 시 명시적 삭제) */
  originalNickname: (guildId: string, memberId: string) =>
    `status_prefix:original:${guildId}:${memberId}`,

  /** 설정 캐시: status_prefix:config:{guildId} — TTL 1시간 */
  config: (guildId: string) => `status_prefix:config:${guildId}`,
} as const;
```

---

### 2. `status-prefix-redis.repository.ts` (선행 단계 파일, 확인만)

**경로**: `apps/api/src/status-prefix/infrastructure/status-prefix-redis.repository.ts`

공통 모듈 문서 2-2에 정의된 메서드들이 구현되어 있음을 확인한다.

`setOriginalNicknameNx` 구현 시 `RedisService`에 `setNx` 전용 메서드가 없으므로, `REDIS_CLIENT`를 직접 주입(`@Inject(REDIS_CLIENT) private readonly client: Redis`)받아 `this.client.set(key, value, 'NX')`를 사용한다. `pipeline()` 콜백 방식은 NX 결과를 단독으로 확인하기 어려우므로 직접 주입 방식이 더 명확하다.

```typescript
import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';

import { REDIS_CLIENT } from '../../../redis/redis.constants';
import { RedisService } from '../../../redis/redis.service';
import { StatusPrefixKeys } from './status-prefix-cache.keys';

const TTL = {
  CONFIG: 3_600, // 1시간
} as const;

@Injectable()
export class StatusPrefixRedisRepository {
  constructor(
    private readonly redis: RedisService,
    @Inject(REDIS_CLIENT) private readonly client: Redis,
  ) {}

  async getOriginalNickname(guildId: string, memberId: string): Promise<string | null> {
    return this.redis.get<string>(StatusPrefixKeys.originalNickname(guildId, memberId));
  }

  /**
   * 원래 닉네임을 NX(존재하지 않을 때만) 저장.
   * 이미 값이 있으면 false 반환(덮어쓰기 방지).
   * 최초 접두사 적용 시만 원래 닉네임을 기록하기 위해 사용.
   */
  async setOriginalNicknameNx(
    guildId: string,
    memberId: string,
    nickname: string,
  ): Promise<boolean> {
    const key = StatusPrefixKeys.originalNickname(guildId, memberId);
    // ioredis: NX 옵션 — 키가 없을 때만 저장. 저장 성공 시 'OK', 이미 존재 시 null 반환.
    const result = await this.client.set(key, JSON.stringify(nickname), 'NX');
    return result === 'OK';
  }

  async deleteOriginalNickname(guildId: string, memberId: string): Promise<void> {
    await this.redis.del(StatusPrefixKeys.originalNickname(guildId, memberId));
  }

  async getConfig(guildId: string): Promise<StatusPrefixConfigCache | null> {
    return this.redis.get<StatusPrefixConfigCache>(StatusPrefixKeys.config(guildId));
  }

  async setConfig(guildId: string, config: StatusPrefixConfigCache): Promise<void> {
    await this.redis.set(StatusPrefixKeys.config(guildId), config, TTL.CONFIG);
  }

  async deleteConfig(guildId: string): Promise<void> {
    await this.redis.del(StatusPrefixKeys.config(guildId));
  }
}

/** Redis 설정 캐시 형태 (enabled, prefixTemplate만 인터랙션에서 필요) */
export interface StatusPrefixConfigCache {
  enabled: boolean;
  prefixTemplate: string;
  channelId: string | null;
  messageId: string | null;
  embedTitle: string | null;
  embedDescription: string | null;
  embedColor: string | null;
}
```

---

### 3. `status-prefix-config.repository.ts` (선행 단계 파일, 확인만)

**경로**: `apps/api/src/status-prefix/infrastructure/status-prefix-config.repository.ts`

공통 모듈 문서 2-3에 정의된 아래 메서드들이 구현되어 있음을 확인한다.

| 메서드 | 설명 | 이 단위에서 사용처 |
|--------|------|-------------------|
| `findByGuildId(guildId)` | buttons 관계 포함 설정 조회 | `apply` 시 `prefixTemplate` 획득 |
| `findButtonById(buttonId)` | 버튼 단건 조회 (prefix, type 확인) | `apply`, `reset` 진입점 |
| `upsert(guildId, dto)` | 설정 upsert (이 단위 미사용) | — |
| `updateMessageId(guildId, messageId)` | 메시지 ID 갱신 (이 단위 미사용) | — |

`findButtonById` 구현 패턴 (`AutoChannelConfigRepository.findButtonById` 동일 패턴):

```typescript
async findButtonById(buttonId: number): Promise<StatusPrefixButton | null> {
  return this.buttonRepo.findOne({
    where: { id: buttonId },
    relations: { config: true },  // prefixTemplate 조회를 위해 config 포함
  });
}
```

---

### 4. `status-prefix-apply.service.ts` (신규 생성)

**경로**: `apps/api/src/status-prefix/application/status-prefix-apply.service.ts`

F-STATUS-PREFIX-003 구현. `type = PREFIX` 버튼 클릭 시 닉네임에 접두사를 적용한다.

#### 의존성

| 의존성 | 주입 방법 | 용도 |
|--------|-----------|------|
| `StatusPrefixConfigRepository` | 생성자 | `findButtonById` — 버튼 조회 |
| `StatusPrefixRedisRepository` | 생성자 | `getOriginalNickname`, `setOriginalNicknameNx` |

Discord `GuildMember` 인스턴스는 `ButtonInteraction`에서 직접 추출하므로 Discord Client 별도 주입 불필요.

#### 전체 구현

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { ButtonInteraction, GuildMember } from 'discord.js';

import { StatusPrefixConfigRepository } from '../infrastructure/status-prefix-config.repository';
import { StatusPrefixRedisRepository } from '../infrastructure/status-prefix-redis.repository';

@Injectable()
export class StatusPrefixApplyService {
  private readonly logger = new Logger(StatusPrefixApplyService.name);

  constructor(
    private readonly configRepo: StatusPrefixConfigRepository,
    private readonly redis: StatusPrefixRedisRepository,
  ) {}

  /**
   * F-STATUS-PREFIX-003: 접두사 적용.
   *
   * 처리 흐름:
   * 1. buttonId로 StatusPrefixButton 조회 (config 관계 포함)
   * 2. Redis에서 원래 닉네임 조회
   *    - 없으면: 현재 Discord displayName을 원래 닉네임으로 NX 저장
   *    - 있으면: 기존 값 유지 (덮어쓰기 방지)
   * 3. prefixTemplate 적용 → 새 닉네임 생성
   * 4. GuildMember.setNickname()으로 닉네임 변경
   * 5. Ephemeral 성공 응답
   *
   * @param guildId - Discord 서버 ID
   * @param memberId - 클릭한 멤버 ID
   * @param buttonId - 클릭된 버튼 DB ID (customId에서 파싱)
   * @param interaction - ButtonInteraction 인스턴스 (응답 및 멤버 정보 추출용)
   */
  async apply(
    guildId: string,
    memberId: string,
    buttonId: number,
    interaction: ButtonInteraction,
  ): Promise<void> {
    // 1. 버튼 조회 (config 관계 포함 — prefixTemplate 획득)
    const button = await this.configRepo.findButtonById(buttonId);

    if (!button || !button.config) {
      await interaction.reply({
        ephemeral: true,
        content: '버튼 설정을 찾을 수 없습니다. 관리자에게 문의하세요.',
      });
      return;
    }

    if (!button.prefix) {
      // PREFIX 타입이지만 prefix 값이 없는 비정상 상태
      await interaction.reply({
        ephemeral: true,
        content: '접두사 설정이 올바르지 않습니다. 관리자에게 문의하세요.',
      });
      return;
    }

    const member = interaction.member as GuildMember;
    const currentDisplayName = member.displayName;

    // 2. 원래 닉네임 조회 또는 최초 저장 (NX — 이미 값이 있으면 덮어쓰지 않음)
    let originalNickname = await this.redis.getOriginalNickname(guildId, memberId);

    if (!originalNickname) {
      // 최초 접두사 적용 → 현재 displayName을 원래 닉네임으로 NX 저장
      await this.redis.setOriginalNicknameNx(guildId, memberId, currentDisplayName);
      originalNickname = currentDisplayName;
    }
    // originalNickname이 이미 있으면 기존 값 유지 (덮어쓰기 방지)

    // 3. 템플릿 적용 → 새 닉네임 생성
    // 예: '[{prefix}] {nickname}' + prefix='관전', nickname='동현' → '[관전] 동현'
    const newNickname = button.config.prefixTemplate
      .replace('{prefix}', button.prefix)
      .replace('{nickname}', originalNickname);

    // 4. Discord API 닉네임 변경
    try {
      await member.setNickname(newNickname);
    } catch (err) {
      this.logger.warn(
        `[STATUS_PREFIX] setNickname failed: guild=${guildId} member=${memberId}`,
        (err as Error).stack,
      );
      await interaction.reply({
        ephemeral: true,
        content: '닉네임을 변경할 권한이 없습니다. 봇 역할을 확인해 주세요.',
      });
      return;
    }

    // 5. Ephemeral 성공 응답
    await interaction.reply({
      ephemeral: true,
      content: `닉네임이 **${newNickname}** 으로 변경되었습니다.`,
    });

    this.logger.log(
      `[STATUS_PREFIX] Apply: guild=${guildId} member=${memberId} nickname="${newNickname}"`,
    );
  }
}
```

#### 주의사항

- `interaction.member`는 `GuildMember | APIInteractionGuildMember | null` 타입이므로 `GuildMember`로 단언 후 사용한다. `ButtonInteraction`이 길드 내에서 발생함이 보장된 시점이므로 핸들러에서 `guildId` 체크 후 진입한다.
- `member.displayName`은 서버 닉네임이 있으면 서버 닉네임, 없으면 Discord 사용자명을 반환한다. PRD 요구사항에 부합한다.
- `setNickname`은 봇의 역할이 대상 멤버보다 높아야 성공한다. 실패 시 `DiscordAPIError`가 발생한다.

---

### 5. `status-prefix-reset.service.ts` (신규 생성)

**경로**: `apps/api/src/status-prefix/application/status-prefix-reset.service.ts`

F-STATUS-PREFIX-004 (버튼 클릭 복원) 및 F-STATUS-PREFIX-005 (음성 채널 퇴장 자동 복원) 구현.

#### 의존성

| 의존성 | 주입 방법 | 용도 |
|--------|-----------|------|
| `StatusPrefixConfigRepository` | 생성자 | `findByGuildId` — `enabled` 확인 (F-STATUS-PREFIX-005) |
| `StatusPrefixRedisRepository` | 생성자 | `getOriginalNickname`, `deleteOriginalNickname`, `getConfig` |
| Discord `Client` | `@InjectDiscordClient()` | `restoreOnLeave`에서 GuildMember 직접 조회용 |

`reset()`은 `ButtonInteraction`을 통해 `GuildMember`를 직접 추출하므로 Client 불필요. `restoreOnLeave()`는 인터랙션 컨텍스트 없이 호출되므로 Client를 통해 GuildMember를 직접 fetch해야 한다.

#### 전체 구현

```typescript
import { InjectDiscordClient } from '@discord-nestjs/core';
import { Injectable, Logger } from '@nestjs/common';
import { ButtonInteraction, Client, GuildMember } from 'discord.js';

import { StatusPrefixConfigRepository } from '../infrastructure/status-prefix-config.repository';
import { StatusPrefixRedisRepository } from '../infrastructure/status-prefix-redis.repository';

@Injectable()
export class StatusPrefixResetService {
  private readonly logger = new Logger(StatusPrefixResetService.name);

  constructor(
    private readonly configRepo: StatusPrefixConfigRepository,
    private readonly redis: StatusPrefixRedisRepository,
    @InjectDiscordClient() private readonly discordClient: Client,
  ) {}

  /**
   * F-STATUS-PREFIX-004: 버튼 클릭으로 원래 닉네임 복원.
   *
   * 처리 흐름:
   * 1. Redis에서 원래 닉네임 조회
   * 2. 없으면 Ephemeral 안내 메시지 응답 후 종료
   * 3. 있으면 GuildMember.setNickname(originalNickname) 호출
   * 4. Redis 키 삭제
   * 5. Ephemeral 성공 응답
   *
   * @param guildId - Discord 서버 ID
   * @param memberId - 클릭한 멤버 ID
   * @param interaction - ButtonInteraction 인스턴스 (응답 및 멤버 정보 추출용)
   */
  async reset(
    guildId: string,
    memberId: string,
    interaction: ButtonInteraction,
  ): Promise<void> {
    // 1. Redis에서 원래 닉네임 조회
    const originalNickname = await this.redis.getOriginalNickname(guildId, memberId);

    // 2. 없으면 변경 이력 없음 안내
    if (!originalNickname) {
      await interaction.reply({
        ephemeral: true,
        content: '변경된 닉네임이 없습니다.',
      });
      return;
    }

    const member = interaction.member as GuildMember;

    // 3. Discord API 닉네임 복원
    try {
      await member.setNickname(originalNickname);
    } catch (err) {
      this.logger.warn(
        `[STATUS_PREFIX] reset setNickname failed: guild=${guildId} member=${memberId}`,
        (err as Error).stack,
      );
      await interaction.reply({
        ephemeral: true,
        content: '닉네임을 변경할 권한이 없습니다. 봇 역할을 확인해 주세요.',
      });
      return;
    }

    // 4. Redis 키 삭제
    await this.redis.deleteOriginalNickname(guildId, memberId);

    // 5. Ephemeral 성공 응답
    await interaction.reply({
      ephemeral: true,
      content: '닉네임이 원래대로 복원되었습니다.',
    });

    this.logger.log(
      `[STATUS_PREFIX] Reset: guild=${guildId} member=${memberId} restored="${originalNickname}"`,
    );
  }

  /**
   * F-STATUS-PREFIX-005: 음성 채널 퇴장 시 닉네임 자동 복원.
   * VoiceLeaveHandler에서 fire-and-forget으로 호출된다.
   * 오류 시 로그 기록 후 조용히 실패한다.
   *
   * 처리 흐름:
   * 1. Redis 설정 캐시에서 enabled 확인 (캐시 미스 시 DB 조회)
   * 2. enabled = false 이면 즉시 반환
   * 3. Redis에서 원래 닉네임 조회
   * 4. 없으면 처리 중단 (닉네임 변경 이력 없음)
   * 5. Discord Client로 GuildMember fetch
   * 6. setNickname(originalNickname) 호출
   * 7. Redis 키 삭제
   *
   * @param guildId - Discord 서버 ID
   * @param memberId - 퇴장한 멤버 ID
   */
  async restoreOnLeave(guildId: string, memberId: string): Promise<void> {
    // 1. 설정 enabled 확인 (Redis 캐시 우선, 미스 시 DB)
    let enabled = false;

    const cachedConfig = await this.redis.getConfig(guildId);

    if (cachedConfig !== null) {
      enabled = cachedConfig.enabled;
    } else {
      const dbConfig = await this.configRepo.findByGuildId(guildId);
      enabled = dbConfig?.enabled ?? false;
    }

    // 2. enabled = false 이면 중단
    if (!enabled) return;

    // 3. Redis에서 원래 닉네임 조회
    const originalNickname = await this.redis.getOriginalNickname(guildId, memberId);

    // 4. 없으면 처리 중단
    if (!originalNickname) return;

    // 5. Discord GuildMember fetch (인터랙션 컨텍스트 없이 Client 직접 사용)
    let member: GuildMember;
    try {
      const guild = await this.discordClient.guilds.fetch(guildId);
      member = await guild.members.fetch(memberId);
    } catch (err) {
      this.logger.warn(
        `[STATUS_PREFIX] restoreOnLeave: Failed to fetch member guild=${guildId} member=${memberId}`,
        (err as Error).stack,
      );
      // 멤버 fetch 실패 시 Redis 키는 유지 (비정상 종료 대비)
      return;
    }

    // 6. 닉네임 복원
    try {
      await member.setNickname(originalNickname);
    } catch (err) {
      this.logger.warn(
        `[STATUS_PREFIX] restoreOnLeave setNickname failed: guild=${guildId} member=${memberId}`,
        (err as Error).stack,
      );
      // setNickname 실패 시도 Redis 키 삭제 (봇 권한 없으면 계속 실패하므로 키 누적 방지)
    }

    // 7. Redis 키 삭제 (setNickname 성공/실패 무관하게 삭제)
    await this.redis.deleteOriginalNickname(guildId, memberId);

    this.logger.log(
      `[STATUS_PREFIX] restoreOnLeave: guild=${guildId} member=${memberId} restored="${originalNickname}"`,
    );
  }
}
```

#### 주의사항

- `restoreOnLeave`는 `VoiceLeaveHandler`에서 `.catch()`로 감싸 fire-and-forget으로 호출되므로, 내부에서 throw하지 않고 조용히 실패한다.
- `guild.members.fetch(memberId)`는 캐시 미스 시 Discord API를 호출한다. 퇴장한 멤버의 경우 API 조회가 가능하다(서버를 나간 게 아니라 음성 채널에서 퇴장한 것이므로).
- `setNickname` 실패 시에도 Redis 키를 삭제한다. 봇에게 닉네임 변경 권한이 없으면 이후 재시도도 동일하게 실패하므로 키를 유지해도 무의미하다.
- `enabled` 캐시가 없을 경우 DB 조회가 발생한다. 설정 저장 시 캐시를 갱신하는 `StatusPrefixConfigService`가 정상 동작하면 DB 조회 빈도는 낮다.

---

### 6. `status-prefix-interaction.handler.ts` (신규 생성)

**경로**: `apps/api/src/status-prefix/interaction/status-prefix-interaction.handler.ts`

`AutoChannelInteractionHandler`, `NewbieInteractionHandler`와 동일한 패턴으로 구현한다.

#### 패턴 비교

| 항목 | AutoChannelInteractionHandler | StatusPrefixInteractionHandler |
|------|-------------------------------|-------------------------------|
| 데코레이터 | `@On('interactionCreate')` | `@On('interactionCreate')` |
| 필터 방식 | `customId.startsWith()` 두 접두사 | `customId.startsWith()` 두 접두사 |
| 서비스 분기 | `handleButtonClick` / `handleSubOptionClick` | `apply` / `reset` |
| 오류 처리 | `interaction.replied/deferred` 체크 후 `followUp` / `reply` | 동일 패턴 |

#### 전체 구현

```typescript
import { On } from '@discord-nestjs/core';
import { Injectable, Logger } from '@nestjs/common';
import { Interaction } from 'discord.js';

import { StatusPrefixApplyService } from '../application/status-prefix-apply.service';
import { StatusPrefixResetService } from '../application/status-prefix-reset.service';

/** 버튼 customId 접두사 */
const CUSTOM_ID_PREFIX = {
  APPLY: 'status_prefix:',  // F-STATUS-PREFIX-003 (type = PREFIX)
  RESET: 'status_reset:',   // F-STATUS-PREFIX-004 (type = RESET)
} as const;

@Injectable()
export class StatusPrefixInteractionHandler {
  private readonly logger = new Logger(StatusPrefixInteractionHandler.name);

  constructor(
    private readonly applyService: StatusPrefixApplyService,
    private readonly resetService: StatusPrefixResetService,
  ) {}

  /**
   * Discord interactionCreate 이벤트 수신.
   * status_prefix: 또는 status_reset: 접두사를 가진 버튼 인터랙션만 처리한다.
   * 다른 모듈의 버튼 인터랙션과 충돌 방지를 위해 접두사 필터링 적용.
   *
   * customId 형식:
   *   status_prefix:{buttonId}  — PREFIX 버튼 클릭 (예: status_prefix:3)
   *   status_reset:{buttonId}   — RESET 버튼 클릭  (예: status_reset:4)
   */
  @On('interactionCreate')
  async handle(interaction: Interaction): Promise<void> {
    // 버튼 인터랙션만 처리
    if (!interaction.isButton()) return;

    const customId = interaction.customId;
    const isApply = customId.startsWith(CUSTOM_ID_PREFIX.APPLY);
    const isReset = customId.startsWith(CUSTOM_ID_PREFIX.RESET);

    // 이 핸들러와 무관한 버튼이면 즉시 반환 (타 도메인과 충돌 없음)
    if (!isApply && !isReset) return;

    // 길드 컨텍스트 필수 확인
    if (!interaction.guildId) {
      await interaction.reply({
        ephemeral: true,
        content: '이 기능은 서버에서만 사용할 수 있습니다.',
      });
      return;
    }

    const guildId = interaction.guildId;
    const memberId = interaction.user.id;

    try {
      if (isApply) {
        // customId: status_prefix:{buttonId}
        const buttonId = parseInt(customId.slice(CUSTOM_ID_PREFIX.APPLY.length), 10);

        if (isNaN(buttonId)) {
          await interaction.reply({ ephemeral: true, content: '잘못된 요청입니다.' });
          return;
        }

        await this.applyService.apply(guildId, memberId, buttonId, interaction);
      } else {
        // customId: status_reset:{buttonId}
        // buttonId는 DB 조회에 사용하지 않지만 형식 일관성 유지
        await this.resetService.reset(guildId, memberId, interaction);
      }
    } catch (error) {
      this.logger.error(
        `[STATUS_PREFIX] Interaction failed: customId=${customId}`,
        (error as Error).stack,
      );

      try {
        const content = '오류가 발생했습니다. 잠시 후 다시 시도하세요.';
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ ephemeral: true, content });
        } else {
          await interaction.reply({ ephemeral: true, content });
        }
      } catch (replyError) {
        this.logger.error(
          `[STATUS_PREFIX] Failed to send error reply`,
          (replyError as Error).stack,
        );
      }
    }
  }
}
```

#### 주의사항

- `status_reset:{buttonId}`에서 `buttonId`를 파싱하지만 실제 DB 조회에 사용하지 않는다. RESET은 memberId만 있으면 동작하므로 불필요하다. PRD에서 customId에 buttonId가 포함되어 있어 형식을 수신하지만, `resetService.reset`에는 전달하지 않는다.
- `@On('interactionCreate')`는 모든 interactionCreate 이벤트를 수신한다. 다른 핸들러(`AutoChannelInteractionHandler`, `NewbieInteractionHandler`)와 동시에 호출되지만 각자 접두사 필터링으로 충돌하지 않는다.
- 이 핸들러는 `StatusPrefixModule`의 providers에 등록된다. `DiscordModule.forFeature()`가 모듈에 import되어 있어야 `@On()` 데코레이터가 동작한다.

---

### 7. `voice-leave.handler.ts` 수정

**경로**: `apps/api/src/event/voice/voice-leave.handler.ts`

기존 파일에 `StatusPrefixResetService` 의존성을 추가하고, `voiceChannelService.onUserLeave` 완료 후 `restoreOnLeave`를 fire-and-forget으로 호출한다.

#### 수정 전 (현재 상태)

```typescript
import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { VoiceChannelService } from '../../channel/voice/application/voice-channel.service';
import { VOICE_EVENTS, VoiceLeaveEvent } from './voice-events';

@Injectable()
export class VoiceLeaveHandler {
  constructor(private readonly voiceChannelService: VoiceChannelService) {}

  @OnEvent(VOICE_EVENTS.LEAVE)
  async handle(event: VoiceLeaveEvent) {
    await this.voiceChannelService.onUserLeave(event.state);
  }
}
```

#### 수정 후

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { VoiceChannelService } from '../../channel/voice/application/voice-channel.service';
import { StatusPrefixResetService } from '../../status-prefix/application/status-prefix-reset.service';
import { VOICE_EVENTS, VoiceLeaveEvent } from './voice-events';

@Injectable()
export class VoiceLeaveHandler {
  private readonly logger = new Logger(VoiceLeaveHandler.name);

  constructor(
    private readonly voiceChannelService: VoiceChannelService,
    private readonly statusPrefixResetService: StatusPrefixResetService,
  ) {}

  @OnEvent(VOICE_EVENTS.LEAVE)
  async handle(event: VoiceLeaveEvent) {
    await this.voiceChannelService.onUserLeave(event.state);

    // Status Prefix 닉네임 자동 복원 (F-STATUS-PREFIX-005, fire-and-forget)
    // 오류 시 로그 기록 후 조용히 실패 — voice 도메인 처리에 영향 없음
    this.statusPrefixResetService
      .restoreOnLeave(event.state.guildId, event.state.userId)
      .catch((err) =>
        this.logger.error('[STATUS_PREFIX] restoreOnLeave failed', (err as Error).stack),
      );
  }
}
```

#### 수정 요점

- `VoiceChannelService.onUserLeave` 완료 후에 호출하므로 voice 도메인 처리 순서에 영향이 없다.
- `.catch()`로 감싸 fire-and-forget 처리한다. `restoreOnLeave` 내부에서도 오류를 잡아 throw하지 않으므로 이중 안전장치가 된다.
- `Logger`를 추가해 오류 추적을 가능하게 한다.
- `event.state.userId`는 `VoiceStateDto`의 필드명이다. `VoiceStateDto.fromVoiceState`에서 `member.id`를 `userId`에 매핑함을 `voice-state.dispatcher.ts`의 `isLeave` 분기(`VoiceStateDto.fromVoiceState(oldState)`)에서 확인한다.

#### 의존성 주입 가능 여부 확인

`VoiceLeaveHandler`는 `DiscordEventsModule`의 provider이다. `DiscordEventsModule`이 `StatusPrefixModule`을 import하고, `StatusPrefixModule`이 `StatusPrefixResetService`를 exports하면 주입 가능하다. 순환 의존이 발생하지 않는다(`StatusPrefixModule`은 voice 도메인에 의존하지 않음).

---

### 8. `discord-events.module.ts` 수정

**경로**: `apps/api/src/event/discord-events.module.ts`

`StatusPrefixModule`을 imports 목록에 추가한다. `StatusPrefixInteractionHandler`는 `StatusPrefixModule`의 내부 provider이므로 `DiscordEventsModule`의 providers에 직접 추가하지 않는다.

#### 수정 전 (현재 상태, 관련 부분)

```typescript
import { AutoChannelModule } from '../channel/auto/auto-channel.module';
import { ChannelModule } from '../channel/channel.module';
import { VoiceChannelModule } from '../channel/voice/voice-channel.module';
import { NewbieModule } from '../newbie/newbie.module';
// ...

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
    NewbieInteractionHandler,
  ],
})
export class DiscordEventsModule {}
```

#### 수정 후

```typescript
import { DiscordModule } from '@discord-nestjs/core';
import { Module } from '@nestjs/common';

import { AutoChannelModule } from '../channel/auto/auto-channel.module';
import { ChannelModule } from '../channel/channel.module';
import { VoiceChannelModule } from '../channel/voice/voice-channel.module';
import { NewbieModule } from '../newbie/newbie.module';
import { StatusPrefixModule } from '../status-prefix/status-prefix.module';  // 추가
import { ChannelStateHandler } from './channel/channel-state.handler';
import { NewbieInteractionHandler } from './newbie/newbie-interaction.handler';
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
    StatusPrefixModule,       // 추가: StatusPrefixResetService export 포함
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
    NewbieInteractionHandler,
    // StatusPrefixInteractionHandler는 StatusPrefixModule 내부에 등록됨 — 여기 추가 불필요
  ],
})
export class DiscordEventsModule {}
```

#### 수정 요점

- `StatusPrefixInteractionHandler`는 `StatusPrefixModule.providers`에 등록되며 `DiscordModule.forFeature()`가 `StatusPrefixModule`에 import되어 있으므로 `@On('interactionCreate')` 데코레이터가 정상 동작한다.
- `VoiceLeaveHandler`에서 주입받는 `StatusPrefixResetService`는 `StatusPrefixModule.exports`에 포함되어 있어야 한다.

---

### 9. `status-prefix.module.ts` (선행 단계 파일, 최종 형태 확인)

**경로**: `apps/api/src/status-prefix/status-prefix.module.ts`

공통 모듈 문서 2-10에 정의된 대로 구현한다. `StatusPrefixResetService`가 exports에 포함되어 있어야 `VoiceLeaveHandler`에서 주입 가능하다.

```typescript
import { DiscordModule } from '@discord-nestjs/core';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { StatusPrefixApplyService } from './application/status-prefix-apply.service';
import { StatusPrefixResetService } from './application/status-prefix-reset.service';
import { StatusPrefixController } from './config/status-prefix.controller';
import { StatusPrefixConfigService } from './config/status-prefix-config.service';
import { StatusPrefixButton } from './domain/status-prefix-button.entity';
import { StatusPrefixConfig } from './domain/status-prefix-config.entity';
import { StatusPrefixConfigRepository } from './infrastructure/status-prefix-config.repository';
import { StatusPrefixRedisRepository } from './infrastructure/status-prefix-redis.repository';
import { StatusPrefixInteractionHandler } from './interaction/status-prefix-interaction.handler';

@Module({
  imports: [
    DiscordModule.forFeature(),
    TypeOrmModule.forFeature([StatusPrefixConfig, StatusPrefixButton]),
    AuthModule,
  ],
  controllers: [StatusPrefixController],
  providers: [
    StatusPrefixConfigRepository,
    StatusPrefixRedisRepository,
    StatusPrefixConfigService,
    StatusPrefixApplyService,
    StatusPrefixResetService,
    StatusPrefixInteractionHandler,
  ],
  exports: [
    StatusPrefixResetService,   // VoiceLeaveHandler에서 주입받기 위해 export
  ],
})
export class StatusPrefixModule {}
```

---

### 10. `app.module.ts` 수정

**경로**: `apps/api/src/app.module.ts`

`StatusPrefixModule`을 imports에 추가한다.

#### 수정 내용 (추가 라인만)

```typescript
import { StatusPrefixModule } from './status-prefix/status-prefix.module';

// imports 배열에 추가:
StatusPrefixModule,
```

#### 최종 imports 배열

```typescript
imports: [
  ConfigModule.forRoot(BaseConfig),
  EventEmitterModule.forRoot(),
  ScheduleModule.forRoot(),
  DiscordModule.forRootAsync(DiscordConfig),
  TypeOrmModule.forRootAsync(TypeORMConfig),
  ChannelModule,
  VoiceChannelModule,
  AutoChannelModule,
  NewbieModule,
  StatusPrefixModule,   // 추가
  MusicModule,
  DiscordEventsModule,
  RedisModule,
  VoiceAnalyticsModule,
  AuthModule,
],
```

---

## 의존성 그래프

```
Discord interactionCreate 이벤트
    │
    ▼
StatusPrefixInteractionHandler (@On, StatusPrefixModule provider)
    │
    ├── customId: status_prefix:{buttonId}
    │       └── StatusPrefixApplyService.apply()
    │               ├── StatusPrefixConfigRepository.findButtonById()
    │               │       └── TypeORM: StatusPrefixButton JOIN StatusPrefixConfig
    │               ├── StatusPrefixRedisRepository.getOriginalNickname()
    │               ├── StatusPrefixRedisRepository.setOriginalNicknameNx()  [최초 시]
    │               └── GuildMember.setNickname()  [Discord API]
    │
    └── customId: status_reset:{buttonId}
            └── StatusPrefixResetService.reset()
                    ├── StatusPrefixRedisRepository.getOriginalNickname()
                    ├── GuildMember.setNickname()  [Discord API]
                    └── StatusPrefixRedisRepository.deleteOriginalNickname()

Discord voiceStateUpdate 이벤트 (퇴장)
    │
    ▼
VoiceStateDispatcher → VOICE_EVENTS.LEAVE 발행 (emitAsync)
    │
    ▼
VoiceLeaveHandler.handle()
    ├── VoiceChannelService.onUserLeave()  [기존 voice 처리]
    └── StatusPrefixResetService.restoreOnLeave()  [fire-and-forget]
            ├── StatusPrefixRedisRepository.getConfig()  [캐시 enabled 확인]
            ├── StatusPrefixConfigRepository.findByGuildId()  [캐시 미스 시]
            ├── StatusPrefixRedisRepository.getOriginalNickname()
            ├── discordClient.guilds.fetch() + guild.members.fetch()
            ├── GuildMember.setNickname()  [Discord API]
            └── StatusPrefixRedisRepository.deleteOriginalNickname()
```

---

## 기존 코드베이스와의 충돌 판단

| 변경 대상 | 충돌 위험 | 판단 근거 |
|-----------|-----------|-----------|
| `status-prefix-apply.service.ts` 신규 생성 | 없음 | `apps/api/src/status-prefix/application/` 경로에 아무 파일도 없음 |
| `status-prefix-reset.service.ts` 신규 생성 | 없음 | 동일 |
| `status-prefix-interaction.handler.ts` 신규 생성 | 없음 | `apps/api/src/status-prefix/interaction/` 경로에 아무 파일도 없음 |
| `voice-leave.handler.ts` 수정 | 없음 | 기존 로직 이후에 `.catch()` 체인 추가만 함. `VoiceChannelService.onUserLeave` await 완료 후 진행하므로 voice 도메인 처리 순서 불변 |
| `discord-events.module.ts` 수정 | 없음 | imports 배열에 `StatusPrefixModule` 한 줄 추가. 기존 provider 목록 변경 없음 |
| `app.module.ts` 수정 | 없음 | imports 배열에 `StatusPrefixModule` 한 줄 추가 |
| `@On('interactionCreate')` 다중 핸들러 | 없음 | `auto_btn:`, `auto_sub:`, `newbie_mission:`, `newbie_moco:`, `status_prefix:`, `status_reset:` 접두사가 모두 다름. 각 핸들러는 자신의 접두사만 처리하고 나머지는 즉시 반환 |
| Redis 키 충돌 | 없음 | `status_prefix:original:*`, `status_prefix:config:*` 패턴이 기존 `newbie:*`, `auto_channel:*` 키와 완전히 분리됨 |

---

## 구현 순서 (의존성 기반)

1. **선행 확인**: `status-prefix-cache.keys.ts`, `status-prefix-redis.repository.ts`, `status-prefix-config.repository.ts`가 공통 모듈 단계에서 구현되어 있는지 확인한다.
2. **step 1**: `status-prefix-apply.service.ts` 구현 (ConfigRepository, RedisRepository 의존)
3. **step 2**: `status-prefix-reset.service.ts` 구현 (ConfigRepository, RedisRepository, DiscordClient 의존)
4. **step 3**: `status-prefix-interaction.handler.ts` 구현 (ApplyService, ResetService 의존)
5. **step 4**: `status-prefix.module.ts`에 ApplyService, ResetService, InteractionHandler providers 등록 및 ResetService exports 확인
6. **step 5**: `voice-leave.handler.ts` 수정 — StatusPrefixResetService 주입 및 restoreOnLeave 호출 추가
7. **step 6**: `discord-events.module.ts` 수정 — StatusPrefixModule import 추가
8. **step 7**: `app.module.ts` 수정 — StatusPrefixModule import 추가

step 1~4는 같은 모듈 내부이므로 순서대로 구현하되 독립적이다. step 5~7은 외부 파일 수정이므로 step 4 완료 후 진행한다.

---

## DRY 준수 사항

| 중복 방지 | 근거 |
|-----------|------|
| Redis 키 생성은 `StatusPrefixKeys`에서만 정의 | `apply.service.ts`, `reset.service.ts` 모두 `StatusPrefixRedisRepository`를 통해 간접 사용 |
| `setNickname` 호출 전 `member` 추출 로직 | `reset()`과 `restoreOnLeave()`에서 방식이 다름 (인터랙션 vs. Client.fetch). 공통화 불가 — 각 컨텍스트에 맞게 분리가 올바름 |
| 오류 응답 패턴 (`interaction.replied/deferred` 체크) | 핸들러 catch 블록에서 한 곳에서만 처리. 서비스 레이어에서는 직접 `interaction.reply`로 응답 |
| `enabled` 확인 로직 | `restoreOnLeave`에서만 필요. `reset()`(버튼 클릭)은 버튼이 존재함 자체가 enabled 상태이므로 확인 불필요 |
