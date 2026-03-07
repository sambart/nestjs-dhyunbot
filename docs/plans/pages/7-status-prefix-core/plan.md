# Unit A: Status Prefix 백엔드 코어 모듈 구현 계획

> 작성일: 2026-03-08
> 범위: Unit A — Status Prefix 도메인의 공통 인프라 전체 (Unit B 인터랙션, Unit C 웹 대시보드의 전제)

---

## 1. 개요

Status Prefix 도메인의 Unit A는 나머지 단위(B, C)가 의존하는 공통 인프라를 구성한다. 엔티티 2종은 이미 존재하므로 건드리지 않는다.

### 생성 파일 목록 (8개)

| 번호 | 파일 경로 | 역할 |
|------|-----------|------|
| 1 | `apps/api/src/status-prefix/infrastructure/status-prefix-cache.keys.ts` | Redis 키 패턴 중앙화 |
| 2 | `apps/api/src/status-prefix/infrastructure/status-prefix-redis.repository.ts` | Redis CRUD |
| 3 | `apps/api/src/status-prefix/infrastructure/status-prefix-config.repository.ts` | DB 저장소 |
| 4 | `apps/api/src/status-prefix/application/status-prefix-config.service.ts` | 설정 조회/저장 + Discord 메시지 전송/갱신 |
| 5 | `apps/api/src/status-prefix/presentation/status-prefix.controller.ts` | REST API 컨트롤러 |
| 6 | `apps/api/src/status-prefix/presentation/status-prefix-config-save.dto.ts` | 요청 바디 DTO |
| 7 | `apps/api/src/status-prefix/status-prefix.module.ts` | NestJS 모듈 정의 |
| 8 | `apps/api/src/app.module.ts` 수정 | StatusPrefixModule 등록 |

### 수정 파일 목록 (2개)

| 번호 | 파일 경로 | 수정 내용 |
|------|-----------|-----------|
| 9 | `apps/api/src/event/discord-events.module.ts` | StatusPrefixModule import 추가 |
| 10 | `apps/api/src/event/voice/voice-leave.handler.ts` | StatusPrefixResetService 호출 추가 (F-STATUS-PREFIX-005) |

### 이미 존재하는 파일 (수정 없음, 확인만)

- `apps/api/src/status-prefix/domain/status-prefix-config.entity.ts` — 올바르게 생성됨
- `apps/api/src/status-prefix/domain/status-prefix-button.entity.ts` — `StatusPrefixButtonType` enum 포함, 올바르게 생성됨
- `apps/api/src/migrations/1773200000000-AddStatusPrefix.ts` — 마이그레이션 완비

---

## 2. 디렉토리 구조

common-modules.md 5절에 명시된 경로와 달리, 이 계획은 기존 Newbie 도메인(`infrastructure/`, `dto/`, 루트의 `controller`, `module`)을 참고하면서 PRD의 관련 모듈 정의(`config/`, `interaction/`, `infrastructure/`)를 합리적으로 해석한다. 단, 현재 계획 범위(Unit A)에는 `interaction/` 하위 서비스(ApplyService, ResetService, InteractionHandler)가 포함되지 않으므로, 이 파일들을 위한 서브 디렉토리를 미리 확정한다.

```
apps/api/src/status-prefix/
  status-prefix.module.ts                       (Unit A, 파일 7)
  domain/
    status-prefix-config.entity.ts              (이미 존재)
    status-prefix-button.entity.ts              (이미 존재)
  infrastructure/
    status-prefix-cache.keys.ts                 (Unit A, 파일 1)
    status-prefix-redis.repository.ts           (Unit A, 파일 2)
    status-prefix-config.repository.ts          (Unit A, 파일 3)
  application/
    status-prefix-config.service.ts             (Unit A, 파일 4)
  presentation/
    status-prefix.controller.ts                 (Unit A, 파일 5)
    status-prefix-config-save.dto.ts            (Unit A, 파일 6)
  interaction/                                  (Unit B에서 생성)
    status-prefix-apply.service.ts
    status-prefix-reset.service.ts
    status-prefix-interaction.handler.ts
```

**설계 근거**: Newbie 모듈은 `infrastructure/`, `dto/`, `mission/`, `moco/`, `role/`, `welcome/` 구조를 사용한다. AutoChannel 모듈은 `application/`, `domain/`, `dto/`, `infrastructure/` 구조를 사용한다. Status Prefix는 AutoChannel의 레이어드 구조(`application/`, `infrastructure/`)를 따르되, 컨트롤러와 DTO를 `presentation/`으로 분리하여 레이어를 명확히 구분한다.

---

## 3. 파일별 상세 구현 계획

### 파일 1: `status-prefix-cache.keys.ts`

**경로**: `apps/api/src/status-prefix/infrastructure/status-prefix-cache.keys.ts`

`AutoChannelKeys`, `NewbieKeys`와 동일한 순수 객체 리터럴 패턴을 따른다. `as const`로 타입 안정성을 보장한다.

