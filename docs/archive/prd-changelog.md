# PRD 변경이력

모든 PRD 변경이력은 이 파일에 기록한다.
PRD 본문(`/docs/specs/prd/*.md`)에는 변경이력을 직접 작성하지 않는다.

## 문서 이력 테이블

| 버전 | 날짜 | 변경 요약 | 작성자 |
|------|------|-----------|--------|
| v3.6 | 2026-03-14 | web: 대시보드 사이드바에 서버 개요(F-WEB-008)·신입 관리(F-WEB-009) 추가, F-WEB-003-B 진입점 갱신 | — |
| v3.5 | 2026-03-14 | newbie: F-WEB-NEWBIE-001 설정 페이지 탭 구성 변경 — 탭 3(미션 관리) 제거 및 탭 번호 재조정, F-NEWBIE-005 웹 UI 위치를 대시보드로 명시 | — |
| v3.4 | 2026-03-14 | self-diagnosis: HHI 표시 레이어를 "관계 다양성 점수"(0~100점)로 변환 (F-SD-003, F-SD-004, F-SD-005, F-SD-008) | — |
| v3.3 | 2026-03-14 | voice-co-presence: 관계 분석 대시보드 기능 추가 (F-COPRESENCE-007 ~ F-COPRESENCE-013) | — |
| v3.2 | 2026-03-14 | inactive-member: 비활동 회원 관리 도메인 PRD 신규 추가 (F-INACTIVE-001 ~ F-INACTIVE-005) | — |
| v3.1 | 2026-03-10 | monitoring: 봇 모니터링 도메인 PRD 신규 추가 (F-MONITORING-001 ~ F-MONITORING-004, F-WEB-MONITORING-001) | — |
| v3.0 | 2026-03-10 | newbie: F-NEWBIE-005 미션 수동 관리 (성공/실패 처리, Embed 숨김) 추가, Embed 전체 상태 표시로 변경 | — |
| v2.9 | 2026-03-10 | voice: F-VOICE-022 `/me` 커맨드 (개인 음성 프로필 카드) 추가, `/voice-time`·`/voice-rank` 대체 삭제 명세 | — |
| v2.8 | 2026-03-09 | web: F-WEB-003-B 채널별 바차트에 카테고리별 탭 추가, F-WEB-007 채널별 도넛차트에 카테고리별 탭 추가 및 입퇴장 이력 테이블에 카테고리 컬럼 추가 | — |
| v2.7 | 2026-03-09 | voice: 채널 카테고리(parentId) 정보 추가 — Channel/VoiceDailyEntity 데이터 모델 확장, F-VOICE-017/018/020 응답 스키마 갱신, F-VOICE-021 신규 추가 | — |
| v2.6 | 2026-03-09 | web: 유저 상세 페이지(F-WEB-007) 추가 / voice: 유저별 음성 일별 통계 API(F-VOICE-018), 멤버 검색 API(F-VOICE-019), 유저 입퇴장 이력 API(F-VOICE-020) 추가 | — |
| v2.5 | 2026-03-09 | voice: 음성 일별 통계 조회 API(F-VOICE-017) 추가 / web: F-WEB-003-B 대시보드 상태 업데이트 | — |
| v2.4 | 2026-03-08 | web: 음성 설정 페이지(F-WEB-006) 추가 | — |
| v2.3 | 2026-03-08 | voice: 음성 시간 제외 채널(VoiceExcludedChannel) 기능 추가 | — |
| v2.2 | 2026-03-08 | newbie: 플레이횟수 카운팅 옵션(최소 참여시간/시간 간격) 추가 | — |
| v2.1 | 2026-03-08 | sticky-message: 고정메세지 도메인 PRD 신규 추가 | — |
| v2.0 | 2026-03-08 | web/voice: 자동방 설정 다중 탭 UI 및 AutoChannelConfig name 컬럼 추가 | — |
| v1.9 | 2026-03-08 | voice: Auto Channel 데이터 모델 및 Redis 키 구조 코드베이스 기준 동기화 | — |
| v1.8 | 2026-03-08 | web: 라우트 경로 코드베이스 기준 수정 및 F-WEB-003/004 UI 명세 갱신 | — |
| v1.7 | 2026-03-08 | newbie: Embed 커스터마이징 필드 추가 및 웹 경로 수정 | — |
| v1.6 | 2026-03-08 | general: 커맨드 목록 API를 글로벌 커맨드 조회로 수정 | — |
| v1.5 | 2026-03-08 | 일반설정(general) 도메인 PRD 신규 추가 | — |
| v1.4 | 2026-03-08 | newbie: 미션/모코코 Embed 템플릿 커스터마이징 시스템 추가 | — |
| v1.3 | 2026-03-08 | 게임방 상태 접두사(status-prefix) 도메인 PRD 신규 추가 | — |
| v1.2 | 2026-03-08 | 신규사용자 관리(newbie) 도메인 PRD 신규 추가 | — |
| v1.1 | 2026-03-08 | 자동방 생성(Auto Channel) 기능 추가 | — |

---

## [수정 25] web: 대시보드 재구성 — 서버 개요 및 신입 관리 대시보드 추가 (WEB-DASHBOARD-REORG)

**변경일**: 2026-03-14
**티켓**: WEB-DASHBOARD-REORG

**변경 파일**:
- `docs/specs/prd/web.md` — F-WEB-008(서버 개요 페이지), F-WEB-009(신입 관리 대시보드) 신규 추가, F-WEB-003-B 진입점 갱신, DashboardSidebar 메뉴 구성 명세 추가, 관련 모듈 목록 갱신

**변경 내용**:
1. **관련 모듈 목록 갱신**: `overview/page.tsx`, `newbie/page.tsx`, `overview-api.ts`, `newbie-dashboard-api.ts` 파일 항목 추가
2. **현재 구현 상태 갱신**: "대시보드 페이지 미구현" 항목을 서버 개요(`/overview`)·신입 관리 대시보드(`/newbie`) 명세 완료·미구현 상태로 분리
3. **F-WEB-003-B 진입점 갱신**: 대시보드 첫 화면이 `/voice`에서 `/overview`(F-WEB-008)로 변경됨을 반영
4. **F-WEB-008 (서버 개요 페이지) 신규 추가**: 경로 `/dashboard/guild/{guildId}/overview`. 섹션 4종(요약 카드, 신입 미션 현황 카드, 최근 7일 음성 활동 미니 차트, 비활동 회원 요약), `missionEnabled = false` 시 미션 카드 비표시 Disable 처리, `GET /api/guilds/{guildId}/overview` API 명세
5. **F-WEB-009 (신입 관리 대시보드) 신규 추가**: 경로 `/dashboard/guild/{guildId}/newbie`. 탭 2개 구성(미션 관리/모코코 순위). 전체 Disable 처리(두 기능 모두 비활성 시 안내 화면, 하나만 비활성 시 해당 탭 비활성). 탭 1(미션 관리): 진행 중·이력 서브탭, 상태 변경 모달, Embed 토글, `missionEnabled = false` 시 읽기 전용/빈 상태 Disable 처리. 탭 2(모코코 순위): 기간 표시, 점수 분포 카드, 순위 테이블, 사냥꾼 상세 펼침, `mocoEnabled = false` 시 Disable 처리. 호출 API 8종 명세
6. **DashboardSidebar 메뉴 구성 명세 추가**: F-WEB-009 하위에 사이드바 7개 메뉴 항목(서버 개요·음성 활동·유저 검색·신입 관리·비활동 회원·관계 분석·모니터링) 경로 포함 tree 형태로 문서화

**변경 사유**: 대시보드 진입 시 서버 상태를 한눈에 파악할 수 있는 서버 개요 페이지를 첫 화면으로 추가하고, 설정 페이지에서 이동된 미션 수동 관리 기능과 모코코 순위를 단일 신입 관리 대시보드 페이지로 통합하여 관리 효율성을 높인다.

---

## [수정 24] newbie: F-WEB-NEWBIE-001 설정 페이지 탭 구성 변경 (NEWBIE-TAB-REORG)

**변경일**: 2026-03-14
**티켓**: NEWBIE-TAB-REORG

**변경 파일**:
- `docs/specs/prd/newbie.md` — F-WEB-NEWBIE-001 탭 구성 테이블 수정, 탭 3(미션 관리) 섹션 삭제, 탭 번호 재조정, F-NEWBIE-005 웹 UI 위치 명시

**변경 내용**:
1. **탭 구성 테이블** 수정: 탭 3(미션 관리, F-NEWBIE-005) 행 제거. 기존 탭 4(모코코 사냥 설정)를 탭 3으로, 기존 탭 5(신입기간 설정)를 탭 4로 번호 조정. 최종 탭 구성: 탭1=환영인사 설정, 탭2=미션 설정, 탭3=모코코 사냥 설정, 탭4=신입기간 설정
2. **탭 구성 테이블 하단** 에 F-NEWBIE-005 웹 UI 제공 위치 안내 주석 추가 (`/dashboard/guild/{guildId}/newbie`)
3. **탭 3(미션 관리) 섹션 전체 삭제**: 진행 중/이력 뷰 테이블 및 관련 UI 요소 명세 삭제
4. **탭 4 → 탭 3 번호 조정**: 헤더(`#### 탭 4: 모코코 사냥 설정` → `#### 탭 3: 모코코 사냥 설정`) 및 내부 소제목(`##### 템플릿 설정 섹션 (탭 4)` → `##### 템플릿 설정 섹션 (탭 3)`) 변경
5. **탭 5 → 탭 4 번호 조정**: 헤더(`#### 탭 5: 신입기간 설정` → `#### 탭 4: 신입기간 설정`) 변경
6. **저장 동작(템플릿) 섹션** 의 탭 번호 참조에 탭 이름 추가 (탭 2 → "탭 2(미션 설정)", 탭 3 → "탭 3(모코코 사냥 설정)")
7. **F-NEWBIE-005 기능 상세 섹션** 에 웹 UI 위치 안내 추가: "웹 UI 위치: 대시보드(`/dashboard/guild/{guildId}/newbie`). 설정 페이지에는 포함하지 않는다."

