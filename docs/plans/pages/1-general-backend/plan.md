# 구현 계획: 슬래시 커맨드 자동 등록 - 백엔드

> 기능: F-GENERAL-001, F-GENERAL-002
> 대상 서비스: apps/api

---

## 1. 현황 파악

### discord.config.ts 현재 상태
- 7개 커맨드 클래스를 직접 import하여 `commands` 배열에 수동 등록하고 있다.
- discord-nestjs v5.5.1의 `DiscordModuleOption` 인터페이스에 `commands` 속성이 존재하지 않으므로, 이 배열은 라이브러리에 의해 무시된다.
- 실제 커맨드 등록은 각 모듈(`MusicModule`, `VoiceAnalyticsModule`)이 `DiscordModule.forFeature()`를 import하고, 커맨드 클래스를 `providers`에 등록함으로써 `ExplorerService`가 자동 탐색한다.
- `MusicModule`과 `VoiceAnalyticsModule` 모두 이미 올바른 구조를 갖추고 있으므로, `discord.config.ts`의 `commands` 배열과 7개 import만 제거하면 된다.

### GuildInfoController 현재 상태
- `@Controller('api/guilds/:guildId')` + `@UseGuards(JwtAuthGuard)` 클래스 레벨 적용
- `@InjectDiscordClient() private readonly client: Client` 이미 주입됨
- `getChannels`, `getRoles`, `getEmojis` 3개 엔드포인트가 동일 패턴으로 구현됨:
  1. `this.client.guilds.cache.get(guildId)` → 없으면 `[]` 반환
  2. guild에서 Discord API 데이터 fetch
  3. 필요한 필드만 map하여 반환
- 커맨드 목록 엔드포인트는 guild를 경유하지 않고 `this.client.application.commands.fetch({ guildId })`를 직접 호출하는 점이 다르다.

---

## 2. 개발 태스크 목록

### 태스크 1: discord.config.ts — commands 배열 및 import 제거 (F-GENERAL-001)

**대상 파일**: `apps/api/src/config/discord.config.ts`

**변경 내용**:
- 삭제할 import 7줄:
  ```
  import { CommunityHealthCommand } from '../gemini/commands/community-health.command';
  import { MyVoiceStatsCommand } from '../gemini/commands/my-voice-stats.command';
  import { VoiceLeaderboardCommand } from '../gemini/commands/voice-leaderboard.command';
  import { VoiceStatsCommand } from '../gemini/commands/voice-stats.command';
  import { MusicPlayCommand } from '../music/music-play.command';
  import { MusicSkipCommand } from '../music/music-skip.command';
  import { MusicStopCommand } from '../music/music-stop.command';
  ```
- 삭제할 `commands` 배열 (useFactory 반환 객체 내):
  ```
  commands: [
    MusicPlayCommand,
    MusicStopCommand,
    MusicSkipCommand,
    VoiceStatsCommand,
    MyVoiceStatsCommand,
    CommunityHealthCommand,
    VoiceLeaderboardCommand,
  ],
  ```
- 유지할 속성: `token`, `discordClientOptions`, `registerCommandOptions`, `failOnLogin`

**충돌 검토**: `MusicModule`과 `VoiceAnalyticsModule`은 이미 `DiscordModule.forFeature()` + `providers` 배열을 통해 커맨드를 등록하고 있다. `commands` 배열 제거 후에도 자동 탐색이 그대로 동작하므로 기능 변화 없음.

---

### 태스크 2: GuildInfoController — getCommands 엔드포인트 추가 (F-GENERAL-002)

**대상 파일**: `apps/api/src/gateway/guild-info.controller.ts`

**추가할 메서드**:

```typescript
@Get('commands')
async getCommands(
  @Param('guildId') guildId: string,
) {
  try {
    const commands = await this.client.application?.commands.fetch({ guildId });
    if (!commands) return [];

    return commands.map((cmd) => ({
      id: cmd.id,
      name: cmd.name,
      description: cmd.description,
    }));
  } catch {
    return [];
  }
}
```

**설계 근거**:
- `this.client`는 이미 생성자에 `@InjectDiscordClient()`로 주입되어 있으므로 추가 DI 불필요.
- `client.application`은 봇 로그인 완료 후 non-null이지만, optional chaining(`?.`)으로 방어 처리하여 null인 경우에도 `[]` 반환.
- `commands.fetch({ guildId })`는 `Collection<Snowflake, ApplicationCommand>`를 반환한다. `.map()`으로 id, name, description만 추출.
- try/catch에서 에러 발생 시(봇이 해당 길드에 없는 경우, Discord API 오류 등) `[]` 반환. PRD F-GENERAL-002 오류 처리 요건 충족.
- 기존 `getChannels`, `getRoles`, `getEmojis`는 `@Query('refresh')` 파라미터를 받아 캐시 갱신을 선택하지만, 커맨드 목록은 Discord API 등록 상태를 매번 실시간 조회해야 하므로 refresh 파라미터 불필요.
- `@UseGuards(JwtAuthGuard)`는 클래스 레벨에 이미 적용되어 있으므로 메서드에 별도 가드 불필요.
- Logger를 사용하는 코드가 컨트롤러에 없으므로, 에러 로깅이 필요하다면 Logger를 생성자에서 선언하거나 catch에서 `console.error`를 사용할 수 있으나, 기존 컨트롤러 스타일이 Logger를 사용하지 않으므로 무음 처리(`[]` 반환)로 일관성 유지.

**모듈 변경 없음**: `gateway.module.ts`는 `GuildInfoController`를 이미 `controllers`에 등록하고 있으므로 변경 불필요.

**충돌 검토**: 기존 `getChannels`, `getRoles`, `getEmojis`와 경로 중복 없음. `GET /api/guilds/:guildId/commands`는 신규 경로.

---

## 3. 최종 변경 파일 목록

| 파일 | 변경 유형 | 변경 내용 요약 |
|------|-----------|---------------|
| `apps/api/src/config/discord.config.ts` | 수정 | import 7줄 및 commands 배열 제거 |
| `apps/api/src/gateway/guild-info.controller.ts` | 수정 | `getCommands` 메서드 추가 |

변경이 없는 파일:
- `apps/api/src/gateway/gateway.module.ts` — 변경 없음
- `apps/api/src/music/music.module.ts` — 변경 없음
- `apps/api/src/gemini/voice-analytics.module.ts` — 변경 없음

---

## 4. 구현 순서

1. `discord.config.ts` 수정: import 7줄 + commands 배열 제거
2. `guild-info.controller.ts` 수정: `getCommands` 메서드 추가
3. 로컬 서버 기동 후 확인:
   - 봇 로그인 정상 완료
   - `GET /api/guilds/:guildId/commands` 에 JWT 토큰 포함 요청 시 커맨드 배열 반환
   - Discord 서버에서 슬래시 커맨드 `/play`, `/skip`, `/stop`, `/voice-stats`, `/my-voice-stats`, `/community-health`, `/voice-leaderboard` 7개 정상 등록 확인
