# 음성 활동 자가진단 (Self-Diagnosis)

## 기능명

음성 활동 자가진단 — 멤버 본인의 음성 활동 패턴을 정량 분석하고, 길드 정책 기준 대비 진단 및 뱃지를 부여하는 기능.

## 도메인

- `voice-analytics` (기존 `gemini/` 리팩토링) — LLM 추상화, 자가진단, 뱃지
- `voice` — Co-Presence 데이터 소비 (PairDaily, Daily)
- `newbie` — 모코코 사냥 데이터 소비 (MocoHuntingDaily)
- `web` — 정책 설정 UI

## 요구사항 요약

디스코드 서버 멤버가 `/자가진단` 슬래시 커맨드로 자신의 음성 활동 건강도를 스스로 진단한다. 활동량, 관계 다양성(HHI 지수), 모코코 기여도, 참여 패턴을 서버 내 순위와 함께 확인하고, 관리자가 설정한 길드 정책 기준 대비 충족 여부를 판정받는다. 높은 등수 기록자에게는 뱃지가 부여되어 `/me` 프로필 카드에 표시된다.

## 전체 흐름

```
[관리자: 웹 대시보드] → VoiceHealthConfig 정책 설정 저장
       ↓
[매일 자정 스케줄러] → 전체 멤버 뱃지 자격 배치 계산 → voice_health_badge 저장
       ↓
[멤버: /자가진단 실행] (1일 1회, Ephemeral)
  ├─ VoiceDaily, PairDaily, MocoHuntingDaily에서 개인 데이터 수집
  ├─ 서버 내 순위/백분위 계산
  ├─ HHI 편중도 지수 계산
  ├─ 길드 정책 기준 대비 충족/미충족 판정
  ├─ 보유 뱃지 현황 표시
  └─ (선택) LLM 종합 진단 리포트 생성
       ↓
[멤버: /me 실행] → voice_health_badge 조회 → 프로필 카드에 뱃지 pill 렌더링
```

---

## 티켓 목록

### T-SD-001: LLM 추상화 레이어 신설

**유형**: refactor
**선행 티켓**: 없음
**영향 범위**: `apps/api/src/gemini/` 전체

#### 목표

`VoiceGeminiService`에서 LLM 호출 로직을 분리하여 제공자 교체 가능한 추상 인터페이스를 만든다.

#### 상세 요구사항

1. `LlmProvider` 인터페이스 정의:
   ```
   interface LlmProvider {
     generateText(prompt: string, options?: LlmOptions): Promise<string>;
   }
   interface LlmOptions {
     temperature?: number;
     maxOutputTokens?: number;
   }
   ```
2. `GeminiLlmProvider` 구현체 작성:
   - 기존 `VoiceGeminiService`의 Gemini SDK 호출, 재시도 로직, 모델 설정을 이동
   - `@google/generative-ai` 의존은 이 파일에만 존재
3. `VoiceGeminiService` → `VoiceAiAnalysisService`로 이름 변경:
   - 프롬프트 구성 로직만 남기고, LLM 호출은 `LlmProvider`에 위임
   - 3개 메서드(`analyzeVoiceActivity`, `analyzeSpecificUser`, `calculateCommunityHealth`)의 프롬프트 빌딩 로직은 그대로 유지
4. `LlmModule` 생성:
   - `LLM_PROVIDER` 토큰으로 `GeminiLlmProvider`를 기본 등록
   - 향후 환경변수나 설정으로 제공자 전환 가능하도록 구조화
5. 기존 기능(voice-stats, community-health 등)이 정상 동작하는지 검증

#### 파일 변경 계획

| 작업 | 파일 |
|------|------|
| 신규 | `llm/llm-provider.interface.ts` |
| 신규 | `llm/gemini-llm.provider.ts` |
| 신규 | `llm/llm.module.ts` |
| 수정 | `voice-gemini.service.ts` → `voice-ai-analysis.service.ts` (이름 변경 + LLM 호출 분리) |
| 수정 | `voice-analytics.module.ts` (LlmModule import, provider 등록 변경) |
| 수정 | `commands/*.command.ts` (import 경로 변경) |

