# 2026 디스코드 봇 트렌드 기반 신규 기능 로드맵 검토안

> 작성일: 2026-05-04
> 작성 목적: 현재 Onyu의 도메인 자산을 2026년 디스코드 봇 시장 동향에 매핑하여, 차별화 가치를 극대화할 수 있는 신규 기능 후보를 도출하고 우선순위·트레이드오프를 제시한다.
> 본 문서는 **검토용 옵션 목록**이며, 채택된 항목은 별도 PRD/Plan 문서로 분기하여 상세화한다.

---

## 1. 배경

Onyu은 13개 도메인 중 voice 계열(`voice`, `voice-co-presence`, `auto-channel`, `inactive-member`)에 자산이 집중된 봇이다.
음성 채널 데이터의 깊이(쌍 단위 동시접속, 게임 세션, 화면공유/카메라/마이크 토글 단위 추적)는 동급 봇 대비 최상위권이지만, **수집된 데이터를 소비하는 사용자 대면 기능이 적다**.

2026년 디스코드 봇 시장은 ① AI 기반 모더레이션, ② 음성/메시지 기반 XP 레벨링, ③ /summarize 류 LLM 기능, ④ 퀘스트·게이미피케이션, ⑤ LFG·임시 음성방으로 빠르게 진화하고 있다. 이 중 Onyu의 강점에 직접 매핑되는 영역만 선별하여, 인프라 재활용도와 차별화 가치가 큰 기능부터 우선 검토한다.

---

## 2. 현재 보유 자산 매핑

| 자산 | 위치 | 잠재 활용처 |
|------|------|-------------|
| `VoiceDailyEntity`(channelDurationSec, micOnSec, aloneSec, streamingSec, videoOnSec) | `voice` | XP 산정, 출석 판정, 뱃지 부여 기준 |
| `VoiceCoPresencePairDaily`(쌍 단위 일별 분 수) | `voice-co-presence` | 친밀도 그래프, 베스트 프렌드 리포트, LFG 매칭 후보 |
| `VoiceGameDaily`(게임별 일별 분 수, 영구 보존) | `voice` | 같은 게임 동료 추천, 게임 전문가 뱃지 |
| `LlmProvider` + `GeminiLlmProvider` + Circuit Breaker | `common/llm/` | /요약, 개인화 DM, AI 모더레이션 |
| `WeeklyReportConfig` 스케줄러 | `voice-analytics/weekly-report/` | 친밀도 리포트 섹션 추가 위치 |
| `auto-channel` 트리거→대기방→확정방 플로우 | `auto-channel` | LFG 모집 완료 시 임시 음성방 자동 생성 |
| `status-prefix` Embed+버튼 설정 패턴 | `status-prefix` | 리액션 롤·출석체크 등 신규 Embed/버튼 기능의 구조 재사용 |
| `inactive-member` DM 템플릿·자동 조치 | `inactive-member` | AI 개인화 독려 메시지로 격상 |
| `newbie` 모코코 사냥 점수 | `newbie` | "도우미" 자동 역할의 입력값 |

---

## 3. 2026 트렌드 요약

| 트렌드 | 대표 봇 | 핵심 동작 |
|--------|---------|-----------|
| 음성+메시지 기반 XP 레벨링 | Arcane, MEE6, VibeBot | 시간/메시지로 XP, 레벨업 시 역할 자동 부여 |
| AI 컨텍스트 모더레이션 | VibeBot, SfwBot, Amanda | LLM이 의도·맥락 판단, 키워드 매칭 한계 보완 |
| /summarize 채널 요약 | MEE6 AI, Optimum-Web | 최근 메시지 LLM 요약 (의사결정·액션 아이템 추출) |
| 퀘스트·게이미피케이션 | CommunityOne Hype Engine | 개인화 퀘스트·래플로 참여율 ↑ |
| LFG + 임시 음성방 | Teamplay, GameTree, LFG Hub | 매칭 시 자동 임시 채널 생성 |
| 자율 역할 부여 | VibeBot 트렌드 | LLM이 행동 분석 → "Helpful Contributor" 자동 부여 |
| 한국형 출석체크 | nalgang.py 등 | 일일 출석 → 점수·랭킹·연속 보너스 |
| 프로필 카드·뱃지 | Tatsu | 시각적 카드, 외부 공유 가능 |

---

## 4. 신규 기능 후보 (적합도 순)

각 후보는 ① 활용 자산, ② 신규 작업, ③ 차별화 지점, ④ 트레이드오프, ⑤ 예상 규모를 명시한다.
**예상 규모**는 `S(1주 이내)`, `M(1~3주)`, `L(1~2개월)`, `XL(분기 단위)`로 표기한다.

