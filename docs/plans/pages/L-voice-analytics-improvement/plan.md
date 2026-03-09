# L - AI 음성분석 모듈 개선 계획

## 개요

`apps/api/src/gemini/` 하위의 AI 음성분석 모듈 전반을 안정성, 성능, 보안, 아키텍처, 코드 품질 관점에서 개선한다.
F-VOICE-021(카테고리 정보 수집)은 별도 작업으로 진행하며 이 계획에 포함하지 않는다.

---

## Phase 1: 안정성 (구현 대상)

### 1-1. Gemini API 재시도 로직 + 폴백 응답

- **파일**: `voice-gemini.service.ts`
- **현재 문제**: API 호출 실패 시 단순 에러 텍스트 반환. 일시적 네트워크 오류에도 분석 실패
- **개선**:
  - 최대 2회 재시도 (exponential backoff: 1초 → 2초)
  - 재시도 실패 시 기본 통계 기반 폴백 응답 반환 (현재 `analyzeVoiceActivity`에만 있고 `analyzeSpecificUser`, `calculateCommunityHealth`에는 없음)
- **영향 범위**: `voice-gemini.service.ts`만 수정

### 1-2. Discord Embed 길이 안전 분할

- **파일**: `commands/voice-stats.command.ts`, `commands/community-health.command.ts`
- **현재 문제**:
  - `voice-stats`: 분할 시 `.match(/[\s\S]{1,1900}/g)`로 단순 자르기 → 마크다운 구조 깨짐
  - `community-health`: healthText가 4096자 초과 시 검증 없이 embed에 삽입 → Discord API 에러
  - `voice-stats`: `fullDescription`이 `BASE_DESCRIPTION + analysis.text`를 중복 결합 (BASE_DESCRIPTION에 이미 analysis.text 포함)
- **개선**:
  - 줄 단위(`\n`) 기준으로 1900자 이내로 분할하여 마크다운 보존
  - `community-health`에도 4096자 초과 체크 + 분할 로직 추가
  - `voice-stats`의 description 중복 결합 버그 수정
- **영향 범위**: 두 command 파일만 수정

### 1-3. Redis 세션 TTL 12시간 한계 보완

- **파일**: `voice-session.service.ts`, `voice-redis.repository.ts`
- **현재 문제**: 12시간 동안 이벤트 없으면 세션 만료 → 퇴장 시 데이터 소실
- **현재 상태**: `accumulateDuration`에서 세션 저장 시 TTL 갱신됨. 이벤트 발생마다 12시간 연장되므로 실질적 문제 발생 확률은 낮음
- **결론**: 현재 구조에서는 추가 조치 불필요. 모니터링만 유지

---

## Phase 2: 성능 (구현 대상)

### 2-1. AI 분석 결과 Redis 캐싱

- **파일**: `voice-gemini.service.ts` (또는 controller 레벨)
- **현재 문제**: 동일 기간/길드에 대해 매번 Gemini API 호출 → 비용 + 지연
- **개선**:
  - `voice-analytics.controller.ts`에서 분석 결과를 Redis에 캐싱
  - 캐시 키: `voice:analysis:{guildId}:{days}`, TTL 30분
  - Slash Command는 캐시 무시 (항상 최신 분석)
- **영향 범위**: `voice-analytics.controller.ts`, `voice-analytics.module.ts`

### 2-2. 이름 보강 Redis 배치 조회 (mget)

- **파일**: `voice-name-enricher.service.ts`, `voice-redis.repository.ts`
- **현재 문제**: 이름 없는 유저/채널마다 개별 Redis GET 호출 → N+1 문제
- **개선**:
  - `getUserNames(guildId, userIds[])` → Redis MGET으로 일괄 조회
  - `getChannelNames(guildId, channelIds[])` → Redis MGET으로 일괄 조회
  - Discord API 폴백도 이미 배치이므로 Redis 부분만 개선
- **영향 범위**: `voice-redis.repository.ts`, `voice-name-enricher.service.ts`

### 2-3. Gemini 모델명/파라미터 환경변수 분리

- **파일**: `voice-gemini.service.ts`, `env.validation.ts`
- **현재 문제**: `gemini-2.0-flash-exp` 하드코딩, temperature 등 매직 넘버
- **개선**:
  - `GEMINI_MODEL` 환경변수 추가 (기본값: `gemini-2.0-flash-exp`)
  - generation config를 상수 객체로 분리
