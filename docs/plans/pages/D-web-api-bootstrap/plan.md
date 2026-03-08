# 단위 D: 웹 설정 API + 봇 기동 초기화 — 구현 계획

## 개요

| 항목 | 내용 |
|------|------|
| 관련 PRD | F-WEB-004 (웹 대시보드 자동방 설정 저장), F-VOICE-009 (안내 메시지 전송/갱신) |
| 구현 단위 | D (공통 모듈 문서 4절) |
| 선행 조건 | 공통 모듈 단계에서 `auto-channel.keys.ts`, `auto-channel-state.ts`, `auto-channel-redis.repository.ts` 파일이 먼저 생성되어야 함 |

---

## 1. 생성/수정 파일 전체 목록

### 1-1. 신규 생성 파일

```
apps/api/src/channel/auto/
  auto-channel.module.ts
  auto-channel.controller.ts
  application/
    auto-channel-bootstrap.service.ts
  infrastructure/
    auto-channel.keys.ts                    ← 공통 모듈 단계 파일 (단위 D에서도 생성)
    auto-channel-state.ts                   ← 공통 모듈 단계 파일 (단위 D에서도 생성)
    auto-channel-redis.repository.ts        ← 공통 모듈 단계 파일 (단위 D에서도 생성)
    auto-channel-config.repository.ts
    auto-channel-discord.gateway.ts
  dto/
    auto-channel-save.dto.ts

apps/api/src/event/auto-channel/
  auto-channel-events.ts                    ← 공통 모듈 단계 파일 (단위 D에서도 생성)
```

> 공통 모듈 단계에서 먼저 생성되어야 할 파일 4개는 병렬 개발 시 해당 단계 완료 후 작업한다.
> 단위 D가 단독 선행 작업이라면 이 파일들도 직접 생성한다.

### 1-2. 기존 수정 파일

```
apps/api/src/app.module.ts   ← AutoChannelModule import 추가
```

---

## 2. 구현 단계별 상세 계획

### Step 1: 공통 인프라 파일 생성

#### `apps/api/src/channel/auto/infrastructure/auto-channel.keys.ts`

`VoiceKeys` (`voice-cache.keys.ts`)와 동일한 패턴으로 작성한다.

```typescript
export const AutoChannelKeys = {
  waiting: (channelId: string) => `auto_channel:waiting:${channelId}`,
  confirmed: (channelId: string) => `auto_channel:confirmed:${channelId}`,
  triggerSet: (guildId: string) => `auto_channel:trigger:${guildId}`,
};
```

#### `apps/api/src/channel/auto/infrastructure/auto-channel-state.ts`

DB 스키마 문서의 AutoChannelWaitingState / AutoChannelConfirmedState 구조를 그대로 타입으로 정의한다.

```typescript
export interface AutoChannelWaitingState {
  guildId: string;
  userId: string;
  triggerChannelId: string;
  configId: number;
}

export interface AutoChannelConfirmedState {
  guildId: string;
  userId: string;
  buttonId: number;
  subOptionId?: number;
}
```

#### `apps/api/src/event/auto-channel/auto-channel-events.ts`

`voice-events.ts`와 동일한 패턴으로 작성한다.

```typescript
import { VoiceStateDto } from '../../channel/voice/infrastructure/voice-state.dto';

export const AUTO_CHANNEL_EVENTS = {
  TRIGGER_JOIN: 'auto-channel.trigger-join',
  CHANNEL_EMPTY: 'auto-channel.channel-empty',
} as const;

export class AutoChannelTriggerJoinEvent {
  constructor(public readonly state: VoiceStateDto) {}
}

export class AutoChannelChannelEmptyEvent {
  constructor(
    public readonly guildId: string,
    public readonly channelId: string,
  ) {}
}
```

---

### Step 2: Redis 저장소 (`auto-channel-redis.repository.ts`)

`VoiceRedisRepository`와 동일한 패턴으로 작성한다. `RedisService`는 `@Global()`이므로 별도 import 불필요.

**파일**: `apps/api/src/channel/auto/infrastructure/auto-channel-redis.repository.ts`

