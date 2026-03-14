# Git Workflow Guide

> 협업을 위한 브랜치 전략 · 커밋 · PR 규칙

| 항목        | 내용       |
| ----------- | ---------- |
| 작성자      | 신동현     |
| 최종 수정일 | 2026-03-12 |

---

## 1. 브랜치 구조

`main`과 `develop` 두 개의 장기 브랜치를 유지하고, 작업은 항상 단기 브랜치에서 진행한다.

```
main               ← 운영 서버 배포 (태그 기반 릴리즈)
 └─ develop        ← QA 서버 배포 · 통합 개발 브랜치
     └─ feature/*  ← 기능 개발
     └─ fix/*      ← 버그 수정
     └─ refactor/* ← 리팩토링
     └─ chore/*    ← 설정 · 빌드
```

| 브랜치            | 역할          | 배포 환경 | 규칙                                |
| ----------------- | ------------- | --------- | ----------------------------------- |
| `main`            | 프로덕션 배포 | 운영 서버 | 직접 push 금지 · PR 필수            |
| `develop`         | 기능 통합     | QA 서버   | CI 통과 시 직접 push 허용           |
| `feature/fix/...` | 작업 단위     | -         | develop에서 분기 → develop으로 병합 |

---

## 2. 브랜치 네이밍

```
feature/user-login
fix/null-pointer-error
refactor/auth-service
chore/eslint-config
```

- kebab-case 사용, 소문자만
- 기능 단위로 짧게 작성
- 이슈 번호가 있을 경우 포함 권장: `feature/123-user-login`

---

## 3. 브랜치 수명 정책

브랜치가 방치되면 충돌이 쌓이고 히스토리가 복잡해진다.

| 구분             | 기준                       | 조치                                     |
| ---------------- | -------------------------- | ---------------------------------------- |
| 작업 중 브랜치   | 생성 후 7일 이내 PR 미생성 | 본인이 PR 생성 또는 브랜치 삭제          |
| 리뷰 대기 브랜치 | PR 생성 후 3일 이상 방치   | 작업자가 직접 Self-merge 가능 (6번 참고) |
| 병합 완료 브랜치 | develop / main 병합 직후   | 즉시 삭제                                |
| 장기 방치 브랜치 | 14일 이상 활동 없음        | 팀 공유 후 강제 삭제                     |

```bash
# 원격 브랜치 삭제
git push origin --delete feature/user-login

# 로컬 브랜치 삭제
git branch -d feature/user-login
```

---

## 4. 작업 흐름

### ① 브랜치 생성

```bash
git checkout develop
git pull origin develop
git checkout -b feature/user-login
```

### ② 커밋

```bash
git add .
git commit -m "feat: 사용자 로그인 API 추가"
```

### ③ develop 최신화 (작업 중)

작업 중 develop에 다른 커밋이 쌓였다면 merge로 내 브랜치에 반영한다.

```bash
git fetch origin
git merge origin/develop
```

### ④ Push & PR

```bash
git push origin feature/user-login
# → GitHub에서 develop ← feature/user-login PR 생성
```

### ⑤ develop → main 릴리즈

```bash
# QA 완료 후 develop → main PR 생성 및 병합
# 병합 후 버전 태그 추가
git tag -a v1.2.0 -m "release v1.2.0"
git push origin v1.2.0
```

---

## 5. 커밋 메시지

Conventional Commit 규칙을 따르되, **한국어**로 작성한다.

```
feat: 사용자 로그인 API 추가
fix: 유저 서비스 null 포인터 오류 수정
refactor: 인증 로직 단순화
test: 인증 서비스 단위 테스트 추가
chore: eslint 설정 업데이트
docs: API 문서 수정
```

| 타입       | 설명                           |
| ---------- | ------------------------------ |
| `feat`     | 새로운 기능                    |
| `fix`      | 버그 수정                      |
| `refactor` | 코드 리팩토링 (기능 변경 없음) |
| `test`     | 테스트 추가 / 수정             |
| `chore`    | 설정 · 빌드 작업               |
| `docs`     | 문서 변경                      |

- 하나의 커밋 = 하나의 목적
- 커밋 메시지는 동사로 시작 (추가, 수정, 삭제, 개선...)
- 의미 없는 메시지 금지: `수정`, `업데이트`, `asdf`

---

## 6. Pull Request

### PR 제목 & 설명 템플릿

```
feat: 로그인 API 추가

## 변경 내용
- 로그인 API 추가
- JWT 인증 처리

## 테스트
- 로그인 성공 / 잘못된 비밀번호 처리

## 참고
- 관련 이슈: #12
```

### PR 체크리스트

- [ ] ESLint / Prettier 통과
- [ ] TypeScript 타입 오류 없음
- [ ] 테스트 통과
- [ ] PR 크기 500 lines 이하 권장
- [ ] 코드 리뷰 승인 (가능한 경우)

### Self-merge 규칙

2~3인 소규모 팀 특성상 리뷰어가 항상 존재하지 않을 수 있다.

아래 조건을 모두 충족하면 Self-merge를 허용한다.

| 조건         | 기준                                       |
| ------------ | ------------------------------------------ |
| CI 통과      | lint · 테스트 · 빌드 모두 green            |
| PR 대기 시간 | 생성 후 최소 4시간 경과 (긴급 핫픽스 제외) |
| PR 크기      | 500 lines 이하                             |
| 팀원 공유    | Slack 등으로 PR 링크 공유 후 진행          |

### Merge 방식

**Merge Commit** 사용 — 브랜치 병합 흔적을 히스토리에 남겨 작업 맥락을 보존한다.

---

## 7. 핫픽스

운영 서버 긴급 버그는 `main`에서 직접 분기하여 수정 후 `main`과 `develop` 양쪽에 병합한다.

```bash
git checkout main
git checkout -b fix/critical-login-error
# 수정 후 PR → main 병합
# develop에도 cherry-pick 또는 별도 PR로 반영
```

> 핫픽스는 브랜치 수명 정책 예외로 PR 생성 즉시 Self-merge 가능하다.

---

## 8. 금지 사항

- `main` 직접 push
- CI 실패 상태에서 `develop` push
- 의미 없는 커밋 메시지 (예: `수정`, `업데이트`, `asdf`)
- 500 lines 초과 PR
- lint 오류 · 테스트 실패 상태 merge
- 14일 이상 방치 브랜치 유지

---

## 9. 자동화 도구

Husky + lint-staged로 커밋 전 자동 실행:

```bash
eslint --fix
prettier --write
```

| 도구        | 역할                  |
| ----------- | --------------------- |
| ESLint      | 코드 품질 검사        |
| Prettier    | 코드 포맷 통일        |
| Husky       | Git hook 관리         |
| lint-staged | 변경 파일만 선별 검사 |