**변경 사유**: 미션 수동 관리(F-NEWBIE-005) UI가 설정 페이지(`/settings/guild/{guildId}/newbie`)에서 대시보드(`/dashboard/guild/{guildId}/newbie`)로 이동됨에 따라, 설정 페이지의 탭 구성에서 "미션 관리" 탭을 제거하고 나머지 탭 번호를 재조정한다. 백엔드 API 명세(F-NEWBIE-005)는 위치 이동 없이 유지한다.

---

## [수정 23] self-diagnosis: HHI 표시 레이어를 "관계 다양성 점수"로 변환 (SD-HHI-UX)

**변경일**: 2026-03-14
**티켓**: SD-HHI-UX

**변경 파일**:
- `docs/specs/prd/self-diagnosis.md` — F-SD-003, F-SD-004, F-SD-005, F-SD-008 내 HHI 관련 표시 방식 변경

**변경 내용**:
1. **F-SD-003 (VoiceHealthConfig)**: `hhiThreshold` 컬럼 설명에 "DB 저장값은 HHI 원본(0~1), UI에서는 `관계 다양성 점수 = (1 - HHI) × 100`으로 변환 표시" 추가. `badgeSocialHhiMax` 컬럼도 동일 내용 추가
2. **F-SD-004 (진단 로직)**: HHI 계산 섹션 다음에 "관계 다양성 점수 변환" 서브 섹션 신규 추가 — 변환 공식(`diversityScore = Math.round((1 - hhi) * 100)`), 변환 예시 3종, 구현 위치(`hhi-calculator.ts`의 `hhiToDiversityScore()` 유틸 함수), 프리셋 정의 테이블(느슨 50점/보통 70점/엄격 80점) 명세
3. **F-SD-005 (Embed 렌더링)**: 모드 A/B 예시 내 HHI 수치 표기를 다양성 점수 기반으로 변경
   - "HHI: 0.180 (낮을수록 다양)" → "관계 다양성: 82점 / 100"
   - "✅ 관계 다양성: HHI 0.180 (기준: HHI 0.3 이하)" → "✅ 관계 다양성: 82점 (기준: 70점 이상)"
   - "🌐 사교왕 — HHI 0.25 이하 & 교류 5명 이상 (HHI 0.180, 12명)" → "🌐 사교왕 — 다양성 75점 이상 & 교류 5명 이상 (현재 82점, 12명)" (모드 A, B 동일 적용)
4. **F-SD-008 (웹 대시보드)**: 섹션 2(정책 기준)의 "HHI 임계값 슬라이더"를 "관계 다양성 점수 슬라이더"로 변경 — 0~100점 범위, 기본 70점, 역변환 공식(`hhiThreshold = (100 - score) / 100`) 및 프리셋 버튼 3개(느슨/보통/엄격) UI 명세 추가. 섹션 3(뱃지 기준)의 "사교왕 HHI 상한 슬라이더"를 "사교왕 다양성 점수 슬라이더"로 변경 — 0~100점 범위, 기본 75점, 역변환 공식(`badgeSocialHhiMax = (100 - score) / 100`) 명세 추가

**변경 사유**: HHI 원본값(0.00~1.00, 낮을수록 좋음)은 일반 사용자와 관리자가 직관적으로 이해하기 어렵다. "관계 다양성 점수"(0~100점, 높을수록 좋음)로 표시 레이어에서만 변환하여 UX를 개선한다. DB 저장값과 내부 로직은 HHI 원본값을 유지하므로 데이터 무결성에 영향 없음.

---

## [수정 22] voice-co-presence: 관계 분석 대시보드 기능 추가 (COPRESENCE-ANALYTICS)

**변경일**: 2026-03-14
**티켓**: COPRESENCE-ANALYTICS

**변경 파일**:
- `docs/specs/prd/voice-co-presence.md` — 관계 분석 대시보드 섹션 추가 (F-COPRESENCE-007 ~ F-COPRESENCE-013), 마이그레이션 전략 Phase 4 구체화

**변경 내용**:
1. **마이그레이션 전략 Phase 4** 항목을 "(향후) 사용자 관계 분석 기능 구현"에서 구체적인 기능 ID 참조(F-COPRESENCE-007 ~ F-COPRESENCE-013)로 갱신
2. **"관계 분석 대시보드 (Phase 4)" 섹션** 신규 추가 — 관련 모듈, 기능 상세 7종, 백엔드 API 요약, 프론트엔드 파일 구조, 의존성, 기존 기능과의 관계 포함
3. **F-COPRESENCE-007 (관계 분석 요약 카드)**: 라우트 `/dashboard/guild/[guildId]/co-presence`. 기간 선택(7/30/90일). 활성 멤버 수, 총 관계 수, 총 동시접속 시간, 평균 관계 수/인 카드 4종. `GET /summary?days=30` API 명세
4. **F-COPRESENCE-008 (네트워크 그래프 시각화)**: `@react-sigma/core` + `graphology` 사용. 노드(크기=접속시간, 색상=Louvain 클러스터), 엣지(두께=동시접속시간). 줌/패닝/클릭 하이라이트/최소 임계값 슬라이더. 노드 상한 50명. `GET /graph?days=30&minMinutes=10` API 명세
5. **F-COPRESENCE-009 (친밀도 TOP N 패널)**: `PairDaily` 기준 `SUM(minutes)` 상위 10쌍. 유저 아바타 ↔ 구분, 총 시간, 세션 수. `GET /top-pairs?days=30&limit=10` API 명세. 아바타 Discord CDN 출처 명세
6. **F-COPRESENCE-010 (고립 멤버 감지)**: `VoiceCoPresenceDaily` 존재 && `VoiceCoPresencePairDaily` 없음 조건. 유저명, 총 음성 접속 시간, 마지막 음성 접속일 표시. `GET /isolated?days=30` API 명세
7. **F-COPRESENCE-011 (관계 상세 테이블)**: 전체 쌍 목록 5컬럼(유저A/B, 총 시간, 세션 수, 마지막 날짜). 유저명 검색 필터, 20건/페이지 페이지네이션, 컬럼 정렬. `GET /pairs?days=30&search=&page=1&limit=20` API 명세. `userId < peerId` 중복 제거 조건 명시
8. **F-COPRESENCE-012 (일별 동시접속 추이 차트)**: Recharts `AreaChart`. X축=날짜, Y축=서버 전체 총 동시접속 분. 양방향 보정(/2). `GET /daily-trend?days=30` API 명세
9. **F-COPRESENCE-013 (특정 쌍 일별 상세 모달)**: F-COPRESENCE-011 행 클릭 시 모달. Recharts `BarChart` (날짜별 쌍 동시접속 분). `GET /pair-detail?userA=&userB=&days=30` API 명세
10. **백엔드 API 요약 테이블**: `CoPresenceAnalyticsController` 컨트롤러 명세. 엔드포인트 7종, JwtAuthGuard 적용
11. **프론트엔드 파일 구조**: `apps/web/app/dashboard/guild/[guildId]/co-presence/` 경로 아래 7개 컴포넌트 파일 및 `co-presence-api.ts` API 클라이언트 명세
12. **의존성 추가**: `@react-sigma/core`, `graphology`, `graphology-communities-louvain` 3개 패키지 명세
13. **기존 기능과의 관계**: 관계 분석 대시보드의 읽기 전용 특성, 비활동 회원 도메인과의 독립성, `DashboardSidebar` 메뉴 연동 필요 사항 명세

**변경 사유**: 마이그레이션 전략 Phase 4에 기술된 "사용자 관계 분석 기능" 계획을 구체화. Co-Presence 도메인이 축적한 `VoiceCoPresencePairDaily` / `VoiceCoPresenceDaily` 데이터를 활용하여 네트워크 그래프, 친밀도 순위, 고립 멤버 감지 등 관계 분석 기능을 웹 대시보드에 제공하기 위한 요구사항 명세.

---

## [수정 21] inactive-member: 비활동 회원 관리 도메인 PRD 신규 추가 (INACTIVE-MEMBER)

**변경일**: 2026-03-14
**티켓**: INACTIVE-MEMBER

**변경 파일**:
- `docs/specs/prd/inactive-member.md` — inactive-member 도메인 PRD 신규 작성 (F-INACTIVE-001 ~ F-INACTIVE-005)
- `docs/specs/prd/_index.md` — 도메인 목록, 핵심 기능 요약, 데이터베이스 엔티티 테이블에 inactive-member 항목 추가

