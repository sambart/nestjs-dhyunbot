# Self-Diagnosis 도메인 PRD

> 변경이력: [prd-changelog.md](../../archive/prd-changelog.md)

## 개요

디스코드 서버 멤버가 `/자가진단` 슬래시 커맨드로 자신의 음성 활동 건강도를 스스로 정량 진단하는 도메인이다. 활동량·관계 다양성(HHI 지수)·모코코 기여도·참여 패턴을 서버 내 순위/백분위와 함께 확인하고, 관리자가 설정한 길드 정책 기준 대비 충족 여부를 판정받는다. 기준을 충족하는 멤버에게는 뱃지가 부여되어 `/me` 프로필 카드에 인라인 pill 형태로 표시된다.

이 도메인은 기존 `gemini/` 모듈을 `voice-analytics/`로 리팩토링하는 과정(T-SD-001, T-SD-002)을 포함하며, LLM 호출 로직을 제공자 교체 가능한 추상 인터페이스(`LlmProvider`)로 분리한다.

## 관련 모듈

- `apps/api/src/voice-analytics/` — 리팩토링된 AI 음성 분석 모듈 (기존 `gemini/`)
  - `llm/llm-provider.interface.ts` — LLM 추상 인터페이스
  - `llm/gemini-llm.provider.ts` — Gemini SDK 구현체
  - `llm/llm.module.ts` — LLM 모듈
  - `voice-ai-analysis.service.ts` — 프롬프트 빌딩 + LLM 위임 (기존 `VoiceGeminiService`)
  - `voice-analytics.service.ts` — 데이터 집계 엔진
  - `voice-analytics.controller.ts` — REST API 엔드포인트
  - `commands/` — 기존 슬래시 커맨드 4종
  - `self-diagnosis/` — 자가진단 + 뱃지 서브 모듈
- `apps/api/src/channel/voice/application/` — `/me` 프로필 카드 수정 대상
- `apps/web/app/settings/guild/[guildId]/voice-health/` — 웹 설정 페이지

## 아키텍처

```
[관리자: 웹 대시보드 /settings/guild/{guildId}/voice-health]
    │  POST /api/guilds/:guildId/voice-health/config
    ▼
[VoiceHealthConfigRepository] ── upsert ──► voice_health_config (DB)

[BadgeScheduler] ← 매일 00:30 KST (Cron)
    │
    ├──► VoiceHealthConfig 조회 (isEnabled=true 길드 전체)
    ├──► VoiceDaily 집계 (활동량 순위)
    ├──► VoiceCoPresencePairDaily 집계 (HHI 계산)
    ├──► MocoHuntingDaily 집계 (모코코 순위)
    └──► BadgeService.judgeAll() → voice_health_badge upsert

[멤버: Discord /자가진단 커맨드]
    │
    ├──► Redis 쿨다운 체크 (voice-health:cooldown:{guildId}:{userId})
    ├──► SelfDiagnosisService.diagnose()
    │       ├── VoiceDaily → 활동량, 활동일, 순위, 백분위
    │       ├── VoiceCoPresencePairDaily → HHI, 교류 인원, 상위 3명
    │       ├── MocoHuntingDaily → 사냥 점수, 순위, 백분위
    │       ├── VoiceDaily(GLOBAL) → 마이크 사용률, 혼자 비율
    │       ├── VoiceHealthConfig → 정책 기준 대비 판정
    │       └── (선택) LlmProvider → AI 종합 진단
    └──► Ephemeral Embed 렌더링

[멤버: Discord /me 커맨드]
    │
    └──► VoiceHealthBadge 조회 → ProfileCardRenderer 뱃지 pill 렌더링
```

---

## 기능 상세

### F-SD-001: LLM 추상화 레이어 신설

**티켓**: T-SD-001
**유형**: refactor

`VoiceGeminiService`에서 LLM 호출 로직을 분리하여 제공자 교체 가능한 추상 인터페이스를 만든다.

#### 인터페이스 정의

```typescript
interface LlmProvider {
  generateText(prompt: string, options?: LlmOptions): Promise<string>;
}
interface LlmOptions {
  temperature?: number;
  maxOutputTokens?: number;
}
```

