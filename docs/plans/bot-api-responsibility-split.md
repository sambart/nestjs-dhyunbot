# Bot / API 책임 분리 명세

## 핵심 원칙

| 프로세스 | 책임 | Discord 연결 |
|---------|------|-------------|
| **Bot** | Discord 이벤트 수신, Discord API 응답(메시지/Embed/역할/채널), 슬래시 커맨드 등록·응답, 음악 재생 | Gateway 연결 O |
| **API** | 비즈니스 로직, DB/Redis CRUD, 데이터 분석, 스케줄러(Cron), 웹 대시보드 REST API | Gateway 연결 X (최종 목표) |

**판단 기준:** Discord.js 네이티브 객체(`ButtonInteraction`, `GuildMember`, `VoiceState`, `CommandInteraction`)가 필요한 코드는 **Bot**, DB/Redis 조회·저장이 핵심인 코드는 **API**.

---

## 1. Discord 이벤트 — Bot 담당

Bot이 수신하고, 필요 시 API를 HTTP로 호출한다.

| Discord 이벤트 | Bot 핸들러 | API 호출 | 비고 |
|---------------|-----------|---------|------|
| `voiceStateUpdate` | `BotVoiceStateDispatcher` | `POST /bot-api/voice/state-update` | 전체 VoiceState 데이터 전달 → API 리스너가 서비스 호출 |
| `guildMemberAdd` | `BotNewbieMemberAddHandler` | `GET /bot-api/newbie/config` + `POST /bot-api/newbie/member-join` + `POST /bot-api/newbie/role-assigned` | 환영인사·역할은 Bot 직접 처리 |
| `messageCreate` | `BotStickyMessageHandler` | `POST /bot-api/sticky-message/message-created` | 디바운스는 API에서 처리 |
| `channelCreate/Delete/Update` | `BotChannelStateHandler` | 없음 | 로깅만 |
| `interactionCreate` (newbie) | `BotNewbieInteractionHandler` | `POST /bot-api/newbie/mission-refresh` 등 | 이미 Bot에서 처리 중 |
| `interactionCreate` (auto-channel) | **Bot으로 이동 필요** | 신규 API 엔드포인트 필요 | 현재 API에서 `@On` 사용 중 |
| `interactionCreate` (status-prefix) | **Bot으로 이동 필요** | 없음 (Bot에서 직접 처리) | 현재 API에서 `@On` 사용 중 |

### 미이동 인터랙션 핸들러 (2개)

| 핸들러 | 현재 위치 | 서비스 호출 | 이동 전략 |
|--------|----------|-----------|----------|
| `AutoChannelInteractionHandler` | API `event/auto-channel/` | `autoChannelService.handleButtonClick(interaction)` | Bot에서 인터랙션 수신 → API 엔드포인트로 버튼 정보 전달 → API가 채널 생성 등 처리 → 결과를 Bot이 `interaction.reply()` |
| `StatusPrefixInteractionHandler` | API `status-prefix/interaction/` | `applyService.apply(interaction)`, `resetService.reset(interaction)` | Bot에서 인터랙션 수신 → 닉네임 변경은 Bot 직접 처리, Redis 원래닉네임 조회는 API 호출 |

---

## 2. 슬래시 커맨드 — Bot 담당

모든 `@Command`/`@Handler`는 `CommandInteraction`을 직접 사용하므로 Bot에서 처리한다.

| 명령어 | 현재 위치 (API) | 이동 전략 |
|--------|---------------|----------|
| `/voice-stats`, `/my-voice-stats`, `/voice-leaderboard`, `/community-health` | voice-analytics/commands/ | Bot에서 API 데이터 조회 → Embed 렌더링 → `interaction.reply()` |
| `/self-diagnosis` | voice-analytics/self-diagnosis/ | 동일 |
| `/me` | channel/voice/application/ | Bot에서 API 데이터 조회 → 프로필 카드 렌더링 |
| `/voice-flush` | channel/voice/application/ | Bot에서 API `POST /bot-api/voice/flush` 호출 |
| `/play`, `/skip`, `/stop` | music/presentation/commands/ | Bot에서 직접 처리 (discord-player는 Bot 전용) |
| `/version` | version/ | Bot에서 직접 처리 (단순 응답) |
| `/고정메세지등록`, `/고정메세지삭제`, `/고정메세지목록` | sticky-message/command/ | Bot에서 API 호출 → 응답 |

---

## 3. 비즈니스 로직 — API 담당

