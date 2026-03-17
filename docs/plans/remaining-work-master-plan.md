# 남은 작업 종합 계획 (Master Plan)

> 작성일: 2026-03-17
> 기준: develop 브랜치 최신 커밋

---

## 현재 상태 요약

### Bot/API 분리 진행 현황

| 항목 | 수량 | 상태 |
|------|------|------|
| 슬래시 커맨드 (`@Command`) | 14개 | Bot에 복제 완료, **API에 원본 14개 잔존** (삭제 미완) |
| `@On` 이벤트 핸들러 | 2개 | API에 유지 (AutoChannel, StatusPrefix — 과도기) |
| `@InjectDiscordClient` adapter | 18개 | API에 유지 (장기 이동 대상) |
| `DiscordModule.forRootAsync()` | 1개 | API app.module.ts에 유지 |
| Bot 이벤트 핸들러 | 6개 | voice, newbie(2), sticky-message, channel, status-prefix |
| Bot 슬래시 커맨드 | 14개 | version, voice-flush, music(3), sticky(3), voice-analytics(5), me |
| bot-api 엔드포인트 | ~15개 | voice, newbie, sticky-message, voice-analytics, me |

---

## 작업 카테고리별 분류

### A. Bot/API 분리 완성 (아키텍처)

남은 단계를 우선순위별로 정리한다.

#### A-1. API 슬래시 커맨드 파일 삭제 (낮음)

Bot에 이미 14개 모두 복제되었으므로 API 원본 삭제만 하면 된다.

| 파일 | 모듈 수정 |
|------|----------|
| `voice-analytics/presentation/commands/*.command.ts` (4개) | `voice-analytics.module.ts` — 이미 제거됨 |
| `voice-analytics/self-diagnosis/presentation/self-diagnosis.command.ts` | `voice-analytics.module.ts` — 이미 제거됨 |
| `music/presentation/commands/*.command.ts` (3개) | `music.module.ts` — 제거 필요 |
| `channel/voice/application/me.command.ts` | `voice-channel.module.ts` — 이미 제거됨 |
| `channel/voice/application/voice-flush.command.ts` | `voice-channel.module.ts` — 제거 필요 |
| `version/version.command.ts` | `version.module.ts` — 제거 필요 |
| `sticky-message/command/*.command.ts` (3개) | `sticky-message.module.ts` — 이미 제거됨 |

**작업:**
1. 모듈에서 커맨드 provider 제거 (music, version, voice-flush)
2. 파일 삭제
3. `discord.config.ts`의 `commands` 배열 정리 (이미 비어있을 수 있음)

#### A-2. AutoChannel/StatusPrefix 인터랙션 Bot 이동 (높음)

현재 API에서 `@On('interactionCreate')`로 처리 중. API에 `DiscordModule`이 유지되는 이유 중 하나.

| 핸들러 | 현재 위치 | 전략 |
|--------|----------|------|
| `AutoChannelInteractionHandler` | `event/auto-channel/` | Bot에서 인터랙션 수신 → API에 버튼 정보 전달 → 결과로 채널 생성/응답 |
| `StatusPrefixInteractionHandler` | `status-prefix/interaction/` | **이미 Bot에 `bot-status-prefix-interaction.handler.ts` 존재** — API 제거만 필요 |

**StatusPrefix:** Bot 핸들러가 이미 존재하므로 API 모듈에서 핸들러 등록 해제 + 파일 삭제.

**AutoChannel:** 복잡함. `autoChannelService.handleButtonClick(interaction)`이 `ButtonInteraction` 객체로 직접 채널 생성 + 응답한다.
- Bot에서 인터랙션 수신
- API에 `POST /bot-api/auto-channel/button-click` (customId, guildId, userId, channelId)
- API가 비즈니스 로직 처리 (DB 조회, 설정 확인)
- API 응답에 "채널 생성 요청" 포함 → Bot이 채널 생성 + interaction.reply()
- 또는: API가 Discord REST API로 직접 채널 생성 (Bot 토큰 불필요, API 자체 토큰 사용) → 현재 과도기이므로 API에 유지

**결론:** AutoChannel은 과도기에 API 유지, StatusPrefix는 Bot으로 완전 이동.

#### A-3. Discord Adapter 18개 → Bot/REST API 전환 (매우 높음)

API에서 Discord Gateway를 완전 제거하기 위한 최대 작업. 두 가지 전략:

**전략 1: Bot에서 Discord 작업 수행 (권장)**
- API가 "이 Embed를 이 채널에 보내줘" → Bot에 요청
- Bot이 Discord API 호출
- 단점: Bot → API → Bot 왕복, 복잡한 콜백 구조

