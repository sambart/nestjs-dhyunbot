# Web 도메인 PRD

## 개요
Next.js 16 기반 웹 대시보드로, 디스코드 서버의 음성 활동 통계를 시각화하고 관리 기능을 제공한다. 현재 프로토타입 단계이다.

## 관련 모듈
- `apps/web/app/page.tsx` — 랜딩 페이지
- `apps/web/app/layout.tsx` — 루트 레이아웃
- `apps/web/app/components/Header.tsx` — 네비게이션 헤더
- `apps/web/app/components/DashboardSidebar.tsx` — 대시보드 사이드바
- `apps/web/app/components/SettingsSidebar.tsx` — 설정 사이드바
- `apps/web/app/auth/` — OAuth 인증 라우트
- `apps/web/app/api/` — API 라우트
- `apps/web/app/select-guild/page.tsx` — 서버 선택 페이지
- `apps/web/app/dashboard/guild/[guildId]/overview/page.tsx` — 서버 개요 페이지 (F-WEB-008)
- `apps/web/app/dashboard/guild/[guildId]/newbie/page.tsx` — 신입 관리 대시보드 (F-WEB-009)
- `apps/web/app/lib/overview-api.ts` — 서버 개요 API 클라이언트
- `apps/web/app/lib/newbie-dashboard-api.ts` — 신입 관리 대시보드 API 클라이언트
- `apps/web/app/lib/api-client.ts` — 공통 API 클라이언트
- `apps/web/app/settings/guild/[guildId]/` — 서버별 설정 라우트 루트
- `apps/web/app/settings/guild/[guildId]/page.tsx` — 일반 설정
- `apps/web/app/settings/guild/[guildId]/auto-channel/page.tsx` — 자동방 설정
- `apps/web/app/settings/guild/[guildId]/newbie/page.tsx` — 신입 관리 설정
- `apps/web/app/settings/guild/[guildId]/status-prefix/page.tsx` — 게임방 상태 설정
- `apps/web/app/settings/guild/[guildId]/sticky-message/page.tsx` — 고정메세지 설정
- `apps/web/app/settings/guild/[guildId]/voice/page.tsx` — 음성 설정
- `apps/web/app/dashboard/guild/[guildId]/getting-started/page.tsx` — 시작 가이드
- `apps/web/app/dashboard/guild/[guildId]/help/page.tsx` — 도움말
- `apps/web/app/privacy/page.tsx` — 개인정보처리방침
- `apps/web/app/terms/page.tsx` — 이용약관
- `apps/web/app/dashboard/guild/[guildId]/error.tsx` — 에러 바운더리

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
- 서버 개요 페이지 (`/dashboard/guild/{guildId}/overview`)
- 신입 관리 대시보드 (`/dashboard/guild/{guildId}/newbie`)
- 시작 가이드 페이지 (`/dashboard/guild/{guildId}/getting-started`)
- 도움말 페이지 (`/dashboard/guild/{guildId}/help`)
- 개인정보처리방침 (`/privacy`)
- 이용약관 (`/terms`)
- 대시보드 에러 바운더리

### 프로토타입/미구현
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

### F-WEB-003-B: 음성 활동 대시보드

- **경로**: `/dashboard/guild/{guildId}/voice` (서버 전체), `/dashboard/guild/{guildId}/voice?userId={userId}` (유저 상세)
- **현재 상태**: 구현 완료. 서버 전체 음성 통계 + 유저 상세 통합 뷰.
- **뷰 전환**: `userId` 쿼리 파라미터 유무에 따라 서버 전체 뷰 / 유저 상세 뷰를 조건 렌더링
  - `userId` 없음 → 서버 전체 뷰 (요약카드, 트렌드, 채널차트, 유저 랭킹)
  - `userId` 있음 → 유저 상세 뷰 (유저 정보, 요약카드, 일별차트, 마이크/채널 파이, 입퇴장 이력)