API가 처리하며, Discord API 호출이 필요한 경우 API 내 adapter를 통해 수행한다.

### 3-1. Bot에서 HTTP로 호출되는 로직

| API 엔드포인트 | 서비스 | 역할 |
|--------------|--------|------|
| `POST /bot-api/voice/state-update` | `BotVoiceEventListener` → `VoiceChannelService` | 음성 추적 (join/leave/move/mic/alone/auto-channel) |
| `POST /bot-api/newbie/member-join` | `MissionService.createMissionFromBot()` | 미션 생성 |
| `GET /bot-api/newbie/config` | `NewbieConfigRepository` | 설정 조회 |
| `POST /bot-api/newbie/role-assigned` | `NewbiePeriodRepository` | 역할 부여 기록 |
| `POST /bot-api/newbie/mission-refresh` | `MissionService.invalidateAndRefresh()` | 미션 Embed 갱신 |
| `GET /bot-api/newbie/moco-rank` | `MocoService.buildRankPayload()` | 모코코 순위 데이터 |
| `GET /bot-api/newbie/moco-my` | `MocoService.buildMyHuntingMessage()` | 내 사냥 시간 |
| `POST /bot-api/sticky-message/message-created` | `StickyMessageRefreshService` | 디바운스 + 고정메세지 갱신 |

### 3-2. API 내부에서 Discord API를 호출하는 로직 (Adapter 패턴)

현재 API에 `DiscordModule.forRootAsync()`가 유지되어 있어 adapter들이 Discord Client를 사용한다. **최종 분리 시 이 adapter들은 Bot으로 이동하거나 API에서 Bot의 Discord REST API를 통해 호출한다.**

| Adapter | Discord API 호출 | 사용처 |
|---------|-----------------|--------|
| `MissionDiscordPresenter` | Embed 전송/수정 | 미션 현황 Embed 갱신 |
| `MissionDiscordActionService` | 역할 부여, DM+강퇴, 멤버 조회 | 미션 성공/실패 처리 |
| `MocoDiscordPresenter` | Embed 전송/수정, displayName 조회 | 모코코 순위 Embed |
| `StickyMessageDiscordAdapter` | 메시지 전송/삭제 | 고정메세지 갱신 |
| `StatusPrefixDiscordAdapter` | 닉네임 변경, 메시지 전송 | 접두사 적용/제거/설정 |
| `InactiveMemberDiscordAdapter` | 멤버 강퇴, DM, 역할 | 비활동 회원 관리 |
| `NewbieRoleDiscordAdapter` | 역할 제거 | 신입기간 만료 |
| `MocoMemberDiscordAdapter` | 채널 멤버 조회 | 모코코 사냥 판별 |

### 3-3. 스케줄러 — API 담당 (Discord 캐시 읽기 필요)

| 스케줄러 | Discord 사용 | 분리 전략 |
|---------|-------------|----------|
| `CoPresenceScheduler` | `guilds.cache`, `channels.cache`, `members` 폴링 | **Bot으로 이동** (60초 주기 음성 채널 스캔은 Discord Gateway 필요) |
| `MissionScheduler` | 없음 (DB만) | API 유지 |
| `MocoResetScheduler` | 없음 (Redis만) | API 유지 |
| `NewbieRoleScheduler` | adapter 통해 역할 제거 | API 유지 (adapter가 Discord 호출) |
| `InactiveMemberScheduler` | adapter 통해 길드 ID 조회 | API 유지 |
| `MonitoringScheduler` | `ws.status`, `guilds.cache` 읽기 | **Bot으로 이동** |

### 3-4. 웹 대시보드 REST API — API 담당

| 컨트롤러 | Discord 사용 | 비고 |
|---------|-------------|------|
| `GuildInfoController` | `@InjectDiscordClient` — 채널/역할/이모지 조회 | **Bot으로 이동 또는 API에서 Discord REST API 직접 호출** |
| 나머지 컨트롤러 | adapter 통해 간접 사용 또는 미사용 | API 유지 |

---

## 4. 현재 과도기 구조

