# Web 도메인 PRD

## 개요
Next.js 16 기반 웹 대시보드로, 디스코드 서버의 음성 활동 통계를 시각화하고 관리 기능을 제공한다. 현재 프로토타입 단계이다.

## 관련 모듈
- `apps/web/app/page.tsx` — 랜딩 페이지
- `apps/web/app/layout.tsx` — 루트 레이아웃
- `apps/web/app/components/Header.tsx` — 네비게이션 헤더
- `apps/web/app/components/SettingsSidebar.tsx` — 설정 사이드바
- `apps/web/app/auth/` — OAuth 인증 라우트
- `apps/web/app/api/` — API 라우트
- `apps/web/app/select-guild/page.tsx` — 서버 선택 페이지
- `apps/web/app/settings/guild/[guildId]/` — 서버별 설정 라우트 루트
- `apps/web/app/settings/guild/[guildId]/page.tsx` — 일반 설정
- `apps/web/app/settings/guild/[guildId]/auto-channel/page.tsx` — 자동방 설정
- `apps/web/app/settings/guild/[guildId]/newbie/page.tsx` — 신입 관리 설정
- `apps/web/app/settings/guild/[guildId]/status-prefix/page.tsx` — 게임방 상태 설정
- `apps/web/app/settings/guild/[guildId]/sticky-message/page.tsx` — 고정메세지 설정
- `apps/web/app/settings/guild/[guildId]/voice/page.tsx` — 음성 설정

## 현재 구현 상태

### 완료
- 랜딩 페이지 (기능 소개 6종, CTA)
- 글로벌 레이아웃 + 헤더
- Discord OAuth 로그인 흐름 (라우트)
- 서버 선택 페이지 (`/select-guild`)
- 서버별 설정 레이아웃 (사이드바 + 인증 가드)
- 일반 설정 페이지 (`/settings/guild/{guildId}`)
- 자동방 설정 페이지 (`/settings/guild/{guildId}/auto-channel`)
- 신입 관리 설정 페이지 (`/settings/guild/{guildId}/newbie`)
- 게임방 상태 설정 페이지 (`/settings/guild/{guildId}/status-prefix`)
- 고정메세지 설정 페이지 (`/settings/guild/{guildId}/sticky-message`)
- 음성 설정 페이지 (`/settings/guild/{guildId}/voice`)

### 프로토타입/미구현
- 대시보드 페이지 (`/dashboard`) — 현재 미구현, 플레이스홀더 상태
- 음성 통계 시각화 (차트)
- 실시간 모니터링

## 기능 상세

### F-WEB-001: 랜딩 페이지
- **경로**: `/`
- **구성**:
  - 히어로 섹션 (제목, 설명, CTA 버튼)
  - 대시보드 프리뷰 (플레이스홀더)
  - 주요 기능 소개 (6개 카드)
  - CTA 섹션

### F-WEB-002: Discord OAuth 로그인
- **경로**: `/auth/discord` → Discord → `/auth/callback`
- **동작**: Discord OAuth2 인증 후 JWT 토큰 발급

### F-WEB-003: 서버 선택 페이지
- **경로**: `/select-guild`
- **접근 조건**: Discord OAuth 로그인 필수 (미로그인 시 `/auth/discord`로 리다이렉트)
- **동작**:
  - 로그인한 사용자가 관리자 또는 서버 관리 권한을 가진 길드 목록을 카드 형태로 표시
  - 길드가 1개이면 즉시 해당 길드 설정 페이지(`/settings/guild/{guildId}`)로 리다이렉트
  - 길드가 없으면 "관리 가능한 서버가 없습니다" 안내 표시
  - 카드 클릭 시 `/settings/guild/{guildId}` 이동

### F-WEB-003-B: 대시보드 (구현 진행 중)
- **경로**: `/dashboard/guild/{guildId}/voice`
- **현재 상태**: 음성 통계 대시보드 페이지 및 차트 컴포넌트 5종, API 클라이언트 구현 완료. 백엔드 API 구현 진행 중.
- **관련 FE 파일**:
  - `apps/web/app/dashboard/guild/[guildId]/voice/page.tsx` — 대시보드 페이지
  - `apps/web/app/lib/voice-dashboard-api.ts` — API 클라이언트
  - 차트 컴포넌트 5종 (동일 디렉토리)