- **관련 FE 파일**:
  - `apps/web/app/dashboard/guild/[guildId]/voice/page.tsx` — 대시보드 페이지 (뷰 전환 컨테이너)
  - `apps/web/app/lib/voice-dashboard-api.ts` — API 클라이언트
  - 서버 전체 뷰 차트 컴포넌트 5종 (동일 디렉토리)
  - 유저 상세 뷰 컴포넌트 7종 (동일 디렉토리)
- **호출 API**:
  | 메서드 | 경로 | 설명 |
  |--------|------|------|
  | `GET` | `/api/guilds/{guildId}/voice/daily?from=YYYYMMDD&to=YYYYMMDD` | 음성 일별 통계 조회. 응답: `VoiceDailyRecord[]` |
  | `GET` | `/api/guilds/{guildId}/voice/daily?from=YYYYMMDD&to=YYYYMMDD&userId={userId}` | 유저별 음성 일별 통계 조회. 응답: `VoiceDailyRecord[]` |
  | `GET` | `/api/guilds/{guildId}/members/profiles?ids=id1,id2,...` | 유저 랭킹 테이블 아바타/닉네임 일괄 조회 (F-VOICE-021) |
  | `GET` | `/api/guilds/{guildId}/members/search?q={query}` | 멤버 닉네임 검색 (F-VOICE-019) |
  | `GET` | `/api/guilds/{guildId}/members/{userId}/profile` | 유저 프로필 조회 (F-VOICE-021) |
  | `GET` | `/api/guilds/{guildId}/voice/history/{userId}?from=&to=&page=&limit=` | 유저 입퇴장 이력 (F-VOICE-020) |

#### 채널별 음성활동 바차트 (ChannelBarChart) — 카테고리별 탭

채널별 바차트 위에 [채널별 | 카테고리별] 탭 UI를 표시한다.

| 탭 | 설명 |
|----|------|
| 채널별 (기본) | 기존과 동일. 채널별 `channelDurationSec` 합계를 바차트로 시각화 |
| 카테고리별 | `VoiceDailyRecord`의 `categoryId` / `categoryName`을 기준으로 프론트엔드에서 집계하여 카테고리 단위 바차트 시각화. `categoryName`이 null인 레코드(카테고리 없는 채널 또는 기존 데이터)는 별도 항목("미분류" 등)으로 묶어 표시 |

- API 변경 없음 (기존 응답의 `categoryId`, `categoryName` 필드 활용)

#### 유저 랭킹 테이블 (UserRankingTable) — 검색 통합

유저 랭킹 테이블 카드 헤더에 검색 입력 필드를 추가하여 유저 검색 기능을 통합한다.

| UI 요소 | 설명 |
|---------|------|
| 카드 제목 | "유저별 음성 활동 랭킹" |
| 검색 입력 필드 | 카드 헤더 우측에 배치. 닉네임 입력 시 debounce 300ms 후 멤버 검색 API 호출 |
| 검색 결과 드롭다운 | 입력 필드 아래에 검색 결과 목록 표시. 클릭 시 유저 상세 뷰로 전환 (`?userId={userId}`) |
| 랭킹 행 클릭 | 클릭 시 유저 상세 뷰로 전환 (`?userId={userId}`) |
| 빈 검색 시 | 기존 랭킹 테이블 그대로 표시 |

#### 유저 상세 뷰 (userId 쿼리 파라미터 존재 시)

| UI 요소 | 설명 |
|---------|------|
| 뒤로가기 버튼 | "서버 전체 보기" — 클릭 시 `userId` 쿼리 파라미터 제거하여 서버 전체 뷰로 복귀 |
| 유저 검색 드롭다운 | 헤더 우측에 배치. 다른 유저로 빠르게 전환 |
| 기간 선택 | 7일 / 14일 / 30일 프리셋 버튼 |
| 유저 기본 정보 | 아바타, 닉네임, 디스코드 ID |
| 요약 카드 4개 | 총 음성시간, 마이크 ON, 마이크 OFF, 혼자 시간 |
| 일별 바 차트 | 날짜별 음성 활동 시각화 |
| 마이크 도넛 차트 | micOnSec vs micOffSec 비율 |
| 채널별 도넛 차트 | 채널/카테고리별 사용 비율 (탭 전환) |
| 입퇴장 이력 테이블 | 페이지네이션 지원. 카테고리명, 채널명, 입장, 퇴장, 체류 시간 |

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

