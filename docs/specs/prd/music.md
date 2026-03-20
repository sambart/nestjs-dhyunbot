# Music 도메인 PRD

> 변경이력: [prd-changelog.md](../../archive/prd-changelog.md)

## 개요

디스코드 음성 채널에서 음악을 재생하는 기능을 제공한다. Lavalink v4(Java 기반 오디오 노드)와 Kazagumo v3(Shoukaku v4 래퍼) 조합을 사용하며, YouTube · Spotify · SoundCloud URL 및 검색어 입력을 지원한다. Lavalink는 별도 Docker 컨테이너로 실행된다.

## 관련 모듈

- `apps/bot/src/music/application/music.service.ts` — 음악 재생 비즈니스 로직
- `apps/bot/src/music/infrastructure/kazagumo.provider.ts` — Lavalink 노드 연결/라이프사이클 관리
- `apps/bot/src/music/presentation/commands/music-play.command.ts` — 재생 커맨드
- `apps/bot/src/music/presentation/commands/music-skip.command.ts` — 건너뛰기 커맨드
- `apps/bot/src/music/presentation/commands/music-stop.command.ts` — 정지 커맨드
- `apps/bot/src/music/presentation/commands/music-pause.command.ts` — 일시정지 커맨드
- `apps/bot/src/music/presentation/commands/music-resume.command.ts` — 재개 커맨드
- `apps/bot/src/music/presentation/utils/now-playing-embed.builder.ts` — Now Playing Embed 생성 유틸
- `apps/bot/src/music/presentation/dto/play.dto.ts` — 재생 커맨드 입력 DTO
- `apps/bot/src/music/music.constants.ts` — 음악 모듈 상수 (Embed 색상, 진행바 등)
- `apps/bot/src/music/music.module.ts` — 모듈 선언

## 아키텍처

```
Discord 슬래시 커맨드 (/play, /skip, /stop, /pause, /resume)
    │
    ▼
[MusicCommand]               ← discord-nestjs SlashCommand 핸들러
    │
    ▼
[MusicService]               ← 비즈니스 로직 (큐 관리, 상태 제어)
    │
    ▼
[Kazagumo]                   ← Shoukaku v4 래퍼 (NestJS 내 Lavalink 클라이언트)
    │
    ▼ (WebSocket)
[Lavalink v4 컨테이너]        ← Java 기반 Lavaplayer 오디오 처리
    │
    ▼
[YouTube / Spotify / SoundCloud]  ← 소스별 플러그인 추출
```

## 기능 상세

### F-MUSIC-001: 음악 재생 (`/play`)

- **입력**: 검색어, YouTube URL, 플레이리스트 URL, Spotify URL, SoundCloud URL
- **동작**:
  1. 유저가 음성 채널에 접속해 있는지 확인 (미접속 시 에러 응답, ephemeral)
  2. Kazagumo를 통해 Lavalink에 트랙 또는 플레이리스트 검색 요청
  3. 플레이리스트 URL 입력 시 전체 트랙을 큐에 일괄 추가
  4. 봇이 해당 음성 채널에 참여 (이미 참여 중이면 유지)
  5. 큐에 트랙 추가 및 즉시 재생 (또는 큐 대기)
- **출력** (3가지 분기):
  - 플레이리스트: `"N곡이 대기열에 추가되었습니다"` 텍스트 메시지
  - 큐 대기 (이미 재생 중): `"대기열에 추가되었습니다"` + Now Playing Embed (status: queued)
  - 즉시 재생 (첫 재생): Now Playing Embed (status: playing)
- **지원 소스**: YouTube URL · 검색어, 플레이리스트 URL, Spotify URL (Lavalink 플러그인), SoundCloud URL (Lavalink 플러그인)

### F-MUSIC-002: 건너뛰기 (`/skip`)

- **동작**: 현재 재생 중인 트랙을 건너뛰고 큐의 다음 트랙 재생
- **출력** (2가지 분기):
  - 다음 트랙 존재: `"스킵했습니다"` + 다음 트랙 Now Playing Embed (status: playing)
  - 다음 트랙 없음: 재생 정지 + 음성 채널 퇴장 + `"스킵했습니다. 다음 곡이 없어 퇴장합니다"` 텍스트

### F-MUSIC-003: 정지 (`/stop`)

- **동작**: 재생 중지, 큐 초기화, 음성 채널 퇴장
- **출력**: 정지 확인 메시지

### F-MUSIC-004: 일시정지 (`/pause`)

- **동작**: 현재 재생 중인 트랙을 일시정지 (큐 유지)
- **출력**: Now Playing Embed (status: paused) — 트랙이 없으면 텍스트 메시지 대체
- **예외**: 재생 중인 트랙이 없으면 에러 응답 (ephemeral)

### F-MUSIC-005: 재개 (`/resume`)

- **동작**: 일시정지 상태인 트랙을 재개
- **출력**: Now Playing Embed (status: playing) — 트랙이 없으면 텍스트 메시지 대체
- **예외**: 일시정지 상태가 아니면 에러 응답 (ephemeral)

## Now Playing Embed 명세

모든 커맨드 응답에 공통으로 포함되는 Embed 형식:

| 필드 | 내용 |
|------|------|
| 제목 | 트랙 제목 (YouTube/소스 링크 포함) |
| 썸네일 | 트랙 썸네일 이미지 (있는 경우) |
| 아티스트 | 채널명 또는 아티스트명 (inline) |
| 상태 | 재생 중 / 일시정지 / 큐 대기 (inline) |
| 진행바 | `` `[▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░]` `` 형식 (20칸 기준) |
| 시간 | `현재시간 / 총시간` (예: `1:23 / 3:45`) |
| 색상 | 재생 중: `#57F287` (녹색), 일시정지/큐 대기: `#FEE75C` (노랑) |

## 인프라

### Lavalink Docker 서비스

- `docker-compose.yml`에 `lavalink` 서비스 추가
- 베이스 이미지: `ghcr.io/lavalink-devs/lavalink:4`
- 설정 파일: `lavalink/application.yml`

### 환경변수

| 변수명 | 설명 | 예시 |
|--------|------|------|
| `LAVALINK_URL` | Lavalink 서버 WebSocket 주소 | `ws://lavalink:2333` |
| `LAVALINK_PASSWORD` | Lavalink 인증 비밀번호 | `youshallnotpass` |

## 의존성

| 패키지 | 버전 | 역할 |
|--------|------|------|
| `kazagumo` | ^3.4.3 | Shoukaku v4 래퍼 — Lavalink 클라이언트 |
| `shoukaku` | ^4.1.0 | Discord.js ↔ Lavalink WebSocket 연결 |
| `@discordjs/voice` | (Shoukaku 내부 사용) | 음성 채널 연결 |

**제거된 의존성**: `discord-player`, `@discord-player/extractor`, `yt-search`, `ytdl-core`, `ffmpeg-static`
