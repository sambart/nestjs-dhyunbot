# Unit B: 환영인사 (F-NEWBIE-001) — 구현 계획

## 개요

Unit B는 디스코드 서버에 신규 멤버가 가입했을 때 환영 Embed 메시지를 전송하는 기능이다.
Unit A(백엔드 코어 모듈)가 완성된 이후 이 단위를 독립적으로 구현한다.

## 구현 범위

| 파일 | 역할 |
|------|------|
| `apps/api/src/newbie/newbie.gateway.ts` | `guildMemberAdd` 이벤트 수신 — 세 서비스(Welcome/Mission/Role)로 분기하는 진입점 |
| `apps/api/src/newbie/welcome/welcome.service.ts` | 환영 Embed 생성, 템플릿 변수 치환, 채널 전송 |

---

## 전제 조건 (Unit A 완성 필요)

Unit B 착수 전에 다음이 모두 존재해야 한다.

| 파일 | 역할 |
|------|------|
| `apps/api/src/newbie/infrastructure/newbie-cache.keys.ts` | `NewbieKeys.config()` 키 생성 함수 |
| `apps/api/src/newbie/infrastructure/newbie-redis.repository.ts` | `getConfig`, `setConfig` 메서드 |
| `apps/api/src/newbie/infrastructure/newbie-config.repository.ts` | `findByGuildId` 메서드 |
| `apps/api/src/newbie/newbie.module.ts` | `WelcomeService` provider 등록 슬롯 |
| `apps/api/src/newbie/domain/newbie-config.entity.ts` | 이미 존재 (수정 없음) |

---

## 구현 상세

### 1. `newbie.gateway.ts`

**경로**: `apps/api/src/newbie/newbie.gateway.ts`

**역할**: `@On('guildMemberAdd')` 데코레이터로 Discord.js 이벤트를 수신한다. `WelcomeService`, `MissionService`, `NewbieRoleService` 세 서비스를 순서대로 호출하는 진입점이다. 각 호출은 개별 `try-catch`로 격리하여 하나가 실패해도 나머지가 계속 실행된다.

**코드 구조**:

```typescript
import { On } from '@discord-nestjs/core';
import { Injectable, Logger } from '@nestjs/common';
import { GuildMember } from 'discord.js';

import { NewbieConfigRepository } from './infrastructure/newbie-config.repository';
import { NewbieRedisRepository } from './infrastructure/newbie-redis.repository';
import { MissionService } from './mission/mission.service';
import { NewbieRoleService } from './role/newbie-role.service';
import { WelcomeService } from './welcome/welcome.service';

@Injectable()
export class NewbieGateway {
  private readonly logger = new Logger(NewbieGateway.name);

  constructor(
    private readonly configRepo: NewbieConfigRepository,
    private readonly newbieRedis: NewbieRedisRepository,
    private readonly welcomeService: WelcomeService,
    private readonly missionService: MissionService,
    private readonly newbieRoleService: NewbieRoleService,
  ) {}

  @On('guildMemberAdd')
  async handleMemberJoin(member: GuildMember): Promise<void> {
    const guildId = member.guild.id;

    // 1. Redis 우선 조회, 미스 시 DB 조회 후 캐시 저장
    let config = await this.newbieRedis.getConfig(guildId);
    if (!config) {
      config = await this.configRepo.findByGuildId(guildId);
      if (!config) return;
      await this.newbieRedis.setConfig(guildId, config);
    }

    // 2. 각 기능을 개별 try-catch로 격리하여 순서대로 실행
    if (config.welcomeEnabled) {
      try {
        await this.welcomeService.sendWelcomeMessage(member, config);
      } catch (error) {
        this.logger.error(
          `[WELCOME] Failed: guild=${guildId} member=${member.id}`,
          (error as Error).stack,
        );
      }
    }

    if (config.missionEnabled) {
      try {
        await this.missionService.createMission(member, config);
      } catch (error) {
        this.logger.error(
          `[MISSION] Failed: guild=${guildId} member=${member.id}`,
          (error as Error).stack,
        );
      }
    }

    if (config.roleEnabled) {
      try {
        await this.newbieRoleService.assignRole(member, config);
      } catch (error) {
        this.logger.error(
          `[ROLE] Failed: guild=${guildId} member=${member.id}`,
          (error as Error).stack,
        );
      }
    }
  }
}
```

**의존성**:
- `@discord-nestjs/core`의 `@On` 데코레이터 — `VoiceStateDispatcher`와 동일한 패턴
- `NewbieConfigRepository.findByGuildId` — DB 조회
- `NewbieRedisRepository.getConfig` / `setConfig` — Redis 캐시 우선 조회
- `WelcomeService`, `MissionService`, `NewbieRoleService` — 각 기능 서비스