```typescript
export const StatusPrefixKeys = {
  /**
   * 원래 닉네임 저장: status_prefix:original:{guildId}:{memberId}
   * TTL 없음 (퇴장 시 또는 RESET 버튼 클릭 시 명시적 삭제)
   */
  originalNickname: (guildId: string, memberId: string) =>
    `status_prefix:original:${guildId}:${memberId}`,

  /**
   * 설정 캐시: status_prefix:config:{guildId}
   * TTL 1시간 (설정 저장 시 명시적 갱신)
   */
  config: (guildId: string) => `status_prefix:config:${guildId}`,
} as const;
```

**의존성**: 없음

---

### 파일 2: `status-prefix-redis.repository.ts`

**경로**: `apps/api/src/status-prefix/infrastructure/status-prefix-redis.repository.ts`

`NewbieRedisRepository`와 동일한 패턴: `RedisService`와 `@Inject(REDIS_CLIENT) client: Redis`를 모두 주입한다. `setOriginalNicknameNx`는 `SET NX` 의미론이 필요하므로 `REDIS_CLIENT`를 직접 사용한다. `RedisService`에는 `setNx` 전용 메서드가 없기 때문이다.

**TTL 상수 (파일 내 로컬 정의)**:

```typescript
const TTL = {
  /** 설정 캐시: 1시간 */
  CONFIG: 60 * 60,
} as const;
```

**전체 클래스 구조**:

```typescript
import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';

import { REDIS_CLIENT } from '../../../redis/redis.constants';
import { RedisService } from '../../../redis/redis.service';
import { StatusPrefixConfig } from '../domain/status-prefix-config.entity';
import { StatusPrefixKeys } from './status-prefix-cache.keys';

@Injectable()
export class StatusPrefixRedisRepository {
  constructor(
    private readonly redis: RedisService,
    @Inject(REDIS_CLIENT) private readonly client: Redis,
  ) {}

  // --- 원래 닉네임 ---

  /** 원래 닉네임 조회 (GET) */
  async getOriginalNickname(guildId: string, memberId: string): Promise<string | null>

  /**
   * 원래 닉네임 저장 (SET NX — 이미 존재하면 무시)
   * 반환값: true = 저장 성공, false = 이미 존재하여 무시
   */
  async setOriginalNicknameNx(guildId: string, memberId: string, nickname: string): Promise<boolean>

  /** 원래 닉네임 삭제 (DEL) — RESET 버튼 또는 음성 퇴장 시 */
  async deleteOriginalNickname(guildId: string, memberId: string): Promise<void>

  // --- 설정 캐시 ---

  /** 설정 캐시 조회 (GET → JSON 역직렬화) */
  async getConfig(guildId: string): Promise<StatusPrefixConfig | null>

  /** 설정 캐시 저장 (SET EX 3600 — TTL 1시간) */
  async setConfig(guildId: string, config: StatusPrefixConfig): Promise<void>

  /** 설정 캐시 삭제 (DEL) — 필요 시 무효화용 */
  async deleteConfig(guildId: string): Promise<void>
}
```

**메서드별 구현 세부사항**:

- `getOriginalNickname`: `redis.get<string>(StatusPrefixKeys.originalNickname(guildId, memberId))` 호출. `RedisService.get`은 내부적으로 `JSON.parse`를 수행하므로 저장 시에도 `JSON.stringify`된 문자열이 들어가야 한다. 단순 문자열이므로 `JSON.parse('"동현"')` = `"동현"`이 정상 반환된다.

- `setOriginalNicknameNx`: `client.set(key, JSON.stringify(nickname), 'NX')` 직접 호출. ioredis `set` 메서드의 `NX` 플래그는 해당 키가 없을 때만 SET한다. 반환값이 `'OK'`이면 `true`, `null`이면 `false` 반환.

  ```typescript
  async setOriginalNicknameNx(guildId: string, memberId: string, nickname: string): Promise<boolean> {
    const key = StatusPrefixKeys.originalNickname(guildId, memberId);
    const result = await this.client.set(key, JSON.stringify(nickname), 'NX');
    return result === 'OK';
  }
  ```

- `deleteOriginalNickname`: `redis.del(StatusPrefixKeys.originalNickname(guildId, memberId))` 호출.

- `getConfig`: `redis.get<StatusPrefixConfig>(StatusPrefixKeys.config(guildId))` 호출. `StatusPrefixConfig`는 `buttons` 관계를 포함하는 엔티티이므로, 실제로는 캐시에 저장되는 값이 `StatusPrefixConfig & { buttons: StatusPrefixButton[] }` 형태의 JSON이다. 역직렬화 후 TypeORM 프록시가 아닌 일반 객체로 반환되지만 읽기 전용 용도로 충분하다.

- `setConfig`: `redis.set(StatusPrefixKeys.config(guildId), config, TTL.CONFIG)` 호출. `config`는 `buttons` 배열을 포함한 전체 설정 객체이다.

- `deleteConfig`: `redis.del(StatusPrefixKeys.config(guildId))` 호출.

**의존성**: `RedisService`, `REDIS_CLIENT`, `StatusPrefixKeys`, `StatusPrefixConfig`

---

### 파일 3: `status-prefix-config.repository.ts`

**경로**: `apps/api/src/status-prefix/infrastructure/status-prefix-config.repository.ts`

