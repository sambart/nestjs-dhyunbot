# Self-Diagnosis 도메인 통합 유스케이스 인덱스

> self-diagnosis 도메인은 **api + bot + web 3앱 cross-app 통합** 기능이다.
> `/자가진단` 슬래시 커맨드(bot) → HHI·순위·백분위 계산 및 정책 판정(api) → 진단 결과/뱃지 표시(web 설정 + Discord Embed/`/me` 카드)의 end-to-end 흐름을 통합 검증 관점에서 명세한다.
>
> 1차 소스: `/docs/specs/prd/self-diagnosis.md`. (작성 시점 `userflow/self-diagnosis.md` 미존재 — PRD 기준. userflow 생성 후 NN 순서 보정 가능)

## 통합 시나리오 개요

```
Discord/Web              Bot (apps/bot)              API (apps/api)                       소스/저장
─────────────            ──────────────              ──────────────                       ──────────
관리자: 웹 설정          /자가진단 커맨드            POST /bot-api/voice-analytics        voice_daily (활동/패턴)
voice-health 페이지      → deferReply(ephemeral)       /self-diagnosis                    voice_co_presence_pair_daily (HHI)
  → POST config          → runSelfDiagnosis()        → SelfDiagnosisService.diagnose()    moco_hunting_daily (모코코)
  ↓                                                    · 활동량 순위/백분위                voice_health_config (정책)
voice_health_config      /me 커맨드                    · HHI/관계 다양성                   voice_health_badge (뱃지)
  ↑ (정책 소비)          → 프로필 카드 pill            · 모코코/참여 패턴                  Redis (쿨다운/결과 캐시)
BadgeScheduler(Cron)                                   · 정책 판정 + 뱃지 조회
  → judgeAll() 배치                                    · (옵션) LLM 요약 위임
  → voice_health_badge                                → Ephemeral Embed (모드 A/B)
```

## 유스케이스 목록

| ID | 제목 | 통합 범위 | 비고 |
|----|------|----------|------|
| [UC-01](UC-01-self-diagnosis-command.md) | `/자가진단` 음성 건강도 정량 진단 (상세 데이터 모드) | bot → api → Discord (전 구간) | 핵심 end-to-end. 🔒 PII(top peers) |
| [UC-02](UC-02-policy-config-to-diagnosis.md) | 웹 정책·뱃지 기준 설정의 진단/뱃지 반영 | web → api → DB/Redis | 다양성 점수↔HHI 역변환 정합. 🔒 권한 |
| [UC-03](UC-03-badge-scheduler-to-profile-card.md) | 뱃지 배치 산정 → `/me` 카드/`/자가진단` 일관 표시 | api scheduler → DB → bot `/me` | 데이터 일관성. 🔒 PII |
| [UC-04](UC-04-ai-summary-mode.md) | AI 종합 진단 모드 (LLM 2단계 호출 + fallback) | bot → api → LLM | 할당량/실패 graceful. 🔒 결제(LLM 비용) |

## 도메인 경계 메모

- **주간 리포트(weekly-report)**: 코드는 `apps/api/src/voice-analytics/weekly-report/`에 위치하나, 본 흐름은 **서버 전체 활동 리포트**(self-diagnosis 뱃지/진단 미포함)이며 매니페스트상 `gemini` 도메인 소관이다. 본 인덱스에서는 self-diagnosis와 동일 모듈을 공유한다는 점만 cross-reference하고, 유스케이스는 gemini 도메인에서 명세한다.
- **web `dashboard/.../diagnosis/`**: 서버 진단 대시보드(gemini)로, self-diagnosis의 멤버 자가진단(Discord Ephemeral)과는 별개 표면. self-diagnosis의 웹 표면은 관리자 설정 페이지 `settings/.../voice-health/` 이다.

## 변경 이력

| 버전 | 날짜 | 작성자 | 변경 내용 |
|------|------|--------|-----------|
| 1.0 | 2026-05-20 | usecase-writer | 초기 작성 (UC-01~04) |