**충돌 검토**:
- `VoiceStateDispatcher`와 동일하게 `@On` 데코레이터를 사용하며, `DiscordEventsModule`의 providers에 등록된다. Unit A에서 이미 이 등록이 수행된다.
- Unit C(MissionService), Unit E(NewbieRoleService)가 구현되기 전이라도 이 파일은 생성 가능하다. 미구현 서비스를 참조하는 경우 임시로 주입 없이 `if`문 내부를 `// TODO: Unit C` 주석으로 처리하거나, Unit A에서 gateway 전체를 함께 생성하면 충돌 없다. 이 파일은 Unit A 범위에 포함되며 Unit B는 `WelcomeService`만 추가로 구현한다.

---

### 2. `welcome/welcome.service.ts`

**경로**: `apps/api/src/newbie/welcome/welcome.service.ts`

**역할**: `NewbieGateway`로부터 `GuildMember`와 `NewbieConfig`를 받아 환영 Embed를 구성하고 지정된 채널에 전송한다. 오류 발생 시 로그 기록 후 예외를 상위로 전파한다(게이트웨이의 try-catch가 처리).

**메서드 시그니처**:

```typescript
async sendWelcomeMessage(member: GuildMember, config: NewbieConfig): Promise<void>
```

**처리 흐름**:

1. `config.welcomeChannelId` 존재 여부 확인 — 없으면 즉시 반환
2. Discord Client로 채널 fetch — 실패 시 warn 로그 후 반환
3. 채널이 텍스트 채널인지 확인 (`channel.isTextBased()`)
4. 템플릿 변수 치환 (`applyTemplate` private 메서드 호출)
5. `EmbedBuilder`로 Embed 구성
6. 채널에 Embed 전송

**코드 구조**:

```typescript
import { InjectDiscordClient } from '@discord-nestjs/core';
import { Injectable, Logger } from '@nestjs/common';
import { Client, EmbedBuilder, GuildMember, TextChannel } from 'discord.js';

import { NewbieConfig } from '../domain/newbie-config.entity';

@Injectable()
export class WelcomeService {
  private readonly logger = new Logger(WelcomeService.name);

  constructor(
    @InjectDiscordClient() private readonly client: Client,
  ) {}

  async sendWelcomeMessage(member: GuildMember, config: NewbieConfig): Promise<void> {
    if (!config.welcomeChannelId) {
      this.logger.debug(`[WELCOME] welcomeChannelId not set: guild=${member.guild.id}`);
      return;
    }

    const channel = await this.client.channels.fetch(config.welcomeChannelId).catch(() => null);
    if (!channel || !channel.isTextBased()) {
      this.logger.warn(
        `[WELCOME] Channel not found or not text-based: channelId=${config.welcomeChannelId} guild=${member.guild.id}`,
      );
      return;
    }

    const username = member.displayName;
    const memberCount = member.guild.memberCount;
    const serverName = member.guild.name;

    const title = config.welcomeEmbedTitle
      ? this.applyTemplate(config.welcomeEmbedTitle, username, memberCount, serverName)
      : null;

    const description = config.welcomeEmbedDescription
      ? this.applyTemplate(config.welcomeEmbedDescription, username, memberCount, serverName)
      : null;

    const embed = new EmbedBuilder();

    if (title) embed.setTitle(title);
    if (description) embed.setDescription(description);
    if (config.welcomeEmbedColor) embed.setColor(config.welcomeEmbedColor as `#${string}`);
    if (config.welcomeEmbedThumbnailUrl) embed.setThumbnail(config.welcomeEmbedThumbnailUrl);

    await (channel as TextChannel).send({ embeds: [embed] });

    this.logger.log(
      `[WELCOME] Sent welcome message: guild=${member.guild.id} member=${member.id} channel=${config.welcomeChannelId}`,
    );
  }

  /**
   * 템플릿 변수 치환.
   * {username} → 서버 닉네임, {memberCount} → 서버 전체 멤버 수, {serverName} → 서버명
   */
  private applyTemplate(
    template: string,
    username: string,
    memberCount: number,
    serverName: string,
  ): string {
    return template
      .replace(/\{username\}/g, username)
      .replace(/\{memberCount\}/g, String(memberCount))
      .replace(/\{serverName\}/g, serverName);
  }
}
```

**의존성**:
- `@InjectDiscordClient()` — `AutoChannelDiscordGateway`, `DiscordVoiceGateway`와 동일한 패턴
- `discord.js`의 `EmbedBuilder`, `GuildMember`, `TextChannel`, `Client`
- `NewbieConfig` 엔티티 (이미 존재)

**충돌 검토**:
- 이 서비스는 다른 어떤 Unit의 파일도 참조하지 않는다. `NewbieConfig` 엔티티와 Discord Client만 의존하므로 완전히 독립적이다.
- `@InjectDiscordClient()`를 사용하는 패턴은 `AutoChannelDiscordGateway`에서 이미 검증됐다. `NewbieModule`에 `DiscordModule.forFeature()`가 import되어야 한다(Unit A에서 처리).

---

## 설계 판단

### templateVariables: 정규식 replace vs split-join

PRD의 변수(`{username}`, `{memberCount}`, `{serverName}`)는 하나의 템플릿에 중복 등장할 수 있다. `String.replace()`의 첫 번째 인수에 정규식(`/g` 플래그)을 사용하여 모든 등장 위치를 치환한다. `AutoChannelService.applyTemplate`은 단순 `string.replace()`(첫 번째만 치환)를 사용하지만, 환영 메시지는 템플릿 자유도가 더 높으므로 전역 치환이 적합하다.

### EmbedBuilder 색상 타입

`discord.js`의 `EmbedBuilder.setColor()`는 `ColorResolvable` 타입을 받는다. DB에는 `#5865F2` 형식의 HEX 문자열로 저장되므로 `` `#${string}` `` 타입 캐스팅이 필요하다. 잘못된 색상 코드가 입력된 경우 `discord.js`가 런타임 오류를 던지며, 게이트웨이의 try-catch가 이를 포착한다.