#### 변경 내용

1. `LlmProvider` 인터페이스를 `llm/llm-provider.interface.ts`에 정의한다.
2. `GeminiLlmProvider` 구현체를 `llm/gemini-llm.provider.ts`에 작성한다. 기존 `VoiceGeminiService`의 Gemini SDK 호출, 재시도 로직, 모델 설정을 이 파일로 이동한다. `@google/generative-ai` 의존은 이 파일에만 존재한다.
3. `VoiceGeminiService`를 `VoiceAiAnalysisService`로 이름 변경한다. 프롬프트 구성 로직만 남기고 LLM 호출은 `LlmProvider`에 위임한다. 기존 3개 메서드(`analyzeVoiceActivity`, `analyzeSpecificUser`, `calculateCommunityHealth`)의 프롬프트 빌딩 로직은 그대로 유지한다.
4. `LlmModule`을 `llm/llm.module.ts`에 생성하고 `LLM_PROVIDER` 토큰으로 `GeminiLlmProvider`를 기본 등록한다.
5. 기존 기능(`/voice-stats`, `/community-health`, `/my-voice-stats`, `/voice-leaderboard`)이 정상 동작해야 한다.

#### 파일 변경 계획

| 작업 | 파일 |
|------|------|
| 신규 | `voice-analytics/llm/llm-provider.interface.ts` |
| 신규 | `voice-analytics/llm/gemini-llm.provider.ts` |
| 신규 | `voice-analytics/llm/llm.module.ts` |
| 수정 | `voice-gemini.service.ts` → `voice-ai-analysis.service.ts` |
| 수정 | `voice-analytics.module.ts` |
| 수정 | `commands/*.command.ts` (import 경로 변경) |

---

### F-SD-002: gemini 모듈 디렉토리 이동

**티켓**: T-SD-002
**유형**: refactor
**선행**: F-SD-001

모듈 디렉토리명을 LLM 제공자에 종속되지 않는 이름으로 변경한다.

#### 변경 내용

1. `apps/api/src/gemini/` → `apps/api/src/voice-analytics/` 디렉토리를 이동한다.
2. `VoiceAnalyticsModule` 클래스명은 그대로 유지한다.
3. `AppModule`의 import 경로를 수정한다.
4. 모든 내부·외부 import 경로를 일괄 변경한다.
5. 기존 REST 엔드포인트 경로(`/voice-analytics`)는 변경하지 않는다.

#### 최종 디렉토리 구조

```
apps/api/src/voice-analytics/
├── llm/
│   ├── llm-provider.interface.ts
│   ├── gemini-llm.provider.ts
│   └── llm.module.ts
├── commands/
│   ├── voice-stats.command.ts
│   ├── community-health.command.ts
│   ├── my-voice-stats.command.ts
│   └── voice-leaderboard.command.ts
├── dto/
│   └── voice-analytics-query.dto.ts
├── self-diagnosis/
│   ├── domain/
│   │   ├── voice-health-config.entity.ts
│   │   └── voice-health-badge.entity.ts
│   ├── self-diagnosis.service.ts
│   ├── self-diagnosis.command.ts
│   ├── self-diagnosis.controller.ts
│   ├── self-diagnosis.types.ts
│   ├── hhi-calculator.ts
│   ├── badge.service.ts
│   ├── badge.scheduler.ts
│   └── voice-health-config.repository.ts
├── voice-ai-analysis.service.ts
├── voice-analytics.service.ts
├── voice-analytics.controller.ts
├── voice-name-enricher.service.ts
└── voice-analytics.module.ts
```

---

### F-SD-003: VoiceHealthConfig 엔티티 및 정책 설정 API

**티켓**: T-SD-003
**유형**: feat
**선행**: F-SD-002

길드별 자가진단 정책을 저장하는 엔티티와 웹 대시보드용 CRUD API를 만든다.

#### 데이터 모델: `voice_health_config`