**전략 2: Discord REST API 직접 호출 (대안)**
- API가 Bot Token으로 Discord REST API 직접 호출 (Gateway 불필요)
- `discord.js`의 `REST` 클래스 사용 또는 직접 HTTP 호출
- 장점: 단순함, Bot 의존 없음
- 단점: Gateway 캐시 미사용, Rate Limit 직접 관리

**전략 3: 과도기 유지 (현재)**
- API에 `DiscordModule.forRootAsync()` 유지
- Adapter가 Discord Client 사용
- 장점: 동작 보장
- 단점: 두 프로세스가 Discord Gateway에 이중 연결

**권장:** Phase 4(레포 분리) 전까지 전략 3 유지. 레포 분리 시 전략 2로 전환.

#### A-4. CoPresence/Monitoring 스케줄러 → Bot 이동 (높음)

| 스케줄러 | Discord 사용 | 전략 |
|---------|-------------|------|
| `CoPresenceScheduler` | `guilds.cache` 폴링 (60초) | Bot에서 실행, 결과를 API로 전달 |
| `MonitoringScheduler` | `ws.status`, `guilds.cache` | Bot에서 실행, 메트릭을 API로 전달 |

#### A-5. GuildInfoController Discord 의존 제거 (중간)

- 현재: `@InjectDiscordClient` → `guilds.cache.get(guildId)`
- 전환: Discord REST API 직접 호출 또는 Bot에 조회 위임

#### A-6. DiscordModule.forRootAsync() 최종 제거

위 A-2~A-5 모두 완료 후에만 가능.

---

### B. 기능 구현 — 페이지 플랜 (미구현)

#### B-1. 프론트엔드 UI 개선 (독립)

| # | 플랜 | 설명 | 의존성 |
|---|------|------|--------|
| 1 | `1-channel-bar-chart-category-tab` | ChannelBarChart 카테고리별 탭 | 없음 |
| 2 | `2-user-channel-pie-chart-category-tab` | UserChannelPieChart 카테고리별 탭 | 없음 |
| 3 | `3-user-history-table-category-column` | UserHistoryTable 카테고리 컬럼 | K-voice-category 완료 필요 |

#### B-2. 일반 설정 (독립)

| # | 플랜 | 설명 | 의존성 |
|---|------|------|--------|
| 4 | `1-general-backend` | 슬래시 커맨드 자동 등록 | 없음 |
| 5 | `2-general-frontend` | 일반설정 페이지 동적 렌더링 | 4 |

#### B-3. 비활동 회원 (프론트엔드만)

| # | 플랜 | 설명 | 의존성 |
|---|------|------|--------|
| 6 | `2-inactive-member-frontend` | 비활동 회원 웹 UI | 백엔드 완료됨 |

#### B-4. 신입 시스템 (대규모 — 6 유닛)

| # | 플랜 | 설명 | 의존성 |
|---|------|------|--------|
| 7 | `2-newbie-welcome` | 환영인사 기능 (Unit B) | 1-newbie-core ✅ |
| 8 | `4-newbie-moco` | 모코코 사냥 (Unit D) | 3-newbie-mission ✅ |
| 9 | `5-newbie-role` | 신입기간 역할 관리 (Unit E) | 4-newbie-moco |
| 10 | `6-newbie-web` | 신입 웹 대시보드 (Unit F) | 5-newbie-role |
| 11 | `13-newbie-play-count-backend` | 플레이횟수 카운팅 (BE) | 3-newbie-mission ✅ |
| 12 | `14-newbie-play-count-frontend` | 플레이횟수 카운팅 (FE) | 11 |

#### B-5. 상태 접두사 (프론트엔드만)

| # | 플랜 | 설명 | 의존성 |
|---|------|------|--------|
| 13 | `8-status-prefix-interaction` | 인터랙션 (Unit B) | 7-core ✅ |
| 14 | `9-status-prefix-web` | 웹 설정 (Unit C) | 13 |

#### B-6. 자동방 (4 유닛)

| # | 플랜 | 설명 | 의존성 |
|---|------|------|--------|
| 15 | `A-trigger-waiting` | 트리거 + 대기방 (Unit A) | 없음 |
| 16 | `B-button-interaction` | 버튼 인터랙션 (Unit B) | 15 |
| 17 | `C-channel-delete` | 채널 삭제 (Unit C) | 16 |
| 18 | `D-web-api-bootstrap` | 웹 설정 API (Unit D) | 17 |

#### B-7. 고정메세지 (프론트엔드만)

| # | 플랜 | 설명 | 의존성 |
|---|------|------|--------|
| 19 | `F-sticky-message-web` | 고정메세지 웹 설정 | 백엔드/커맨드 ✅ |

#### B-8. 음성 관련