**변경 내용**:
1. `docs/specs/prd/inactive-member.md` 신규 생성: 개요, 관련 모듈, 아키텍처, 기능 상세, 데이터 모델, API 엔드포인트, 기존 기능과의 관계, 제약사항 포함
2. F-INACTIVE-001 (비활동 회원 자동 분류): 매일 00:00 KST 스케줄러 실행. `VoiceDailyEntity.channelDurationSec` 집계로 판단 기간 내 총 음성 접속 시간 계산. FULLY_INACTIVE(0분) / LOW_ACTIVE(임계값 미만) / DECLINING(이전 기간 대비 N% 감소) 3등급 분류. 제외 역할(`excludedRoleIds`) 설정 지원
3. F-INACTIVE-002 (웹 대시보드 비활동 회원 목록): `/dashboard/guild/{guildId}/inactive-member` 경로. 닉네임·분류 등급·마지막 음성 접속일·총 접속 시간·등급 변경일 컬럼 표시. 등급/기간/정렬 필터, 닉네임 검색, 일괄 선택 체크박스, 오프셋 기반 페이지네이션(20명/페이지)
4. F-INACTIVE-003 (비활동 회원 조치 액션): ACTION_DM(독려 DM 일괄 전송, Embed 템플릿 변수 지원) / ACTION_ROLE_ADD(비활동 역할 부여) / ACTION_ROLE_REMOVE(특정 역할 제거) 3종. 모든 조치는 `InactiveMemberActionLog`에 기록. 자동 조치 규칙(FULLY_INACTIVE 판정 시 자동 역할 부여/DM 발송) ON/OFF 설정 지원
5. F-INACTIVE-004 (비활동 통계 대시보드): 활동/비활동 비율 파이 차트, 주/월별 비활동 추이 라인 차트(등급별 3개 라인), 활동 복귀 회원 하이라이트
6. F-INACTIVE-005 (길드별 설정): `/settings/guild/{guildId}/inactive-member` 경로. 판단 기간(7/14/30일), 저활동 임계값(분), 활동 감소 비율(%) 설정. 자동 조치 ON/OFF, 역할 설정, 제외 역할 멀티 셀렉트, DM Embed 템플릿 커스텀(제목/본문/색상/실시간 미리보기)
7. 데이터 모델 3개 신규 추가: `InactiveMemberConfig`(길드별 설정), `InactiveMemberRecord`(분류 스냅샷, 복합 유니크 guildId+userId), `InactiveMemberActionLog`(조치 이력)
8. REST API 6종 명세: 목록 조회(쿼리 파라미터 7종), 통계 조회, 조치 실행, 설정 조회/저장, 이력 조회
9. `_index.md` 도메인 목록에 inactive-member 행 추가
10. `_index.md` 핵심 기능 요약 12번 항목(비활동 회원 관리) 추가
11. `_index.md` 데이터베이스 엔티티 테이블에 InactiveMemberConfig / InactiveMemberRecord / InactiveMemberActionLog 행 추가

**변경 사유**: 디스코드 서버 음성 채널 비활동 회원을 자동 식별하고 관리자가 웹 대시보드에서 조치할 수 있는 기능 요구사항 반영. 기존 `VoiceDailyEntity` 데이터를 재활용하여 별도 음성 이벤트 리스너 없이 구현 가능한 구조로 설계.

---

## [수정 20] monitoring: 봇 모니터링 도메인 PRD 신규 추가 (BOT-MONITORING)

**변경일**: 2026-03-10
**티켓**: BOT-MONITORING

**변경 파일**:
- `docs/specs/prd/monitoring.md` — monitoring 도메인 PRD 신규 작성 (F-MONITORING-001 ~ F-MONITORING-004, F-WEB-MONITORING-001)
- `docs/specs/prd/_index.md` — 도메인 목록, 핵심 기능 요약, 데이터베이스 엔티티 테이블에 monitoring 항목 추가

**변경 내용**:
1. `docs/specs/prd/monitoring.md` 신규 생성: 개요, 관련 모듈, 아키텍처, 기능 상세, 데이터 모델, Redis 키 구조, 외부 의존성, web 도메인 연계 명세 포함
2. F-MONITORING-001 (실시간 봇 상태 조회): `GET /api/guilds/{guildId}/bot/status` 엔드포인트 명세. Discord Client에서 online/uptime/ping/guildCount/memory/voiceUserCount 수집, Redis 10초 캐시
3. F-MONITORING-002 (메트릭 수집 스케줄러): 1분 간격 Cron으로 길드별 BotMetric 레코드 INSERT. status/pingMs/heapUsedMb/heapTotalMb/voiceUserCount/guildCount 수집
4. F-MONITORING-003 (시계열 메트릭 조회 API): `GET /api/guilds/{guildId}/bot/metrics` 엔드포인트 명세. from/to/interval 파라미터, date_trunc 기반 집계(1m/5m/1h/1d), availabilityPercent 계산
5. F-MONITORING-004 (메트릭 보존 정책): 매일 03:00 Cron으로 30일 초과 레코드 일괄 삭제
6. F-WEB-MONITORING-001 (모니터링 대시보드 페이지): `/dashboard/guild/{guildId}/monitoring` 경로, 상태 요약 카드 6개(봇 상태/업타임/핑/서버 수/메모리/음성 접속자), 차트 4개(업타임 히스토리 AreaChart, 핑 추이 LineChart, 메모리 추이 AreaChart, 시간대별 음성 접속자 BarChart), 기간 프리셋(24시간/7일/30일)
7. BotMetric 데이터 모델: `bot_metric` PostgreSQL 엔티티 명세 (guildId, status enum, pingMs, heapUsedMb, heapTotalMb, voiceUserCount, guildCount, recordedAt) 및 인덱스 2개
8. Redis 키 구조: `monitoring:status` (10초 TTL, 실시간 상태 캐시)
9. `_index.md` 도메인 목록에 monitoring 행 추가
10. `_index.md` 핵심 기능 요약 11번 항목(봇 모니터링) 추가
11. `_index.md` 데이터베이스 엔티티 테이블에 BotMetric 행 추가

**변경 사유**: 봇 상태(온라인/오프라인, 업타임, 핑, 메모리)와 서버 음성 접속자 추이를 웹 대시보드에서 시계열 차트로 모니터링하는 기능 요구사항 반영.

---

## [수정 19] newbie: 미션 수동 관리 기능 추가 (NEWBIE-MISSION-MANAGE)

**변경일**: 2026-03-10
**티켓**: NEWBIE-MISSION-MANAGE

**변경 파일**:
- `docs/specs/prd/newbie.md` — F-NEWBIE-005 신규 추가, F-NEWBIE-002 Embed 표시 범위 변경, NewbieMission 데이터 모델 확장, F-WEB-NEWBIE-001 탭 구성 변경, 아키텍처 API 목록 갱신

**변경 내용**:
1. **F-NEWBIE-005 (미션 수동 관리)** 신규 추가:
   - 관리자가 웹 대시보드에서 `IN_PROGRESS` 미션을 수동으로 성공/실패 처리
   - 성공 처리 시 옵션: Discord 역할 부여 (서버 역할 드롭다운 선택)
   - 실패 처리 시 옵션: 멤버 강퇴 (kick), 강퇴 전 DM 사유 메시지 전송
   - Embed 숨김: 특정 미션을 Discord Embed에서 제거 (`hiddenFromEmbed` 플래그)
   - 모든 옵션은 선택 사항 (역할 부여, 강퇴, DM 모두 옵션)
   - F-NEWBIE-004(신입기간 역할 자동관리)와 독립 동작
   - API 엔드포인트 4개: `GET missions/history`, `POST missions/complete`, `POST missions/fail`, `POST missions/hide`
   - 요청/응답 본문 스키마 정의, 에러 처리 및 warning 응답 규칙 명세
2. **F-NEWBIE-002 Embed 표시 범위 변경**:
   - 기존: `IN_PROGRESS` 상태 미션만 Embed에 표시
   - 변경: 모든 상태(IN_PROGRESS, COMPLETED, FAILED)의 미션을 Embed에 표시. `hiddenFromEmbed = true`인 미션은 제외
3. **NewbieMission 데이터 모델** 컬럼 1개 추가:
   - `hiddenFromEmbed` | `boolean` | NOT NULL, DEFAULT `false` | Embed 표시 제외 여부
   - 인덱스 추가: `IDX_newbie_mission_guild_visible` — `(guildId, hiddenFromEmbed)` — Embed 표시 대상 미션 조회
4. **F-WEB-NEWBIE-001 탭 구성 변경**:
   - 기존 4개 탭 → 5개 탭으로 확장
   - 탭 3 "미션 관리" 신규 추가 (F-NEWBIE-005 대응)
   - 탭 3 UI: 진행 중 미션 섹션(액션 버튼 포함) + 전체 이력 섹션(상태 필터, 페이지네이션)
   - 기존 모코코 사냥 설정 → 탭 4, 신입기간 설정 → 탭 5로 이동
5. **아키텍처 다이어그램** Web Dashboard API 섹션에 신규 엔드포인트 4개 추가

**변경 사유**: 관리자가 웹 대시보드에서 신입미션을 수동으로 관리(성공/실패 처리, 역할 부여, 강퇴, Embed 숨김)할 수 있는 기능 요구사항 반영. 미션 Embed가 완료/실패 멤버도 표시하도록 변경하고, 관리자가 특정 멤버를 Embed에서 수동 제거할 수 있도록 함.

---

## [수정 18] web: 카테고리별 탭 및 입퇴장 이력 카테고리 컬럼 추가 (WEB-CATEGORY-TAB)

**변경일**: 2026-03-09
**티켓**: WEB-CATEGORY-TAB

**변경 파일**:
- `docs/specs/prd/web.md` — F-WEB-003-B 채널별 바차트에 카테고리별 탭 추가, F-WEB-007 채널별 도넛차트에 카테고리별 탭 추가 및 입퇴장 이력 테이블 5열 구조로 변경

**변경 내용**:
1. **F-WEB-003-B (음성 대시보드) — ChannelBarChart 카테고리별 탭 추가**:
   - 채널별 바차트(ChannelBarChart) 위에 [채널별 | 카테고리별] 탭 UI 추가
   - "채널별" 탭: 기존과 동일 (채널별 channelDurationSec 바차트)
   - "카테고리별" 탭: VoiceDailyRecord의 categoryId/categoryName으로 프론트엔드에서 집계하여 카테고리 단위 바차트 표시. categoryName이 null인 레코드는 "미분류" 등 별도 항목으로 묶어 표시
   - API 변경 없음 (기존 응답의 categoryId, categoryName 필드 활용)