`AutoChannelConfigRepository`와 동일한 패턴: `DataSource`를 주입하여 트랜잭션 내에서 버튼 전체 삭제 후 재삽입을 처리한다.

**전체 클래스 구조**:

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { StatusPrefixButton } from '../domain/status-prefix-button.entity';
import { StatusPrefixConfig } from '../domain/status-prefix-config.entity';
import { StatusPrefixConfigSaveDto } from '../presentation/status-prefix-config-save.dto';

@Injectable()
export class StatusPrefixConfigRepository {
  constructor(
    @InjectRepository(StatusPrefixConfig)
    private readonly configRepo: Repository<StatusPrefixConfig>,
    @InjectRepository(StatusPrefixButton)
    private readonly buttonRepo: Repository<StatusPrefixButton>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * guildId로 설정 단건 조회 (buttons 관계 포함, sortOrder 오름차순)
   */
  async findByGuildId(guildId: string): Promise<StatusPrefixConfig | null>

  /**
   * 설정 upsert:
   *   1. guildId 기준으로 기존 레코드 조회
   *   2. 없으면 INSERT, 있으면 UPDATE
   *   3. 기존 buttons를 DELETE 후 새 buttons INSERT (sortOrder 반영)
   *
   * messageId는 upsert에서 초기화하지 않고 updateMessageId()로만 변경한다.
   */
  async upsert(guildId: string, dto: StatusPrefixConfigSaveDto): Promise<StatusPrefixConfig>

  /**
   * Discord Embed 메시지 ID 저장.
   * 메시지 전송/갱신 후 호출.
   */
  async updateMessageId(guildId: string, messageId: string): Promise<void>

  /**
   * 버튼 ID로 버튼 단건 조회.
   * 인터랙션 핸들러에서 버튼의 prefix, type 확인용으로 사용 (Unit B).
   */
  async findButtonById(buttonId: number): Promise<StatusPrefixButton | null>
}
```

**메서드별 구현 세부사항**:

- `findByGuildId`:
  ```typescript
  return this.configRepo.findOne({
    where: { guildId },
    relations: { buttons: true },
    order: { buttons: { sortOrder: 'ASC' } },
  });
  ```

- `upsert`: `dataSource.transaction`으로 트랜잭션 처리. `AutoChannelConfigRepository.upsert`와 동일한 패턴이나, AutoChannel이 `waitingRoomTemplate`, `guideMessage` 필드를 다루는 것처럼 Status Prefix는 `enabled`, `channelId`, `embedTitle`, `embedDescription`, `embedColor`, `prefixTemplate` 필드를 다룬다.

  ```typescript
  async upsert(guildId: string, dto: StatusPrefixConfigSaveDto): Promise<StatusPrefixConfig> {
    return this.dataSource.transaction(async (manager) => {
      // 1. 기존 설정 조회
      let config = await manager.findOne(StatusPrefixConfig, { where: { guildId } });

      if (config) {
        // 2a. 기존 설정 업데이트 (messageId는 건드리지 않음)
        config.enabled = dto.enabled;
        config.channelId = dto.channelId ?? null;
        config.embedTitle = dto.embedTitle ?? null;
        config.embedDescription = dto.embedDescription ?? null;
        config.embedColor = dto.embedColor ?? null;
        config.prefixTemplate = dto.prefixTemplate;
        await manager.save(StatusPrefixConfig, config);

        // 2b. 기존 버튼 전체 삭제 (ON DELETE CASCADE이므로 configId 기준 삭제로 충분)
        await manager.delete(StatusPrefixButton, { configId: config.id });
      } else {
        // 3. 신규 생성 (messageId는 null로 초기화)
        config = manager.create(StatusPrefixConfig, {
          guildId,
          enabled: dto.enabled,
          channelId: dto.channelId ?? null,
          messageId: null,
          embedTitle: dto.embedTitle ?? null,
          embedDescription: dto.embedDescription ?? null,
          embedColor: dto.embedColor ?? null,
          prefixTemplate: dto.prefixTemplate,
        });
        config = await manager.save(StatusPrefixConfig, config);
      }

      // 4. 버튼 INSERT (sortOrder 반영)
      for (const btnDto of dto.buttons) {
        const button = manager.create(StatusPrefixButton, {
          configId: config.id,
          label: btnDto.label,
          emoji: btnDto.emoji ?? null,
          prefix: btnDto.prefix ?? null,
          type: btnDto.type,
          sortOrder: btnDto.sortOrder,
        });
        await manager.save(StatusPrefixButton, button);
      }

      // 5. 최종 상태를 buttons 관계 포함하여 반환
      return manager.findOneOrFail(StatusPrefixConfig, {
        where: { id: config.id },
        relations: { buttons: true },
        order: { buttons: { sortOrder: 'ASC' } },
      });
    });
  }
  ```

- `updateMessageId`:
  ```typescript
  await this.configRepo.update({ guildId }, { messageId });
  ```

- `findButtonById`:
  ```typescript
  return this.buttonRepo.findOne({ where: { id: buttonId } });
  ```
  Unit B의 인터랙션 핸들러에서 `prefix`, `type` 확인에만 사용하므로 관계 조회 불필요.

**의존성**: `StatusPrefixConfig`, `StatusPrefixButton`, `StatusPrefixConfigSaveDto`, `DataSource`, `Repository`

---

### 파일 4: `status-prefix-config.service.ts`

**경로**: `apps/api/src/status-prefix/application/status-prefix-config.service.ts`

설정 조회/저장과 Discord Embed 메시지 전송/갱신 로직을 담당한다. `AutoChannelService.sendOrUpdateGuideMessage`와 유사하지만, 음성 채널이 아닌 텍스트 채널을 대상으로 하고 Embed 형식을 사용한다.

**전체 클래스 구조**:

```typescript
import { InjectDiscordClient } from '@discord-nestjs/core';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  EmbedBuilder,
  TextChannel,
} from 'discord.js';
import { Injectable, Logger } from '@nestjs/common';

