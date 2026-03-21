# Gemini 도메인 PRD

## 개요
VoiceDailyEntity 데이터를 집계하여 Google Gemini API로 AI 분석 리포트를 생성하고, Discord 슬래시 커맨드 및 REST API로 제공하는 도메인이다.

## 관련 모듈
- `apps/api/src/voice-analytics/application/voice-analytics.service.ts` — 데이터 집계 엔진
- `apps/api/src/voice-analytics/application/voice-ai-analysis.service.ts` — LLM 기반 AI 분석
- `apps/api/src/common/llm/` — LLM 추상화 레이어 (LlmProvider 인터페이스 + GeminiLlmProvider)
- `apps/api/src/voice-analytics/presentation/voice-analytics.controller.ts` — REST API 엔드포인트
- `apps/bot/src/command/voice-analytics/` — Discord 슬래시 커맨드 (Bot)

## 기능 상세

### F-GEMINI-001: 서버 음성 활동 AI 분석 (`/voice-stats`)
- **입력**: guildId, days (기본 7일, 최대 90일)
- **처리**:
  1. VoiceDailyEntity에서 GLOBAL + 개별 채널 데이터 조회
  2. 유저별/채널별/일별 통계 집계
  3. Redis/Discord API로 유저명/채널명 보강
  4. Gemini API에 분석 요청
- **출력**: Discord Embed (기본 통계 + AI 분석 텍스트)
- **제한**: Embed 4096자 초과 시 followUp 메시지로 분할 전송

### F-GEMINI-002: 개인 음성 통계 (`/my-voice-stats`)
- **입력**: guildId, userId, days (기본 30일)
- **처리**: 전체 데이터에서 해당 유저 필터링
- **출력**: Discord Embed (ephemeral)
  - 기본 통계: 순위, 총 음성시간, 마이크ON/OFF, 혼자시간
  - 활동 패턴: 활동일수, 일평균, 마이크 사용률
  - 자주 사용한 채널 TOP 5

### F-GEMINI-003: 커뮤니티 건강도 진단 (`/community-health`)
- **입력**: guildId, days (기본 30일)
- **처리**: 활동 데이터를 Gemini에 전달하여 건강도 분석
- **출력**: Discord Embed (AI 진단 텍스트)

### F-GEMINI-004: 리더보드 (`/voice-leaderboard`)
- **입력**: guildId, days (기본 7일)
- **처리**: 유저별 음성시간 기준 정렬
- **출력**: Discord Embed (TOP 10, 메달 표시)

## 데이터 집계 구조 (VoiceActivityData)

```typescript
{
  guildId, guildName,
  timeRange: { start, end },
  totalStats: {
    totalUsers,          // 고유 유저 수
    totalVoiceTime,      // 전체 음성 시간 (초)
    totalMicOnTime,      // 전체 마이크 ON 시간 (초)
    avgDailyActiveUsers  // 일평균 활성 유저
  },
  userActivities: [{
    userId, username,
    totalVoiceTime, totalMicOnTime, totalMicOffTime, aloneTime,
    activeChannels: [{ channelId, channelName, duration }],
    activeDays, avgDailyVoiceTime, micUsageRate
  }],
  channelStats: [{
    channelId, channelName,
    totalVoiceTime, uniqueUsers, avgSessionDuration
  }],
  dailyTrends: [{
    date, totalVoiceTime, activeUsers, avgMicUsage
  }]
}
```

## 이름 보강 전략
1. VoiceDailyEntity의 userName/channelName 확인
2. 비어있으면 Redis 캐시 조회 (7일 TTL)
3. Redis에도 없으면 Discord API 배치 조회 → Redis 저장

## 장애 대응 (Resilience)

### Circuit Breaker + Retry + Timeout
- **라이브러리**: `cockatiel` (공통 `ResiliencePolicy` 사용)
- **개방 조건**: 5회 연속 실패 시 회로 개방
- **반개방**: 60초 후 반개방 상태로 전환
- **Timeout**: 호출당 30초
- **Retry**: 최대 2회, 지수 백오프 (초기 1초)

### 기본 모델
- `gemini-2.5-flash` (환경변수 `GEMINI_MODEL`로 변경 가능)

### 할당량 초과 처리
- Gemini API 429 응답 시 `LlmQuotaExhaustedException` throw
