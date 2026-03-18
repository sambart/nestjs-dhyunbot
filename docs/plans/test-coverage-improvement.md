# 도메인별 테스트 커버리지 개선 계획

> 작성일: 2026-03-18
> 목표: 주요 도메인의 단위·통합 테스트를 체계적으로 확충하여 코드 신뢰성 향상

---

## 1. 현황 요약

| 도메인 | 단위 테스트 | 통합 테스트 | 커버리지 |
|--------|-----------|-----------|---------|
| Voice (channel/voice) | 4개 spec | 8개 integration-spec | **22%** |
| Inactive-Member | 1개 spec | 2개 integration-spec | 16% |
| Common | 2개 spec | - | 13% |
| Monitoring | - | 1개 integration-spec | 13% |
| Auto-Channel | - | 1개 integration-spec | 7% |
| Newbie | - | 2개 integration-spec | 4% |
| Auth | - | - | **0%** |
| Member | - | - | **0%** |
| Status-Prefix | - | - | **0%** |
| Sticky-Message | - | - | **0%** |
| Voice-Analytics | - | - | **0%** |
| Bot-API | - | - | **0%** |

### 테스트 인프라 (이미 구축됨)

- **프레임워크**: Vitest (spec.ts = 단위, integration-spec.ts = 통합)
- **통합 테스트 환경**: Testcontainers (PostgreSQL 15 + Redis 7)
- **유틸리티**: `createIntegrationModuleBuilder`, `cleanDatabase`, `cleanRedis`
- **실행 명령**: `pnpm --filter @dhyunbot/api test` / `test:integration`

---

## 2. 테스트 작성 원칙

### 2.1 단위 테스트 (*.spec.ts)

- 외부 의존성은 모두 `vi.fn()` + `Mocked<T>` 타입으로 모킹
- 테스트 데이터는 `make*()` 헬퍼 함수 + overrides 패턴
- 비즈니스 로직과 분기 조건에 집중
- Discord API, DB, Redis 호출은 모킹하되 호출 여부·인자를 검증

### 2.2 통합 테스트 (*.integration-spec.ts)

- 실제 PostgreSQL + Redis 사용 (Testcontainers)
- `createIntegrationModuleBuilder`로 NestJS 모듈 구성
- `afterEach`에서 `cleanDatabase` + `cleanRedis`로 격리
- Repository 계층과 Service 계층의 실제 상호작용 검증

### 2.3 작성 우선순위 기준

1. **비즈니스 영향도**: 사용자 대면 핵심 기능 우선
2. **버그 위험도**: 복잡한 비즈니스 로직 우선
3. **테스트 난이도**: Easy → Medium → Hard 순서로 효율적 확충
4. **기존 패턴 활용**: 이미 검증된 테스트 패턴 재사용

---

## 3. Phase별 작업 계획

### Phase 1: Easy 서비스 단위 테스트 (빠른 커버리지 확보)

난이도가 낮고 외부 의존성이 적은 서비스부터 시작하여 빠르게 커버리지를 확보한다.

#### 1-1. Member Service — `member.service.spec.ts`

| 항목 | 내용 |
|------|------|
| 대상 | `MemberService` |
| 의존성 | `Repository<Member>` (모킹) |
| 테스트 케이스 | |
| | - `findOne`: 존재하는 멤버 조회, 존재하지 않는 멤버 조회 |
| | - `findOrCreateMember`: 신규 멤버 생성, 기존 멤버 닉네임 업데이트, 아바타 업데이트, 변경 없을 때 save 미호출 |
| 예상 난이도 | Easy |

#### 1-2. Voice History Service — `voice-history.service.spec.ts`

| 항목 | 내용 |
|------|------|
| 대상 | `VoiceHistoryService` |
| 의존성 | `Repository<VoiceChannelHistoryOrm>` (모킹) |
| 테스트 케이스 | |
| | - 페이지네이션 (page, limit 적용 확인) |
| | - 날짜 범위 필터링 (from/to YYYYMMDD) |
| | - 결과 없을 때 빈 배열 반환 |
| 예상 난이도 | Easy |

#### 1-3. Voice Excluded Channel Service — `voice-excluded-channel.service.spec.ts`

| 항목 | 내용 |
|------|------|
| 대상 | `VoiceExcludedChannelService` |
| 의존성 | `VoiceExcludedChannelRepository`, `RedisService` (모킹) |
| 테스트 케이스 | |
| | - `getExcludedChannels`: Redis 캐시 히트, 캐시 미스 → DB 조회 |
| | - `saveExcludedChannel`: 정상 등록, 중복 등록 시 예외 |
| | - `deleteExcludedChannel`: 정상 삭제, 캐시 무효화 확인 |
| | - `syncExcludedChannels`: 벌크 동기화 (기존 삭제 + 재삽입) |
| | - `isExcludedChannel`: 채널 ID 매치, 카테고리 ID 매치, 미매치 |
| 예상 난이도 | Easy |