2. **F-WEB-007 (유저 상세 페이지) — UserChannelPieChart 카테고리별 탭 추가**:
   - 채널별 활동 비율 도넛차트(UserChannelPieChart) 위에 [채널별 | 카테고리별] 탭 UI 추가
   - "채널별" 탭: 기존과 동일 (채널별 channelDurationSec 합계 비율 도넛 차트)
   - "카테고리별" 탭: categoryId/categoryName으로 프론트엔드에서 집계하여 카테고리 단위 도넛 차트 표시. categoryName이 null인 레코드는 "미분류" 등 별도 항목으로 묶어 표시
   - API 변경 없음
3. **F-WEB-007 (유저 상세 페이지) — 입퇴장 이력 테이블 카테고리 컬럼 추가**:
   - 기존 4열(채널명 | 입장 | 퇴장 | 시간) → 5열(카테고리 | 채널명 | 입장 | 퇴장 | 시간)로 변경
   - categoryName을 첫 번째 컬럼으로 추가. null인 경우 "—" 또는 빈 값 표시
   - API 변경 없음 (F-VOICE-020 응답에 이미 categoryId, categoryName 포함)

**변경 사유**: F-VOICE-021에서 VoiceDailyRecord 및 VoiceChannelHistory 응답에 categoryId/categoryName이 추가됨에 따라, 웹 대시보드와 유저 상세 페이지에서 해당 정보를 카테고리 단위 집계 및 컬럼 표시로 활용하는 UI 요구사항 반영.

---

## [수정 17] voice: 채널 카테고리(parentId) 정보 추가 (VOICE-CATEGORY)

**변경일**: 2026-03-09
**티켓**: VOICE-CATEGORY

**변경 파일**:
- `docs/specs/prd/voice.md` — Channel 데이터 모델 확장, VoiceDailyEntity 데이터 모델 확장, F-VOICE-001/002 동작 갱신, F-VOICE-017/018/020 응답 스키마 갱신, F-VOICE-021 신규 추가

**변경 내용**:
1. **Channel 데이터 모델** 컬럼 2개 추가:
   - `categoryId` (string, nullable) — 디스코드 카테고리 채널 ID (parentId). 카테고리 없는 채널은 null
   - `categoryName` (string, nullable) — 카테고리명 캐시. 카테고리 없는 채널은 null
2. **VoiceDailyEntity 데이터 모델** 컬럼 2개 추가:
   - `categoryId` (string, nullable) — 카테고리 채널 ID 캐시 (비정규화). GLOBAL 레코드는 null
   - `categoryName` (string, nullable) — 카테고리명 캐시 (비정규화). GLOBAL 레코드 또는 카테고리 없는 채널은 null
   - 비정규화 정책 명세 추가 (기존 channelName/userName 패턴과 동일)
3. **F-VOICE-001** 동작 2항 갱신: Channel 생성/갱신 시 F-VOICE-021에 따라 Discord API에서 parentId와 카테고리명을 조회하여 저장
4. **F-VOICE-002** 동작 3항 갱신: VoiceDailyEntity 개별 채널 레코드 upsert 시 `categoryId`, `categoryName` 함께 저장
5. **F-VOICE-017** 응답 스키마 갱신: `categoryId`, `categoryName` 필드 추가 (null 케이스 명세 포함)
6. **F-VOICE-018** 응답 스키마 갱신: `categoryId`, `categoryName` 필드 추가 (GLOBAL 레코드는 null)
7. **F-VOICE-020** 응답 스키마 갱신: 히스토리 항목에 `categoryId`, `categoryName` 필드 추가 (Channel 엔티티 값 반환, null 케이스 명세 포함)
8. **F-VOICE-021** (채널 카테고리 정보 수집 및 저장) 신규 추가:
   - Discord API(`guild.channels.fetch`)로 채널의 `parentId` 조회
   - `parentId` 유무에 따라 Channel 엔티티의 `categoryId`, `categoryName` 저장/갱신
   - VoiceDailyEntity 개별 채널 레코드 upsert 시 Channel에서 읽은 카테고리 정보 함께 저장
   - GLOBAL 레코드에는 카테고리 필드 null 설정
   - 기존 데이터 처리 정책: 이전 레코드는 null 유지, 재입장 시점부터 갱신
   - Discord API 실패 시 null 저장 후 입장 처리 계속 (non-blocking)

**변경 사유**: 디스코드 카테고리(parentId) 정보를 음성기록 시스템에 추가하여, 채널별 음성 통계 조회 시 카테고리 단위 분류 및 필터링을 가능하게 함. 커스텀 태그가 아닌 디스코드 네이티브 카테고리를 활용하며, 기존 channelName/userName 비정규화 패턴을 일관되게 유지함.

---

## [수정 16] web: 유저 상세 페이지(F-WEB-007) 추가 / voice: 유저 데이터 조회 API 3종 추가 (USER-DETAIL-PAGE)

**변경일**: 2026-03-09
**티켓**: USER-DETAIL-PAGE

**변경 파일**:
- `docs/specs/prd/web.md` — F-WEB-007 (유저 상세 페이지) 추가
- `docs/specs/prd/voice.md` — F-VOICE-018 (유저별 음성 일별 통계 조회 API), F-VOICE-019 (멤버 검색 API), F-VOICE-020 (유저 입퇴장 이력 조회 API) 추가

**변경 내용**:
1. **F-WEB-007 (유저 상세 페이지)** 신규 추가:
   - 경로: `/dashboard/guild/{guildId}/user/{userId}`
   - 접근 방식 2가지: UserRankingTable 유저 행 클릭 / 검색창 직접 입력
   - 기간 선택 프리셋 버튼 (7일/14일/30일)
   - 유저 기본 정보 섹션: 아바타, 닉네임, 디스코드 ID
   - 음성 통계 요약 섹션: 총 음성시간, 마이크 ON/OFF 시간, 혼자 있던 시간
   - 일별 음성 트렌드 바 차트 (날짜별 channelDurationSec)
   - 채널별 사용 비율 파이/도넛 차트
   - 마이크 ON/OFF 분포 파이/도넛 차트
   - VoiceChannelHistory 기반 최근 입퇴장 이력 테이블 (채널명, 입장시각, 퇴장시각, 체류시간, 페이지네이션)
   - 유저 검색창 (debounce 300ms, 검색 결과 드롭다운)
   - 호출 API 테이블 3종 및 관련 FE 파일 목록 명시
2. **F-VOICE-018 (유저별 음성 일별 통계 조회 API)** 신규 추가:
   - 엔드포인트: `GET /api/guilds/:guildId/voice/daily` (기존 F-VOICE-017 확장)
   - 선택 파라미터 `userId` 추가: 제공 시 해당 유저 필터, 미제공 시 전체 유저 조회 (기존 동작 유지)
   - 인증: JWT Bearer 토큰 필수 (JwtAuthGuard 적용)
   - 응답: `VoiceDailyRecord[]` (F-VOICE-017과 동일 스키마)
3. **F-VOICE-019 (멤버 검색 API)** 신규 추가:
   - 엔드포인트: `GET /api/guilds/:guildId/members/search?q={query}`
   - `voice_daily` 테이블의 `userName` 컬럼 LIKE 매칭, guildId 필터
   - 중복 userId 제거, userName 오름차순, 최대 20개 반환
   - 응답: `MemberSearchResult[]` (`userId`, `userName`)
   - `q` 누락 시 400 응답
4. **F-VOICE-020 (유저 입퇴장 이력 조회 API)** 신규 추가:
   - 엔드포인트: `GET /api/guilds/:guildId/voice/history/:userId`
   - `VoiceChannelHistory` 기반 페이지네이션 조회
   - 쿼리 파라미터: `from`, `to` (선택), `page` (기본 1), `limit` (기본 20, 최대 100)
   - `joinAt` 내림차순 정렬
   - 응답: `VoiceHistoryPage` (`total`, `page`, `limit`, `items[]`)
   - `leftAt` null이면 접속 중 상태, `durationSec`도 null 반환

**변경 사유**: 유저별 음성 활동 상세 조회 기능 신규 요구사항 반영. 기존 서버 전체 통계 대시보드에서 특정 유저의 상세 음성 데이터를 조회·시각화하는 페이지와 이를 지원하는 백엔드 API 3종을 추가.

---

## [수정 15] voice: 음성 일별 통계 조회 API 추가 / web: 대시보드 상태 업데이트 (VOICE-DAILY-API)

**변경일**: 2026-03-09
**티켓**: VOICE-DAILY-API

**변경 파일**:
- `docs/specs/prd/voice.md` — F-VOICE-017 (음성 일별 통계 조회 API) 추가
- `docs/specs/prd/web.md` — F-WEB-003-B 현재 상태 및 호출 API 업데이트

**변경 내용**:
1. **F-VOICE-017 (음성 일별 통계 조회 API)** 신규 추가:
   - 엔드포인트: `GET /api/guilds/:guildId/voice/daily?from=YYYYMMDD&to=YYYYMMDD`
   - 인증: JWT Bearer 토큰 필수 (JwtAuthGuard 적용)
   - 쿼리 파라미터: `from`, `to` (YYYYMMDD 형식, 필수)
   - 동작: `guildId` + `date BETWEEN from AND to` 조건으로 `VoiceDailyEntity` 조회 후 `VoiceDailyRecord[]` 반환
   - 응답 스키마: `guildId`, `userId`, `userName`, `date`, `channelId`, `channelName`, `channelDurationSec`, `micOnSec`, `micOffSec`, `aloneSec`
   - FE 호출 경로: `apps/web/app/dashboard/guild/[guildId]/voice/page.tsx` → Next.js 프록시 → `http://api:3000/api/guilds/{guildId}/voice/daily`
   - 관련 FE 파일 목록 명시 (대시보드 페이지, API 클라이언트, 차트 컴포넌트 5종)