| 컬럼 | 타입 | 제약조건 | 기본값 | 설명 |
|------|------|----------|--------|------|
| `id` | `int` | PK, AUTO_INCREMENT | — | 내부 ID |
| `guildId` | `varchar` | UNIQUE, NOT NULL | — | 디스코드 서버 ID |
| `isEnabled` | `boolean` | NOT NULL | `false` | 자가진단 기능 활성화 |
| `analysisDays` | `int` | NOT NULL | `30` | 분석 기간 (일). 7~90 |
| `isCooldownEnabled` | `boolean` | NOT NULL | `true` | 쿨다운 활성화 여부. `false`이면 쿨다운 없이 무제한 사용 가능 |
| `cooldownHours` | `int` | NOT NULL | `24` | 실행 쿨다운 (시간). 1~168. `isCooldownEnabled=false`이면 무시됨 |
| `isLlmSummaryEnabled` | `boolean` | NOT NULL | `false` | AI 종합 진단 포함 여부. `true`이면 LLM 결과만 표시, `false`이면 상세 데이터 표시 |
| `minActivityMinutes` | `int` | NOT NULL | `600` | 활동량 기준: 최소 총 활동 시간(분) |
| `minActiveDaysRatio` | `decimal(3,2)` | NOT NULL | `0.50` | 활동량 기준: 최소 활동일 비율 (0.00~1.00) |
| `hhiThreshold` | `decimal(3,2)` | NOT NULL | `0.30` | 관계 다양성 기준: HHI 편중도 경고 임계값 (0.00~1.00). DB 저장값은 HHI 원본(0~1), UI에서는 `관계 다양성 점수 = (1 - HHI) × 100`으로 변환 표시 |
| `minPeerCount` | `int` | NOT NULL | `3` | 관계 다양성 기준: 최소 교류 인원 수 |
| `badgeActivityTopPercent` | `int` | NOT NULL | `10` | 활동왕 뱃지: 상위 N% (1~100) |
| `badgeSocialHhiMax` | `decimal(3,2)` | NOT NULL | `0.25` | 사교왕 뱃지: HHI 상한 (0.00~1.00). DB 저장값은 HHI 원본(0~1), UI에서는 `관계 다양성 점수 = (1 - HHI) × 100`으로 변환 표시 |
| `badgeSocialMinPeers` | `int` | NOT NULL | `5` | 사교왕 뱃지: 최소 교류 인원 |
| `badgeHunterTopPercent` | `int` | NOT NULL | `10` | 헌터 뱃지: 모코코 사냥 상위 N% (1~100) |
| `badgeConsistentMinRatio` | `decimal(3,2)` | NOT NULL | `0.80` | 꾸준러 뱃지: 최소 활동일 비율 (0.00~1.00) |
| `badgeMicMinRate` | `decimal(3,2)` | NOT NULL | `0.70` | 소통러 뱃지: 최소 마이크 사용률 (0.00~1.00) |
| `createdAt` | `timestamp` | NOT NULL | `now()` | 생성일 |
| `updatedAt` | `timestamp` | NOT NULL | `now()` | 수정일 |

**인덱스**: `UNIQUE(guildId)`

#### API 엔드포인트

| Method | Path | 설명 |
|--------|------|------|
| `GET` | `/api/guilds/:guildId/voice-health/config` | 정책 설정 조회 |
| `POST` | `/api/guilds/:guildId/voice-health/config` | 정책 설정 저장 (upsert) |

- 인증: `JwtAuthGuard` + 서버 관리 권한
- 캐시: `VoiceHealthConfigRepository`는 Redis 캐시 + DB 조회 전략을 사용한다.

---

### F-SD-004: 자가진단 데이터 수집 및 진단 로직

**티켓**: T-SD-004
**유형**: feat
**선행**: F-SD-003

개인 음성 활동 데이터를 수집하고, 서버 내 순위·백분위를 계산하며, HHI 편중도 지수를 산출하고, 정책 기준 대비 판정을 수행하는 서비스를 만든다.

#### 진단 항목