---

### Tier 1 — 기존 데이터 직접 활용, 차별화 강함

#### A. 음성 활동 기반 XP/레벨 시스템 + 자동 역할 보상

- **활용 자산**: `VoiceDailyEntity`(channelDurationSec / micOnSec / aloneSec / streamingSec)
- **신규 작업**:
  - 길드별 `level_config`(임계 곡선, 레벨↔역할 매핑, 마이크 ON 가중치)
  - 멤버별 누적 XP 엔티티(`MemberLevelEntity`) + 일별 증분 스케줄러
  - 레벨업 이벤트 → 역할 자동 부여(승급) + 강등 정책 옵션
  - 웹: 길드별 레벨 곡선·역할 매핑 설정 페이지, 사용자별 랭킹 페이지
- **차별화**: Arcane/MEE6는 메시지 가중치 위주, Onyu은 음성 시간·마이크 ON·화면공유 등 풍부한 가중치 입력 → 음성 위주 서버에 압도적 적합도
- **트레이드오프**:
  - 보상 역할 운영 책임 → 강등 정책·중복 부여 충돌 사전 정의 필요
  - 길드 관리자가 곡선 튜닝할 UI 부담 큼 → 기본 프리셋 3종 권장
- **규모**: **L** (백엔드 + 웹 + 정책 정리)

---

#### B. 친밀도 그래프 + "베스트 프렌드 TOP" 리포트

- **활용 자산**: `VoiceCoPresencePairDaily` (이미 적재 중, **현재 소비자 0개**)
- **신규 작업**:
  - 슬래시 커맨드 `/친한친구 [user]` — TOP N 페어 Embed
  - 주간 자동 리포트(`WeeklyReportConfig`) 섹션 추가: "이번 주 베프 페어 TOP 5"
  - 웹 대시보드: 사용자 상세 페이지에 "함께 한 시간 TOP" 위젯
  - 사생활 보호: 사용자 opt-out 설정(`PrivacyConfig.disableRelationshipShare`)
- **차별화**: 적재 중인데 미사용인 데이터를 즉시 가치화. 글로벌 봇 어디에도 없음.
- **트레이드오프**:
  - 사생활 우려 → opt-out + 길드별 노출 정책 필수
  - 페어 데이터 양이 많은 길드는 쿼리 최적화(인덱스, top-k) 필요
- **규모**: **M** (데이터·인프라 이미 존재, UI/커맨드만 신규)

---

#### C. 음성 활동 뱃지 시스템 + 프로필 카드

- **활용 자산**: `VoiceDailyEntity`, `VoiceGameDaily`, `VoiceCoPresencePairDaily`, `MocoHuntingDaily`
- **신규 작업**:
  - 뱃지 정의(예시):
    - `night_owl` — 0–6시 음성 누적 N시간 이상
    - `streamer` — `streamingSec` 누적 N시간 이상
    - `game_specialist:{gameName}` — 단일 게임 100h 이상
    - `connector` — 함께 한 고유 peer 수 N명 이상
    - `newbie_helper` — 모코코 사냥 점수 상위 X%
  - 뱃지 부여 스케줄러(매일 자정, 비활동 분류와 같은 시간대)
  - 슬래시 커맨드 `/프로필 [user]` — 카드 Embed
  - (옵션) 웹 OG 이미지 생성 → 외부 공유
- **차별화**: 음성 데이터 깊이를 시각화로 외부에 노출. 트위터/X 공유로 자연 유입.
- **트레이드오프**:
  - 뱃지 설계는 콘텐츠 운영 영역 → 길드별 활성/비활성 토글 필요
  - OG 이미지 렌더링은 추가 인프라(canvas/sharp) 필요
- **규모**: **M** (커맨드+카드만 M, OG 이미지까지 가면 L)

---

### Tier 2 — Gemini 파이프라인 확장 (저비용 트렌드 흡수)

#### D. `/요약` 슬래시 커맨드 (텍스트 채널 N개 메시지 LLM 요약)

- **활용 자산**: `LlmProvider` 추상화 + `GeminiLlmProvider` + Circuit Breaker
- **신규 작업**:
  - 슬래시 커맨드 `/요약 [count: 50|100|200]` — 직전 메시지 요약 Embed
  - 길드별 일일 호출 한도(예: 50회/일) — `Redis INCR + EXPIRE`
  - 결과 캐시(채널별 5분) — 동일 요청 재호출 방지
- **차별화**: 단독 차별화는 낮음. 그러나 트렌드 충족 비용이 가장 저렴.
- **트레이드오프**:
  - 토큰 비용 변동성 → 한도/캐시 필수
  - 한국어 메시지 요약 품질 검증 필요(샘플 50건)