2. **F-WEB-003-B** 업데이트:
   - 현재 상태를 "미구현. 플레이스홀더 없음."에서 "음성 통계 대시보드 페이지 및 차트 컴포넌트 5종, API 클라이언트 구현 완료. 백엔드 API 구현 진행 중."으로 변경
   - 경로를 `/dashboard`에서 `/dashboard/guild/{guildId}/voice`로 구체화
   - 관련 FE 파일 목록 및 호출 API 테이블 추가

**변경 사유**: FE 대시보드(`/dashboard/guild/{guildId}/voice`)가 호출하는 백엔드 음성 일별 통계 조회 API 구현 요구사항 반영. FE는 이미 완전히 구현되어 있으며 백엔드 API가 필요한 상태.

---

## [수정 14] voice: 음성 시간 제외 채널 기능 추가 (VOICE-EXCLUDED-CHANNELS)

**변경일**: 2026-03-08
**티켓**: VOICE-EXCLUDED-CHANNELS

**변경 파일**:
- `docs/specs/prd/voice.md` — F-VOICE-013 ~ F-VOICE-016, VoiceExcludedChannel 데이터 모델, Redis 키 구조 추가
- `docs/specs/prd/_index.md` — 데이터베이스 엔티티 테이블에 VoiceExcludedChannel 행 추가

**변경 내용**:
1. **F-VOICE-013 (제외 채널 설정 조회)**: `GET /api/guilds/{guildId}/voice/excluded-channels` 엔드포인트 명세. guildId 기준 전체 조회 및 응답 형식 정의
2. **F-VOICE-014 (제외 채널 등록)**: `POST /api/guilds/{guildId}/voice/excluded-channels` 엔드포인트 명세. `type` 필드(`CHANNEL`/`CATEGORY`) 정의, 중복 시 409 응답, 카테고리 등록 시 하위 채널 전체 제외 동작 명세, Redis 캐시 무효화 명세
3. **F-VOICE-015 (제외 채널 삭제)**: `DELETE /api/guilds/{guildId}/voice/excluded-channels/{id}` 엔드포인트 명세. id+guildId 일치 검증, Redis 캐시 무효화, 404 예외 처리 명세
4. **F-VOICE-016 (음성 이벤트 처리 시 제외 채널 필터링)**: `voiceStateUpdate` 이벤트 수신 직후 제외 채널 판별 로직 명세
   - Redis 캐시 조회 (미스 시 DB 조회 후 1시간 TTL 캐싱)
   - `CHANNEL` 타입: channelId 직접 비교
   - `CATEGORY` 타입: Discord API로 parentId 조회 후 비교
   - 이동(move) 이벤트 세부 처리 규칙 (A-제외/B-일반, A-일반/B-제외, 둘 다 제외, 둘 다 일반 케이스)
   - 자동방 트리거 채널과의 관계 명세 (별도 처리 불필요)
5. **VoiceExcludedChannel 데이터 모델** (`voice_excluded_channel`) 신규 추가: id, guildId, channelId, type(enum CHANNEL/CATEGORY), createdAt, updatedAt 컬럼 및 인덱스 2개 정의
6. **Redis 키 구조 추가**: `voice:excluded:{guildId}` (1시간 TTL, String/JSON) — 제외 채널 목록 캐시, 등록/삭제 시 명시적 무효화 규칙 명세
7. `_index.md` 데이터베이스 엔티티 테이블에 VoiceExcludedChannel 행 추가

**변경 사유**: 특정 음성 채널(AFK 채널, 관전 채널, 대기 채널 등)을 음성 시간 추적에서 제외하는 요구사항 반영. 카테고리 단위 일괄 제외를 지원하여 설정 편의성을 높임.

---

## [수정 13] web: 음성 설정 페이지(F-WEB-006) 추가 (VOICE-SETTINGS-PAGE)

**변경일**: 2026-03-08
**티켓**: VOICE-SETTINGS-PAGE

**변경 파일**:
- `docs/specs/prd/web.md` — 관련 모듈, 구현 상태, F-WEB-006 음성 설정 페이지 추가

**변경 내용**:
1. 관련 모듈 목록에 `apps/web/app/settings/guild/[guildId]/voice/page.tsx` 경로 추가
2. 구현 상태 "완료" 항목에 음성 설정 페이지(`/settings/guild/{guildId}/voice`) 추가
3. F-WEB-006 (음성 설정 페이지) 신규 추가:
   - 경로: `/settings/guild/{guildId}/voice`, 사이드바 > 음성 설정 (Mic 또는 Volume2 아이콘)
   - 사이드바 메뉴 항목 명세
   - 음성 시간 제외 채널 섹션: 멀티 셀렉트 드롭다운 (음성 채널 + 카테고리), 📁/🔊 아이콘 구분, 태그(칩) 형태 선택 항목 표시, 카테고리 선택 시 인라인 안내 문구, 채널 새로고침 버튼 명세
   - 저장 동작: 필수 항목 없음(0개 선택도 허용), `POST /api/guilds/{guildId}/voice/excluded-channels` 전체 교체 방식, 성공/실패 인라인 메시지(3초 소멸) 명세
   - 초기 로드: `GET /api/guilds/{guildId}/voice/excluded-channels` 조회 후 드롭다운 선택 상태 반영 명세
   - API 테이블: GET/POST 엔드포인트 및 요청/응답 형식 명세

**변경 사유**: 음성 시간 집계 시 특정 채널 또는 카테고리를 제외하는 기능을 웹 대시보드에서 설정할 수 있도록 음성 설정 전용 페이지를 신규 추가.

---

## [수정 12] newbie: 플레이횟수 카운팅 옵션 추가 (NEWBIE-PLAYCOUNT-OPTION)

**변경일**: 2026-03-08
**티켓**: NEWBIE-PLAYCOUNT-OPTION

**변경 파일**:
- `docs/specs/prd/newbie.md` — F-NEWBIE-002, NewbieConfig 데이터 모델, F-WEB-NEWBIE-001 탭 2, Voice 도메인 연계 섹션 수정

**변경 내용**:
1. **F-NEWBIE-002 동작 (플레이타임 측정)**: "플레이횟수" 정의에 카운팅 옵션 적용 후 집계임을 명시. 플레이횟수 카운팅 옵션 서브 항목 신규 추가
   - 최소 참여시간 기준(`playCountMinDurationMin`): 세션 참여시간이 N분 이상인 경우만 유효 1회로 인정. NULL이면 비활성화. 예시 포함
   - 시간 간격 기준(`playCountIntervalMin`): 이전 유효 세션 시작 후 N분 이내 재입장은 동일 1회로 병합. NULL이면 비활성화. 예시 포함
   - 두 옵션 동시 적용 가능(AND 조건) 규칙, 기본값 30분, 최솟값 1분 명세
2. **데이터 모델 NewbieConfig**: `missionNotifyChannelId` 컬럼 앞에 두 컬럼 추가
   - `playCountMinDurationMin` | `int` | NULLABLE | 플레이횟수 카운팅 최소 참여시간 기준 (분). NULL이면 비활성화. 기본값 30, 최솟값 1
   - `playCountIntervalMin` | `int` | NULLABLE | 플레이횟수 카운팅 시간 간격 기준 (분). NULL이면 비활성화. 기본값 30, 최솟값 1
3. **F-WEB-NEWBIE-001 탭 2 (미션 설정)**: UI 요소 테이블에 두 항목 추가
   - 플레이횟수 최소 참여시간 입력 (숫자 + 활성화 체크박스): 분 단위, 체크박스 OFF 시 NULL 저장, 기본값 30
   - 플레이횟수 시간 간격 입력 (숫자 + 활성화 체크박스): 분 단위, 체크박스 OFF 시 NULL 저장, 기본값 30
4. **Voice 도메인 연계 > 플레이횟수 조회 쿼리 조건**: 단순 `COUNT(*)` 쿼리 대신 기본 후보 세션 조회 쿼리 + 애플리케이션 레이어 2단계 필터링 로직으로 교체
   - 1단계: 최소 참여시간 필터 (`playCountMinDurationMin` NOT NULL 시)
   - 2단계: 시간 간격 병합 (`playCountIntervalMin` NOT NULL 시)
   - 두 옵션 모두 NULL이면 전체 세션 수 그대로 사용

**변경 사유**: 플레이횟수 1회의 기준을 설정할 수 있는 두 가지 옵션(최소 참여시간, 시간 간격 병합)을 추가하여 단순 세션 카운트의 한계를 보완. 짧은 참여나 연속 재입장을 의미 있는 단위로 집계할 수 있도록 확장.

---

## [수정 11] sticky-message: 고정메세지 도메인 PRD 신규 추가 (STICKY-MESSAGE)

**변경일**: 2026-03-08
**티켓**: STICKY-MESSAGE

**변경 파일**:
- `docs/specs/prd/sticky-message.md` — sticky-message 도메인 PRD 신규 작성 (F-STICKY-001 ~ F-STICKY-007, F-WEB-005)
- `docs/specs/prd/_index.md` — 도메인 목록, 핵심 기능 요약, 데이터베이스 엔티티 테이블에 sticky-message 항목 추가
- `docs/specs/prd/web.md` — 관련 모듈, 구현 상태, F-WEB-005 고정메세지 설정 페이지 추가