| 카테고리 | 수집 데이터 | 데이터 소스 | 판정 기준 (VoiceHealthConfig) |
|----------|------------|------------|------------------------------|
| 활동량 | 총 시간, 활동일, 일평균, 순위, 백분위 | `VoiceDaily` | `minActivityMinutes`, `minActiveDaysRatio` |
| 관계 다양성 | 교류 인원 수, HHI 지수, 상위 3명 비율 | `VoiceCoPresencePairDaily` | `hhiThreshold`, `minPeerCount` |
| 모코코 기여 | 사냥 점수, 순위, 백분위, 도움준 신입 수 | `MocoHuntingDaily` | (뱃지 기준만 적용) |
| 참여 패턴 | 마이크 사용률, 혼자 비율 | `VoiceDaily` (GLOBAL) | (뱃지 기준만 적용) |

#### HHI (Herfindahl-Hirschman Index) 계산

```
HHI = Σ(si²)
  si = 특정 peer와의 동시접속 시간 / 전체 동시접속 시간

예: A와 50분, B와 30분, C와 20분 (합계 100분)
  HHI = (0.5)² + (0.3)² + (0.2)² = 0.25 + 0.09 + 0.04 = 0.38

범위: 0(완전 분산) ~ 1(한 명에 집중)
데이터소스: VoiceCoPresencePairDaily에서 (guildId, userId) 기준 peer별 SUM(minutes) 조회
```

#### 관계 다양성 점수 변환

HHI는 낮을수록 좋은 값이므로 사용자가 직관적으로 이해할 수 있도록 **표시 레이어에서만** 점수로 변환한다. DB 저장값은 HHI 원본(0~1)을 유지한다.

```
diversityScore = Math.round((1 - hhi) * 100)

예: HHI 0.38 → 관계 다양성 점수 62점
    HHI 0.30 → 관계 다양성 점수 70점 (기본 임계값)
    HHI 0.20 → 관계 다양성 점수 80점

범위: 0점(한 명에 집중) ~ 100점(완전 분산). 높을수록 좋음.
구현 위치: hhi-calculator.ts의 hhiToDiversityScore() 유틸 함수
```

| 프리셋 | 다양성 점수 | HHI 환산값 | 최소 교류 인원 | 설명 |
|--------|------------|-----------|--------------|------|
| 느슨 | 50점 | 0.50 | 2명 | 소규모 서버, 편중 허용 |
| 보통 | 70점 | 0.30 | 3명 | 일반적인 기준 (기본값) |
| 엄격 | 80점 | 0.20 | 5명 | 다양한 교류를 강하게 권장 |

#### 순위·백분위 계산

- **활동량 순위**: `VoiceDaily`에서 기간 내 `SUM(channelDurationSec)` 기준 전체 사용자 순위
- **모코코 순위**: `MocoHuntingDaily`에서 기간 내 `SUM(score)` 기준 순위
- **백분위**: `(순위 / 전체 인원) × 100` — 상위 N%

#### 쿨다운

- Redis 키: `voice-health:cooldown:{guildId}:{userId}`
- TTL: `cooldownHours` (VoiceHealthConfig 설정값)
- 커맨드 실행 시 키 존재 확인 → 존재하면 남은 시간 안내 후 거부

#### 진단 결과 인터페이스

```typescript
SelfDiagnosisResult {
  // 활동량
  totalMinutes: number
  activeDays: number
  totalDays: number           // analysisDays
  activeDaysRatio: number     // 0~1
  avgDailyMinutes: number
  activityRank: number
  activityTotalUsers: number
  activityTopPercent: number

  // 관계 다양성
  peerCount: number
  hhiScore: number            // 0~1
  topPeers: Array<{ userId: string; userName: string; minutes: number; ratio: number }>

  // 모코코 기여
  mocoScore: number
  mocoRank: number
  mocoTotalUsers: number
  mocoTopPercent: number
  mocoHelpedNewbies: number

  // 참여 패턴
  micUsageRate: number        // 0~1
  aloneRatio: number          // 0~1

  // 정책 판정
  verdicts: Array<{
    category: string
    isPassed: boolean
    criterion: string         // "최소 10시간"
    actual: string            // "42시간 30분"
  }>

  // 뱃지
  badges: Badge[]
  badgeGuides: Array<{
    code: BadgeCode
    name: string
    icon: string
    isEarned: boolean
    criterion: string    // "활동 상위 10% 이내"
    current: string      // "현재 상위 15.4%"
  }>

  // LLM 요약 (선택)
  llmSummary?: string
}
```