import { StatusPrefixConfigRepository } from '../infrastructure/status-prefix-config.repository';
import { StatusPrefixRedisRepository } from '../infrastructure/status-prefix-redis.repository';
import { StatusPrefixConfig } from '../domain/status-prefix-config.entity';
import { StatusPrefixButton, StatusPrefixButtonType } from '../domain/status-prefix-button.entity';
import { StatusPrefixConfigSaveDto } from '../presentation/status-prefix-config-save.dto';

/** Discord 버튼 제약: ActionRow당 최대 버튼 수 */
const BUTTONS_PER_ROW = 5;

@Injectable()
export class StatusPrefixConfigService {
  private readonly logger = new Logger(StatusPrefixConfigService.name);

  constructor(
    private readonly configRepo: StatusPrefixConfigRepository,
    private readonly redisRepo: StatusPrefixRedisRepository,
    @InjectDiscordClient() private readonly client: Client,
  ) {}

  /**
   * 설정 조회 (F-STATUS-PREFIX-001).
   * Redis 캐시 우선, 미스 시 DB 조회 후 캐시 저장.
   */
  async getConfig(guildId: string): Promise<StatusPrefixConfig | null>

  /**
   * 설정 저장 (F-STATUS-PREFIX-002).
   * 처리 순서:
   *   1. DB upsert (StatusPrefixConfig + StatusPrefixButton 버튼 전체 삭제 후 재삽입)
   *   2. Redis 설정 캐시 갱신
   *   3. enabled = true이면 Discord 채널에 Embed + 버튼 메시지 전송/갱신
   *   4. 전송된 messageId를 DB에 저장
   */
  async saveConfig(guildId: string, dto: StatusPrefixConfigSaveDto): Promise<StatusPrefixConfig>

  /**
   * Discord 텍스트 채널에 Embed + 버튼 ActionRow 메시지 전송 또는 갱신.
   * messageId가 존재하면 기존 메시지 edit 시도, 실패 시 신규 전송으로 폴백.
   * 반환값: 전송된 메시지 ID
   */
  private async buildAndSendMessage(config: StatusPrefixConfig): Promise<string>