```typescript
import { Injectable } from '@nestjs/common';

import { RedisService } from '../../../redis/redis.service';
import { AutoChannelKeys } from './auto-channel.keys';
import { AutoChannelWaitingState, AutoChannelConfirmedState } from './auto-channel-state';

const TTL = {
  WAITING: 60 * 60 * 12,    // 12시간
  CONFIRMED: 60 * 60 * 12,  // 12시간
} as const;

@Injectable()
export class AutoChannelRedisRepository {
  constructor(private readonly redis: RedisService) {}

  // --- 대기방 ---
  async setWaitingState(channelId: string, state: AutoChannelWaitingState): Promise<void> {
    await this.redis.set(AutoChannelKeys.waiting(channelId), state, TTL.WAITING);
  }

  async getWaitingState(channelId: string): Promise<AutoChannelWaitingState | null> {
    return this.redis.get<AutoChannelWaitingState>(AutoChannelKeys.waiting(channelId));
  }

  async deleteWaitingState(channelId: string): Promise<void> {
    await this.redis.del(AutoChannelKeys.waiting(channelId));
  }

  // --- 확정방 ---
  async setConfirmedState(channelId: string, state: AutoChannelConfirmedState): Promise<void> {
    await this.redis.set(AutoChannelKeys.confirmed(channelId), state, TTL.CONFIRMED);
  }

  async getConfirmedState(channelId: string): Promise<AutoChannelConfirmedState | null> {
    return this.redis.get<AutoChannelConfirmedState>(AutoChannelKeys.confirmed(channelId));
  }

  async deleteConfirmedState(channelId: string): Promise<void> {
    await this.redis.del(AutoChannelKeys.confirmed(channelId));
  }

  // --- 트리거 채널 집합 ---
  async addTriggerChannel(guildId: string, triggerChannelId: string): Promise<void> {
    await this.redis.sadd(AutoChannelKeys.triggerSet(guildId), triggerChannelId);
  }

  async removeTriggerChannel(guildId: string, triggerChannelId: string): Promise<void> {
    await this.redis.srem(AutoChannelKeys.triggerSet(guildId), triggerChannelId);
  }

  async isTriggerChannel(guildId: string, channelId: string): Promise<boolean> {
    return this.redis.sismember(AutoChannelKeys.triggerSet(guildId), channelId);
  }

  /**
   * 봇 기동 시 또는 설정 전체 갱신 시 호출.
   * 기존 Set을 삭제 후 새 목록으로 덮어쓴다.
   * triggerChannelIds가 빈 배열이면 키를 삭제한다.
   */
  async initTriggerSet(guildId: string, triggerChannelIds: string[]): Promise<void> {
    const key = AutoChannelKeys.triggerSet(guildId);
    await this.redis.del(key);
    if (triggerChannelIds.length > 0) {
      await this.redis.sadd(key, triggerChannelIds);
    }
  }
}
```

**주의**: `RedisService.sadd`가 `string | string[]`을 받으므로 배열 전달 시 그대로 사용 가능하다.

---

### Step 3: DTO 정의 (`auto-channel-save.dto.ts`)

**파일**: `apps/api/src/channel/auto/dto/auto-channel-save.dto.ts`

공통 모듈 문서(2-11)의 DTO 구조에 `class-validator` 데코레이터를 추가한다.

```typescript
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AutoChannelSubOptionDto {
  @IsString()
  @IsNotEmpty()
  label: string;

  @IsOptional()
  @IsString()
  emoji?: string;

  @IsString()
  @IsNotEmpty()
  channelSuffix: string;

  @IsInt()
  sortOrder: number;
}

export class AutoChannelButtonDto {
  @IsString()
  @IsNotEmpty()
  label: string;

  @IsOptional()
  @IsString()
  emoji?: string;

  @IsString()
  @IsNotEmpty()
  targetCategoryId: string;

  @IsInt()
  sortOrder: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AutoChannelSubOptionDto)
  subOptions: AutoChannelSubOptionDto[];
}

export class AutoChannelSaveDto {
  @IsString()
  @IsNotEmpty()
  triggerChannelId: string;

  @IsString()
  @IsNotEmpty()
  waitingRoomTemplate: string;

  @IsString()
  @IsNotEmpty()
  guideMessage: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AutoChannelButtonDto)
  buttons: AutoChannelButtonDto[];
}
```

**응답 DTO** — 별도 클래스 없이 저장된 `AutoChannelConfig` 엔티티를 직렬화하여 반환한다.

---

### Step 4: DB 설정 저장소 (`auto-channel-config.repository.ts`)

**파일**: `apps/api/src/channel/auto/infrastructure/auto-channel-config.repository.ts`

TypeORM `DataSource`를 이용한 트랜잭션 upsert 패턴은 `VoiceChannelHistoryService`와 동일하게 구현한다.

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { AutoChannelConfig } from '../domain/auto-channel-config.entity';
import { AutoChannelButton } from '../domain/auto-channel-button.entity';
import { AutoChannelSubOption } from '../domain/auto-channel-sub-option.entity';
import { AutoChannelSaveDto } from '../dto/auto-channel-save.dto';