---

### F-SD-005: /자가진단 슬래시 커맨드 및 Embed 렌더링

**티켓**: T-SD-005
**유형**: feat
**선행**: F-SD-004

`/자가진단` 슬래시 커맨드를 등록하고, 진단 결과를 Ephemeral Embed로 렌더링한다.

#### 커맨드 사양

| 항목 | 값 |
|------|-----|
| name | `self-diagnosis` |
| nameLocalizations | `{ ko: '자가진단' }` |
| description | `내 음성 활동을 진단합니다` |
| defaultMemberPermissions | 없음 (모든 멤버 사용 가능) |
| 응답 | Ephemeral (본인만 보임) |

#### Embed 구조

**모드 A: AI 요약 OFF (`isLlmSummaryEnabled=false`) — 상세 데이터 표시**

```
Title: 🩺 음성 활동 자가진단
Color: Blurple (#5B8DEF)

📊 **활동량**
총 42시간 30분 | 활동일 22/30일 (73.3%)
일평균 1시간 56분 | 서버 8위 / 52명 (상위 15.4%)
✅ 활동량: 2550분 (기준: 600분 이상)
✅ 활동 일수: 73% (기준: 활동일 비율 50% 이상)

👥 **관계 다양성**
교류 인원: 12명 | 관계 다양성: 82점 / 100
주요 교류: 유저A (11시간, 22.0%), 유저B (9시간, 18.0%), 유저C (7시간, 14.0%)
✅ 관계 다양성: 82점 (기준: 70점 이상)
✅ 교류 인원: 12명 (기준: 3명 이상)

🌱 **모코코 기여**
점수: 250점 | 5위 / 30명 (상위 16.7%)
도움준 신입 (연인원): 3명

🎵 **참여 패턴**
마이크 사용률: 78.0% | 혼자 보낸 시간: 8.0%

🏅 **보유 뱃지**
🔥 활동왕  📅 꾸준러  🎤 소통러

📋 **뱃지 달성 가이드**
🌐 사교왕 — 다양성 75점 이상 & 교류 5명 이상 (현재 82점, 12명)
🌱 헌터 — 모코코 기여 상위 10% 이내 (현재 상위 16.7%)

Footer: 📅 분석 기간: 최근 30일 · 다음 진단 가능: 24시간 후
```

**모드 B: AI 요약 ON (`isLlmSummaryEnabled=true`) — LLM 결과만 표시**

```
Title: 🩺 음성 활동 자가진단
Color: Blurple (#5B8DEF)

💬 **AI 종합 진단**
활동량과 관계 다양성 모두 양호한 편이에요! 🎉
다만 모코코 기여 순위가 상위 16.7%로, 헌터 뱃지(상위 10%)까지 조금 더 노력하면
달성할 수 있을 것 같아요. 신입 멤버들과 함께 음성 채널에서 시간을 보내보세요! 🌱

🏅 **보유 뱃지**
🔥 활동왕  📅 꾸준러  🎤 소통러

📋 **뱃지 달성 가이드**
🌐 사교왕 — 다양성 75점 이상 & 교류 5명 이상 (현재 82점, 12명)
🌱 헌터 — 모코코 기여 상위 10% 이내 (현재 상위 16.7%)

Footer: 📅 분석 기간: 최근 30일 · 다음 진단 가능: 24시간 후
```

**LLM 프롬프트 구조** (AI 요약 ON 시):

프롬프트에는 활동량/관계 다양성/모코코 기여/참여 패턴/정책 준수 현황/뱃지 달성 현황을 모두 포함하여 LLM이 정책 대비 위험도와 개선 방향을 구체적으로 제시할 수 있도록 한다. 작성 지침으로 4~5문장, 미달 항목 개선 방향, 미달성 뱃지 달성 팁 제시를 요구한다.

#### 오류 처리