  /**
   * 버튼 목록을 Discord ActionRow 컴포넌트 배열로 변환.
   * PREFIX 버튼: customId = 'status_prefix:{buttonId}'
   * RESET 버튼: customId = 'status_reset:{buttonId}'
   * style: Primary (파란색) 고정
   */
  private buildActionRows(buttons: StatusPrefixButton[]): ActionRowBuilder<ButtonBuilder>[]
}
```

**메서드별 구현 세부사항**:

- `getConfig`:
  ```typescript
  async getConfig(guildId: string): Promise<StatusPrefixConfig | null> {
    const cached = await this.redisRepo.getConfig(guildId);
    if (cached) return cached;

    const config = await this.configRepo.findByGuildId(guildId);
    if (config) {
      await this.redisRepo.setConfig(guildId, config);
    }
    return config;
  }
  ```

- `saveConfig`:
  ```typescript
  async saveConfig(guildId: string, dto: StatusPrefixConfigSaveDto): Promise<StatusPrefixConfig> {
    // 1. DB upsert
    const config = await this.configRepo.upsert(guildId, dto);

    // 2. Redis 캐시 갱신
    await this.redisRepo.setConfig(guildId, config);

    // 3. enabled = true이고 channelId가 있으면 Discord 메시지 전송/갱신
    if (config.enabled && config.channelId) {
      try {
        const messageId = await this.buildAndSendMessage(config);
        // 4. messageId DB 저장 (upsert에서 messageId를 건드리지 않으므로 별도 업데이트)
        await this.configRepo.updateMessageId(guildId, messageId);
        config.messageId = messageId;
        // Redis 캐시도 messageId 반영하여 재저장
        await this.redisRepo.setConfig(guildId, config);
      } catch (err) {
        this.logger.error(
          `[STATUS_PREFIX] Failed to send guide message: guild=${guildId}`,
          (err as Error).stack,
        );
        throw err; // 채널/권한 오류는 컨트롤러까지 전파하여 API 오류 반환
      }
    }

    return config;
  }
  ```

- `buildAndSendMessage`:
  ```typescript
  private async buildAndSendMessage(config: StatusPrefixConfig): Promise<string> {
    const channel = await this.client.channels.fetch(config.channelId!);

    if (!channel || !channel.isTextBased()) {
      throw new Error(`Channel ${config.channelId} is not a text-based channel`);
    }

    const embed = new EmbedBuilder();
    if (config.embedTitle) embed.setTitle(config.embedTitle);
    if (config.embedDescription) embed.setDescription(config.embedDescription);
    if (config.embedColor) {
      // HEX 색상을 number로 변환: '#5865F2' → 0x5865F2
      embed.setColor(parseInt(config.embedColor.replace('#', ''), 16) as ColorResolvable);
    }

    const sortedButtons = [...config.buttons].sort((a, b) => a.sortOrder - b.sortOrder);
    const components = this.buildActionRows(sortedButtons);

    if (config.messageId) {
      try {
        const message = await (channel as TextChannel).messages.fetch(config.messageId);
        await message.edit({ embeds: [embed], components });
        return config.messageId;
      } catch {
        this.logger.warn(
          `[STATUS_PREFIX] Failed to edit message ${config.messageId}, sending new one`,
        );
        // 메시지 삭제됨 등의 이유로 수정 실패 → 신규 전송으로 폴백
      }
    }

    const message = await (channel as TextChannel).send({ embeds: [embed], components });
    return message.id;
  }
  ```

- `buildActionRows`:
  ```typescript
  private buildActionRows(buttons: StatusPrefixButton[]): ActionRowBuilder<ButtonBuilder>[] {
    const rows: ActionRowBuilder<ButtonBuilder>[] = [];

    for (let i = 0; i < buttons.length; i += BUTTONS_PER_ROW) {
      const rowButtons = buttons.slice(i, i + BUTTONS_PER_ROW);
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        rowButtons.map((btn) => {
          const customId =
            btn.type === StatusPrefixButtonType.PREFIX
              ? `status_prefix:${btn.id}`
              : `status_reset:${btn.id}`;

          const builder = new ButtonBuilder()
            .setCustomId(customId)
            .setLabel(btn.label)
            .setStyle(ButtonStyle.Primary);

          if (btn.emoji) {
            builder.setEmoji(btn.emoji);
          }

          return builder;
        }),
      );
      rows.push(row);
    }

    return rows;
  }
  ```

**오류 처리 정책**:
- `buildAndSendMessage`에서 채널을 찾을 수 없거나 봇 권한 부족 시: `Error`를 throw → `saveConfig`에서 catch하여 로그 기록 후 re-throw → 컨트롤러까지 전파 → API 오류 응답 반환. PRD F-STATUS-PREFIX-002의 오류 처리 정책을 따른다.
- 기존 메시지 수정(edit) 실패 시: 로그만 기록하고 신규 전송으로 폴백 (`AutoChannelDiscordGateway.editGuideMessage`와 동일 패턴).

**의존성**: `StatusPrefixConfigRepository`, `StatusPrefixRedisRepository`, `@InjectDiscordClient() Client`, `StatusPrefixConfig`, `StatusPrefixButton`, `StatusPrefixButtonType`, `StatusPrefixConfigSaveDto`

---

### 파일 5: `status-prefix.controller.ts`

**경로**: `apps/api/src/status-prefix/presentation/status-prefix.controller.ts`

`AutoChannelController`와 `NewbieController`의 패턴을 따른다: `@Controller('api/guilds/:guildId/status-prefix')`, `@UseGuards(JwtAuthGuard)`.

**전체 클래스 구조**:

```typescript
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { StatusPrefixConfigService } from '../application/status-prefix-config.service';
import { StatusPrefixConfigSaveDto } from './status-prefix-config-save.dto';

@Controller('api/guilds/:guildId/status-prefix')
@UseGuards(JwtAuthGuard)
export class StatusPrefixController {
  constructor(private readonly configService: StatusPrefixConfigService) {}

  /**
   * GET /api/guilds/:guildId/status-prefix/config
   * 설정 조회 (F-STATUS-PREFIX-001).
   * Redis 캐시 우선, 미스 시 DB 조회.
   * 설정 없으면 null 반환 (프론트엔드에서 기본값으로 처리).
   */
  @Get('config')
  async getConfig(@Param('guildId') guildId: string)

  /**
   * POST /api/guilds/:guildId/status-prefix/config
   * 설정 저장 (F-STATUS-PREFIX-002).
   * DB upsert → Redis 캐시 갱신 → Discord 메시지 전송/갱신.
   * 반환: { ok: boolean }
   */
  @Post('config')
  @HttpCode(HttpStatus.OK)
  async saveConfig(
    @Param('guildId') guildId: string,
    @Body() dto: StatusPrefixConfigSaveDto,
  ): Promise<{ ok: boolean }>
}
```

**메서드별 구현 세부사항**:

- `getConfig`: `configService.getConfig(guildId)` 호출 후 결과 직접 반환. 설정 없으면 `null` 반환 (NestJS는 null을 그대로 JSON으로 직렬화하여 반환).

- `saveConfig`:
  ```typescript
  async saveConfig(
    @Param('guildId') guildId: string,
    @Body() dto: StatusPrefixConfigSaveDto,
  ): Promise<{ ok: boolean }> {
    await this.configService.saveConfig(guildId, dto);
    return { ok: true };
  }
  ```
  `configService.saveConfig`에서 오류 throw 시 NestJS 기본 예외 처리기가 500 응답을 반환한다. 채널 미존재 등 비즈니스 오류는 서비스에서 적절한 `HttpException`을 throw하거나, 컨트롤러에서 catch 후 `BadRequestException`으로 변환한다.

**의존성**: `StatusPrefixConfigService`, `StatusPrefixConfigSaveDto`, `JwtAuthGuard`

---

### 파일 6: `status-prefix-config-save.dto.ts`

**경로**: `apps/api/src/status-prefix/presentation/status-prefix-config-save.dto.ts`

`AutoChannelSaveDto`와 `NewbieConfigSaveDto`의 패턴을 따른다: `class-validator` 데코레이터 사용, 중첩 객체는 `@ValidateNested` + `@Type`.

```typescript
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