| # | 플랜 | 설명 | 의존성 |
|---|------|------|--------|
| 20 | `E-voice-commands` | Voice 커맨드 확장 | 없음 |
| 21 | `G-voice-excluded-channel-backend` | 제외 채널 (BE) | 없음 |
| 22 | `H-voice-settings-web` | 음성 설정 (FE) | 21 |
| 23 | `K-voice-category` | 카테고리 정보 추가 | 없음 (일부 완료) |
| 24 | `L-voice-analytics-improvement` | AI 분석 모듈 개선 | 없음 |

#### B-9. 유저 상세

| # | 플랜 | 설명 | 의존성 |
|---|------|------|--------|
| 25 | `J-user-detail-backend` | 유저 상세 API | I-voice-daily ✅ |
| 26 | `J-user-detail-frontend` | 유저 상세 UI | 25 |

#### B-10. 기타

| # | 플랜 | 설명 | 의존성 |
|---|------|------|--------|
| 27 | `I-auto-versioning` | 자동 시맨틱 버저닝 | 없음 |

---

### C. 아키텍처 리팩토링 (top-level 플랜)

| # | 플랜 | 상태 | 비고 |
|---|------|------|------|
| 1 | `premium-service-architecture.md` | Phase 1~3 완료 | Phase 4(레포 분리), 5(프리미엄) 남음 |
| 2 | `bot-api-responsibility-split.md` | 참조 문서 | 삭제 대상 아님 |
| 3 | `bot-api-gap-fix.md` | 완료 | voice/auto-channel/status-prefix/newbie 복구 |
| 4 | `codebase-commonization.md` | 미착수 | 코드 통합 |
| 5 | `eslint-quality-improvement.md` | 미착수 | ESLint 규칙 강화 |
| 6 | `eslint-warning-elimination.md` | 미착수 | 경고 제거 |
| 7 | `llm-abstraction-and-directory-move.md` | 미착수 | LLM 추상화 |
| 8 | `co-presence-analytics-backend.md` | 미착수 | 동시접속 분석 |
| 9 | `co-presence-dashboard-frontend.md` | 미착수 | 동시접속 대시보드 |
| 10 | `hhi-diversity-score-ux.md` | 미착수 | HHI 다양성 점수 UX |
| 11 | `self-diagnosis-badge-and-settings.md` | 미착수 | 자가진단 뱃지/설정 |
| 12 | `self-diagnosis-core.md` | 미착수 | 자가진단 코어 |
| 13 | `sidebar-settings-adjustment.md` | 미착수 | 사이드바 설정 |
| 14 | `overview-page.md` | 미착수 | 개요 페이지 |
| 15 | `voice-co-presence-refactoring.md` | 미착수 | CoPresence 리팩토링 |

---

## 권장 실행 순서

### Phase 즉시 (Bot/API 정리)

```
1. API 슬래시 커맨드 14개 파일 삭제 + 모듈 정리          [A-1] ~30분
2. StatusPrefix @On 핸들러 API에서 제거                  [A-2] ~15분
   (Bot에 이미 존재하므로 삭제만)
3. discord.config.ts commands 배열 정리                  [B-2.4] ~10분
```

### Phase 단기 (독립 기능)

```
4. 프론트엔드 UI 3종 (차트 탭, 테이블 카테고리)            [B-1] 독립
5. 비활동 회원 프론트엔드                                 [B-3] 독립
6. 고정메세지 웹 설정                                     [B-7] 독립
7. K-voice-category 완성                                 [B-8.23] 독립
8. 유저 상세 페이지 (BE + FE)                             [B-9] I-daily ✅
```

### Phase 중기 (도메인 기능)

```
9.  환영인사 (Unit B)                                    [B-4.7]
10. 모코코 사냥 (Unit D)                                 [B-4.8]
11. 신입기간 역할 (Unit E)                               [B-4.9]
12. 신입 웹 대시보드 (Unit F)                             [B-4.10]
13. 상태 접두사 인터랙션 + 웹                             [B-5]
14. 자동방 4유닛 (A→D)                                   [B-6]
15. 음성 설정 (제외채널 BE + 설정 FE)                     [B-8.21-22]
```

### Phase 장기 (아키텍처)

```
16. AutoChannel 인터랙션 Bot 이동                        [A-2]
17. Discord Adapter → REST API 전환                      [A-3]
18. CoPresence/Monitoring 스케줄러 Bot 이동              [A-4]
19. GuildInfoController Discord 제거                      [A-5]
20. DiscordModule.forRootAsync() 최종 제거                [A-6]
21. Public/Private 레포 분리                              [Phase 4]
22. 프리미엄 기능 인프라                                   [Phase 5]
```

### Phase 품질 (병행 가능)

```
23. ESLint 경고 제거                                      [C.6]
24. LLM 추상화                                           [C.7]
25. 코드 통합                                             [C.4]
26. AI 분석 개선                                          [B-8.24]
27. 자동 버저닝                                           [B-10.27]
```