#### STEP 1: 트리거 설정

| UI 요소 | 설명 |
|---------|------|
| 설정 이름 입력 필드 | 탭 라벨로 표시될 사용자 지정 이름 (필수, 예: "게임방", "스터디방") |
| 음성 채널 선택 드롭다운 | 서버의 음성 채널 목록에서 대기 채널(트리거 채널) 단일 선택 (필수) |
| 모드 라디오 버튼 | `즉시 생성` / `선택 생성` 두 가지 모드 선택 (필수). 모드 선택에 따라 이후 스텝 표시가 달라진다 |

**모드별 이후 스텝 구성**:

- `즉시 생성` 선택 시: STEP 2(채널 생성 설정)만 표시. 안내 메시지 채널, Embed, 버튼 섹션(STEP 2~3 선택 생성 전용)은 숨긴다
- `선택 생성` 선택 시: STEP 2(안내 메시지 설정) → STEP 3(게임 선택 버튼 설정) 표시

#### STEP 2 — 즉시 생성 모드: 채널 생성 설정

> 즉시 생성 모드 선택 시에만 표시

| UI 요소 | 설명 |
|---------|------|
| 채널명 템플릿 입력 | 생성될 채널 이름 템플릿 (선택, 변수: `{username}`, `{n}`) |
| 생성 카테고리 선택 드롭다운 | 채널이 생성될 카테고리 선택 (필수) |

#### STEP 2 — 선택 생성 모드: 안내 메시지 설정

> 선택 생성 모드 선택 시에만 표시

| UI 요소 | 설명 |
|---------|------|
| 텍스트 채널 선택 드롭다운 | Embed + 버튼이 표시될 텍스트 채널 단일 선택 (필수) |
| Embed 제목 입력 필드 | Embed 제목 텍스트 (선택) |
| Embed 설명 텍스트에리어 | 안내 채널에 표시될 본문 문구 (멀티라인, 필수) |
| 길드 이모지 피커 | Embed 설명 커서 위치에 길드 커스텀 이모지 삽입 |
| Embed 색상 피커 | 색상 선택기 + HEX 코드 직접 입력 |

#### STEP 3 — 선택 생성 모드: 게임 선택 버튼 설정

> 선택 생성 모드 선택 시에만 표시

버튼 목록을 압축된 카드 그리드로 표시한다. 각 카드에는 라벨, 이모지, 카테고리명, 하위 선택지 개수가 요약 표시된다.

| UI 요소 | 설명 |
|---------|------|
| 버튼 카드 그리드 | 등록된 버튼을 카드 형태로 그리드 배치. 카드에 라벨, 이모지, 카테고리명, 하위 선택지 개수 요약 표시 |
| `[수정]` 버튼 | 카드 내 배치. 클릭 시 해당 버튼의 상세 설정을 모달 다이얼로그로 편집 |
| `[삭제]` 버튼 | 카드 내 배치. 클릭 시 해당 버튼 카드 제거 |
| `[+ 추가]` 카드 | 그리드 마지막에 배치. 클릭 시 빈 버튼 편집 모달을 열어 새 버튼 추가 (최대 25개) |

**버튼 편집 모달 필드**:

| 필드 | 설명 |
|------|------|
| 버튼 라벨 입력 | 버튼 표시 텍스트 (필수) |
| 이모지 입력 | 버튼 이모지 (선택, 길드 이모지 피커 지원) |
| 대상 카테고리 선택 드롭다운 | 확정방이 생성될 카테고리 선택 (필수) |
| 채널명 템플릿 입력 | 확정방 이름 템플릿 (선택, 변수: `{username}`, `{n}`) |
| 하위 선택지 인라인 목록 | 모달 내 인라인 행 목록으로 표시. 선택지 라벨, 이모지(선택, 길드 이모지 피커 지원), 채널명 템플릿(변수: `{name}` — 버튼 기본 채널명으로 치환) 입력 |
| 선택지 추가 버튼 | 새 하위 선택지 행 추가 |
| 선택지 삭제 버튼 | 하위 선택지 행 제거 |