| 상황 | 응답 |
|------|------|
| 기능 비활성화 | "이 서버에서 자가진단 기능이 활성화되지 않았습니다." |
| 쿨다운 중 | "다음 진단은 {남은시간} 후에 가능합니다." |
| 활동 데이터 없음 | "최근 {N}일간 음성 활동 기록이 없습니다." |
| Co-Presence 데이터 없음 | 관계 다양성 섹션을 "데이터 부족"으로 표시 |
| LLM 실패 | AI 종합 진단 섹션 생략, 나머지 정상 표시 |
| LLM 할당량 초과 (429) | `LlmQuotaExhaustedException` — 후원 유도 Embed 표시 ("AI 진단 엔진이 지쳐버렸어요...") |

---

### F-SD-006: 뱃지 시스템 (엔티티 + 스케줄러 + 서비스)

**티켓**: T-SD-006
**유형**: feat
**선행**: F-SD-003

매일 자정 스케줄러가 전체 멤버의 뱃지 자격을 배치 계산하여 DB에 저장한다.

#### 데이터 모델: `voice_health_badge`

| 컬럼 | 타입 | 제약조건 | 설명 |
|------|------|----------|------|
| `id` | `int` | PK, AUTO_INCREMENT | 내부 ID |
| `guildId` | `varchar` | NOT NULL | 디스코드 서버 ID |
| `userId` | `varchar` | NOT NULL | 멤버 디스코드 ID |
| `badges` | `json` | NOT NULL, DEFAULT `[]` | 보유 뱃지 코드 배열 (예: `["ACTIVITY","CONSISTENT"]`) |
| `activityRank` | `int` | NULLABLE | 활동량 순위 |
| `activityTopPercent` | `decimal(5,2)` | NULLABLE | 활동량 상위 % |
| `hhiScore` | `decimal(4,3)` | NULLABLE | HHI 지수 |
| `mocoRank` | `int` | NULLABLE | 모코코 순위 |
| `mocoTopPercent` | `decimal(5,2)` | NULLABLE | 모코코 상위 % |
| `micUsageRate` | `decimal(4,3)` | NULLABLE | 마이크 사용률 |
| `activeDaysRatio` | `decimal(3,2)` | NULLABLE | 활동일 비율 |
| `calculatedAt` | `timestamp` | NOT NULL | 마지막 계산 시각 |
| `createdAt` | `timestamp` | NOT NULL | 생성일 |
| `updatedAt` | `timestamp` | NOT NULL | 수정일 |

**인덱스**:
- `UQ_voice_health_badge_guild_user` — `UNIQUE(guildId, userId)`
- `IDX_voice_health_badge_guild_badges` — `(guildId)` — 길드별 뱃지 조회

#### 뱃지 코드 및 판정 기준

| 코드 | 이름 | 아이콘 | 판정 기준 |
|------|------|--------|----------|
| `ACTIVITY` | 활동왕 | 🔥 | 활동량 상위 `badgeActivityTopPercent`% 이내 |
| `SOCIAL` | 사교왕 | 🌐 | HHI ≤ `badgeSocialHhiMax` AND 교류 인원 ≥ `badgeSocialMinPeers` |
| `HUNTER` | 헌터 | 🌱 | 모코코 점수 상위 `badgeHunterTopPercent`% 이내 |
| `CONSISTENT` | 꾸준러 | 📅 | 활동일 비율 ≥ `badgeConsistentMinRatio` |
| `MIC` | 소통러 | 🎤 | 마이크 사용률 ≥ `badgeMicMinRate` |

#### 스케줄러 동작

- **실행 시각**: 매일 00:30 KST (Co-Presence 세션 정리(00:00 KST) 이후)
- **처리 순서**:
  1. `isEnabled=true`인 모든 길드의 `VoiceHealthConfig` 조회
  2. 길드별로:
     a. `VoiceDaily`에서 기간 내 전체 사용자 활동량 순위 산출
     b. `VoiceCoPresencePairDaily`에서 기간 내 전체 사용자 HHI 산출
     c. `MocoHuntingDaily`에서 기간 내 전체 사용자 점수 순위 산출
     d. `VoiceDaily` GLOBAL에서 마이크 사용률, 활동일 비율 산출
     e. 각 사용자별 뱃지 자격 판정
     f. `voice_health_badge` 테이블에 일괄 upsert
  3. 처리 건수 로그 출력