- **호출 API**:
  | 메서드 | 경로 | 설명 |
  |--------|------|------|
  | `GET` | `/api/guilds/{guildId}/voice/daily?from=YYYYMMDD&to=YYYYMMDD` | 음성 일별 통계 조회. 응답: `VoiceDailyRecord[]` |
- **계획 기능** (향후):
  - 서버별 음성 활동 요약
  - 일별/주별/월별 통계 차트
  - 유저별 활동 랭킹
  - 채널별 사용 통계

### F-WEB-004: 자동방 설정 페이지

> 변경이력: [prd-changelog.md](../../archive/prd-changelog.md)

- **경로**: `/settings/guild/{guildId}/auto-channel`
- **위치**: 설정 사이드바 > 자동방 설정
- **접근 조건**: Discord OAuth 로그인 + 해당 서버 관리 권한 (레이아웃 레벨에서 검증)
- **구성**: 다중 탭 UI — 각 탭이 하나의 AutoChannelConfig(자동방 설정)를 나타낸다

#### 탭 바 (Tab Bar)

| UI 요소 | 설명 |
|---------|------|
| 탭 목록 | 저장된 AutoChannelConfig 목록을 탭으로 표시 (탭 라벨 = 설정의 `name` 필드) |
| 탭 추가 버튼 (`+`) | 클릭 시 빈 설정의 새 탭을 추가 (아직 저장되지 않은 상태) |
| 탭 삭제 버튼 | 각 탭에 표시. 클릭 시 확인 모달을 표시한 후 `DELETE /api/guilds/{guildId}/auto-channel/{configId}` 호출 (해당 설정 및 연결된 안내 메시지 즉시 삭제) |
| 탭 전환 | 탭 클릭 시 해당 설정 폼으로 전환 |

#### 설정 이름 (탭 라벨)

| UI 요소 | 설명 |
|---------|------|
| 설정 이름 입력 필드 | 탭 라벨로 표시될 사용자 지정 이름 (필수, 예: "게임방", "스터디방") |

#### 대기 채널 설정

| UI 요소 | 설명 |
|---------|------|
| 음성 채널 선택 드롭다운 | 서버의 음성 채널 목록에서 대기 채널(트리거 채널) 단일 선택 |

#### 안내 메시지 채널 설정

| UI 요소 | 설명 |
|---------|------|
| 텍스트 채널 선택 드롭다운 | Embed + 버튼이 표시될 텍스트 채널 단일 선택 |

#### 안내 메시지 (Embed) 설정

| UI 요소 | 설명 |
|---------|------|
| Embed 제목 입력 필드 | Embed 제목 텍스트 (선택) |
| Embed 설명 텍스트에리어 | 안내 채널에 표시될 본문 문구 (멀티라인, 필수) |
| 길드 이모지 피커 | Embed 설명 커서 위치에 길드 커스텀 이모지 삽입 |
| Embed 색상 피커 | 색상 선택기 + HEX 코드 직접 입력 |
| 실시간 미리보기 | Discord 다크모드 배경 스타일의 Embed 미리보기 패널 |

#### 버튼 목록 설정

| UI 요소 | 설명 |
|---------|------|
| 버튼 카드 목록 | 등록된 버튼 목록 (카드 인덱스 번호 표시) |
| 버튼 라벨 입력 | 버튼 표시 텍스트 (필수) |
| 이모지 입력 | 버튼 이모지 (선택, 길드 이모지 피커 지원) |
| 대상 카테고리 선택 드롭다운 | 확정방이 생성될 카테고리 선택 (필수) |
| 채널명 템플릿 입력 | 확정방 이름 템플릿 (선택, 변수: `{username}`, `{n}`) |
| 버튼 추가 버튼 | 새 버튼 카드 추가 (최대 25개) |
| 버튼 삭제 버튼 | 버튼 카드 제거 |

#### 하위 선택지 설정 (버튼별)

| UI 요소 | 설명 |
|---------|------|
| 하위 선택지 인라인 목록 | 버튼 카드 하단에 표시되는 인라인 행 목록 |
| 선택지 라벨 입력 | 하위 버튼 표시 텍스트 |
| 선택지 이모지 입력 | 하위 버튼 이모지 (선택, 길드 이모지 피커 지원) |
| 채널명 템플릿 입력 | 하위 선택지 채널명 템플릿 (변수: `{name}` — 버튼 기본 채널명으로 치환) |
| 선택지 추가 버튼 | 새 하위 선택지 행 추가 |
| 선택지 삭제 버튼 | 하위 선택지 행 제거 |