#### 통합 미리보기

설정 결과가 Discord에서 어떻게 보이는지 시각화한다. 모드에 따라 표시 내용이 달라진다.

| 모드 | 미리보기 내용 |
|------|--------------|
| 즉시 생성 | 트리거 채널명 → 생성될 채널명(템플릿 적용) → 카테고리 위치를 채널 구조 형태로 시각화 |
| 선택 생성 | Discord 다크모드 배경 스타일의 Embed 실시간 미리보기 + 생성될 채널 구조 시각화 |

#### 채널 새로고침

| UI 요소 | 설명 |
|---------|------|
| 채널 새로고침 버튼 | 음성 채널, 텍스트 채널, 카테고리, 길드 이모지 목록을 Discord API로부터 재조회 |

#### 저장 동작 (탭별 개별 저장)

1. 클라이언트 유효성 검사: 모드에 따라 검증 필드가 다르다
   - 공통: 설정 이름 누락, 대기 채널 미선택, 모드 미선택 시 오류 표시
   - 즉시 생성 모드 추가 검증: 생성 카테고리 미선택 시 오류 표시
   - 선택 생성 모드 추가 검증: 안내 메시지 채널 미선택, Embed 설명 누락, 버튼 라벨 누락, 대상 카테고리 누락 시 오류 표시
2. 현재 탭의 설정 내용만 API(`POST /api/guilds/{guildId}/auto-channel`)로 전송
3. 백엔드에서 AutoChannelConfig(`name`, `mode` 포함), AutoChannelButton, AutoChannelSubOption DB 저장
4. 선택 생성 모드인 경우: 안내 채널에 Embed + 버튼 메시지 전송 또는 갱신 (F-VOICE-009)
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
- **구성**: 다중 탭 UI — 각 탭이 하나의 StickyMessageConfig를 나타낸다 (자동방 설정과 동일 패턴)

#### 탭 바 (Tab Bar)

| UI 요소 | 설명 |
|---------|------|
| 탭 목록 | 저장된 StickyMessageConfig 목록을 탭으로 표시 (탭 라벨 = 선택된 텍스트 채널명, 채널 미선택 시 "새 고정메세지") |
| 탭 추가 버튼 (`+`) | 클릭 시 빈 설정의 새 탭을 추가 (아직 저장되지 않은 상태) |
| 탭 삭제 버튼 | 각 탭에 표시. 클릭 시 확인 모달을 표시한 후 `DELETE /api/guilds/{guildId}/sticky-message/{id}` 호출 (해당 설정 및 Discord 채널의 메시지 즉시 삭제) |
| 탭 전환 | 탭 클릭 시 해당 설정 폼으로 전환 |

#### 채널 설정

| UI 요소 | 설명 |
|---------|------|
| 텍스트 채널 선택 드롭다운 | 고정메세지를 표시할 텍스트 채널 단일 선택 (서버 채널 목록) |
| 기능 활성화 토글 | 해당 탭의 고정메세지 기능 ON/OFF |

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

#### 저장 동작 (탭별 개별 저장)

1. 클라이언트 유효성 검사: 채널 미선택 시 오류 표시
2. 현재 탭의 설정 내용을 `POST /api/guilds/{guildId}/sticky-message`로 전송
3. 백엔드에서 `StickyMessageConfig` DB upsert
4. `enabled = true`이면 지정 채널에 Embed 메시지 즉시 전송 또는 갱신 (F-STICKY-002)
5. 저장 성공 시 해당 탭에 "저장되었습니다." 인라인 메시지 표시 (3초 후 자동 소멸)
6. 저장 실패(채널 없음, 권한 부족 등) 시 오류 토스트 표시
7. 각 탭은 독립적인 저장 버튼과 저장 상태를 가진다

#### 탭 삭제 동작

