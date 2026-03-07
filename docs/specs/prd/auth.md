# Auth 도메인 PRD

## 개요
웹 대시보드 접근을 위한 Discord OAuth2 인증과 JWT 세션 관리를 담당한다.

## 관련 모듈
- `apps/api/src/auth/auth.service.ts` — JWT 토큰 생성/검증
- `apps/api/src/auth/auth.module.ts` — JwtModule 설정
- `apps/web/app/auth/discord/route.ts` — Discord OAuth 시작
- `apps/web/app/auth/callback/route.ts` — OAuth 콜백 처리

## 기능 상세

### F-AUTH-001: Discord OAuth2 로그인
- **흐름**:
  1. 웹 대시보드에서 "시작하기" 클릭
  2. Discord OAuth2 인증 페이지로 리다이렉트
  3. 인증 완료 후 콜백 URL로 리다이렉트
  4. 콜백에서 access token 교환
- **스코프**: identify (기본)

### F-AUTH-002: JWT 세션 관리
- **토큰 설정**: 1시간 만료
- **시크릿**: 환경변수 `JWT_SECRET`
- **용도**: API 요청 인증

## 환경변수
| 변수 | 용도 |
|------|------|
| JWT_SECRET | JWT 서명 키 |
| DISCORD_CLIENT_ID | OAuth 앱 ID |
| DISCORD_CLIENT_SECRET | OAuth 앱 시크릿 |
