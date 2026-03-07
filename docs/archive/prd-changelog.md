# PRD 변경이력

모든 PRD 변경이력은 이 파일에 기록한다.
PRD 본문(`/docs/specs/prd/*.md`)에는 변경이력을 직접 작성하지 않는다.

## 문서 이력 테이블

| 버전 | 날짜 | 변경 요약 | 작성자 |
|------|------|-----------|--------|
| v1.3 | 2026-03-08 | 게임방 상태 접두사(status-prefix) 도메인 PRD 신규 추가 | — |
| v1.2 | 2026-03-08 | 신규사용자 관리(newbie) 도메인 PRD 신규 추가 | — |
| v1.1 | 2026-03-08 | 자동방 생성(Auto Channel) 기능 추가 | — |

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