- **규모**: **S**

---

#### E. AI 개인화 비활동 독려 DM

- **활용 자산**: `inactive-member` 정적 DM 템플릿, `LlmProvider`, 멤버 과거 활동 패턴(자주 쓴 채널·자주 함께한 친구)
- **신규 작업**:
  - DM 생성 파이프라인: 멤버 컨텍스트(최근 30일 채널 TOP 3, peer TOP 3) → Gemini 프롬프트 → 한 줄 메시지
  - 길드별 톤 가이드 입력란("친근하게", "정중하게", "캐주얼") + 금지어 목록
  - 미리보기 API(전송 전 관리자 검수)
- **차별화**: "데이터 기반 LLM"이 아니면 절대 못 만드는 메시지. inactive-member 도메인의 가치 격상.
- **트레이드오프**:
  - 토큰 비용 → 길드별 일일 한도 + 배치 발송
  - 어조 통제 어려움 → 미리보기 + 폴백 템플릿 병행
- **규모**: **M**

---

#### F. AI 자율 역할 부여 ("Helpful Contributor" 류)

- **활용 자산**: `MocoHuntingDaily`(신규 도움 점수), `VoiceCoPresencePairDaily`(다양한 peer 분포), `VoiceDailyEntity`
- **신규 작업**:
  - 길드별 자율 역할 정의(`AutoRoleRule`) — 입력 지표·임계값·LLM 판정 사용 여부
  - 주 1회 스케줄러 — 후보 추출 → (옵션) Gemini 판정 → 역할 부여/회수
  - 부여 이력(`AutoRoleAssignmentLog`) + 웹 검토 페이지
- **차별화**: VibeBot 트렌드 직접 추격 + Onyu의 모코코·peer 데이터로 정밀도 ↑
- **트레이드오프**:
  - LLM 판정 결정의 설명 가능성 — 감사 로그 필수
  - 오부여 시 사용자 불만 → 관리자 검토 모드(자동 vs 추천)
- **규모**: **L**

---

### Tier 3 — 한국 커뮤니티 특화

#### G. 음성 출석체크 + 연속 출석 보너스

- **활용 자산**: `VoiceDailyEntity` (이미 일별 레코드 보유 → 백필 가능)
- **신규 작업**:
  - `AttendanceDaily` 엔티티(guildId, userId, date, source: VOICE_AUTO|MANUAL, streakDays)
  - 음성 입장 첫 5분 충족 시 자동 출석 처리
  - 연속 N일(예: 7/30) 시 뱃지·역할·점수 부여 → C(뱃지)와 통합 가능
  - 슬래시 커맨드 `/출석`(수동), `/출석현황`(개인 streak)
  - 웹: 길드별 출석 보상 정책 설정 페이지
- **차별화**: 한국 커뮤니티 표준 기능. nalgang.py 등은 메시지 기반 → Onyu은 음성 기반(자동성 ↑).
- **트레이드오프**:
  - 보상 인플레이션 위험 → 시즌 단위 리셋 옵션
  - "5분 미만" 입퇴장 어뷰징 방지 필요
- **규모**: **M**

---

#### H. LFG (파티 모집) + auto-channel 연계

- **활용 자산**: `auto-channel`(트리거→대기방→확정방), `VoiceGameActivity/Daily`(같은 게임 자주 하는 사람 후보)
- **신규 작업**:
  - 슬래시 커맨드 `/파티 게임:<자동완성> 인원:<N> 메모:<text>`
  - 모집 메시지 Embed + 참가/취소 버튼 → 인원 충원 시 auto-channel API 호출하여 임시방 자동 생성 + 신청자 자동 이동
  - 게임 자동완성: `VoiceGameDaily`에서 길드 인기 게임 TOP 20
  - (옵션) 후보 추천: "이 게임을 자주 하는 멤버" 5명 멘션 옵션
- **차별화**: 일반 LFG 봇은 음성방 생성까지만 → Onyu은 데이터 기반 후보 추천까지 가능
- **트레이드오프**:
  - auto-channel 도메인과의 책임 분리 필요(LFG가 owner, auto-channel이 executor)
  - 멘션 추천은 사생활 이슈 → opt-out 필수
- **규모**: **L**

---

### Tier 4 — 기본기 보강 (차별화는 약함)

#### I. 리액션 롤

- **활용 자산**: `status-prefix` Embed+버튼 설정 패턴 (구조 그대로 재사용)
- **신규 작업**: status-prefix와 거의 동일한 CRUD + 인터랙션 핸들러. 다만 닉네임 대신 역할 부여/회수.
- **차별화**: 없음. 표준 기능.
- **트레이드오프**: 차별화 0이지만, "기본기" 평가 측면에서 검토 가치는 있음.
- **규모**: **S~M**