```
┌─────────────────────────────────────────────────────────┐
│ Bot Process (apps/bot)                                  │
│                                                          │
│ Discord Gateway 연결                                     │
│ ├── @On('voiceStateUpdate')     → API HTTP 호출           │
│ ├── @On('guildMemberAdd')       → API HTTP 호출 + 직접 처리│
│ ├── @On('messageCreate')        → API HTTP 호출           │
│ ├── @On('channelCreate/Delete') → 로깅만                  │
│ ├── @On('interactionCreate')    → newbie 버튼만 처리       │
│ └── (미이동: auto-channel, status-prefix 인터랙션)         │
└─────────────────────────────────────────────────────────┘
          │ HTTP
          ▼
┌─────────────────────────────────────────────────────────┐
│ API Process (apps/api)                                  │
│                                                          │
│ Discord Gateway 연결 (과도기 — 최종 제거 대상)              │
│ ├── bot-api/ 엔드포인트 (Bot → API)                       │
│ ├── BotVoiceEventListener (voice 서비스 호출)              │
│ ├── @On('interactionCreate') — auto-channel (미이동)      │
│ ├── @On('interactionCreate') — status-prefix (미이동)     │
│ ├── @Command — 14개 슬래시 커맨드 (미이동)                 │
│ ├── Discord adapter들 (Embed 전송, 역할 관리 등)           │
│ ├── 스케줄러 (CoPresence, Monitoring — 미이동)             │
│ ├── 비즈니스 로직 (서비스 계층)                             │
│ ├── DB/Redis                                             │
│ └── 웹 대시보드 REST API                                  │
└─────────────────────────────────────────────────────────┘
```

## 5. 최종 목표 구조

```
┌─────────────────────────────────────────────────────────┐
│ Bot Process                                              │
│                                                          │
│ Discord Gateway 연결 (유일한 연결점)                       │
│ ├── 모든 @On 이벤트 핸들러                                 │
│ ├── 모든 @Command 슬래시 커맨드                            │
│ ├── 모든 인터랙션 핸들러                                   │
│ ├── 음악 모듈 (discord-player)                            │
│ ├── CoPresence/Monitoring 스케줄러                        │
│ ├── Embed 렌더링 (Presenter 역할)                         │
│ └── BotApiClient (API HTTP 호출)                          │
└─────────────────────────────────────────────────────────┘
          │ HTTP only
          ▼
┌─────────────────────────────────────────────────────────┐
│ API Process                                              │
│                                                          │
│ Discord Gateway 연결 X                                    │
│ ├── bot-api/ 엔드포인트                                   │
│ ├── 웹 대시보드 REST API                                  │
│ ├── 비즈니스 로직 (서비스 계층)                             │
│ ├── DB/Redis CRUD                                        │
│ ├── AI 분석 (Gemini)                                      │
│ ├── 스케줄러 (DB 기반만)                                   │
│ └── 프리미엄/과금 (향후)                                   │
└─────────────────────────────────────────────────────────┘
```

## 6. 남은 이동 작업 목록

### 즉시 이동 (API에서 @On 제거)

| # | 대상 | 현재 위치 | 이동 대상 | 난이도 |
|---|------|----------|----------|--------|
| 1 | AutoChannelInteractionHandler | API event/auto-channel/ | Bot event/auto-channel/ | 높음 (API 엔드포인트 필요) |
| 2 | StatusPrefixInteractionHandler | API status-prefix/interaction/ | Bot event/status-prefix/ | 중간 (닉네임 변경은 Bot, Redis는 API) |

### 점진적 이동 (슬래시 커맨드)

| # | 대상 | 난이도 | 이유 |
|---|------|--------|------|
| 3 | 음악 커맨드 3개 | 낮음 | discord-player는 Bot 전용 |
| 4 | /version | 낮음 | 단순 응답 |
| 5 | /voice-flush | 낮음 | API 호출 1개 |
| 6 | 고정메세지 커맨드 3개 | 중간 | API 호출 필요 |
| 7 | voice-analytics 커맨드 5개 | 높음 | AI 분석 + Embed 렌더링 |
| 8 | /me | 높음 | 프로필 카드 렌더링 |

### 장기 이동 (API Discord 완전 제거)

| # | 대상 | 난이도 | 이유 |
|---|------|--------|------|
| 9 | Discord adapter들 → Bot으로 이동 | 매우 높음 | 모든 Embed 전송/역할 관리를 Bot에서 처리 |
| 10 | CoPresence/Monitoring 스케줄러 → Bot | 높음 | Discord 캐시 폴링 필요 |
| 11 | GuildInfoController → Bot 또는 Discord REST API | 중간 | 캐시 → REST API 전환 |
| 12 | `DiscordModule.forRootAsync()` 제거 | 최종 | 모든 Discord 의존 제거 후 |