#### 1-4. Newbie Role Service — `newbie-role.service.spec.ts`

| 항목 | 내용 |
|------|------|
| 대상 | `NewbieRoleService` |
| 의존성 | `NewbiePeriodRepository`, `NewbieRedisRepository` (모킹) |
| 테스트 케이스 | |
| | - `assignRole`: 역할 부여 + DB 기록 + Redis Set 추가 |
| | - 만료일 계산 정확성 (YYYYMMDD 포맷) |
| | - Discord API 에러 시 처리 |
| 예상 난이도 | Easy |

#### 1-5. Welcome Service — `welcome.service.spec.ts`

| 항목 | 내용 |
|------|------|
| 대상 | `WelcomeService` |
| 의존성 | `DiscordRestService` (모킹) |
| 테스트 케이스 | |
| | - 환영 메시지 Embed 구성 확인 (제목, 설명, 색상) |
| | - 템플릿 변수 치환 ({username}, {mention}, {memberCount}, {serverName}) |
| | - Discord REST 호출 인자 검증 |
| 예상 난이도 | Easy |

---

### Phase 2: Medium 서비스 단위 테스트

#### 2-1. Auth Service — `auth.service.spec.ts`

| 항목 | 내용 |
|------|------|
| 대상 | `AuthService` |
| 의존성 | `JwtService` (모킹) |
| 테스트 케이스 | |
| | - `createToken`: 관리 권한 있는 길드만 필터링 (ADMINISTRATOR=0x8, MANAGE_GUILD=0x20) |
| | - JWT 페이로드 구조 확인 |
| | - 권한 없는 길드 제외 확인 |
| | - 빈 길드 목록 처리 |
| 예상 난이도 | Medium |

#### 2-2. Monitoring Service — `monitoring.service.spec.ts`

| 항목 | 내용 |
|------|------|
| 대상 | `MonitoringService` |
| 의존성 | `RedisService`, `BotMetricRepository` (모킹) |
| 테스트 케이스 | |
| | - `getStatus`: Redis 캐시 히트(Bot 상태), 캐시 미스(collectStatus 폴백) |
| | - `getMetrics`: 1m/5m/1h/1d 간격별 집계 |
| | - `fillGaps`: 누락 구간 OFFLINE 채우기 |
| | - 가용성 계산 검증 |
| 예상 난이도 | Medium |

#### 2-3. Voice Stats Query Service — `voice-stats-query.service.spec.ts`

| 항목 | 내용 |
|------|------|
| 대상 | `VoiceStatsQueryService` |
| 의존성 | `Repository<VoiceDailyOrm>`, `VoiceDailyFlushService` (모킹) |
| 테스트 케이스 | |
| | - `getUserVoiceStats`: 사용자 통계 반환 (시간, 마이크 ON/OFF) |
| | - `getGuildVoiceRank`: 길드 랭킹 반환 |
| | - 쿼리 전 flush 호출 확인, flush 에러 시에도 계속 진행 |
| | - 날짜 범위 계산 (YYYYMMDD 포맷) |
| 예상 난이도 | Medium |

#### 2-4. Moco Service — `moco.service.spec.ts`

| 항목 | 내용 |
|------|------|
| 대상 | `MocoService` |
| 의존성 | `NewbieConfigRepository`, `NewbieRedisRepository`, `MocoDiscordPresenter` (모킹) |
| 테스트 케이스 | |
| | - `buildRankPayload`: 순위 Embed + 페이지네이션 버튼 구성 |
| | - `buildMyHuntingMessage`: 개인 사냥 통계 포맷 |
| | - 페이지네이션 경계 (첫 페이지, 마지막 페이지) |
| | - 데이터 없을 때 처리 |
| 예상 난이도 | Medium |

---

### Phase 3: Hard 서비스 단위 테스트

#### 3-1. Status Prefix Apply/Reset Service — `status-prefix-apply.service.spec.ts`, `status-prefix-reset.service.spec.ts`

| 항목 | 내용 |
|------|------|
| 대상 | `StatusPrefixApplyService`, `StatusPrefixResetService` |
| 의존성 | `StatusPrefixConfigRepository`, `StatusPrefixRedisRepository`, `StatusPrefixConfigService`, `StatusPrefixDiscordAdapter` (모킹) |
| 테스트 케이스 | |
| | - `apply`: 접두사 적용 → 닉네임 변경, Redis에 원래 닉네임 저장 (NX) |
| | - `applyFromBot`: Bot 호출 시 동일 로직 |
| | - `reset`: 원래 닉네임 복원, Redis 키 삭제 |
| | - `restoreOnLeave`: 음성 채널 퇴장 시 자동 복원 |
| | - `stripPrefixFromNickname`: 정규식 기반 접두사 제거 (중첩, 특수문자 엣지 케이스) |
| 예상 난이도 | Hard |