---

#### J. AI 컨텍스트 모더레이션 (한국어 강점)

- **활용 자산**: `LlmProvider` + Gemini Flash(한국어 강점)
- **신규 작업**:
  - 메시지 인터셉트 → Gemini 판정 → 임계 초과 시 차단/타임아웃
  - 길드별 정책(차단 카테고리, 임계, 화이트리스트)
  - 감사 로그(원문·판정·조치)
- **차별화**: 글로벌 봇은 한국어 반어/슬랭 약함. Gemini 한국어 강점 활용 시 차별화 가능.
- **트레이드오프**:
  - 운영 책임 ↑(거짓 양성 고객 응대)
  - 모든 메시지에 LLM 호출 비용 막대 → 사전 키워드 필터 + LLM은 의심군에만
  - **본 봇 정체성(음성 분석)과 거리 있음** → 권장도 낮음
- **규모**: **XL**

---

## 5. 추천 우선순위 및 사유

Onyu의 정체성은 "**음성 활동 데이터의 깊이**"이며, 본 로드맵은 이 정체성을 강화하는 방향을 우선한다.

### 추천 1순위: **B + D** (빠른 가치, 1~2주 내 출시 가능)

- B(친밀도 리포트): 이미 적재 중인 데이터의 즉시 가치화. 인프라 비용 0.
- D(/요약): LLM 인프라 재활용. 트렌드 충족 비용 최저.
- 합계 규모: M+S

### 추천 2순위: **A + C** (정체성 강화 핵심 투자, 1~2개월)

- A(음성 XP): "음성 봇 = Onyu" 포지셔닝의 결정적 한 수. Arcane 대체 가능.
- C(뱃지·프로필): A의 가시화. 외부 공유 유입 통로.
- 합계 규모: L+M

### 추천 3순위: **G + H** (한국 커뮤니티 시너지)

- G(출석체크): 한국 표준 기능, 데이터·UI 모두 기존 자산 재활용.
- H(LFG): auto-channel과 결합 시 시장 차별화 명확.
- 합계 규모: M+L

### 비권장: **J(AI 모더레이션)**

- 정체성과 거리, 운영 부담 큼, 대형 봇과 정면 경쟁. 신중 검토.

---

## 6. 결정 필요 사항

본 문서를 PRD/Plan 단계로 발전시키기 전에 다음 결정이 필요하다.

| 결정 항목 | 옵션 |
|-----------|------|
| 1순위 라인 | (a) B+D 빠른 트랙 / (b) A+C 정체성 트랙 / (c) G+H 한국형 트랙 / (d) 위 외 조합 |
| LLM 비용 한도 정책 | 길드별 일일 호출 한도 도입 여부 및 기준 |
| 보상 시스템 운영 모델 | XP/뱃지/출석 보상의 통합(`reward` 도메인 신설) 여부 |
| 사생활 정책 | 친밀도/peer 데이터 노출에 대한 길드/사용자 opt-out 기본값 |

위 결정이 내려지면, 채택된 후보는 개별 PRD(`docs/specs/prd/<domain>.md`) 및 Plan(`docs/plans/<feature>.md`) 문서로 분기하여 상세화한다.

---

## 7. 참고 자료

- [Best Discord Bots 2026 (VibeBot)](https://www.vibebot.gg/blog/best-discord-bots-2026)
- [Best Discord Bots 2026 (CopyKitten)](https://copykitten.gg/best-discord-bots-2026/)
- [Discord AI Bot for Community Management 2026 (Optimum-Web)](https://www.optimum-web.com/blog/discord-ai-bot-community-management-2026/)
- [Best AI Discord Bots in 2026 (eesel AI)](https://www.eesel.ai/blog/discord-ai)
- [Best Discord Moderation Bots in 2026 (sfw.bot)](https://sfw.bot/blog/best-discord-moderation-bots-2026)
- [VoiceMaster — Temporary Voice Channels](https://voicemaster.xyz/)
- [Teamplay LFG Bot](https://teamplay.gg/discord-lfg-bot)
- [GameTree Discord LFG Bot](https://gametree.me/discord-lfg-bot/)
- [Top Level Bots Discord (CommunityOne)](https://blog.communityone.io/top-level-bots-discord-2025/)
- [Carl-bot Dashboard](https://carl.gg/)
- [nalgang.py — 출석체크 봇](https://github.com/YoungseokCh/nalgang.py)
- [Discord/봇/국내 (나무위키)](https://namu.wiki/w/Discord/%EB%B4%87/%EA%B5%AD%EB%82%B4)