**변경 내용**:
1. `docs/specs/prd/sticky-message.md` 신규 생성: 개요, 관련 모듈, 아키텍처, 기능 상세, 데이터 모델, Redis 키 구조, 슬래시 커맨드 목록, 외부 의존성, web 도메인 연계 명세 포함
2. F-STICKY-001 (설정 목록 조회): `GET /api/guilds/{guildId}/sticky-message` 엔드포인트 응답 형식 명세
3. F-STICKY-002 (고정메세지 등록/수정): 웹 설정 저장 시 DB upsert + Redis 캐시 갱신 + Discord 채널에 Embed 즉시 전송 명세
4. F-STICKY-003 (고정메세지 삭제): Discord 채널 메시지 삭제 + DB 삭제 + Redis 캐시 무효화 명세
5. F-STICKY-004 (messageCreate 감지 및 디바운스 재전송): 봇 메시지 무시, Redis 설정 캐시 조회, 3초 디바운스 타이머, 기존 메시지 삭제 후 재전송 플로우 명세
6. F-STICKY-005~007 (슬래시 커맨드 3종): `/고정메세지등록` (웹 안내 Ephemeral), `/고정메세지목록` (Embed 목록 Ephemeral), `/고정메세지삭제` (채널 파라미터 선택, 전체 삭제) 명세
7. 데이터 모델: `StickyMessageConfig` (`sticky_message_config`) PostgreSQL 엔티티 명세 (guildId, channelId, embedTitle, embedDescription, embedColor, messageId, enabled, sortOrder) 및 인덱스 3개 정의
8. Redis 키 구조: `sticky_message:config:{guildId}` (설정 캐시 TTL 1h), `sticky_message:debounce:{channelId}` (디바운스 타이머 TTL 3s) 명세
9. `_index.md` 도메인 목록에 sticky-message 행 추가
10. `_index.md` 핵심 기능 요약 10번 항목(고정메세지) 추가
11. `_index.md` 데이터베이스 엔티티 테이블에 StickyMessageConfig 행 추가
12. `web.md` 관련 모듈, 구현 상태에 sticky-message 페이지 경로 추가
13. `web.md` F-WEB-005 (고정메세지 설정 페이지) 신규 추가: 카드 목록 UI, 채널 선택, Embed 설정(제목/설명/색상/이모지 피커/실시간 미리보기), 카드별 개별 저장·삭제 동작, 초기 로드 명세

**변경 사유**: 텍스트 채널 고정메세지(Sticky Message) 도메인 신규 요구사항 반영 (티켓 STICKY-MESSAGE)

---

## [수정 10] web/voice: 자동방 설정 다중 탭 UI 및 AutoChannelConfig name 컬럼 추가 (AUTO-CHANNEL-MULTI-TAB)

**변경일**: 2026-03-08
**티켓**: AUTO-CHANNEL-MULTI-TAB

**변경 파일**:
- `docs/specs/prd/web.md` — F-WEB-004 자동방 설정 페이지를 단일 폼에서 다중 탭 UI로 변경
- `docs/specs/prd/voice.md` — AutoChannelConfig 데이터 모델에 `name` 컬럼 추가

**변경 내용**:
1. **web.md F-WEB-004** 구성 섹션 전면 재작성:
   - 탭 바(Tab Bar) 섹션 신규 추가: 탭 목록, `+` 탭 추가 버튼, 탭 삭제 버튼(확인 모달 + `DELETE /api/guilds/{guildId}/auto-channel/{configId}` 호출), 탭 전환 동작 명세
   - 설정 이름 섹션 신규 추가: 탭 라벨로 표시될 사용자 지정 `name` 입력 필드(필수)
   - 저장 동작을 "탭별 개별 저장"으로 변경: 현재 탭 설정만 전송, 각 탭에 독립적인 저장 버튼 및 피드백 메시지
   - 탭 삭제 동작 섹션 신규 추가: 확인 모달 표시 → DELETE API 호출 → 안내 메시지 즉시 삭제 → 탭 제거 플로우 명세
   - 초기 로드 섹션 신규 추가: 기존 설정 전체를 탭으로 로드, 설정 없을 때 빈 탭 1개 기본 표시, 개수 제한 없음 명세
   - 기존 "(수정)" 표기 규칙 제거 (탭 구조로 대체됨)
2. **voice.md AutoChannelConfig** 데이터 모델 테이블에 `name` 컬럼 추가:
   - `name` | string | 설정 이름 (웹 탭 라벨용, 예: "게임방", "스터디방")

**변경 사유**: 하나의 서버에서 트리거 채널(대기방)을 여러 개 운용하는 요구사항을 지원하기 위해, 단일 폼 구조를 다중 탭 구조로 변경. 각 탭이 독립된 AutoChannelConfig를 나타내며, 사용자 지정 이름으로 탭을 식별할 수 있도록 `name` 필드를 추가함.

---

## [수정 9] voice: Auto Channel 데이터 모델 및 Redis 키 구조 코드베이스 기준 동기화 (VOICE-SYNC-001)

**변경일**: 2026-03-08
**티켓**: VOICE-SYNC-001

**변경 파일**:
- `docs/specs/prd/voice.md` — AutoChannelConfig/Button/SubOption 데이터 모델 및 AutoChannelState Redis 키 구조 수정, F-VOICE-007~011 기능 명세 갱신, 전체 흐름 다이어그램 수정

**변경 내용**:
1. **AutoChannelState (Redis)** 섹션 전면 재작성
   - `auto_channel:waiting:{channelId}` 키 제거 — 코드에 미구현, 대기방은 `RedisTempChannelStore`가 관리
   - `auto_channel:trigger:{guildId}` 키 제거 — 코드에 미구현, 트리거 채널은 DB 직접 조회
   - 확정방 키(`auto_channel:confirmed:{channelId}`) TTL 12시간 명시
   - `voice:temp:channels:{guildId}` (Set), `voice:temp:channel:{channelId}:members` (Set) 키 추가 (RedisTempChannelStore 관리)
   - 트리거 채널 조회 방식(`findByTriggerChannel` DB 조회) 명시
2. **AutoChannelSubOption** 데이터 모델: `channelSuffix` → `channelNameTemplate`으로 필드명 변경, `{name}` 템플릿 변수 동작 명세 추가
3. **AutoChannelButton** 데이터 모델: `channelNameTemplate` (nullable) 필드 추가 — 확정방 채널명 템플릿
4. **AutoChannelConfig** 데이터 모델: `guideChannelId` (nullable), `embedTitle` (nullable), `embedColor` (nullable) 필드 추가. `waitingRoomTemplate`을 nullable로 수정
5. **F-VOICE-007** (트리거 채널 입장 감지): DB 조회 방식(`findByTriggerChannel`) 명시, Redis 캐싱 없음 명시
6. **F-VOICE-008** (대기방 관련): "대기방 생성 및 사용자 이동"에서 "대기방 상태 관리"로 변경. 별도 채널 생성 없음을 명시하고 `RedisTempChannelStore` 키 패턴 기술
7. **F-VOICE-009** (안내 메시지): 전송 대상을 `guideChannelId`(텍스트 채널)로 수정, Embed 형식(`embedTitle`/`embedColor`) 명세 추가, customId 형식(`auto_btn:{buttonId}`) 명시
8. **F-VOICE-010** (하위 선택지): `channelSuffix` → `channelNameTemplate`으로 변경, `{name}` 변수 동작 설명 추가, customId 형식(`auto_sub:{subOptionId}`) 명시, 대기방 검증 방식 구체화
9. **F-VOICE-011** (확정방 전환): 대기방 검증 방식 구체화, 채널명 결정 로직에 버튼/하위선택지 `channelNameTemplate` 적용 규칙 및 `{n}` 순번 변수 명세 추가, 확정방을 신규 생성(삭제+재생성 아님) 방식으로 수정
10. **전체 흐름 다이어그램**: 실제 구현 흐름에 맞게 재작성

**변경 사유**: v1.1에서 작성된 Auto Channel 명세가 실제 코드 구현과 불일치하여 코드베이스(`auto-channel-config.entity.ts`, `auto-channel-button.entity.ts`, `auto-channel-sub-option.entity.ts`, `auto-channel.keys.ts`, `auto-channel-redis.repository.ts`, `redis-temp-channel-store.ts`, `auto-channel.service.ts`) 기준으로 동기화

---

## [수정 8] web: 라우트 경로 코드베이스 기준 수정 및 F-WEB-003/004 UI 명세 갱신 (WEB-FIX-001)

**변경일**: 2026-03-08
**티켓**: WEB-FIX-001

**변경 파일**:
- `docs/specs/prd/web.md` — 라우트 경로 전면 수정, 관련 모듈 목록 갱신, 구현 상태 갱신, F-WEB-003 분리 및 F-WEB-004 UI 명세 코드 기준 재작성