---

### F-SD-007: /me 프로필 카드 뱃지 표시

**티켓**: T-SD-007
**유형**: feat
**선행**: F-SD-006

`/me` 프로필 카드 헤더에 보유 뱃지를 pill 형태로 렌더링한다.

#### 변경 사항

1. **MeProfileService** (`me-profile.service.ts`):
   - `voice_health_badge` 테이블에서 해당 사용자의 뱃지 조회
   - `MeProfileData` 인터페이스에 `badges: string[]` 필드 추가 (예: `["ACTIVITY","CONSISTENT"]`)

2. **ProfileCardRenderer** (`profile-card-renderer.ts`):
   - `drawHeader()`에 뱃지 전용 행 렌더링 로직 추가
   - 뱃지 위치: 사용자명/부제 아래, 디바이더 위에 **별도 행**으로 배치
   - 뱃지 형태: 작은 pill (둥근 사각형 배경 + 아이콘 + 텍스트)
   - 최대 표시 개수: 4개 (초과 시 우선순위 순으로 잘라냄)
   - 뱃지가 없으면 기존과 동일하게 렌더링 (별도 행 미표시)

#### 뱃지 우선순위 (좌→우 표시 순서)

1. ACTIVITY (활동왕)
2. SOCIAL (사교왕)
3. HUNTER (헌터)
4. CONSISTENT (꾸준러)
5. MIC (소통러)

#### 뱃지 pill 스타일

| 코드 | 배경색 | 텍스트 색 |
|------|--------|----------|
| ACTIVITY | `#FEF3C7` | `#92400E` |
| SOCIAL | `#DBEAFE` | `#1E40AF` |
| HUNTER | `#D1FAE5` | `#065F46` |
| CONSISTENT | `#E0E7FF` | `#3730A3` |
| MIC | `#FCE7F3` | `#9D174D` |

#### 렌더링 예시

```
[Avatar]  사용자명
          최근 15일 음성 활동
[🔥활동왕] [📅꾸준러] [🎤소통러]
──────────────────────────────
```

#### 레이아웃 제약

- 캔버스 기본 높이 650px, 뱃지 유무에 따라 +18px 동적 조정
- 뱃지가 있으면 디바이더가 18px 아래로 이동하고, 하위 요소(랭크카드, 스탯카드, 바차트, 푸터)에 `badgeOffset` 적용
- 뱃지가 없으면 기존 레이아웃과 동일

---

### F-SD-008: 웹 대시보드 자가진단 정책 설정 페이지

**티켓**: T-SD-008
**유형**: feat
**선행**: F-SD-003

관리자가 웹 대시보드에서 자가진단 정책과 뱃지 기준을 설정할 수 있는 페이지를 만든다.

#### 페이지 경로

`/settings/guild/[guildId]/voice-health`

#### UI 구성

**섹션 1: 기본 설정**

| UI 요소 | 설명 |
|---------|------|
| 기능 활성화 토글 | 자가진단 기능 ON/OFF |
| 분석 기간 입력 (숫자) | 진단 시 분석할 기간 (일). 7~90, 기본 30 |
| 쿨다운 활성화 토글 | 쿨다운 ON/OFF. OFF이면 무제한 사용 가능 |
| 쿨다운 시간 입력 (숫자) | 재실행 대기 시간 (시간). 1~168, 기본 24. 쿨다운 비활성화 시 숨김 |
| AI 요약 활성화 토글 | LLM 종합 진단 포함 여부. ON이면 LLM 결과만 표시, OFF이면 상세 데이터 표시 |

**섹션 2: 정책 기준**