1. 삭제 버튼 클릭 시 확인 모달 표시 ("이 고정메세지를 삭제하면 채널에서도 즉시 제거됩니다.")
2. 확인 시 `DELETE /api/guilds/{guildId}/sticky-message/{id}` 호출
3. 백엔드에서 StickyMessageConfig 및 Discord 채널의 메시지 즉시 삭제
4. 삭제 성공 시 해당 탭 제거, 남은 첫 번째 탭으로 포커스 이동

#### 초기 로드

- 기존 설정이 있으면 모든 StickyMessageConfig를 탭으로 로드 (sortOrder 오름차순)
- 설정이 없으면 빈 탭 1개를 기본으로 표시
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

### F-WEB-007: 유저 상세 뷰 (음성 활동 대시보드 통합)

> 변경이력: [prd-changelog.md](../../archive/prd-changelog.md)

- **경로**: `/dashboard/guild/{guildId}/voice?userId={userId}`
- **접근 방식**:
  1. 음성 대시보드의 유저 랭킹 테이블에서 행 클릭 시 `?userId={userId}` 쿼리 파라미터 추가하여 유저 상세 뷰로 전환
  2. 유저 랭킹 테이블 헤더의 검색창에서 유저 검색 후 선택
  3. 유저 상세 뷰 내 검색 드롭다운에서 다른 유저로 전환
- **폐기된 라우트**: `/dashboard/guild/{guildId}/user` (검색 전용 페이지), `/dashboard/guild/{guildId}/user/{userId}` (유저 상세 페이지) — 음성 활동 대시보드에 통합되어 삭제됨

유저 상세 뷰의 UI 구성 및 호출 API는 F-WEB-003-B의 "유저 상세 뷰" 섹션을 참조한다.

#### 관련 FE 파일

- `apps/web/app/dashboard/guild/[guildId]/voice/page.tsx` — 음성 활동 대시보드 (뷰 전환 컨테이너)
- `apps/web/app/dashboard/guild/[guildId]/voice/components/UserDetailView.tsx` — 유저 상세 뷰 컴포넌트
- `apps/web/app/lib/user-detail-api.ts` — API 클라이언트 함수
- 유저 상세 차트 컴포넌트 (동일 디렉토리)

---

### F-WEB-008: 서버 개요 페이지 (신규)

> 변경이력: [prd-changelog.md](../../archive/prd-changelog.md)

- **경로**: `/dashboard/guild/{guildId}/overview`
- **위치**: 대시보드 사이드바 > 서버 개요
- **접근 조건**: Discord OAuth 로그인 + 해당 서버 관리 권한
- **역할**: 대시보드 진입 시 첫 화면. 서버 전체 상태를 한눈에 파악하는 개요 대시보드.

#### 섹션 구성

| 섹션 | 내용 | 데이터 소스 |
|------|------|------------|
| 요약 카드 | 총 멤버 수, 오늘 음성 활동 시간(합계), 현재 음성 접속자 수, 활성/비활성 비율 | Discord API, VoiceDaily, BotMetric, InactiveMemberRecord |
| 신입 미션 현황 카드 | 진행 중 N명, 완료 N명, 실패 N명 | NewbieMission |
| 최근 7일 음성 활동 미니 차트 | 일별 총 음성시간 라인/바 차트 (간략) | VoiceDaily |
| 비활동 회원 요약 | 등급별 인원 수 (완전 비활동 / 저활동 / 활동 감소) | InactiveMemberRecord |

#### Disable 처리

| 조건 | 동작 |
|------|------|
| `missionEnabled = false` | 신입 미션 현황 카드 비표시 |

#### 호출 API

| 메서드 | 경로 | 설명 |
|--------|------|------|
| `GET` | `/api/guilds/{guildId}/overview` | 서버 개요 요약 데이터 통합 응답 |

#### 관련 FE 파일

- `apps/web/app/dashboard/guild/[guildId]/overview/page.tsx` — 서버 개요 페이지
- `apps/web/app/lib/overview-api.ts` — API 클라이언트

---

### F-WEB-009: 신입 관리 대시보드 (신규)

> 변경이력: [prd-changelog.md](../../archive/prd-changelog.md)