import { StatusPrefixButtonType } from '../domain/status-prefix-button.entity';

export class StatusPrefixButtonSaveDto {
  @IsString()
  @IsNotEmpty()
  label: string;

  @IsOptional()
  @IsString()
  emoji?: string | null;

  @IsOptional()
  @IsString()
  prefix?: string | null;

  @IsEnum(StatusPrefixButtonType)
  type: StatusPrefixButtonType;

  @IsInt()
  sortOrder: number;
}

export class StatusPrefixConfigSaveDto {
  @IsBoolean()
  enabled: boolean;

  @IsOptional()
  @IsString()
  channelId?: string | null;

  @IsOptional()
  @IsString()
  embedTitle?: string | null;

  @IsOptional()
  @IsString()
  embedDescription?: string | null;

  @IsOptional()
  @IsString()
  embedColor?: string | null;

  @IsString()
  @IsNotEmpty()
  prefixTemplate: string;

  @IsArray()
  @ArrayMaxSize(25)
  @ValidateNested({ each: true })
  @Type(() => StatusPrefixButtonSaveDto)
  buttons: StatusPrefixButtonSaveDto[];
}
```

**설계 근거**:
- `messageId`는 DTO에 포함하지 않는다. Discord 메시지 ID는 봇이 자체 관리하며 웹에서 입력받지 않는다.
- `prefixTemplate`은 `@IsNotEmpty()`로 빈 문자열을 거부한다. DB 기본값이 `'[{prefix}] {nickname}'`이지만, 저장 시 명시적으로 전달받아야 한다.
- `buttons`는 `@ArrayMaxSize(25)`로 Discord 버튼 제약(최대 25개)을 검증한다.
- `StatusPrefixButtonType` enum을 직접 import하여 `@IsEnum` 검증에 사용한다. 이렇게 하면 enum 값이 변경될 때 DTO도 자동으로 동기화된다.

**의존성**: `StatusPrefixButtonType` enum (domain layer에서 import)

---

### 파일 7: `status-prefix.module.ts`

**경로**: `apps/api/src/status-prefix/status-prefix.module.ts`

`AutoChannelModule`과 `NewbieModule`의 구조를 따른다.

```typescript
import { DiscordModule } from '@discord-nestjs/core';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { StatusPrefixConfigService } from './application/status-prefix-config.service';
import { StatusPrefixButton } from './domain/status-prefix-button.entity';
import { StatusPrefixConfig } from './domain/status-prefix-config.entity';
import { StatusPrefixConfigRepository } from './infrastructure/status-prefix-config.repository';
import { StatusPrefixRedisRepository } from './infrastructure/status-prefix-redis.repository';
import { StatusPrefixController } from './presentation/status-prefix.controller';

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
    // Unit B에서 추가:
    // StatusPrefixApplyService,
    // StatusPrefixResetService,
    // StatusPrefixInteractionHandler,
  ],
  exports: [
    StatusPrefixConfigService,
    StatusPrefixRedisRepository,
    // Unit B에서 추가:
    // StatusPrefixResetService,  ← VoiceLeaveHandler에서 주입받기 위해 export 필요
  ],
})
export class StatusPrefixModule {}
```

**설계 근거**:
- `RedisModule`은 `@Global()` 모듈이므로 import 불필요. `StatusPrefixRedisRepository`는 `RedisService`와 `REDIS_CLIENT` 모두 전역으로 주입받을 수 있다.
- `DiscordModule.forFeature()`는 `@InjectDiscordClient()`가 동작하기 위해 필요하다. `StatusPrefixConfigService`에서 Discord Client를 주입하기 때문이다.
- `AuthModule`은 `JwtAuthGuard` 의존성 해소를 위해 필요하다. 기존 AutoChannel, Newbie 모듈과 동일한 패턴이다.
- Unit B(`StatusPrefixResetService`)는 `VoiceLeaveHandler`에서 사용하므로 exports에 추가해야 하지만, Unit A 범위에서는 아직 구현하지 않는다. Unit B 구현 시 providers와 exports에 추가한다.

---

### 파일 8: `app.module.ts` 수정

**경로**: `apps/api/src/app.module.ts`

현재 `app.module.ts`에 `NewbieModule`까지 import되어 있다. `StatusPrefixModule`을 추가한다.

**추가할 import**:
```typescript
import { StatusPrefixModule } from './status-prefix/status-prefix.module';
```

**imports 배열 변경 후**:
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

**순서 선택 근거**: `NewbieModule` 바로 다음에 배치하여 도메인 모듈들을 연속으로 유지한다.

---

### 파일 9: `discord-events.module.ts` 수정

**경로**: `apps/api/src/event/discord-events.module.ts`

`StatusPrefixModule`을 imports에 추가한다. Unit B 구현 이후 `StatusPrefixInteractionHandler`가 `StatusPrefixModule` 내부 providers로 등록되므로, `DiscordEventsModule`은 `StatusPrefixModule`을 import만 하면 된다 (common-modules.md 3-2 참조).

**변경 후 전체 모듈**:
```typescript
import { DiscordModule } from '@discord-nestjs/core';
import { Module } from '@nestjs/common';