#### 3-2. Status Prefix Config Service — `status-prefix-config.service.spec.ts`

| 항목 | 내용 |
|------|------|
| 대상 | `StatusPrefixConfigService` |
| 테스트 케이스 | |
| | - `getConfig`: Redis 캐시 히트/미스 |
| | - `saveConfig`: 설정 저장 + Discord 메시지 전송/수정 |
| | - ActionRow 페이지네이션 (5개 버튼/행 제한) |
| | - 메시지 편집 실패 시 새 전송 폴백 |
| 예상 난이도 | Hard |

#### 3-3. Sticky Message Service — `sticky-message-config.service.spec.ts`, `sticky-message-refresh.service.spec.ts`

| 항목 | 내용 |
|------|------|
| 대상 | `StickyMessageConfigService`, `StickyMessageRefreshService` |
| 테스트 케이스 | |
| | - `getConfigs`: 캐시 히트/미스 |
| | - `saveConfig`: 설정 저장 + Embed 전송/갱신 |
| | - `deleteConfig`: 설정 삭제 + Discord 메시지 삭제 |
| | - `refresh`: 고정메시지 재전송, 동시성 제어 (중복 요청 무시) |
| | - 고아 메시지 정리 (Footer 마커 기반 필터링) |
| 예상 난이도 | Hard |

#### 3-4. Inactive Member Action Service — `inactive-member-action.service.spec.ts`

| 항목 | 내용 |
|------|------|
| 대상 | `InactiveMemberActionService` |
| 의존성 | `InactiveMemberRepository`, `InactiveMemberService`, `InactiveMemberDiscordAdapter` (모킹) |
| 테스트 케이스 | |
| | - `executeAction`: 액션 타입별 분기 (DM, 역할 추가/제거, 강제퇴장) |
| | - 배치 처리 (동시성 5) 및 부분 실패 처리 |
| | - 템플릿 변수 치환 ({nickName}, {serverName}) |
| | - `executeAutoActions`: 설정 기반 자동 액션 |
| | - 액션 로그 기록 확인 |
| 예상 난이도 | Hard |

#### 3-5. Voice Recovery Service — `voice-recovery.service.spec.ts`

| 항목 | 내용 |
|------|------|
| 대상 | `VoiceRecoveryService` |
| 의존성 | `RedisService`, `VoiceRedisRepository`, `VoiceDailyFlushService`, `VoiceChannelHistoryService` (모킹) |
| 테스트 케이스 | |
| | - `onApplicationShutdown`: 세션 flush + 고아 레코드 종료 |
| | - `onAppReady`: 고아 레코드 종료 + 세션 복구 |
| | - Redis 키 스캔 및 파싱 |
| | - 부분 실패 시 나머지 세션 계속 처리 |
| 예상 난이도 | Hard |

#### 3-6. Mission Service — `mission.service.spec.ts`

| 항목 | 내용 |
|------|------|
| 대상 | `MissionService` |
| 의존성 | `NewbieMissionRepository`, `NewbieConfigRepository`, `NewbieRedisRepository`, `VoiceDailyFlushService`, `MissionDiscordPresenter`, `MissionDiscordActionService`, `Repository<VoiceDailyOrm>`, `Repository<VoiceChannelHistoryOrm>` (모킹) |
| 테스트 케이스 | |
| | - `createMission`: 미션 생성 (상태 IN_PROGRESS) |
| | - `completeMission`: 미션 성공 + 역할 부여 |
| | - `failMission`: 미션 실패 + 강제퇴장 옵션 |
| | - `getPlaytimeSec`: 기간별 플레이타임 집계 |
| | - `getPlayCount`: 최소 지속시간·간격 필터링 |
| | - `enrichMissions`: 멤버명 + 현재 플레이타임 추가 |
| | - `registerMissingMembers`: 가입일 기준 누락 멤버 등록 |
| 예상 난이도 | Hard |

#### 3-7. Voice AI Analysis Service — `voice-ai-analysis.service.spec.ts`