- **경로**: `/dashboard/guild/{guildId}/newbie`
- **위치**: 대시보드 사이드바 > 신입 관리
- **접근 조건**: Discord OAuth 로그인 + 해당 서버 관리 권한
- **구성**: 탭 2개 — **미션 관리** / **모코코 순위**

#### 전체 Disable 처리

| 조건 | 동작 |
|------|------|
| `missionEnabled = false` AND `mocoEnabled = false` | 두 기능 모두 비활성 안내 화면 표시. "설정에서 기능을 활성화하세요" 메시지 + 설정 페이지 이동 링크 버튼 |
| 하나만 비활성 | 해당 탭만 비활성 처리, 활성된 탭을 기본 선택 |

#### 탭 1: 미션 관리

기존 신입 관리 설정 페이지(F-WEB-NEWBIE-001 탭 3)의 미션 관리 기능을 대시보드로 이동한 것이다. 기능은 동일하며, 탭 형식으로 "진행 중" / "이력" 두 서브탭을 전환한다.

| UI 요소 | 설명 |
|---------|------|
| **서브탭: 진행 중** | |
| 진행 중 미션 테이블 | `IN_PROGRESS` 미션 목록 (닉네임, 시작일, 마감일, 플레이타임/목표, 상태, Embed 토글) |
| 상태 뱃지 드롭다운 | `IN_PROGRESS` 상태 뱃지 클릭 시 완료/실패 뱃지 드롭다운. 완료 선택 시 역할 선택 모달, 실패 선택 시 강퇴 옵션 모달 |
| 역할 선택 모달 | 성공 처리 시 부여할 Discord 역할 선택. 선택하지 않으면 역할 부여 안함 |
| 강퇴 옵션 모달 | 실패 처리 시 강퇴 체크박스(기본 OFF) + DM 사유 입력(옵션) |
| Embed 토글 버튼 | 각 행마다 표시. 토글 ON(인디고)=Embed 표시, OFF(회색)=Embed 숨김. 클릭 시 즉시 전환 |
| **서브탭: 이력** | |
| 상태 필터 드롭다운 | 전체 / 완료 / 실패 / 퇴장 선택 (IN_PROGRESS 제외) |
| 이력 테이블 | COMPLETED/FAILED/LEFT 미션 목록 (닉네임, 시작일, 마감일, 플레이타임/목표, 상태, Embed 토글). 페이지네이션 지원. Discord API 호출 없이 DB 저장된 memberName 사용 |
| Embed 토글 버튼 | 이력에서도 Embed 표시/숨김 전환 가능 |

##### Disable 처리 (`missionEnabled = false`)

| 조건 | 동작 |
|------|------|
| 기존 미션 데이터 있음 | 테이블 상단에 "미션 기능이 비활성화 상태입니다" 경고 배너 표시. 기존 데이터는 읽기 전용으로 조회 가능. 상태 변경/Embed 토글 버튼 비활성화 (disabled) |
| 기존 미션 데이터 없음 | 빈 상태 안내. "미션 기능이 비활성화 상태입니다. 설정에서 활성화하세요" + 설정 이동 링크 |

#### 탭 2: 모코코 순위

| UI 요소 | 설명 |
|---------|------|
| 기간 표시 | 현재 집계 기간 표시 (리셋 주기에 따라 자동 결정) |
| 점수 분포 카드 | 상위 3명 하이라이트 + 전체 참여자 수 |
| 순위 테이블 | 순위, 사냥꾼 닉네임(아바타), 총 점수, 사냥 시간(분), 세션 횟수, 도움준 모코코 수 |
| 사냥꾼 상세 펼침 | 행 클릭 시 도움받은 모코코 목록 (닉네임, 동시접속 시간, 세션 횟수) 표시 |

##### Disable 처리 (`mocoEnabled = false`)

| 조건 | 동작 |
|------|------|
| 기존 순위 데이터 있음 | 테이블 상단에 "모코코 사냥 기능이 비활성화 상태입니다" 경고 배너 표시. 기존 순위 데이터는 읽기 전용으로 조회 가능 |
| 기존 순위 데이터 없음 | 빈 상태 안내. "모코코 사냥 기능이 비활성화 상태입니다. 설정에서 활성화하세요" + 설정 이동 링크 |