---

### T-SD-002: gemini 모듈 디렉토리 이동

**유형**: refactor
**선행 티켓**: T-SD-001
**영향 범위**: `apps/api/src/gemini/` → `apps/api/src/voice-analytics/`

#### 목표

모듈 디렉토리명을 LLM 제공자에 종속되지 않는 이름으로 변경한다.

#### 상세 요구사항

1. `apps/api/src/gemini/` → `apps/api/src/voice-analytics/` 디렉토리 이동
2. `VoiceAnalyticsModule` 클래스명은 그대로 유지 (이미 범용적)
3. `AppModule`의 import 경로 수정
4. 모든 내부/외부 import 경로 일괄 변경
5. 기존 REST 엔드포인트 경로(`/voice-analytics`)는 변경 없음

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
├── voice-ai-analysis.service.ts
├── voice-analytics.service.ts
├── voice-analytics.controller.ts
├── voice-name-enricher.service.ts
└── voice-analytics.module.ts
```

---

### T-SD-003: VoiceHealthConfig 엔티티 및 정책 설정 API

**유형**: feat
**선행 티켓**: T-SD-002
**영향 범위**: `voice-analytics/self-diagnosis/`

#### 목표

길드별 자가진단 정책을 저장하는 엔티티와 웹 대시보드용 CRUD API를 만든다.

#### 데이터 모델: `voice_health_config`

| 컬럼 | 타입 | 제약조건 | 설명 |
|------|------|----------|------|
| `id` | `int` | PK, AUTO_INCREMENT | 내부 ID |
| `guildId` | `varchar` | UNIQUE, NOT NULL | 디스코드 서버 ID |
| `isEnabled` | `boolean` | NOT NULL, DEFAULT `false` | 자가진단 기능 활성화 |
| `analysisDays` | `int` | NOT NULL, DEFAULT `30` | 분석 기간 (일). 7~90 |
| `cooldownHours` | `int` | NOT NULL, DEFAULT `24` | 실행 쿨다운 (시간). 1~168 |
| `isLlmSummaryEnabled` | `boolean` | NOT NULL, DEFAULT `false` | AI 종합 진단 포함 여부 |
| `minActivityMinutes` | `int` | NOT NULL, DEFAULT `600` | 활동량 기준: 최소 총 활동 시간(분) |
| `minActiveDaysRatio` | `decimal(3,2)` | NOT NULL, DEFAULT `0.50` | 활동량 기준: 최소 활동일 비율 (0.00~1.00) |
| `hhiThreshold` | `decimal(3,2)` | NOT NULL, DEFAULT `0.30` | 관계 다양성 기준: HHI 편중도 경고 임계값 (0.00~1.00) |
| `minPeerCount` | `int` | NOT NULL, DEFAULT `3` | 관계 다양성 기준: 최소 교류 인원 수 |
| `badgeActivityTopPercent` | `int` | NOT NULL, DEFAULT `10` | 활동왕 뱃지: 상위 N% (1~100) |
| `badgeSocialHhiMax` | `decimal(3,2)` | NOT NULL, DEFAULT `0.25` | 사교왕 뱃지: HHI 상한 (0.00~1.00) |
| `badgeSocialMinPeers` | `int` | NOT NULL, DEFAULT `5` | 사교왕 뱃지: 최소 교류 인원 |
| `badgeHunterTopPercent` | `int` | NOT NULL, DEFAULT `10` | 헌터 뱃지: 모코코 사냥 상위 N% (1~100) |
| `badgeConsistentMinRatio` | `decimal(3,2)` | NOT NULL, DEFAULT `0.80` | 꾸준러 뱃지: 최소 활동일 비율 (0.00~1.00) |
| `badgeMicMinRate` | `decimal(3,2)` | NOT NULL, DEFAULT `0.70` | 소통러 뱃지: 최소 마이크 사용률 (0.00~1.00) |
| `createdAt` | `timestamp` | NOT NULL, DEFAULT now() | 생성일 |
| `updatedAt` | `timestamp` | NOT NULL, DEFAULT now() | 수정일 |

**인덱스**: `UNIQUE(guildId)`

#### API 엔드포인트

| Method | Path | 설명 |
|--------|------|------|
| `GET` | `/api/guilds/:guildId/voice-health/config` | 정책 설정 조회 |
| `POST` | `/api/guilds/:guildId/voice-health/config` | 정책 설정 저장 (upsert) |

- 인증: JwtAuthGuard + 서버 관리 권한

#### 파일 계획

```
voice-analytics/self-diagnosis/
├── domain/
│   └── voice-health-config.entity.ts
├── self-diagnosis.controller.ts        (설정 API)
└── voice-health-config.repository.ts   (Redis 캐시 + DB)
```

---

### T-SD-004: 자가진단 데이터 수집 및 진단 로직

**유형**: feat
**선행 티켓**: T-SD-003
**영향 범위**: `voice-analytics/self-diagnosis/`

#### 목표

개인 음성 활동 데이터를 수집하고, 서버 내 순위/백분위를 계산하며, HHI 편중도 지수를 산출하고, 정책 기준 대비 판정을 수행하는 서비스를 만든다.

#### 진단 항목

| 카테고리 | 수집 데이터 | 데이터 소스 | 판정 기준 (VoiceHealthConfig) |
|----------|------------|------------|------------------------------|
| 활동량 | 총 시간, 활동일, 일평균, 순위, 백분위 | `VoiceDaily` | `minActivityMinutes`, `minActiveDaysRatio` |
| 관계 다양성 | 교류 인원 수, HHI 지수, 상위 3명 비율 | `VoiceCoPresencePairDaily` | `hhiThreshold`, `minPeerCount` |
| 모코코 기여 | 사냥 점수, 순위, 백분위, 도움준 신입 수 | `MocoHuntingDaily` | (뱃지 기준만 적용) |
| 참여 패턴 | 마이크 사용률, 혼자 비율 | `VoiceDaily` (GLOBAL) | (뱃지 기준만 적용) |

#### HHI (Herfindahl–Hirschman Index) 계산

```
HHI = Σ(si²)
  si = 특정 peer와의 동시접속 시간 / 전체 동시접속 시간

