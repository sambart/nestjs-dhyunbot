# Web 도메인 PRD

## 개요
Next.js 16 기반 웹 대시보드로, 디스코드 서버의 음성 활동 통계를 시각화하고 관리 기능을 제공한다. 현재 프로토타입 단계이다.

## 관련 모듈
- `apps/web/app/page.tsx` — 랜딩 페이지
- `apps/web/app/layout.tsx` — 루트 레이아웃
- `apps/web/app/components/Header.tsx` — 네비게이션 헤더
- `apps/web/app/auth/` — OAuth 인증 라우트
- `apps/web/app/api/` — API 라우트

## 현재 구현 상태

### 완료
- 랜딩 페이지 (기능 소개 6종, CTA)
- 글로벌 레이아웃 + 헤더
- Discord OAuth 로그인 흐름 (라우트)

### 프로토타입/미구현
- 대시보드 페이지 (`/dashboard`)
- 음성 통계 시각화 (차트)
- 실시간 모니터링
- 서버 설정 관리

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

### F-WEB-003: 대시보드 (계획)
- **경로**: `/dashboard`
- **계획 기능**:
  - 서버별 음성 활동 요약
  - 일별/주별/월별 통계 차트
  - 유저별 활동 랭킹
  - 채널별 사용 통계

## 기술 스택
| 기술 | 버전 | 용도 |
|------|------|------|
| Next.js | 16.1.0 | React 프레임워크 |
| React | 19.2.3 | UI 라이브러리 |
| Tailwind CSS | 3.4.19 | 스타일링 |
| Lucide React | - | 아이콘 |