**변경 내용**:
1. 관련 모듈 목록에 실제 구현된 파일 경로 7개 추가 (SettingsSidebar, select-guild, settings/guild/[guildId] 하위 4개 페이지)
2. 구현 상태 "완료" 항목에 실제 구현된 6개 페이지 추가 (서버 선택, 설정 레이아웃, 일반설정, 자동방, 신입관리, 게임방상태)
3. 구현 상태 "프로토타입/미구현"에서 "서버 설정 관리" 항목 제거, 대시보드를 "미구현/플레이스홀더 상태"로 명확히 기재
4. F-WEB-003을 서버 선택 페이지(`/select-guild`) 명세로 변경: 접근 조건, 동작(단일 길드 자동 리다이렉트, 빈 길드 안내) 명세
5. F-WEB-003-B를 대시보드(미구현) 항목으로 신규 추가, 향후 계획 기능 유지
6. F-WEB-004 경로를 `/dashboard/servers/{guildId}/settings/auto-channel`에서 `/settings/guild/{guildId}/auto-channel`로 수정
7. F-WEB-004 위치 표기를 "대시보드 > 서버 설정 > 자동방 설정"에서 "설정 사이드바 > 자동방 설정"으로 수정
8. F-WEB-004 구성 섹션 전면 재작성 (코드 기준):
   - "트리거 채널 설정(다중)"을 "대기 채널 설정(단일 음성 채널 선택)"으로 변경
   - "대기방 설정" 섹션 제거, "안내 메시지 채널 설정" 섹션 신규 추가
   - "안내 메시지 설정"을 "안내 메시지 (Embed) 설정"으로 변경하고 Embed 제목/색상 필드 및 실시간 미리보기 항목 추가
   - 버튼 목록에 채널명 템플릿 필드(`{username}`, `{n}` 변수), 최대 25개 제한 명세 추가
   - 하위 선택지에 `{name}` 변수 설명 추가
   - 채널 새로고침 섹션 신규 추가
   - 저장 동작에 클라이언트 유효성 검사 규칙, 저장 성공 피드백 방식, "(수정)" 표기 규칙 추가

**변경 사유**: 실제 구현된 코드베이스의 라우트 구조(`/settings/guild/{guildId}/...`)와 PRD에 기재된 경로(`/dashboard/servers/{guildId}/settings/...`)가 불일치하여 코드 기준으로 정정. F-WEB-004 UI 명세도 실제 컴포넌트(`auto-channel/page.tsx`) 기준으로 재작성.

---

## [수정 7] newbie: Embed 커스터마이징 필드 추가 및 웹 경로 수정 (NEWBIE-FIX-001)

**변경일**: 2026-03-08
**티켓**: NEWBIE-FIX-001

**변경 파일**:
- `docs/specs/prd/newbie.md` — NewbieConfig 데이터 모델 필드 추가, F-WEB-NEWBIE-001 경로 및 UI 요소 수정

**변경 내용**:
1. `NewbieConfig` 데이터 모델 테이블에 미션 Embed 커스터마이징 필드 4개 추가
   - `missionEmbedTitle` (varchar, NULLABLE) — 미션 현황 Embed 제목
   - `missionEmbedDescription` (text, NULLABLE) — 미션 현황 Embed 설명
   - `missionEmbedColor` (varchar, NULLABLE) — 미션 현황 Embed 색상
   - `missionEmbedThumbnailUrl` (varchar, NULLABLE) — 미션 현황 Embed 썸네일 이미지 URL
2. `NewbieConfig` 데이터 모델 테이블에 모코코 Embed 커스터마이징 필드 4개 추가
   - `mocoEmbedTitle` (varchar, NULLABLE) — 모코코 순위 Embed 제목
   - `mocoEmbedDescription` (text, NULLABLE) — 모코코 순위 Embed 설명
   - `mocoEmbedColor` (varchar, NULLABLE) — 모코코 순위 Embed 색상
   - `mocoEmbedThumbnailUrl` (varchar, NULLABLE) — 모코코 순위 Embed 썸네일 이미지 URL
3. F-WEB-NEWBIE-001 경로 수정: `/dashboard/servers/{guildId}/settings/newbie` → `/settings/guild/{guildId}/newbie`
4. F-WEB-NEWBIE-001 탭 2(미션 설정) UI 요소에 Embed 커스터마이징 입력 필드 4개 추가 (Embed 제목/설명/색상/썸네일)
5. F-WEB-NEWBIE-001 탭 3(모코코 사냥 설정) UI 요소에 Embed 커스터마이징 입력 필드 4개 추가 (Embed 제목/설명/색상/썸네일)

**변경 사유**: 코드베이스(`newbie-config.entity.ts`)에 실제 구현된 `missionEmbed*`, `mocoEmbed*` 필드가 PRD에 누락되어 있었고, 웹 앱의 실제 라우팅 경로(`/settings/guild/{guildId}/newbie`)와 PRD 기재 경로가 불일치하여 수정

---

## [수정 6] general: 커맨드 목록 API를 글로벌 커맨드 조회로 수정 (GENERAL-FIX-001)

**변경일**: 2026-03-08
**티켓**: GENERAL-FIX-001

**변경 파일**:
- `docs/specs/prd/general.md` — F-GENERAL-002 동작·오류처리·외부 의존성, 아키텍처 다이어그램 수정

**변경 내용**:
1. 아키텍처 다이어그램의 Discord REST API 호출 경로를 `GET /applications/{appId}/guilds/{guildId}/commands`에서 `GET /applications/{appId}/commands (글로벌 커맨드)`로 수정
2. F-GENERAL-002 동작 2항을 길드 한정 커맨드 조회에서 글로벌 커맨드 조회(`GET /applications/{applicationId}/commands`)로 수정
3. F-GENERAL-002 동작에 `application`이 null일 때 빈 배열 반환하는 3항 추가
4. F-GENERAL-002 오류 처리에서 "봇이 해당 길드에 없는 경우" 항목을 삭제하고, `client.application` null 케이스로 교체. 로그 없이 빈 배열만 반환하는 실제 catch 블록 동작 반영
5. 외부 의존성 테이블의 엔드포인트를 `GET /applications/{appId}/commands`로 수정, 용도를 "길드별"에서 "글로벌"로 수정
6. 외부 의존성 설명의 `Client.application.commands.fetch({ guildId })`를 `Client.application.commands.fetch()`로 수정하고, 글로벌 커맨드 조회임을 명시

**변경 사유**: 커밋 `b867572`에서 `GuildInfoController.getCommands()`가 `Client.application.commands.fetch({ guildId })`에서 `Client.application.commands.fetch()`로 변경되어 글로벌 커맨드를 조회하도록 의도적으로 수정됨. PRD를 실제 코드와 일치시키기 위해 업데이트.

---

## [수정 5] 일반설정(general) 도메인 PRD 신규 추가 (GENERAL)

**변경일**: 2026-03-08
**티켓**: GENERAL

**변경 파일**:
- `docs/specs/prd/general.md` — general 도메인 PRD 신규 작성 (F-GENERAL-001 ~ F-GENERAL-003)
- `docs/specs/prd/_index.md` — 도메인 목록 및 핵심 기능 요약에 general 항목 추가

**변경 내용**:
1. `docs/specs/prd/general.md` 신규 생성: 개요, 관련 모듈, 아키텍처, 기능 상세, 외부 의존성, web 도메인 연계 명세 포함
2. F-GENERAL-001 (슬래시 커맨드 자동 등록): `discord.config.ts`의 수동 `commands` 배열 제거 명세, discord-nestjs `ExplorerService`의 `@Command` 자동 탐색 방식 명시. 현재 등록 대상 커맨드 7개 목록(play/skip/stop/voice-stats/my-voice-stats/community-health/voice-leaderboard) 및 소속 모듈 명시
3. F-GENERAL-002 (커맨드 목록 API): `GET /api/guilds/:guildId/commands` 엔드포인트 명세. Discord REST API 호출, 응답 형식(`id`, `name`, `description`) 정의, JwtAuthGuard 적용, 오류 시 빈 배열 반환 명세
4. F-GENERAL-003 (프론트엔드 동적 커맨드 목록): 일반설정 페이지의 하드코딩 배열 제거, API 기반 동적 로딩, 커맨드 이름 기반 아이콘 매핑 규칙(Music/Mic/Bot/Hash), `fetchGuildCommands()` API 클라이언트 함수 시그니처 명세
5. `_index.md` 도메인 목록에 general 행 추가
6. `_index.md` 핵심 기능 요약 9번 항목(일반설정) 추가

**변경 사유**: 슬래시 커맨드 자동 등록 방식 명확화 및 웹 대시보드 일반설정 페이지 동적 커맨드 렌더링 요구사항 반영 (티켓 GENERAL)

---

## [수정 4] newbie: 미션/모코코 Embed 템플릿 커스터마이징 시스템 추가 (NEWBIE-TMPL)

**변경일**: 2026-03-08
**티켓**: NEWBIE-TMPL

**변경 파일**:
- `docs/specs/prd/newbie.md` — F-NEWBIE-002, F-NEWBIE-003, F-WEB-NEWBIE-001 갱신 및 데이터 모델 2개 추가
- `docs/specs/prd/_index.md` — 데이터베이스 엔티티 테이블에 NewbieMissionTemplate, NewbieMocoTemplate 행 추가

**변경 내용**:
1. F-NEWBIE-002에 Embed 템플릿 시스템(F-NEWBIE-002-TMPL) 서브 섹션 추가
   - 제목 템플릿(`titleTemplate`): 허용 변수 `{totalCount}`, 기본값 명세
   - 헤더 템플릿(`headerTemplate`): 허용 변수 `{totalCount}`, `{inProgressCount}`, `{completedCount}`, `{failedCount}`
   - 항목 템플릿(`itemTemplate`): 허용 변수 13개 전체 목록 및 기본값 3줄 포맷 명세
   - 푸터 템플릿(`footerTemplate`): 허용 변수 `{updatedAt}`, 기본값 명세
   - 상태 이모지/텍스트 매핑(`statusMapping`): JSON 컬럼 구조 및 기본값 명세
   - 날짜 포맷 고정(`YYYY-MM-DD`) 및 유효성 검사 규칙 명세