@Injectable()
export class AutoChannelConfigRepository {
  constructor(
    @InjectRepository(AutoChannelConfig)
    private readonly configRepo: Repository<AutoChannelConfig>,
    @InjectRepository(AutoChannelButton)
    private readonly buttonRepo: Repository<AutoChannelButton>,
    @InjectRepository(AutoChannelSubOption)
    private readonly subOptionRepo: Repository<AutoChannelSubOption>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * 서버 내 모든 설정 조회 (buttons, subOptions 포함).
   * 봇 기동 초기화에서 사용.
   */
  async findAllByGuildId(guildId: string): Promise<AutoChannelConfig[]> {
    return this.configRepo.find({
      where: { guildId },
      relations: { buttons: { subOptions: true } },
    });
  }

  /**
   * 특정 트리거 채널 설정 조회.
   */
  async findByTriggerChannel(
    guildId: string,
    triggerChannelId: string,
  ): Promise<AutoChannelConfig | null> {
    return this.configRepo.findOne({
      where: { guildId, triggerChannelId },
      relations: { buttons: { subOptions: true } },
    });
  }

  /**
   * 설정 upsert:
   *   1. (guildId, triggerChannelId) 기준으로 기존 레코드 조회
   *   2. 없으면 INSERT, 있으면 UPDATE
   *   3. 기존 buttons를 CASCADE DELETE 후 새 buttons/subOptions INSERT
   *
   * 트랜잭션 내에서 처리하여 부분 실패를 방지한다.
   */
  async upsert(
    guildId: string,
    dto: AutoChannelSaveDto,
  ): Promise<AutoChannelConfig> {
    return this.dataSource.transaction(async (manager) => {
      // 1. 기존 설정 조회
      let config = await manager.findOne(AutoChannelConfig, {
        where: { guildId, triggerChannelId: dto.triggerChannelId },
      });

      if (config) {
        // 2a. 기존 설정 업데이트
        config.waitingRoomTemplate = dto.waitingRoomTemplate;
        config.guideMessage = dto.guideMessage;
        // guideMessageId는 별도 updateGuideMessageId()로 갱신 — 여기서 초기화하지 않음
        await manager.save(AutoChannelConfig, config);

        // 2b. 기존 버튼 전체 삭제 (CASCADE로 subOptions도 삭제됨)
        await manager.delete(AutoChannelButton, { configId: config.id });
      } else {
        // 3. 신규 생성
        config = manager.create(AutoChannelConfig, {
          guildId,
          triggerChannelId: dto.triggerChannelId,
          waitingRoomTemplate: dto.waitingRoomTemplate,
          guideMessage: dto.guideMessage,
          guideMessageId: null,
        });
        config = await manager.save(AutoChannelConfig, config);
      }

      // 4. 버튼 + 하위 선택지 INSERT
      for (const btnDto of dto.buttons) {
        let button = manager.create(AutoChannelButton, {
          configId: config.id,
          label: btnDto.label,
          emoji: btnDto.emoji ?? null,
          targetCategoryId: btnDto.targetCategoryId,
          sortOrder: btnDto.sortOrder,
        });
        button = await manager.save(AutoChannelButton, button);

        for (const subDto of btnDto.subOptions) {
          const sub = manager.create(AutoChannelSubOption, {
            buttonId: button.id,
            label: subDto.label,
            emoji: subDto.emoji ?? null,
            channelSuffix: subDto.channelSuffix,
            sortOrder: subDto.sortOrder,
          });
          await manager.save(AutoChannelSubOption, sub);
        }
      }

      // 5. 최종 상태를 relations 포함하여 반환
      return manager.findOneOrFail(AutoChannelConfig, {
        where: { id: config.id },
        relations: { buttons: { subOptions: true } },
      });
    });
  }

  /**
   * 안내 메시지 Discord ID 저장.
   * F-VOICE-009에서 메시지 전송 후 호출.
   */
  async updateGuideMessageId(configId: number, messageId: string): Promise<void> {
    await this.configRepo.update(configId, { guideMessageId: messageId });
  }
}
```

**설계 근거**:
- 버튼 replace 전략으로 "기존 DELETE + 신규 INSERT"를 선택한다. TypeORM cascade upsert는 관계 depth가 2단계(config → button → subOption)일 때 동작이 불명확하여, 명시적 delete 후 insert가 더 안전하다.
- `guideMessageId`는 upsert에서 초기화하지 않고 `updateGuideMessageId()`로만 변경한다. 안내 메시지를 Discord에 재전송한 시점에 정확한 ID로 덮어쓰기 때문이다.
- `findOneOrFail`로 relations 포함 반환하여 컨트롤러에서 버튼 정보 사용 가능.

---

### Step 5: Discord Gateway (`auto-channel-discord.gateway.ts`)

**파일**: `apps/api/src/channel/auto/infrastructure/auto-channel-discord.gateway.ts`

`DiscordVoiceGateway`와 동일하게 `@discord-nestjs/core`의 `@InjectDiscordClient()`를 사용한다.

```typescript
import { InjectDiscordClient } from '@discord-nestjs/core';
import { Injectable, Logger } from '@nestjs/common';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  TextChannel,
} from 'discord.js';

