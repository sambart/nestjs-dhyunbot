# Voice 도메인 통합 유스케이스 인덱스

> voice 도메인은 **api + bot + web 3앱 cross-app 통합**의 핵심이다.
> 음성 채널 접속/이탈 이벤트(bot) → 세션 추적·집계(api) → 일별 통계(voice_daily) → 대시보드 표시(web)의 end-to-end 흐름을 통합 검증 관점에서 명세한다.
>
> 1차 소스: `/docs/specs/prd/voice.md`. (voice userflow 문서는 미작성 대상 — PRD 기준)

## 통합 시나리오 개요

```
Discord                Bot (apps/bot)              API (apps/api)                 Web (apps/web)
음성 채널        voiceStateUpdate          POST /bot-api/voice/state-update   GET /api/guilds/:id/voice/daily
입장/이탈/이동   → 이벤트 분류             → EventEmitter                     → Next.js 프록시
마이크/화면공유   (join/leave/move/         → BotVoiceEventListener            → 대시보드 차트
카메라/deaf        mic·streaming·video·     → VoiceChannelService              (요약·추이·채널·랭킹)
게임 활동           deaf·게임)              → Redis 세션 누적
                                            → VoiceDailyFlushService
                                            → voice_daily (일별 집계)
```

## 유스케이스 목록

| ID | 제목 | 통합 범위 | 비고 |
|----|------|----------|------|
| [UC-01](UC-01-voice-tracking-to-dashboard.md) | 음성 활동 실시간 추적부터 대시보드 표시까지 | bot → api → web (전 구간) | 핵심 end-to-end |
| [UC-02](UC-02-bot-restart-session-recovery.md) | 봇 재시작 시 음성 세션 복구 동기화 | bot → api (F-VOICE-023) | 장애/배포 복구 🔒 PII |
| [UC-03](UC-03-excluded-channel-filtering-integrity.md) | 제외 채널 설정의 cross-app 추적 차단 일관성 | web → api → bot 이벤트 (F-VOICE-013~016) | 설정-추적 정합성 |

## 변경 이력

| 버전 | 날짜 | 작성자 | 변경 내용 |
|------|------|--------|-----------|
| 1.0 | 2026-05-20 | usecase-writer | 초기 작성 (UC-01~03) |