#### 호출 API

| 메서드 | 경로 | 설명 |
|--------|------|------|
| `GET` | `/api/guilds/{guildId}/newbie/config` | 기능 상태 확인 (`missionEnabled`, `mocoEnabled`) |
| `GET` | `/api/guilds/{guildId}/newbie/missions` | 진행 중 미션 목록 |
| `GET` | `/api/guilds/{guildId}/newbie/missions/history` | 미션 이력 (상태 필터·페이지네이션 지원) |
| `POST` | `/api/guilds/{guildId}/newbie/missions/complete` | 미션 수동 성공 처리 |
| `POST` | `/api/guilds/{guildId}/newbie/missions/fail` | 미션 수동 실패 처리 |
| `POST` | `/api/guilds/{guildId}/newbie/missions/hide` | Embed 숨김 처리 |
| `POST` | `/api/guilds/{guildId}/newbie/missions/unhide` | Embed 숨김 해제 |
| `GET` | `/api/guilds/{guildId}/newbie/moco` | 모코코 사냥 순위 |

#### DashboardSidebar 메뉴 구성

대시보드 사이드바(`DashboardSidebar.tsx`)의 메뉴 항목은 다음과 같다.

```
대시보드
├── 서버 개요        → /dashboard/guild/{guildId}/overview   (F-WEB-008)
├── 음성 활동        → /dashboard/guild/{guildId}/voice       (F-WEB-003-B, F-WEB-007 통합)
├── 신입 관리        → /dashboard/guild/{guildId}/newbie      (F-WEB-009)
├── 비활동 회원      → /dashboard/guild/{guildId}/inactive-member
├── 관계 분석        → /dashboard/guild/{guildId}/co-presence
├── 모니터링         → /dashboard/guild/{guildId}/monitoring
└── 도움말           → /dashboard/guild/{guildId}/help        (F-WEB-011, 사이드바 하단)
```

#### 관련 FE 파일

- `apps/web/app/dashboard/guild/[guildId]/newbie/page.tsx` — 신입 관리 대시보드
- `apps/web/app/lib/newbie-dashboard-api.ts` — API 클라이언트
- `apps/web/app/components/DashboardSidebar.tsx` — 사이드바 메뉴 추가

---

---

### F-WEB-010: 시작 가이드 (Getting Started)
- **경로**: `/dashboard/guild/{guildId}/getting-started`
- **위치**: 길드 설정이 없는 경우 자동 리다이렉트
- **구성**: 4단계 위자드
  1. 봇 권한 확인 — 봇 온라인 상태 체크
  2. 음성 추적 설정 — 제외 채널 설정 안내 (설정 페이지 링크)
  3. 알림 채널 설정 — 신입/비활동 알림 채널 안내 (설정 페이지 링크)
  4. 완료 — 주요 기능 바로가기

### F-WEB-011: 도움말 페이지
- **경로**: `/dashboard/guild/{guildId}/help`
- **위치**: 대시보드 사이드바 하단
- **구성**: FAQ 아코디언 (6개 섹션: 음성 추적, AI 분석, 신입 관리, 비활동 회원, 관계 분석, 자동 채널)

### F-WEB-012: 법적 페이지
- **개인정보처리방침**: `/privacy` (로그인 불필요)
- **이용약관**: `/terms` (로그인 불필요)
- **링크 위치**: 랜딩 페이지 푸터
- **포함 내용**: 수집 데이터, 보관 기간(90일), 제3자 제공(Google Gemini), 쿠키, 데이터 삭제 방법

### F-WEB-013: 에러 바운더리
- **경로**: `/dashboard/guild/{guildId}/*` 하위 전체
- **구현**: Next.js `error.tsx` 파일 기반, 에러 메시지 + 재시도 버튼

---

## 기술 스택
| 기술 | 버전 | 용도 |
|------|------|------|
| Next.js | 16.1.0 | React 프레임워크 |
| React | 19.2.3 | UI 라이브러리 |
| Tailwind CSS | 3.4.19 | 스타일링 |
| Lucide React | - | 아이콘 |
