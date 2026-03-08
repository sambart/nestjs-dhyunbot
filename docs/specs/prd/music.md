# Music 도메인 PRD

## 개요
디스코드 음성 채널에서 YouTube 음악을 재생하는 기능을 제공한다. discord-player 라이브러리를 사용한다.

## 관련 모듈
- `apps/api/src/music/music.service.ts` — 음악 재생 서비스
- `apps/api/src/music/music-play.command.ts` — 재생 커맨드
- `apps/api/src/music/music-skip.command.ts` — 건너뛰기 커맨드
- `apps/api/src/music/music-stop.command.ts` — 정지 커맨드

## 기능 상세

### F-MUSIC-001: 음악 재생 (`/play`)
- **입력**: 검색어 또는 YouTube URL
- **동작**:
  1. 유저가 음성 채널에 접속해 있는지 확인
  2. 봇이 해당 음성 채널에 참여
  3. discord-player로 트랙 검색 및 재생
- **출력**: 재생 시작 메시지

### F-MUSIC-002: 건너뛰기 (`/skip`)
- **동작**: 현재 재생 중인 트랙을 건너뛰고 다음 트랙 재생
- **출력**: 건너뛴 트랙 정보

### F-MUSIC-003: 정지 (`/stop`)
- **동작**: 재생 중지, 큐 초기화, 음성 채널 퇴장
- **출력**: 정지 확인 메시지

## 의존성
- `discord-player` 7.1.0
- `@discord-player/extractor` 4.5.8
- `ytdl-core` 4.11.5
- `ffmpeg-static` — 오디오 인코딩