#### 채널 새로고침

| UI 요소 | 설명 |
|---------|------|
| 채널 새로고침 버튼 | 음성 채널, 텍스트 채널, 카테고리, 길드 이모지 목록을 Discord API로부터 재조회 |

#### 저장 동작 (탭별 개별 저장)

1. 클라이언트 유효성 검사: 설정 이름 누락, 대기 채널 미선택, 안내 메시지 채널 미선택, 버튼 라벨 누락, 대상 카테고리 누락 시 오류 표시
2. 현재 탭의 설정 내용만 API(`POST /api/guilds/{guildId}/auto-channel`)로 전송
3. 백엔드에서 AutoChannelConfig(`name` 포함), AutoChannelButton, AutoChannelSubOption DB 저장
4. 안내 채널에 Embed + 버튼 메시지 전송 또는 갱신 (F-VOICE-009)
5. 저장 성공 시 해당 탭에 "저장되었습니다." 인라인 메시지 표시 (3초 후 자동 소멸)
6. 각 탭은 독립적인 저장 버튼과 저장 상태를 가진다

#### 탭 삭제 동작

1. 삭제 버튼 클릭 시 확인 모달 표시 ("이 설정을 삭제하면 연결된 안내 메시지도 함께 삭제됩니다.")
2. 확인 시 `DELETE /api/guilds/{guildId}/auto-channel/{configId}` 호출
3. 백엔드에서 AutoChannelConfig 및 연결된 Discord 안내 메시지 즉시 삭제
4. 삭제 성공 시 해당 탭 제거, 남은 첫 번째 탭으로 포커스 이동

#### 초기 로드

- 기존 설정이 있으면 모든 AutoChannelConfig를 탭으로 로드
- 설정이 없으면 빈 탭 1개를 기본으로 표시
- 개수 제한 없음

### F-WEB-005: 고정메세지 설정 페이지

> 변경이력: [prd-changelog.md](../../archive/prd-changelog.md)

- **경로**: `/settings/guild/{guildId}/sticky-message`
- **위치**: 설정 사이드바 > 고정메세지
- **접근 조건**: Discord OAuth 로그인 + 해당 서버 관리 권한 (레이아웃 레벨에서 검증)
- **구성**: 카드 목록 UI — 각 카드가 하나의 StickyMessageConfig를 나타낸다

#### 고정메세지 카드 목록

| UI 요소 | 설명 |
|---------|------|
| 카드 목록 | 등록된 StickyMessageConfig 목록을 카드로 표시 |
| 카드 추가 버튼 (`+ 고정메세지 추가`) | 클릭 시 빈 설정의 새 카드를 추가 (아직 저장되지 않은 상태) |
| 카드 삭제 버튼 | 각 카드에 표시. 클릭 시 확인 모달 표시 후 `DELETE /api/guilds/{guildId}/sticky-message/{id}` 호출 |

#### 채널 설정

| UI 요소 | 설명 |
|---------|------|
| 텍스트 채널 선택 드롭다운 | 고정메세지를 표시할 텍스트 채널 단일 선택 (서버 채널 목록) |
| 기능 활성화 토글 | 해당 카드의 고정메세지 기능 ON/OFF |

#### 안내 메시지 (Embed) 설정

| UI 요소 | 설명 |
|---------|------|
| Embed 제목 입력 필드 | Embed 제목 텍스트 (선택) |
| Embed 설명 텍스트에리어 | 고정메세지 본문 문구 (멀티라인, 선택) |
| 길드 이모지 피커 | Embed 설명 커서 위치에 길드 커스텀 이모지 삽입 |
| Embed 색상 피커 | 색상 선택기 + HEX 코드 직접 입력 |
| 실시간 미리보기 | Discord 다크모드 배경 스타일의 Embed 미리보기 패널 |

#### 채널 새로고침

| UI 요소 | 설명 |
|---------|------|
| 채널 새로고침 버튼 | 텍스트 채널 목록 및 길드 이모지 목록을 Discord API로부터 재조회 |

#### 저장 동작 (카드별 개별 저장)

