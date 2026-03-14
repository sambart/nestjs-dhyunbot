# Code Style

## Naming

- 변수/함수: `camelCase` | 컴포넌트/타입/인터페이스: `PascalCase` | 상수: `UPPER_SNAKE_CASE`
- Boolean: `is` / `has` / `can` / `should` 접두사 필수 (`isLoading`, `hasError`)
- 함수명: 동사로 시작 (`fetchUser`, `formatDate`)
- 이벤트 핸들러: `handle` + 대상 + 이벤트 (`handleLoginClick`, `handleFormSubmit`)

## Functions

- 함수 하나는 한 가지 일만 — 이름에 `and`가 들어가거나 50줄 초과 시 분리
- 파라미터 3개 이상 → 객체로 묶기
- 컴포넌트는 `function` 선언식, 나머지는 화살표 함수
- guard clause로 early return — 불필요한 `else` 제거
- 중첩 3단계 초과 시 함수 추출

## TypeScript

- `any` 사용 금지 (ESLint: warn) — 불가피하면 `unknown` + 타입 가드로 좁히기
- `as` 단언 사용 시 이유를 주석으로 명시
- 객체 구조 → `interface` / 유니온·유틸리티 → `type`
- `type import` 분리 필수: `import type { Foo } from './foo'`
- 타입은 `*.types.ts`에 정의 후 named export

## Promise / Async

- floating promise 금지 — 항상 `await`, 의도적 무시는 `void` 명시
- `try/catch` 안에서는 반드시 `return await` (그냥 `return`하면 catch 안 잡힘)
- async 함수를 조건문/이벤트 핸들러에 직접 전달 금지 — `() => { void asyncFn(); }` 패턴 사용

## Nullish / Optional

- `a && a.b` → `a?.b` (optional chaining 강제)
- `a || default` → `a ?? default` (null/undefined만 대체할 때)
- `||`는 falsy 전체를 처리할 때만 — 이유 주석 필수

## Error Handling

- 빈 `catch` 금지 — 반드시 로깅하거나 상위로 `throw`
- `throw`는 반드시 `new Error(...)` — 문자열·객체 리터럴 throw 금지
- `catch (error)` 사용 전 `error instanceof Error` 확인

## Tidy

- 매직 넘버/스트링 → 이름 있는 상수로 추출
- 미사용 변수/import 즉시 삭제 (ESLint: error)
- `console.log` 사용 금지 — `console.warn` / `console.error`만 허용
- dead code(주석 처리된 코드) 즉시 삭제
- 변수는 사용 직전에 선언

## Comments

- 주석은 why만 — what을 반복하는 주석 금지
- 공용 함수/훅/유틸에 JSDoc 작성
- TODO/FIXME: 담당자 + 날짜 + 이슈번호 필수 `// TODO(이름 YYYY-MM-DD): 내용 — #이슈`