예: A와 50분, B와 30분, C와 20분 (합계 100분)
  HHI = (0.5)² + (0.3)² + (0.2)² = 0.25 + 0.09 + 0.04 = 0.38

HHI 범위: 0(완전 분산) ~ 1(한 명에 집중)
```

- `PairDaily`에서 기간 내 `(guildId, userId)` 기준으로 peer별 `SUM(minutes)` 조회
- peer별 비율 계산 후 제곱합 산출

#### 순위/백분위 계산

- 활동량 순위: `VoiceDaily`에서 기간 내 `SUM(channelDurationSec)` 기준 전체 사용자 순위
- 모코코 순위: `MocoHuntingDaily`에서 기간 내 `SUM(score)` 기준 순위
- 백분위: `(순위 / 전체 인원) × 100` — 상위 N%

#### 쿨다운

- Redis 키: `voice-health:cooldown:{guildId}:{userId}` (TTL: `cooldownHours`)
- 커맨드 실행 시 키 존재 확인 → 존재하면 남은 시간 안내 후 거부

#### 진단 결과 인터페이스

```
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
  hhiScore: number           // 0~1
  topPeers: Array<{ userId: string; userName: string; minutes: number; ratio: number }>  // 상위 3명

  // 모코코 기여
  mocoScore: number
  mocoRank: number
  mocoTotalUsers: number
  mocoTopPercent: number
  mocoHelpedNewbies: number

  // 참여 패턴
  micUsageRate: number       // 0~1
  aloneRatio: number         // 0~1

  // 정책 판정
  verdicts: Array<{
    category: string
    isPassed: boolean
    criterion: string        // "최소 10시간"
    actual: string           // "42시간 30분"
  }>

  // 뱃지
  badges: Badge[]

  // LLM 요약 (선택)
  llmSummary?: string
}
```

#### 파일 계획

```
voice-analytics/self-diagnosis/
├── self-diagnosis.service.ts       — 데이터 수집 + 판정 오케스트레이션
├── hhi-calculator.ts               — HHI 계산 순수 함수
└── self-diagnosis.types.ts         — 결과 인터페이스
```

---

### T-SD-005: /자가진단 슬래시 커맨드 및 Embed 렌더링

**유형**: feat
**선행 티켓**: T-SD-004
**영향 범위**: `voice-analytics/self-diagnosis/`

#### 목표

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

```
Title: 🩺 음성 활동 자가진단
Color: Blurple (#5B8DEF)
Description:
  📊 **활동량**
  총 시간: 42시간 30분 (**8위** / 52명, 상위 15.4%)
  활동일: 22일 / 30일 (73.3%)
  일평균: 1시간 56분
  ✅ 기준 충족 — 최소 10시간

  🌐 **관계 다양성**
  교류 인원: 12명
  HHI 지수: 0.18 (양호 — 관계가 다양합니다)
  상위 교류: 유저A 22% · 유저B 18% · 유저C 14%
  ✅ 기준 충족 — HHI < 0.30, 3명 이상 교류

  🌱 **모코코 기여**
  사냥 점수: 250점 (**5위** / 30명, 상위 16.7%)
  도움준 신입: 3명
  ⚠️ 기준 미충족 — 상위 10% 필요 (현재 16.7%)

  🎤 **참여 패턴**
  마이크 사용률: 78%
  혼자 비율: 8%

  🏅 **보유 뱃지**
  🔥 활동왕 · 📅 꾸준러 · 🎤 소통러
  ❌ 사교왕 — HHI 0.32 (0.25 이하 필요)
  ❌ 헌터 — 상위 16.7% (10% 이내 필요)

  💬 **AI 종합 진단**  ← isLlmSummaryEnabled=true일 때만
  전반적으로 건강한 활동 패턴입니다. 다양한 멤버와...

Footer: 📅 분석 기간: 최근 30일 · 다음 진단 가능: 내일 00:00
```

#### 오류 처리

| 상황 | 응답 |
|------|------|
| 기능 비활성화 | "이 서버에서 자가진단 기능이 활성화되지 않았습니다." |
| 쿨다운 중 | "다음 진단은 {남은시간} 후에 가능합니다." |
| 활동 데이터 없음 | "최근 {N}일간 음성 활동 기록이 없습니다." |
| Co-Presence 데이터 없음 | 관계 다양성 섹션을 "데이터 부족"으로 표시 |
| LLM 실패 | AI 종합 진단 섹션 생략, 나머지 정상 표시 |

#### 파일 계획

```
voice-analytics/self-diagnosis/
└── self-diagnosis.command.ts       — 슬래시 커맨드 + Embed 빌더
```

---

### T-SD-006: 뱃지 시스템 (엔티티 + 스케줄러 + 서비스)

**유형**: feat
**선행 티켓**: T-SD-003
**영향 범위**: `voice-analytics/self-diagnosis/`, 프로필 카드

#### 목표

매일 자정 스케줄러가 전체 멤버의 뱃지 자격을 배치 계산하여 DB에 저장한다.

#### 데이터 모델: `voice_health_badge`

| 컬럼 | 타입 | 제약조건 | 설명 |
|------|------|----------|------|
| `id` | `int` | PK, AUTO_INCREMENT | 내부 ID |
| `guildId` | `varchar` | NOT NULL | 디스코드 서버 ID |
| `userId` | `varchar` | NOT NULL | 멤버 디스코드 ID |
| `badges` | `json` | NOT NULL, DEFAULT `[]` | 보유 뱃지 코드 배열 (예: `["ACTIVITY","CONSISTENT","MIC"]`) |
| `activityRank` | `int` | NULLABLE | 활동량 순위 |
| `activityTopPercent` | `decimal(5,2)` | NULLABLE | 활동량 상위 % |
| `hhiScore` | `decimal(4,3)` | NULLABLE | HHI 지수 |
| `mocoRank` | `int` | NULLABLE | 모코코 순위 |
| `mocoTopPercent` | `decimal(5,2)` | NULLABLE | 모코코 상위 % |
| `micUsageRate` | `decimal(4,3)` | NULLABLE | 마이크 사용률 |
| `activeDaysRatio` | `decimal(3,2)` | NULLABLE | 활동일 비율 |
| `calculatedAt` | `timestamp` | NOT NULL | 마지막 계산 시각 |
| `createdAt` | `timestamp` | NOT NULL, DEFAULT now() | 생성일 |
| `updatedAt` | `timestamp` | NOT NULL, DEFAULT now() | 수정일 |

**인덱스**:
- `UQ_voice_health_badge_guild_user` — `UNIQUE(guildId, userId)`
- `IDX_voice_health_badge_guild_badges` — `(guildId)` — 길드별 뱃지 조회

#### 뱃지 코드 및 표시

| 코드 | 이름 | 아이콘 | 판정 기준 |
|------|------|--------|----------|
| `ACTIVITY` | 활동왕 | 🔥 | 활동량 상위 `badgeActivityTopPercent`% |
| `SOCIAL` | 사교왕 | 🌐 | HHI ≤ `badgeSocialHhiMax` AND 교류 인원 ≥ `badgeSocialMinPeers` |
| `HUNTER` | 헌터 | 🌱 | 모코코 점수 상위 `badgeHunterTopPercent`% |
| `CONSISTENT` | 꾸준러 | 📅 | 활동일 비율 ≥ `badgeConsistentMinRatio` |
| `MIC` | 소통러 | 🎤 | 마이크 사용률 ≥ `badgeMicMinRate` |

#### 스케줄러

- **실행 시각**: 매일 00:30 KST (Co-Presence 세션 정리(00:00) 이후)
- **동작**:
  1. `isEnabled=true`인 모든 길드의 `VoiceHealthConfig` 조회
  2. 길드별로:
     a. `VoiceDaily`에서 기간 내 전체 사용자 활동량 순위 산출
     b. `PairDaily`에서 기간 내 전체 사용자 HHI 산출
     c. `MocoHuntingDaily`에서 기간 내 전체 사용자 점수 순위 산출
     d. `VoiceDaily` GLOBAL에서 마이크 사용률, 활동일 비율 산출
     e. 각 사용자별 뱃지 자격 판정
     f. `voice_health_badge` 테이블에 일괄 upsert
  3. 처리 건수 로그 출력

#### 파일 계획

```
voice-analytics/self-diagnosis/
├── domain/
│   └── voice-health-badge.entity.ts
├── badge.service.ts                — 뱃지 자격 판정 로직
└── badge.scheduler.ts              — 매일 배치 스케줄러
```

---

### T-SD-007: /me 프로필 카드 뱃지 표시

**유형**: feat
**선행 티켓**: T-SD-006
**영향 범위**: `channel/voice/application/` (me-profile, profile-card-renderer)

#### 목표

`/me` 프로필 카드 헤더에 보유 뱃지를 pill 형태로 렌더링한다.

#### 변경 사항

1. **MeProfileService** (`me-profile.service.ts`):
   - `voice_health_badge` 테이블에서 해당 사용자의 뱃지 조회
   - `MeProfileData` 인터페이스에 `badges: string[]` 필드 추가 (예: `["ACTIVITY","CONSISTENT"]`)

2. **ProfileCardRenderer** (`profile-card-renderer.ts`):
   - `drawHeader()`에 뱃지 렌더링 로직 추가
   - 뱃지 위치: 사용자명 오른쪽, 인라인 배치
   - 뱃지 형태: 작은 pill (둥근 사각형 배경 + 아이콘 + 텍스트)
     - 배경색: 뱃지별 고유 색상 (연한 톤)
     - 크기: 약 높이 20px, 너비 가변 (텍스트 길이에 따라)
     - 간격: pill 사이 6px
   - 최대 표시 개수: 4개 (초과 시 우선순위 순으로 잘라냄)
   - 뱃지 없으면 기존과 동일하게 렌더링 (변경 없음)

3. **뱃지 우선순위** (좌→우 표시 순서):
   1. ACTIVITY (활동왕)
   2. SOCIAL (사교왕)
   3. HUNTER (헌터)
   4. CONSISTENT (꾸준러)
   5. MIC (소통러)

#### 렌더링 예시

```
[Avatar]  사용자명  [🔥활동왕] [📅꾸준러] [🎤소통러]
          최근 15일 음성 활동
```

뱃지 pill 스타일:
- 활동왕: 배경 #FEF3C7, 텍스트 #92400E
- 사교왕: 배경 #DBEAFE, 텍스트 #1E40AF
- 헌터: 배경 #D1FAE5, 텍스트 #065F46
- 꾸준러: 배경 #E0E7FF, 텍스트 #3730A3
- 소통러: 배경 #FCE7F3, 텍스트 #9D174D

#### 레이아웃 영향

- 캔버스 높이(618px) 변경 없음
- 헤더 영역 내에서 이름 오른쪽 여백 활용
- 이름이 길어 뱃지와 겹칠 경우: 이름을 말줄임(…)으로 truncate

---

### T-SD-008: 웹 대시보드 자가진단 정책 설정 페이지

**유형**: feat
**선행 티켓**: T-SD-003
**영향 범위**: `apps/web/`

#### 목표

관리자가 웹 대시보드에서 자가진단 정책과 뱃지 기준을 설정할 수 있는 페이지를 만든다.

#### 페이지 경로

`/settings/guild/[guildId]/voice-health`

#### UI 구성

**섹션 1: 기본 설정**

| UI 요소 | 설명 |
|---------|------|
| 기능 활성화 토글 | 자가진단 기능 ON/OFF |
| 분석 기간 입력 (숫자) | 진단 시 분석할 기간 (일). 7~90, 기본 30 |
| 쿨다운 시간 입력 (숫자) | 재실행 대기 시간 (시간). 1~168, 기본 24 |
| AI 요약 활성화 토글 | LLM 종합 진단 포함 여부. OFF이면 정량 진단만 제공 |

**섹션 2: 정책 기준 (길드 기준)**

| UI 요소 | 설명 |
|---------|------|
| 최소 활동 시간 입력 | 기준 충족 판정: 최소 총 활동 시간 (분). 기본 600 |
| 최소 활동일 비율 슬라이더 | 기준 충족 판정: 최소 활동일/분석기간 비율. 0~100%, 기본 50% |
| HHI 임계값 슬라이더 | 관계 편중도 경고 기준. 0~1.00, 기본 0.30 |
| 최소 교류 인원 입력 | 관계 다양성 기준: 최소 교류 인원 수. 기본 3 |

**섹션 3: 뱃지 기준**

| UI 요소 | 설명 |
|---------|------|
| 활동왕 기준 입력 | 음성 활동량 상위 N%. 1~100, 기본 10 |
| 사교왕 HHI 상한 슬라이더 | HHI 이 값 이하일 때 부여. 0~1.00, 기본 0.25 |
| 사교왕 최소 인원 입력 | 교류 인원이 이 수 이상일 때 부여. 기본 5 |
| 헌터 기준 입력 | 모코코 사냥 상위 N%. 1~100, 기본 10 |
| 꾸준러 비율 슬라이더 | 활동일 비율이 이 값 이상일 때 부여. 0~100%, 기본 80% |
| 소통러 비율 슬라이더 | 마이크 사용률이 이 값 이상일 때 부여. 0~100%, 기본 70% |

**공통**: 저장 버튼, 저장 시 토스트 알림

#### 사이드바

기존 `DashboardSidebar`에 "자가진단 설정" 메뉴 항목 추가.

---

## 의존 관계

```
T-SD-001 (LLM 추상화)
    ↓
T-SD-002 (디렉토리 이동)
    ↓
T-SD-003 (VoiceHealthConfig) ──────────────► T-SD-008 (웹 설정 페이지)
    ↓
T-SD-004 (진단 로직)
    ↓
T-SD-005 (슬래시 커맨드)

T-SD-003 ─► T-SD-006 (뱃지 시스템) ─► T-SD-007 (/me 뱃지 표시)
```

## 선행 조건

- Co-Presence 도메인 (Phase 1~3) 구현 완료 — `PairDaily`, `Daily` 테이블 존재
- 모코코 사냥 소비자 전환 완료 — `MocoHuntingDaily` 테이블 존재