| 항목 | 내용 |
|------|------|
| 대상 | `VoiceAiAnalysisService` |
| 의존성 | `LlmProvider` (모킹) |
| 테스트 케이스 | |
| | - `analyzeVoiceActivity`: LLM 호출 + 프롬프트 검증 |
| | - `analyzeSpecificUser`: 특정 사용자 분석 |
| | - `calculateCommunityHealth`: 건강도 계산 |
| | - LLM 에러 시 폴백 분석 반환 |
| | - 시간 포맷팅 (초 → 시간:분) |
| 예상 난이도 | Hard |

---

### Phase 4: Repository 통합 테스트 보강

현재 미테스트인 Repository에 대해 통합 테스트를 추가한다.

| 대상 Repository | 파일명 |
|----------------|--------|
| `StatusPrefixConfigRepository` | `status-prefix-config.repository.integration-spec.ts` |
| `StatusPrefixRedisRepository` | `status-prefix-redis.repository.integration-spec.ts` |
| `StickyMessageConfigRepository` | `sticky-message-config.repository.integration-spec.ts` |
| `StickyMessageRedisRepository` | `sticky-message-redis.repository.integration-spec.ts` |
| `NewbieConfigRepository` | `newbie-config.repository.integration-spec.ts` |
| `NewbieMissionTemplateRepository` | `newbie-mission-template.repository.integration-spec.ts` |
| `NewbieMocoTemplateRepository` | `newbie-moco-template.repository.integration-spec.ts` |
| `NewbiePeriodRepository` | `newbie-period.repository.integration-spec.ts` |
| `MocoDbRepository` | `moco-db.repository.integration-spec.ts` |
| `AutoChannelRedisRepository` | `auto-channel-redis.repository.integration-spec.ts` |

각 Repository 통합 테스트는 기존 패턴을 따른다:
- `createIntegrationModuleBuilder`로 모듈 구성
- CRUD 메서드별 정상/예외 케이스
- `afterEach`에서 `cleanDatabase` / `cleanRedis`

---

### Phase 5: 서비스 통합 테스트 확충

단위 테스트에서 검증하기 어려운 DB·Redis 상호작용을 통합 테스트로 보강한다.

| 대상 Service | 파일명 | 우선순위 |
|-------------|--------|---------|
| `InactiveMemberService` (classify 로직) | `inactive-member.service.integration-spec.ts` | P1 |
| `VoiceExcludedChannelService` | `voice-excluded-channel.service.integration-spec.ts` | P2 |
| `MissionService` (플레이타임 집계) | `mission.service.integration-spec.ts` | P2 |
| `MonitoringService` (메트릭 조회) | `monitoring.service.integration-spec.ts` | P3 |

---

## 4. 작업 순서 요약

```
Phase 1 (Easy 단위 테스트)
 ├─ 1-1. MemberService
 ├─ 1-2. VoiceHistoryService
 ├─ 1-3. VoiceExcludedChannelService
 ├─ 1-4. NewbieRoleService
 └─ 1-5. WelcomeService

Phase 2 (Medium 단위 테스트)
 ├─ 2-1. AuthService
 ├─ 2-2. MonitoringService
 ├─ 2-3. VoiceStatsQueryService
 └─ 2-4. MocoService

Phase 3 (Hard 단위 테스트)
 ├─ 3-1. StatusPrefixApply/ResetService
 ├─ 3-2. StatusPrefixConfigService
 ├─ 3-3. StickyMessageService (Config + Refresh)
 ├─ 3-4. InactiveMemberActionService
 ├─ 3-5. VoiceRecoveryService
 ├─ 3-6. MissionService
 └─ 3-7. VoiceAiAnalysisService

Phase 4 (Repository 통합 테스트)
 └─ 10개 미테스트 Repository

Phase 5 (서비스 통합 테스트)
 └─ 4개 핵심 서비스
```

---

## 5. 제외 대상

아래는 현 단계에서 테스트 작성을 보류한다:

| 대상 | 사유 |
|------|------|
| Bot-API Controller (11개) | HTTP 엔드포인트 단순 위임 — 서비스 테스트로 충분 |
| Discord Gateway | Discord.js 이벤트 핸들러 — E2E 영역 |
| Health Controller | 프레임워크 제공 기능 |
| Overview Service/Controller | 단순 집계 API |
| Voice-Analytics Controller | 서비스 테스트로 커버 |
| VoiceNameEnricherService | Discord API 래핑 — 모킹 가치 낮음 |

---

## 6. 기대 효과

| 지표 | 현재 | Phase 1 후 | Phase 3 완료 후 | 전체 완료 후 |
|------|------|-----------|---------------|------------|
| 테스트 파일 수 | 26개 | 31개 | 43개 | 57개 |
| 테스트 대상 서비스 | 5개 | 10개 | 21개 | 21개+ |
| 0% 커버리지 도메인 | 11개 | 8개 | 2개 | 0개 |