1. 클라이언트 유효성 검사: 채널 미선택 시 오류 표시
2. 현재 카드의 설정 내용을 `POST /api/guilds/{guildId}/sticky-message`로 전송
3. 백엔드에서 `StickyMessageConfig` DB upsert
4. `enabled = true`이면 지정 채널에 Embed 메시지 즉시 전송 또는 갱신 (F-STICKY-002)
5. 저장 성공 시 해당 카드에 "저장되었습니다." 인라인 메시지 표시 (3초 후 자동 소멸)
6. 저장 실패(채널 없음, 권한 부족 등) 시 오류 토스트 표시

#### 삭제 동작

1. 삭제 버튼 클릭 시 확인 모달 표시 ("이 고정메세지를 삭제하면 채널에서도 즉시 제거됩니다.")
2. 확인 시 `DELETE /api/guilds/{guildId}/sticky-message/{id}` 호출
3. 백엔드에서 StickyMessageConfig 및 Discord 채널의 메시지 즉시 삭제
4. 삭제 성공 시 해당 카드 제거

#### 초기 로드

- 기존 설정이 있으면 모든 StickyMessageConfig를 카드로 로드 (sortOrder 오름차순)
- 설정이 없으면 안내 문구와 추가 버튼만 표시
- 개수 제한 없음

### F-WEB-006: 음성 설정 페이지

> 변경이력: [prd-changelog.md](../../archive/prd-changelog.md)

- **경로**: `/settings/guild/{guildId}/voice`
- **위치**: 설정 사이드바 > 음성 설정
- **접근 조건**: Discord OAuth 로그인 + 해당 서버 관리 권한 (레이아웃 레벨에서 검증)
- **구성**: 단일 폼 UI — 음성 시간 제외 채널 멀티 셀렉트 드롭다운 및 저장 버튼

#### 사이드바 메뉴

| UI 요소 | 설명 |
|---------|------|
| 음성 설정 메뉴 항목 | Mic 또는 Volume2 아이콘 + "음성 설정" 라벨. 클릭 시 `/settings/guild/{guildId}/voice`로 이동 |

#### 음성 시간 제외 채널 섹션

| UI 요소 | 설명 |
|---------|------|
| 섹션 제목 | "음성 시간 제외 채널" |
| 멀티 셀렉트 드롭다운 | 서버의 음성 채널 및 카테고리 목록에서 복수 선택. 카테고리는 📁 아이콘, 음성 채널은 🔊 아이콘으로 구분 |
| 선택 항목 표시 | 선택된 항목을 태그(칩) 형태로 드롭다운 위 또는 내부에 표시. 각 태그에 개별 제거(×) 버튼 |
| 카테고리 선택 안내 | 카테고리가 선택된 경우 "카테고리 선택 시 하위 음성 채널 전체가 제외됩니다." 인라인 안내 문구 표시 |
| 채널 새로고침 버튼 | 음성 채널 및 카테고리 목록을 Discord API로부터 재조회 |

#### 저장 동작

1. 클라이언트 유효성 검사: 별도 필수 항목 없음 (선택 항목이 0개여도 저장 가능 — 제외 채널 전체 해제)
2. `POST /api/guilds/{guildId}/voice/excluded-channels` 호출. 요청 바디에 선택된 채널/카테고리 ID 배열을 전달 (전체 교체 방식)
3. 저장 성공 시 "저장되었습니다." 인라인 메시지 표시 (3초 후 자동 소멸)
4. 저장 실패 시 오류 인라인 메시지 표시

#### 초기 로드

1. 페이지 마운트 시 `GET /api/guilds/{guildId}/voice/excluded-channels` 호출하여 현재 제외 채널 목록 조회
2. 음성 채널 및 카테고리 목록 조회 (`GET /api/guilds/{guildId}/channels` 또는 채널 새로고침 API)
3. 기존 제외 채널 목록을 드롭다운 선택 상태에 반영하여 표시

#### API

| 메서드 | 경로 | 설명 |
|--------|------|------|
| `GET` | `/api/guilds/{guildId}/voice/excluded-channels` | 제외 채널 목록 조회. 응답: `{ excludedChannelIds: string[] }` |
| `POST` | `/api/guilds/{guildId}/voice/excluded-channels` | 제외 채널 목록 저장 (전체 교체). 요청 바디: `{ excludedChannelIds: string[] }` |

---

## 기술 스택
| 기술 | 버전 | 용도 |
|------|------|------|
| Next.js | 16.1.0 | React 프레임워크 |
| React | 19.2.3 | UI 라이브러리 |
| Tailwind CSS | 3.4.19 | 스타일링 |
| Lucide React | - | 아이콘 |