import { AutoChannelButtonDto } from '../dto/auto-channel-save.dto';

@Injectable()
export class AutoChannelDiscordGateway {
  private readonly logger = new Logger(AutoChannelDiscordGateway.name);

  constructor(@InjectDiscordClient() private readonly client: Client) {}

  /**
   * F-VOICE-009: 트리거 채널에 안내 메시지 + 버튼 신규 전송.
   * 반환값: Discord message ID
   */
  async sendGuideMessage(
    channelId: string,
    guideMessage: string,
    buttons: AutoChannelButtonDto[],
  ): Promise<string> {
    const channel = await this.client.channels.fetch(channelId) as TextChannel;
    const components = this.buildActionRows(buttons);

    const message = await channel.send({
      content: guideMessage,
      components,
    });

    return message.id;
  }

  /**
   * F-VOICE-009: 기존 안내 메시지 수정.
   * 실패 시 (메시지 삭제됨 등) null 반환 — 호출자가 신규 전송으로 폴백.
   */
  async editGuideMessage(
    channelId: string,
    messageId: string,
    guideMessage: string,
    buttons: AutoChannelButtonDto[],
  ): Promise<string | null> {
    try {
      const channel = await this.client.channels.fetch(channelId) as TextChannel;
      const message = await channel.messages.fetch(messageId);
      const components = this.buildActionRows(buttons);

      await message.edit({
        content: guideMessage,
        components,
      });

      return messageId;
    } catch (error) {
      this.logger.warn(
        `Failed to edit guide message (channelId=${channelId}, messageId=${messageId}): ${(error as Error).message}`,
      );
      return null;
    }
  }

  /**
   * 단위 B (버튼-확정방) / 단위 D에서 사용.
   * 서버 내 음성 채널 목록 조회 (중복 채널명 순번 처리용).
   */
  async fetchGuildVoiceChannelNames(guildId: string): Promise<string[]> {
    const guild = await this.client.guilds.fetch(guildId);
    const channels = await guild.channels.fetch();
    return channels
      .filter((ch) => ch?.isVoiceBased() ?? false)
      .map((ch) => ch!.name);
  }