2. F-NEWBIE-003에 Embed 템플릿 시스템(F-NEWBIE-003-TMPL) 서브 섹션 추가
   - 제목 템플릿(`titleTemplate`): 허용 변수 `{rank}`, `{hunterName}`, 기본값 명세
   - 본문 템플릿(`bodyTemplate`): `{mocoList}` 블록 변수로 항목 반복 삽입, 기본값 명세
   - 항목 템플릿(`itemTemplate`): 허용 변수 `{newbieName}`, `{minutes}`, 기본값 명세
   - 푸터 템플릿(`footerTemplate`): 허용 변수 `{currentPage}`, `{totalPages}`, `{interval}`, 기본값 명세
3. F-WEB-NEWBIE-001 탭 2 미션 설정에 템플릿 설정 섹션 UI 명세 추가
   - 제목/헤더/항목/푸터 템플릿 입력 필드, 상태 매핑 3행 테이블, 기본값 복원 버튼
   - 실시간 미리보기 패널 (debounce 300ms, 프론트 고정 더미 데이터)
   - 사용 가능 변수 인라인 안내
4. F-WEB-NEWBIE-001 탭 3 모코코 사냥 설정에 템플릿 설정 섹션 UI 명세 추가
   - 제목/본문/항목/푸터 템플릿 입력 필드, 기본값 복원 버튼
   - 실시간 미리보기 패널 (debounce 300ms, 프론트 고정 더미 데이터)
5. F-WEB-NEWBIE-001 저장 동작에 템플릿 전용 저장 API 엔드포인트 명세 추가
   - `POST /api/guilds/{guildId}/newbie/mission-template`
   - `POST /api/guilds/{guildId}/newbie/moco-template`
   - 백엔드 유효성 검사 실패 시 400 응답 및 오류 필드 반환 규칙
6. 데이터 모델에 `NewbieMissionTemplate` (`newbie_mission_template`) 테이블 추가
   - 컬럼: `id`, `guildId`(UNIQUE), `titleTemplate`, `headerTemplate`, `itemTemplate`, `footerTemplate`, `statusMapping`(JSON), `createdAt`, `updatedAt`
7. 데이터 모델에 `NewbieMocoTemplate` (`newbie_moco_template`) 테이블 추가
   - 컬럼: `id`, `guildId`(UNIQUE), `titleTemplate`, `bodyTemplate`, `itemTemplate`, `footerTemplate`, `createdAt`, `updatedAt`
8. `_index.md` 데이터베이스 엔티티 테이블에 NewbieMissionTemplate, NewbieMocoTemplate 행 추가

**변경 사유**: 미션 Embed(F-NEWBIE-002) 및 모코코 사냥 Embed(F-NEWBIE-003)의 표시 형식을 길드별로 커스터마이징할 수 있도록 템플릿 시스템을 신규 도입. 기존 NewbieConfig 테이블의 과부하를 방지하기 위해 별도 테이블로 분리.

---

## [수정 3] 게임방 상태 접두사(status-prefix) 도메인 PRD 신규 추가 (STATUS-PREFIX)

**변경일**: 2026-03-08
**티켓**: STATUS-PREFIX

**변경 파일**:
- `docs/specs/prd/status-prefix.md` — status-prefix 도메인 PRD 신규 작성 (F-STATUS-PREFIX-001 ~ F-STATUS-PREFIX-005, F-WEB-STATUS-PREFIX-001)
- `docs/specs/prd/_index.md` — 도메인 목록, 핵심 기능 요약, 데이터베이스 엔티티 테이블에 status-prefix 항목 추가

**변경 내용**:
1. `docs/specs/prd/status-prefix.md` 신규 생성: 개요, 관련 모듈, 아키텍처, 기능 상세, 데이터 모델, Redis 키 구조, voice 도메인 연계 명세 포함
2. F-STATUS-PREFIX-001 (설정 조회): `GET /api/guilds/{guildId}/status-prefix/config` 응답 형식 명세
3. F-STATUS-PREFIX-002 (안내 메시지 전송/갱신): 설정 저장 시 Discord 텍스트 채널에 Embed + ActionRow 버튼 메시지 전송 또는 수정, messageId DB 저장
4. F-STATUS-PREFIX-003 (접두사 적용): `status_prefix:{buttonId}` 버튼 클릭 시 원래 닉네임 Redis 저장 후 템플릿 기반 닉네임 변경, Ephemeral 응답
5. F-STATUS-PREFIX-004 (접두사 제거): `status_reset:{buttonId}` 버튼 클릭 시 Redis에서 원래 닉네임 조회 후 복원, Redis 키 삭제
6. F-STATUS-PREFIX-005 (퇴장 시 자동 복원): voiceStateUpdate 퇴장 이벤트 감지 시 닉네임 자동 복원, voice 도메인 VoiceLeaveHandler 연계 명세
7. F-WEB-STATUS-PREFIX-001 (설정 페이지): `/dashboard/servers/{guildId}/settings/status-prefix` 경로, 기능 활성화 토글/채널 선택/Embed 설정/템플릿/버튼 목록 관리 UI 명세
8. 데이터 모델: StatusPrefixConfig, StatusPrefixButton PostgreSQL 엔티티 명세 (버튼 타입 enum: PREFIX/RESET, customId 형식 정의)
9. Redis 키 구조: `status_prefix:original:{guildId}:{memberId}` (원래 닉네임), `status_prefix:config:{guildId}` (설정 캐시) 및 TTL 정책 명세
10. `_index.md` 도메인 목록에 status-prefix 행 추가
11. `_index.md` 핵심 기능 요약 8번 항목(게임방 상태 접두사) 추가
12. `_index.md` 데이터베이스 엔티티 테이블에 StatusPrefixConfig, StatusPrefixButton 행 추가

**변경 사유**: 게임방 상태 접두사(status-prefix) 도메인 신규 요구사항 반영 (티켓 STATUS-PREFIX)

---

## [수정 2] 신규사용자 관리(newbie) 도메인 PRD 신규 추가 (NEWBIE)

**변경일**: 2026-03-08
**티켓**: NEWBIE

**변경 파일**:
- `docs/specs/prd/newbie.md` — newbie 도메인 PRD 신규 작성 (F-NEWBIE-001 ~ F-NEWBIE-004, F-WEB-NEWBIE-001)
- `docs/specs/prd/_index.md` — 도메인 목록, 핵심 기능 요약, 데이터베이스 엔티티 테이블에 newbie 항목 추가

**변경 내용**:
1. `docs/specs/prd/newbie.md` 신규 생성: 개요, 관련 모듈, 아키텍처, 기능 상세, 데이터 모델, Redis 키 구조, voice 도메인 연계 명세 포함
2. F-NEWBIE-001 (환영인사): guildMemberAdd 트리거, Discord Embed 메시지 전송, 템플릿 변수(`{username}`, `{memberCount}`, `{serverName}`) 치환 명세
3. F-NEWBIE-002 (미션 생성 및 추적): 음성 채널 플레이타임 기반 미션, IN_PROGRESS/COMPLETED/FAILED 상태, 스케줄러 기반 만료 처리, VoiceDailyEntity 연계 쿼리 조건
4. F-NEWBIE-003 (모코코 사냥): 신규사용자와 기존 멤버의 동시 음성 채널 접속 시간 누적, TOP N 순위 Embed 채널 표시, 페이지네이션 및 자동 갱신
5. F-NEWBIE-004 (신입기간 역할 자동관리): guildMemberAdd 시 역할 부여, 스케줄러 기반 만료 후 역할 제거, 미션과 독립 동작
6. F-WEB-NEWBIE-001 (신입 관리 설정 페이지): `/dashboard/servers/{guildId}/settings/newbie` 경로, 4개 탭(환영인사/미션/모코코 사냥/신입기간) UI 명세
7. 데이터 모델: NewbieConfig, NewbieMission, NewbiePeriod PostgreSQL 엔티티 및 MocoHunting Redis 구조 명세
8. `_index.md` 도메인 목록에 newbie 행 추가
9. `_index.md` 핵심 기능 요약 7번 항목(신규사용자 관리) 추가
10. `_index.md` 데이터베이스 엔티티 테이블에 NewbieConfig, NewbieMission, NewbiePeriod 행 추가

**변경 사유**: 신규사용자 관리(newbie) 도메인 신규 요구사항 반영 (티켓 NEWBIE)

---

## [수정 1] 자동방 생성(Auto Channel) 기능 명세 추가 (AUTO-CHANNEL)

**변경일**: 2026-03-08
**티켓**: AUTO-CHANNEL

**변경 파일**:
- `docs/specs/prd/voice.md` — F-VOICE-007 ~ F-VOICE-012 추가 (자동방 생성 흐름, 데이터 모델)
- `docs/specs/prd/web.md` — F-WEB-004 추가 (자동방 웹 설정 UI)
- `docs/specs/prd/_index.md` — 도메인 목록 및 핵심 기능 요약에 자동방 항목 추가

**변경 내용**:
1. voice 도메인에 트리거 채널 입장 감지(F-VOICE-007), 대기방 생성 및 이동(F-VOICE-008), 안내 메시지 & 버튼 처리(F-VOICE-009), 하위 선택지 Ephemeral 처리(F-VOICE-010), 확정방 전환(F-VOICE-011), 자동방 채널 삭제(F-VOICE-012) 추가
2. voice 도메인에 AutoChannelConfig, AutoChannelButton, AutoChannelSubOption, AutoChannelState 데이터 모델 추가
3. web 도메인에 자동방 설정 페이지(F-WEB-004) 추가
4. _index.md 도메인 목록에 auto-channel 도메인 행 추가
5. _index.md 핵심 기능 요약에 6번 자동방 생성 항목 추가

**변경 사유**: 자동방 생성 기능 신규 요구사항 반영 (티켓 AUTO-CHANNEL)