import { AutoChannelModule } from '../channel/auto/auto-channel.module';
import { ChannelModule } from '../channel/channel.module';
import { VoiceChannelModule } from '../channel/voice/voice-channel.module';
import { NewbieModule } from '../newbie/newbie.module';
import { StatusPrefixModule } from '../status-prefix/status-prefix.module';
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
    StatusPrefixModule,   // 추가
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

**주의**: `StatusPrefixInteractionHandler`는 Unit B에서 구현하며, `StatusPrefixModule` 내부 providers에 등록된다. `DiscordEventsModule`의 providers에는 추가하지 않는다. `StatusPrefixModule`이 `@On('interactionCreate')` 핸들러를 포함한 채로 `DiscordEventsModule`에 import되면, NestJS가 해당 모듈의 providers를 인스턴스화하면서 Discord 이벤트 리스너가 자동 등록된다.

---

### 파일 10: `voice-leave.handler.ts` 수정

**경로**: `apps/api/src/event/voice/voice-leave.handler.ts`

Unit A 범위에서는 **수정하지 않는다**. Unit B에서 `StatusPrefixResetService`가 구현되고 exports된 후에 수정한다.

**Unit B 완료 후 수정 내용** (참고용):

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { VoiceChannelService } from '../../channel/voice/application/voice-channel.service';
import { StatusPrefixResetService } from '../../status-prefix/interaction/status-prefix-reset.service';
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
    this.statusPrefixResetService
      .restoreOnLeave(event.state.guildId, event.state.userId)
      .catch((err) =>
        this.logger.error('[STATUS_PREFIX] restoreOnLeave failed', (err as Error).stack),
      );
  }
}
```

`VoiceLeaveHandler`는 `DiscordEventsModule`의 providers에 등록되어 있다. `DiscordEventsModule`이 `StatusPrefixModule`을 import하고, `StatusPrefixModule`이 `StatusPrefixResetService`를 exports하면, `VoiceLeaveHandler`는 DI로 `StatusPrefixResetService`를 주입받을 수 있다.

---

## 4. 구현 순서

의존성 그래프에 따라 하위 레이어부터 시작한다.

```
1. status-prefix-cache.keys.ts          (의존성 없음)
2. status-prefix-config-save.dto.ts     (StatusPrefixButtonType enum 의존)
3. status-prefix-redis.repository.ts    (keys, RedisService, REDIS_CLIENT 의존)
4. status-prefix-config.repository.ts   (엔티티 2종, DTO, DataSource 의존)
5. status-prefix-config.service.ts      (repository 2종, Discord Client 의존)
6. status-prefix.controller.ts          (service, DTO 의존)
7. status-prefix.module.ts              (모든 파일 의존)
8. app.module.ts 수정                   (module 의존)
9. discord-events.module.ts 수정        (module 의존)
```

`voice-leave.handler.ts` 수정은 Unit B 완료 후 실행한다.

---

## 5. 기존 코드베이스 충돌 검토

| 항목 | 판단 | 근거 |
|------|------|------|
| `RedisModule` 전역 모듈 재사용 | 충돌 없음 | `@Global()` 모듈이므로 `StatusPrefixModule`에서 별도 import 없이 `RedisService`, `REDIS_CLIENT` 사용 가능 |
| `StatusPrefixConfig` 엔티티 등록 | 충돌 없음 | `TypeOrmModule.forFeature()`에 새로 등록. `autoLoadEntities: true` 환경에서 중복 테이블 생성 없음 |
| `StatusPrefixButton` 엔티티 등록 | 충돌 없음 | 동일 |
| `AuthModule` import | 충돌 없음 | `AutoChannelModule`, `NewbieModule` 모두 동일하게 import. 공유 모듈이므로 중복 등록 무해 |
| `DiscordModule.forFeature()` | 충돌 없음 | 모듈당 독립 Discord Client 인스턴스를 주입받는 방식으로 설계되어 있음 |
| `REDIS_CLIENT` 직접 주입 | 충돌 없음 | `NewbieRedisRepository`에서 이미 동일 패턴 사용. 전역으로 provide됨 |
| `DiscordEventsModule`에 StatusPrefixModule import 추가 | 충돌 없음 | imports 배열에 추가만 하며 기존 항목 제거 없음 |
| `app.module.ts`에 StatusPrefixModule 추가 | 충돌 없음 | imports 배열에 추가만. 기존 모듈 순서 변경 없음 |
| `EmbedBuilder` 사용 (텍스트 채널) | 충돌 없음 | 기존 AutoChannel은 음성 채널에 텍스트 메시지를 전송. Status Prefix는 텍스트 채널에 Embed 전송으로 다른 채널 타입 사용 |
| `HEX → Color number 변환` | 주의 필요 | `parseInt(hex.replace('#', ''), 16)` 결과를 `ColorResolvable`로 캐스팅. `EmbedBuilder.setColor`는 `ColorResolvable` 타입(`number | [r,g,b] | string | null`)을 수용. `number` 타입으로 전달해도 정상 동작하지만 `as ColorResolvable` 캐스팅이 필요할 수 있음 — discord.js 타입에 따라 `parseInt(...) as ColorResolvable` 또는 직접 HEX 문자열 `config.embedColor` 전달도 가능 |
| `voice-leave.handler.ts` 수정 | Unit B 이후 | Unit A에서 건드리지 않음. `StatusPrefixResetService` 구현 완료 후 수정 |

---

## 6. 검증 체크리스트

- [ ] `status-prefix-cache.keys.ts` — 2개 키 함수 모두 PRD Redis 키 패턴(`status_prefix:original:`, `status_prefix:config:`)과 일치
- [ ] `status-prefix-redis.repository.ts` — `REDIS_CLIENT` import 경로가 `../../../redis/redis.constants`인지 확인
- [ ] `status-prefix-redis.repository.ts` — `setOriginalNicknameNx`에서 `client.set(key, JSON.stringify(value), 'NX')` 사용 (RedisService.set을 사용하면 NX 플래그 지원 불가)
- [ ] `status-prefix-redis.repository.ts` — `getOriginalNickname`이 `redis.get<string>`으로 JSON 역직렬화 경유하여 문자열 반환
- [ ] `status-prefix-config.repository.ts` — `upsert` 시 `messageId` 필드를 건드리지 않음 (신규 생성 시만 `null`로 초기화)
- [ ] `status-prefix-config.repository.ts` — `DataSource` 주입으로 트랜잭션 처리
- [ ] `status-prefix-config.repository.ts` — 버튼 삭제 시 `DELETE WHERE configId = config.id` 사용 (엔티티에 `ON DELETE CASCADE` 설정되어 있지만 명시적 삭제가 더 안전)
- [ ] `status-prefix-config.service.ts` — `saveConfig`에서 Discord 메시지 전송 실패 시 Error를 re-throw하여 컨트롤러까지 전파
- [ ] `status-prefix-config.service.ts` — `buildAndSendMessage`에서 기존 메시지 edit 실패 시 신규 전송으로 폴백
- [ ] `status-prefix-config.service.ts` — `buildActionRows`에서 `type === StatusPrefixButtonType.PREFIX` → `status_prefix:{id}`, `type === StatusPrefixButtonType.RESET` → `status_reset:{id}` customId 형식 준수
- [ ] `status-prefix-config-save.dto.ts` — `messageId` 필드 없음
- [ ] `status-prefix-config-save.dto.ts` — `buttons` 배열에 `@ArrayMaxSize(25)` 적용
- [ ] `status-prefix-config-save.dto.ts` — `StatusPrefixButtonType` enum import 경로가 `../domain/status-prefix-button.entity`인지 확인
- [ ] `status-prefix.module.ts` — `DiscordModule.forFeature()` import 포함 (ConfigService에서 Discord Client 주입 위해)
- [ ] `status-prefix.module.ts` — `RedisModule` import 없음 (전역 모듈이므로 불필요)
- [ ] `status-prefix.module.ts` — Unit B 완료 전까지 `StatusPrefixResetService` exports에 없음 (VoiceLeaveHandler 수정도 Unit B 이후)
- [ ] `app.module.ts` — `StatusPrefixModule`이 imports에 추가됨
- [ ] `discord-events.module.ts` — `StatusPrefixModule`이 imports에 추가됨
- [ ] `voice-leave.handler.ts` — Unit A에서 수정하지 않음 (Unit B 완료 후 수정)

---

## 7. Unit B 구현 시 추가로 수정할 파일

Unit A 완료 후 Unit B(`StatusPrefixApplyService`, `StatusPrefixResetService`, `StatusPrefixInteractionHandler`)를 구현할 때 수정이 필요한 기존 파일:

| 파일 | 수정 내용 |
|------|-----------|
| `apps/api/src/status-prefix/status-prefix.module.ts` | providers에 `StatusPrefixApplyService`, `StatusPrefixResetService`, `StatusPrefixInteractionHandler` 추가. exports에 `StatusPrefixResetService` 추가 |
| `apps/api/src/event/voice/voice-leave.handler.ts` | `StatusPrefixResetService` 생성자 주입 추가 + `restoreOnLeave` 호출 추가 |

이 두 파일만 수정하면 되며, `discord-events.module.ts`와 `app.module.ts`는 Unit A에서 이미 처리된다.