| UI 요소 | 설명 |
|---------|------|
| 최소 활동 시간 입력 | 기준 충족 판정: 최소 총 활동 시간 (분). 기본 600 |
| 최소 활동일 비율 슬라이더 | 기준 충족 판정: 최소 활동일/분석기간 비율. 0~100%, 기본 50% |
| 관계 다양성 점수 슬라이더 | 관계 편중도 경고 기준. 0~100점(높을수록 다양), 기본 70점. 저장 시 `hhiThreshold = (100 - score) / 100`으로 역변환하여 DB에 HHI 원본값 저장. 프리셋 버튼 3개(느슨 50점 / 보통 70점 / 엄격 80점) 제공 |
| 최소 교류 인원 입력 | 관계 다양성 기준: 최소 교류 인원 수. 기본 3 |

**섹션 3: 뱃지 기준**

| UI 요소 | 설명 |
|---------|------|
| 활동왕 기준 입력 | 음성 활동량 상위 N%. 1~100, 기본 10 |
| 사교왕 다양성 점수 슬라이더 | 관계 다양성 점수가 이 값 이상일 때 부여. 0~100점, 기본 75점. 저장 시 `badgeSocialHhiMax = (100 - score) / 100`으로 역변환하여 DB에 HHI 원본값 저장 |
| 사교왕 최소 인원 입력 | 교류 인원이 이 수 이상일 때 부여. 기본 5 |
| 헌터 기준 입력 | 모코코 사냥 상위 N%. 1~100, 기본 10 |
| 꾸준러 비율 슬라이더 | 활동일 비율이 이 값 이상일 때 부여. 0~100%, 기본 80% |
| 소통러 비율 슬라이더 | 마이크 사용률이 이 값 이상일 때 부여. 0~100%, 기본 70% |

**공통**: 저장 버튼, 저장 성공/실패 토스트 알림

#### 사이드바

기존 `DashboardSidebar`에 "자가진단 설정" 메뉴 항목 추가.

---

## 데이터 모델 요약

| 엔티티 | 테이블 | 역할 |
|--------|--------|------|
| `VoiceHealthConfig` | `voice_health_config` | 길드별 자가진단 정책 + 뱃지 임계값 |
| `VoiceHealthBadge` | `voice_health_badge` | 사용자별 보유 뱃지 + 지표 스냅샷 |

## Redis 키 구조

| 키 | TTL | 설명 |
|----|-----|------|
| `voice-health:cooldown:{guildId}:{userId}` | `cooldownHours` (설정값) | 자가진단 쿨다운 |
| `voice-health:config:{guildId}` | 1시간 | VoiceHealthConfig 캐시 |

## 기존 기능과의 관계

| 도메인 | 관계 | 설명 |
|--------|------|------|
| voice (VoiceDaily) | 읽기 전용 소비 | 활동량, 활동일, 마이크 사용률, 혼자 비율 |
| voice-co-presence (VoiceCoPresencePairDaily) | 읽기 전용 소비 | HHI 계산용 peer별 동시접속 시간 |
| newbie (MocoHuntingDaily) | 읽기 전용 소비 | 모코코 사냥 점수 및 순위 |
| gemini (기존 모듈) | 리팩토링 대상 | `voice-analytics/`로 이동 후 LLM 추상화 |
| voice (/me 프로필 카드) | 수정 | 프로필 카드 헤더에 뱃지 pill 렌더링 추가 |

## 선행 조건

- Co-Presence 도메인 (Phase 1~3) 구현 완료 — `VoiceCoPresencePairDaily`, `VoiceCoPresenceDaily` 테이블 존재
- 모코코 사냥 소비자 전환 완료 — `MocoHuntingDaily` 테이블 존재
- gemini 모듈이 코드베이스에 존재하고 4개 커맨드가 정상 동작 중

## 티켓 의존 관계

```
F-SD-001 (LLM 추상화)
    ↓
F-SD-002 (디렉토리 이동)
    ↓
F-SD-003 (VoiceHealthConfig) ────────────────► F-SD-008 (웹 설정 페이지)
    ↓
F-SD-004 (진단 로직)
    ↓
F-SD-005 (슬래시 커맨드)

F-SD-003 ─► F-SD-006 (뱃지 시스템) ─► F-SD-007 (/me 뱃지 표시)
```