- **영향 범위**: `voice-gemini.service.ts`, `env.validation.ts`

---

## Phase 3: 보안 (계획만)

### 3-1. AI 분석 요청 Rate Limiting

- Discord Slash Command에 길드별 쿨다운 추가 (예: `/voice-stats` 5분, `/community-health` 10분)
- REST API에는 NestJS `@nestjs/throttler` 적용 검토
- Redis 기반 쿨다운: `voice:cooldown:{guildId}:{commandName}` 키 사용

### 3-2. 프롬프트 인젝션 방지

- 유저명/채널명을 프롬프트에 삽입 시 특수 문자 이스케이프
- JSON 블록 안에만 유저 데이터 포함 (시스템 지시와 분리)
- 현재 구조는 JSON.stringify로 감싸고 있어 위험도는 낮으나, 유저명에 프롬프트 지시가 들어갈 경우를 대비

### 3-3. API 키 관리

- Gemini API 키 로테이션은 현재 단일 서버 규모에서는 불필요
- Rate limit 도달 시 알림 로깅 추가 (Phase 1 재시도 로직에서 함께 처리)

---

## Phase 4: 아키텍처 (계획만)

### 4-1. 모듈명 `gemini` → `voice-analytics` 추상화

- 디렉토리: `apps/api/src/gemini/` → `apps/api/src/voice-analytics/`
- AI 서비스 인터페이스 추출: `VoiceAiService` 인터페이스 → `VoiceGeminiService` 구현체
- 모델 교체 시 구현체만 교체 가능한 구조

### 4-2. 프롬프트 템플릿 분리

- `voice-gemini.service.ts` 내 인라인 프롬프트 → `prompts/` 디렉토리 별도 파일
- 프롬프트 수정 시 서비스 코드 변경 불필요

### 4-3. 서비스 책임 분리

- `VoiceGeminiService`: 프롬프트 생성 + API 호출 + 응답 파싱 모두 담당
- 분리: `VoicePromptBuilder` (프롬프트 생성) + `GeminiClient` (API 호출) + `VoiceGeminiService` (오케스트레이션)
- 현재 규모에서는 과도한 분리일 수 있으므로 규모 성장 시 진행

---

## Phase 5: 코드 품질 (계획만)

### 5-1. 매직 넘버 상수화

- `3000` (분석 텍스트 제한), `4096` (embed 제한), `1900` (메시지 분할)
- `temperature: 0.7`, `topK: 40`, `topP: 0.95`, `maxOutputTokens: 8192`
- → `GEMINI_CONFIG` 상수 객체 또는 환경변수로 분리

### 5-2. `any` 타입 제거

- `voice-analytics.service.ts`의 `channelMap: Map<string, any>`, `dailyMap: Map<string, any>`
- 적절한 인터페이스 정의로 교체

### 5-3. 테스트 작성

- `voice-gemini.service.ts`: Gemini API mock으로 단위 테스트
- `voice-analytics.service.ts`: DB mock으로 집계 로직 테스트
- `voice-name-enricher.service.ts`: Redis/Discord mock으로 보강 로직 테스트
- 각 Slash Command: interaction mock으로 응답 포맷 테스트

---

## Phase 6: PRD 정합성 (계획만)

### 6-1. `/voice-analytics/guild/:guildId/compare` 엔드포인트

- PRD에 미정의 상태. 문서화하거나 제거 결정 필요

### 6-2. 스케줄 기반 Daily Flush

- PRD F-VOICE-005에 "스케줄 또는 세션 종료 시" flush 명시
- 현재 세션 종료 시에만 flush 수행
- 크론잡으로 자정 전체 flush 추가 검토 (날짜 변경 시 flush는 이미 존재)

---

## 구현 우선순위 및 일정

| 순서 | 항목 | 상태 |
|------|------|------|
| 1 | Phase 1-1: Gemini 재시도 + 폴백 | **구현** |
| 2 | Phase 1-2: Embed 길이 안전 분할 + 버그 수정 | **구현** |
| 3 | Phase 2-3: Gemini 설정 환경변수 분리 | **구현** |
| 4 | Phase 2-1: AI 분석 결과 캐싱 | **구현** |
| 5 | Phase 2-2: 이름 보강 배치 조회 | **구현** |
| 6 | Phase 3~6 | 계획만 (후속 작업) |
