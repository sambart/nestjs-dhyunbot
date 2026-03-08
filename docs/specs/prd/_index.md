# DHyunBot PRD (Product Requirements Document)

## 프로젝트 개요

DHyunBot은 디스코드 서버의 음성 채널 활동을 실시간 추적하고, AI 기반 분석 리포트를 제공하며, 음악 재생 기능을 갖춘 다목적 디스코드 봇이다.

### 기술 스택
| 계층 | 기술 |
|------|------|
| Backend | NestJS 10 + TypeORM 0.3 + PostgreSQL 15 + Redis 7 |
| Frontend | Next.js 16 + React 19 + Tailwind CSS 3 |
| Discord | Discord.js 14 + discord-nestjs 5 |
| AI | Google Gemini (@google/generative-ai) |
| 인프라 | Docker Compose, npm workspaces 모노레포 |

### 모노레포 구조
```
apps/api/     → NestJS 백엔드 API (포트 3000)
apps/web/     → Next.js 웹 대시보드 (포트 4000)
libs/shared/  → 공유 타입 및 상수
```

## 도메인 목록

| 도메인 | 설명 | PRD 문서 |
|--------|------|----------|
| voice | 음성 채널 접속 추적, 세션 관리, 일별 통계 집계, 자동방 생성 | [voice.md](voice.md) |
| gemini | AI 기반 음성 활동 분석 및 리포트 생성 | [gemini.md](gemini.md) |
| music | 디스코드 음성 채널 음악 재생/제어 | [music.md](music.md) |
| auth | Discord OAuth2 인증, JWT 세션 관리 | [auth.md](auth.md) |
| web | 웹 대시보드 UI (음성 통계, 서버 관리, 자동방 설정) | [web.md](web.md) |
| newbie | 신규사용자 관리 (환영인사, 미션 추적, 모코코 사냥, 신입기간 역할) | [newbie.md](newbie.md) |
| status-prefix | 게임방 상태 접두사 설정 (버튼 클릭으로 닉네임 접두사 변경 및 자동 복원) | [status-prefix.md](status-prefix.md) |
| member | 디스코드 멤버 정보 관리 | (voice.md에 포함) |
| channel | 디스코드 채널 정보 관리 | (voice.md에 포함) |
| auto-channel | 트리거 채널 입장 기반 자동 음성 채널 생성 및 관리 | (voice.md에 포함) |

## 핵심 기능 요약

### 1. 음성 채널 활동 추적 (voice)
- 실시간 음성 이벤트 감지 (입장/퇴장/이동/마이크 토글)
- Redis 기반 세션 시간 누적 (TTL 관리)
- PostgreSQL 일별 통계 flush (GLOBAL + 개별 채널)
- 서버 크래시 복구를 위한 세션 flush 전략

### 2. AI 음성 분석 (gemini)
- `/voice-stats` — 서버 전체 음성 활동 AI 분석 (Gemini)
- `/my-voice-stats` — 개인 음성 활동 통계
- `/community-health` — 커뮤니티 건강도 AI 진단
- `/voice-leaderboard` — 음성 활동 리더보드

### 3. 음악 재생 (music)
- `/play` — YouTube 음악 재생
- `/skip` — 현재 곡 건너뛰기
- `/stop` — 재생 중지 및 채널 퇴장

### 4. 인증 (auth)
- Discord OAuth2 로그인
- JWT 토큰 발급 (1시간 만료)

### 5. 웹 대시보드 (web)
- 랜딩 페이지 (기능 소개)
- Discord OAuth 로그인 흐름
- 대시보드 (프로토타입 단계)
- 자동방 설정 UI (서버별 트리거 채널, 버튼 구성, 네이밍 규칙 설정)

### 6. 자동방 생성 (auto-channel)
- 트리거 채널 입장 시 대기방 자동 생성 및 사용자 이동
- 안내 메시지 + Discord Button Component로 확정방 선택
- 하위 선택지 Ephemeral 버튼으로 세부 유형 선택
- 확정방 전환 시 voice 세션 추적 통합
- 모든 사용자 퇴장 시 채널 즉시 삭제

### 7. 신규사용자 관리 (newbie)
- `guildMemberAdd` 이벤트 기반 환영 Embed 메시지 자동 전송 (템플릿 변수 지원)
- 신규 가입 시 음성 채널 플레이타임 기반 미션 자동 생성 및 완료/실패 상태 추적
- 기존 멤버가 신규사용자와 동시 음성 채널 접속한 시간 기록 (모코코 사냥) 및 TOP N 순위 채널 Embed 표시
- 신입기간 만료 시 Discord 역할 자동 제거 (미션 완료 여부와 독립)

### 8. 게임방 상태 접두사 (status-prefix)
- 관리자가 웹에서 접두사 버튼 목록, Embed 안내 메시지, 표시 채널, 접두사 형식 템플릿 설정
- 설정 저장 시 지정 텍스트 채널에 Embed + 버튼 메시지 전송/갱신
- 사용자가 버튼 클릭 시 닉네임이 템플릿 형식으로 변경 (예: `[관전] 동현`)
- 다른 접두사 버튼 클릭 시 기존 접두사가 새 접두사로 교체
- 음성 채널 퇴장 시 원래 닉네임으로 자동 복원 (voice 도메인 연계)

## 데이터베이스 엔티티

| 엔티티 | 테이블 | 역할 |
|--------|--------|------|
| Member | public.member | 디스코드 유저 정보 (discordMemberId, nickName) |
| Channel | public.channel | 디스코드 채널 정보 (discordChannelId, channelName, status) |
| VoiceChannelHistory | public.voice_channel_history | 음성 입/퇴장 이력 (joinAt, leftAt, duration) |
| VoiceDailyEntity | voice_daily | 일별 집계 통계 (channelDurationSec, micOnSec, micOffSec, aloneSec) |
| AutoChannelConfig | auto_channel_config | 자동방 설정 (guildId, triggerChannelId, 대기방 템플릿, 안내 메시지) |
| AutoChannelButton | auto_channel_button | 자동방 버튼 목록 (label, emoji, targetCategoryId) |
| AutoChannelSubOption | auto_channel_sub_option | 버튼 하위 선택지 (label, emoji, channelSuffix) |
| NewbieConfig | newbie_config | 신규사용자 관리 길드별 설정 (환영인사, 미션, 모코코, 역할 설정 통합) |
| NewbieMission | newbie_mission | 신규사용자 미션 진행 상태 (startDate, endDate, targetPlaytimeSec, status) |
| NewbiePeriod | newbie_period | 신입기간 역할 관리 이력 (startDate, expiresDate, isExpired) |
| StatusPrefixConfig | status_prefix_config | 게임방 상태 접두사 길드별 설정 (channelId, messageId, embedTitle, prefixTemplate) |
| StatusPrefixButton | status_prefix_button | 접두사 버튼 목록 (label, emoji, prefix, type, sortOrder) |

## 외부 의존성

| 서비스 | 용도 |
|--------|------|
| Discord API | 봇 이벤트 수신, 슬래시 커맨드, 유저/채널 정보 조회 |
| Google Gemini API | 음성 활동 데이터 AI 분석 |
| PostgreSQL | 영구 데이터 저장 |
| Redis | 실시간 세션 캐싱, 이름 캐싱 (7일 TTL) |