  /**
   * 버튼 DTO 목록을 Discord ActionRow 컴포넌트 배열로 변환.
   * Discord 제약: ActionRow 최대 5개, 버튼 최대 5개/행 → 총 25개.
   */
  private buildActionRows(
    buttons: AutoChannelButtonDto[],
  ): ActionRowBuilder<ButtonBuilder>[] {
    const rows: ActionRowBuilder<ButtonBuilder>[] = [];
    const BUTTONS_PER_ROW = 5;

    for (let i = 0; i < buttons.length; i += BUTTONS_PER_ROW) {
      const rowButtons = buttons.slice(i, i + BUTTONS_PER_ROW);
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        rowButtons.map((btn) => {
          const builder = new ButtonBuilder()
            .setCustomId(`auto_btn:${btn.sortOrder}`)  // 실제 DB id는 저장 후 알 수 있음 — 임시로 sortOrder 사용
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
}
```

**customId 처리 방식 상세**:

`sendGuideMessage` / `editGuideMessage`가 호출되는 시점에는 버튼 DB ID가 확정된 상태이므로, 실제 구현에서는 DTO가 아닌 저장된 `AutoChannelButton[]`을 받아야 한다. 컨트롤러 흐름에서 순서를 확인한다 (Step 7 참조).

수정된 시그니처:

```typescript
// 저장된 엔티티를 받도록 변경
async sendGuideMessage(
  channelId: string,
  guideMessage: string,
  buttons: { id: number; label: string; emoji: string | null }[],
): Promise<string>

async editGuideMessage(
  channelId: string,
  messageId: string,
  guideMessage: string,
  buttons: { id: number; label: string; emoji: string | null }[],
): Promise<string | null>
```

`buildActionRows` 내에서 `customId`를 `auto_btn:${button.id}`로 설정한다.

---

### Step 6: 봇 기동 초기화 서비스 (`auto-channel-bootstrap.service.ts`)

**파일**: `apps/api/src/channel/auto/application/auto-channel-bootstrap.service.ts`

`VoiceRecoveryService`와 동일하게 `OnApplicationBootstrap`을 구현한다.

```typescript
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';

import { AutoChannelConfigRepository } from '../infrastructure/auto-channel-config.repository';
import { AutoChannelRedisRepository } from '../infrastructure/auto-channel-redis.repository';

@Injectable()
export class AutoChannelBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AutoChannelBootstrapService.name);

  constructor(
    private readonly configRepo: AutoChannelConfigRepository,
    private readonly redisRepo: AutoChannelRedisRepository,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.initTriggerSets();
  }

  /**
   * DB의 모든 AutoChannelConfig를 읽어 guildId별로 그룹화한 뒤
   * Redis trigger set을 초기화한다.
   *
   * 방식: guildId별로 initTriggerSet() 호출 (기존 Set 삭제 후 재구성).
   * 봇 크래시 후 재기동 시 Redis 상태가 DB와 동기화됨을 보장한다.
   */
  private async initTriggerSets(): Promise<void> {
    // DB에서 전체 설정 조회 — guildId별 triggerChannelId 수집
    // findAllConfigs는 간단한 SELECT 이므로 AutoChannelConfigRepository에 추가
    const allConfigs = await this.configRepo.findAllConfigs();

    if (allConfigs.length === 0) {
      this.logger.log('No AutoChannelConfig found. Skipping trigger set initialization.');
      return;
    }

    // guildId → triggerChannelId[] 맵 구성
    const guildMap = new Map<string, string[]>();
    for (const config of allConfigs) {
      const list = guildMap.get(config.guildId) ?? [];
      list.push(config.triggerChannelId);
      guildMap.set(config.guildId, list);
    }

    // 각 서버별 Redis Set 초기화
    for (const [guildId, triggerChannelIds] of guildMap.entries()) {
      await this.redisRepo.initTriggerSet(guildId, triggerChannelIds);
      this.logger.log(
        `Initialized trigger set for guild=${guildId}: [${triggerChannelIds.join(', ')}]`,
      );
    }

    this.logger.log(`AutoChannel bootstrap complete. ${guildMap.size} guild(s) initialized.`);
  }
}
```

`AutoChannelConfigRepository`에 `findAllConfigs()` 메서드를 추가한다:

```typescript
// auto-channel-config.repository.ts 에 추가
async findAllConfigs(): Promise<AutoChannelConfig[]> {
  return this.configRepo.find();  // buttons 관계 불필요 — guildId, triggerChannelId만 사용
}
```

---

### Step 7: 컨트롤러 (`auto-channel.controller.ts`)

**파일**: `apps/api/src/channel/auto/auto-channel.controller.ts`

공통 모듈 문서(2-10)에서 정의한 경로: `POST /api/guilds/:guildId/auto-channel`, `GET /api/guilds/:guildId/auto-channel`.

```typescript
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { AutoChannelSaveDto } from './dto/auto-channel-save.dto';
import { AutoChannelConfigRepository } from './infrastructure/auto-channel-config.repository';
import { AutoChannelRedisRepository } from './infrastructure/auto-channel-redis.repository';
import { AutoChannelDiscordGateway } from './infrastructure/auto-channel-discord.gateway';

@Controller('api/guilds/:guildId/auto-channel')
@UseGuards(JwtAuthGuard)
export class AutoChannelController {
  constructor(
    private readonly configRepo: AutoChannelConfigRepository,
    private readonly redisRepo: AutoChannelRedisRepository,
    private readonly discordGateway: AutoChannelDiscordGateway,
  ) {}

  /**
   * POST /api/guilds/:guildId/auto-channel
   *
   * 처리 순서 (F-WEB-004 저장 동작):
   *   1. DB upsert (config + buttons + subOptions)
   *   2. 안내 메시지 전송 또는 갱신 (F-VOICE-009)
   *   3. guideMessageId DB 저장
   *   4. Redis trigger set 갱신
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  async save(
    @Param('guildId') guildId: string,
    @Body() dto: AutoChannelSaveDto,
  ) {
    // 1. DB upsert
    const config = await this.configRepo.upsert(guildId, dto);

    // 2. 저장된 버튼 ID 기반으로 안내 메시지 전송/갱신
    const buttonPayloads = config.buttons.map((btn) => ({
      id: btn.id,
      label: btn.label,
      emoji: btn.emoji,
    }));

    let guideMessageId: string;

    if (config.guideMessageId) {
      // 기존 메시지 수정 시도
      const editResult = await this.discordGateway.editGuideMessage(
        dto.triggerChannelId,
        config.guideMessageId,
        dto.guideMessage,
        buttonPayloads,
      );

      if (editResult) {
        guideMessageId = editResult;
      } else {
        // 수정 실패 (메시지 삭제됨 등) → 신규 전송
        guideMessageId = await this.discordGateway.sendGuideMessage(
          dto.triggerChannelId,
          dto.guideMessage,
          buttonPayloads,
        );
      }
    } else {
      // 최초 전송
      guideMessageId = await this.discordGateway.sendGuideMessage(
        dto.triggerChannelId,
        dto.guideMessage,
        buttonPayloads,
      );
    }

    // 3. guideMessageId DB 저장
    await this.configRepo.updateGuideMessageId(config.id, guideMessageId);

    // 4. Redis trigger set 갱신 (단건 SADD)
    await this.redisRepo.addTriggerChannel(guildId, dto.triggerChannelId);

    return { ok: true, configId: config.id, guideMessageId };
  }

  /**
   * GET /api/guilds/:guildId/auto-channel
   *
   * 서버의 모든 자동방 설정 반환 (웹 대시보드 초기 데이터 로드).
   */
  @Get()
  async findAll(@Param('guildId') guildId: string) {
    const configs = await this.configRepo.findAllByGuildId(guildId);
    return configs;
  }
}
```

**설계 근거**:
- `upsert()` 완료 후 `config.buttons`에 DB 저장된 ID가 포함되어 있으므로, 이 시점에 `auto_btn:{button.id}` customId를 정확하게 구성할 수 있다.
- 안내 메시지 전송이 실패하더라도 DB는 이미 커밋된 상태이므로, Discord 전송 오류는 별도 에러 전파로 처리한다 (클라이언트에서 재시도 가능).
- `@HttpCode(HttpStatus.OK)` — POST이지만 upsert 의미이므로 항상 200 반환.

---

### Step 8: NestJS 모듈 (`auto-channel.module.ts`)

**파일**: `apps/api/src/channel/auto/auto-channel.module.ts`

```typescript
import { DiscordModule } from '@discord-nestjs/core';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../../auth/auth.module';
import { AutoChannelConfig } from './domain/auto-channel-config.entity';
import { AutoChannelButton } from './domain/auto-channel-button.entity';
import { AutoChannelSubOption } from './domain/auto-channel-sub-option.entity';
import { AutoChannelController } from './auto-channel.controller';
import { AutoChannelBootstrapService } from './application/auto-channel-bootstrap.service';
import { AutoChannelConfigRepository } from './infrastructure/auto-channel-config.repository';
import { AutoChannelRedisRepository } from './infrastructure/auto-channel-redis.repository';
import { AutoChannelDiscordGateway } from './infrastructure/auto-channel-discord.gateway';

@Module({
  imports: [
    DiscordModule.forFeature(),
    TypeOrmModule.forFeature([AutoChannelConfig, AutoChannelButton, AutoChannelSubOption]),
    AuthModule,
  ],
  controllers: [AutoChannelController],
  providers: [
    AutoChannelConfigRepository,
    AutoChannelRedisRepository,
    AutoChannelDiscordGateway,
    AutoChannelBootstrapService,
  ],
  exports: [
    AutoChannelConfigRepository,
    AutoChannelRedisRepository,
    AutoChannelDiscordGateway,
  ],
})
export class AutoChannelModule {}
```

**설계 근거**:
- `RedisModule`은 `@Global()`이므로 import 불필요. `RedisService`를 `AutoChannelRedisRepository`에 직접 주입받는다.
- `DiscordModule.forFeature()` — `AutoChannelDiscordGateway`가 `@InjectDiscordClient()`를 사용하므로 필요하다. `DiscordVoiceGateway`와 동일한 패턴.
- `AuthModule` import — `JwtAuthGuard`를 컨트롤러에서 사용하기 위해 필요. `AuthModule.exports`에 `JwtAuthGuard`가 포함되어 있음.
- `exports` 3개 — 단위 A, B, C에서 `AutoChannelModule`을 import할 때 사용할 공개 API.

---

### Step 9: AppModule 수정

**파일**: `apps/api/src/app.module.ts`

```typescript
// 추가할 import
import { AutoChannelModule } from './channel/auto/auto-channel.module';

// imports 배열에 추가
AutoChannelModule,
```

최종 AppModule imports 순서:
```typescript
imports: [
  ConfigModule.forRoot(BaseConfig),
  EventEmitterModule.forRoot(),
  DiscordModule.forRootAsync(DiscordConfig),
  TypeOrmModule.forRootAsync(TypeORMConfig),
  ChannelModule,
  VoiceChannelModule,
  AutoChannelModule,   // 추가
  MusicModule,
  DiscordEventsModule,
  RedisModule,
  VoiceAnalyticsModule,
  AuthModule,
],
```

---

## 3. 전체 컨트롤러 → 서비스 → 저장소 흐름

```
POST /api/guilds/:guildId/auto-channel
  │
  ▼ [AutoChannelController.save]
  │   1. AutoChannelConfigRepository.upsert(guildId, dto)
  │      └─ DataSource.transaction
  │           ├─ AutoChannelConfig FIND or CREATE
  │           ├─ AutoChannelButton DELETE (기존) → INSERT (신규)
  │           └─ AutoChannelSubOption INSERT
  │   2. AutoChannelDiscordGateway.editGuideMessage || sendGuideMessage
  │      └─ discord.js TextChannel.messages.fetch().edit || channel.send()
  │   3. AutoChannelConfigRepository.updateGuideMessageId(configId, messageId)
  │   4. AutoChannelRedisRepository.addTriggerChannel(guildId, triggerChannelId)
  │
  ▼ Response { ok: true, configId, guideMessageId }

GET /api/guilds/:guildId/auto-channel
  │
  ▼ [AutoChannelController.findAll]
  │   AutoChannelConfigRepository.findAllByGuildId(guildId)
  │
  ▼ AutoChannelConfig[] (buttons + subOptions 포함)

봇 기동 시
  │
  ▼ [AutoChannelBootstrapService.onApplicationBootstrap]
  │   AutoChannelConfigRepository.findAllConfigs()
  │   → guildId별 그룹화
  │   → AutoChannelRedisRepository.initTriggerSet(guildId, triggerChannelIds[])
  │
  ▼ Redis: SADD auto_channel:trigger:{guildId} {triggerChannelId...}
```

---

## 4. 안내 메시지 Discord API 호출 방법

### 채널 타입 주의사항

트리거 채널은 음성 채널(`GuildVoice`)이다. Discord.js에서 음성 채널은 `TextChannel`이 아닌 `VoiceChannel` 타입이지만, 음성 채널에도 텍스트(메시지) 전송이 가능하다. `channel.send()`는 `BaseGuildTextChannel`을 구현하는 모든 채널에서 사용 가능하므로, 타입은 `GuildVoice | TextChannel`로 처리한다.

```typescript
import { VoiceChannel } from 'discord.js';

// fetch 후 타입 단언 또는 isVoiceBased() 가드로 처리
const channel = await this.client.channels.fetch(channelId);
if (!channel || !channel.isVoiceBased()) {
  throw new Error(`Channel ${channelId} is not a voice channel`);
}
// VoiceChannel은 send()를 지원함
const message = await (channel as VoiceChannel).send({ content, components });
```

### 버튼 구성 (ActionRow)

```
[ActionRow 1] [btn1][btn2][btn3][btn4][btn5]  ← buttons 0~4
[ActionRow 2] [btn6][btn7][btn8][btn9][btn10] ← buttons 5~9
...
최대 5개 ActionRow × 5개 버튼 = 25개 버튼 제한 (PRD F-VOICE-009 명시)
```

`buttons` 배열이 25개를 초과할 경우 유효성 검사에서 거부 (DTO에 `@ArrayMaxSize(25)` 추가 고려).

### 메시지 수정 실패 시 폴백

기존 `guideMessageId`가 저장되어 있어도 메시지가 Discord에서 삭제된 경우 `messages.fetch()`가 `DiscordAPIError[10008]: Unknown Message`를 throw한다. `editGuideMessage()`에서 catch 후 `null` 반환 → 컨트롤러에서 `sendGuideMessage()`로 폴백한다.

---

## 5. 에러 처리 전략

### 5-1. DB upsert 실패

- TypeORM 트랜잭션 내 오류 → 자동 롤백
- 컨트롤러로 예외 전파 → NestJS 기본 500 응답
- 별도 `try/catch` 불필요 (글로벌 예외 필터가 처리)

### 5-2. Discord API 실패

| 상황 | 처리 |
|------|------|
| `editGuideMessage` 실패 (메시지 삭제됨) | `null` 반환 → 컨트롤러에서 `sendGuideMessage`로 폴백 |
| `sendGuideMessage` 실패 | 예외 전파 → 500 응답. DB는 이미 커밋 상태. 클라이언트는 재시도 가능. |
| 채널을 찾을 수 없음 (`Unknown Channel`) | 예외 전파 → 500 응답 |

Discord 실패 시 DB rollback을 하지 않는다. 이유: 설정 데이터 자체는 유효하며, 안내 메시지 재전송은 다음 저장 시 재시도되기 때문이다.

### 5-3. Redis 실패

`addTriggerChannel` 실패 → 예외 전파 → 500 응답.
봇 기동 초기화(`initTriggerSets`)는 실패해도 봇 기동 자체를 막지 않도록, 내부에서 try/catch 후 warn 로그 출력:

```typescript
// auto-channel-bootstrap.service.ts 수정
for (const [guildId, triggerChannelIds] of guildMap.entries()) {
  try {
    await this.redisRepo.initTriggerSet(guildId, triggerChannelIds);
  } catch (error) {
    this.logger.warn(`Failed to init trigger set for guild=${guildId}`, (error as Error).stack);
  }
}
```

### 5-4. JWT 인증 실패

`JwtAuthGuard`가 `UnauthorizedException`(401)을 던진다. NestJS 기본 동작.

### 5-5. DTO 유효성 검사 실패

`ValidationPipe`(전역 파이프)가 `BadRequestException`(400)을 던진다. AppModule 또는 main.ts에서 `new ValidationPipe({ transform: true })` 설정이 이미 되어 있는 것을 전제한다.

---

## 6. 기존 코드베이스 충돌 검토

| 항목 | 판단 | 근거 |
|------|------|------|
| `RedisService` 재사용 | 충돌 없음 | `@Global()` 모듈. `sadd(key, string[])` 시그니처가 이미 배열을 지원함 |
| `JwtAuthGuard` 재사용 | 충돌 없음 | `AuthModule.exports`에 포함됨. `AutoChannelModule`이 `AuthModule`을 import하면 사용 가능 |
| `AppModule` 수정 | 최소 변경 | `AutoChannelModule` 한 줄 추가만 필요 |
| `AutoChannelConfig` 엔티티 | 충돌 없음 | 엔티티 파일이 이미 존재하며, `auto-channel.module.ts`에서 `TypeOrmModule.forFeature`로 등록 |
| `DiscordModule.forFeature()` | 충돌 없음 | `VoiceChannelModule`과 동일하게 feature 방식 사용. 여러 모듈에서 독립적으로 사용 가능 |
| `DataSource` 주입 | 충돌 없음 | `VoiceChannelHistoryService`와 동일 패턴. TypeORM이 글로벌로 등록되어 있음 |
| `OnApplicationBootstrap` 순서 | 주의 필요 | `VoiceRecoveryService`도 `OnApplicationBootstrap`을 구현함. 두 서비스 간 초기화 순서 의존성 없음 (독립적) |
| `DiscordEventsModule` | 단위 D에서 수정 불필요 | 공통 모듈 문서(3-2)에서 `AutoChannelModule` import를 명시했으나, 단위 D 자체는 이벤트 핸들러를 등록하지 않으므로 `DiscordEventsModule` 수정은 단위 A/B/C에서 처리 |

---

## 7. 마이그레이션

`synchronize: false` 설정이므로 TypeORM 마이그레이션을 생성해야 한다.

**마이그레이션 파일 경로**: `apps/api/src/migrations/{timestamp}-CreateAutoChannelTables.ts`

마이그레이션에서 생성할 테이블:
- `auto_channel_config` (guildId, triggerChannelId, waitingRoomTemplate, guideMessage, guideMessageId, createdAt, updatedAt)
  - UNIQUE INDEX: `UQ_auto_channel_config_guild_trigger` (guildId, triggerChannelId)
- `auto_channel_button` (configId FK, label, emoji, targetCategoryId, sortOrder)
  - INDEX: `IDX_auto_channel_button_config` (configId)
- `auto_channel_sub_option` (buttonId FK, label, emoji, channelSuffix, sortOrder)
  - INDEX: `IDX_auto_channel_sub_option_button` (buttonId)

> 마이그레이션 파일 자체의 코드는 이 계획에서 정의하지 않는다. 엔티티 파일이 이미 완성되어 있으므로 `typeorm migration:generate`로 자동 생성할 수 있다.

---

## 8. 최종 파일 목록 요약

| 파일 | 분류 | 설명 |
|------|------|------|
| `apps/api/src/channel/auto/infrastructure/auto-channel.keys.ts` | 신규 | Redis 키 패턴 중앙화 |
| `apps/api/src/channel/auto/infrastructure/auto-channel-state.ts` | 신규 | Redis 상태 인터페이스 |
| `apps/api/src/channel/auto/infrastructure/auto-channel-redis.repository.ts` | 신규 | 자동방 Redis CRUD |
| `apps/api/src/channel/auto/infrastructure/auto-channel-config.repository.ts` | 신규 | DB 설정 저장소 (upsert 포함) |
| `apps/api/src/channel/auto/infrastructure/auto-channel-discord.gateway.ts` | 신규 | Discord API 호출 (메시지 전송/수정) |
| `apps/api/src/channel/auto/dto/auto-channel-save.dto.ts` | 신규 | 요청 DTO (class-validator 포함) |
| `apps/api/src/channel/auto/application/auto-channel-bootstrap.service.ts` | 신규 | 봇 기동 초기화 |
| `apps/api/src/channel/auto/auto-channel.controller.ts` | 신규 | REST API 컨트롤러 |
| `apps/api/src/channel/auto/auto-channel.module.ts` | 신규 | NestJS 모듈 |
| `apps/api/src/event/auto-channel/auto-channel-events.ts` | 신규 | 이벤트 상수 및 이벤트 클래스 |
| `apps/api/src/app.module.ts` | 수정 | AutoChannelModule import 추가 |