### 채널 타입 검증: `isTextBased()` 사용

`isTextBased()`는 `TextChannel`, `DMChannel`, `NewsChannel`, `ThreadChannel`, `VoiceChannel`(텍스트도 가능) 등을 포함한다. `channel.isTextBased()`가 `true`이면 `.send()` 메서드가 존재하므로 `TextChannel`로 타입 단언하여 전송한다.

### 오류 처리 전략

`WelcomeService`는 예외를 직접 catch하지 않는다. 채널 fetch 실패와 채널 타입 불일치는 warn 로그 후 조기 반환으로 처리한다. `send()` 실패(봇 권한 부족 등)는 예외가 `NewbieGateway`의 try-catch로 전파되어 error 로그로 기록된다. 이 방식은 단일 책임 원칙을 유지하면서 PRD의 "오류 처리: 조용히 실패" 요건을 만족한다.

---

## 파일 변경 목록

### 신규 생성 (Unit B 담당)

| 파일 | 설명 |
|------|------|
| `apps/api/src/newbie/welcome/welcome.service.ts` | 환영 Embed 생성 및 전송 서비스 |

### 신규 생성 (Unit A 담당 — 충돌 주의)

| 파일 | 설명 |
|------|------|
| `apps/api/src/newbie/newbie.gateway.ts` | guildMemberAdd 이벤트 핸들러 진입점 |

### 수정 없음

- `apps/api/src/newbie/domain/newbie-config.entity.ts` — 이미 존재, 수정 불필요
- `apps/api/src/newbie/newbie.module.ts` — Unit A에서 `WelcomeService` provider 등록 슬롯 포함

---

## 구현 순서

1. Unit A가 완성되어 `NewbieModule`, `NewbieConfigRepository`, `NewbieRedisRepository`, `newbie.gateway.ts` 스켈레톤이 존재하는 상태를 확인한다.
2. `apps/api/src/newbie/welcome/welcome.service.ts`를 작성한다.
3. `newbie.module.ts`의 providers에 `WelcomeService`가 등록되어 있는지 확인한다(Unit A 결과물).
4. NestJS 빌드(`pnpm build` 또는 `tsc --noEmit`)로 타입 오류가 없는지 검증한다.
5. `guildMemberAdd` 이벤트를 수동으로 트리거하여 환영 채널에 Embed가 전송되는지 확인한다.

---

## 검증 체크리스트

- [ ] `welcomeEnabled = false` 시 채널 전송이 발생하지 않는다
- [ ] `welcomeChannelId = null` 시 warn 로그 없이 조용히 반환된다
- [ ] `{username}`, `{memberCount}`, `{serverName}` 세 변수가 모두 올바르게 치환된다
- [ ] 동일 변수가 템플릿에 여러 번 등장해도 모두 치환된다
- [ ] 채널 fetch 실패 시 warn 로그가 기록되고 프로세스가 중단되지 않는다
- [ ] 봇 권한 부족으로 `send()`가 실패해도 다른 서비스(Mission, Role) 실행에 영향이 없다
- [ ] `welcomeEmbedColor`가 `null`이면 Embed 색상이 설정되지 않는다
- [ ] `welcomeEmbedThumbnailUrl`이 `null`이면 썸네일이 설정되지 않는다
- [ ] `GuildMember.displayName`이 서버 닉네임 우선, 없으면 전역 닉네임을 반환한다(discord.js 기본 동작)
