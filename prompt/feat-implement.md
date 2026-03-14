# 기능 수정/추가 작업 프롬프트

## 작업 대상
- 기능명: {{FEATURE_NAME}}
- 요구사항: {{REQUIREMENT_SUMMARY}}

## 실행 모드: 자율 연속 실행

> **이 프롬프트는 참조 문서가 아닌 실행 명령이다.**
> Phase 0부터 Phase 6까지 사용자 개입 없이 자율적으로 끝까지 실행한다.

### 자율 실행 규칙
1. **중단 금지**: 에이전트 호출 결과를 받은 즉시 다음 단계를 호출한다. 사용자에게 "결과를 보고하고 대기"하지 않는다.
2. **Phase 자동 전환**: 현재 Phase의 모든 단계가 완료되면, 사용자 확인 없이 다음 Phase로 진행한다.
3. **중간 보고 생략**: Phase 간 전환 시 사용자에게 "다음 단계로 진행할까요?"라고 묻지 않는다. TodoWrite로 진행 상황을 업데이트하는 것으로 충분하다.
4. **멈춰야 하는 유일한 경우**: 3회 연속 실패 시에만 사용자에게 보고하고 대기한다.
5. **진행 추적**: 파이프라인 시작 시 TodoWrite로 전체 Phase를 등록하고, 각 단계 완료마다 상태를 갱신한다.

### 에이전트 호출 패턴
```
# 잘못된 패턴 (❌): 호출 후 보고하고 멈춤
에이전트 A 호출 → 결과 수신 → "A가 완료되었습니다. 다음으로 진행할까요?" → [사용자 대기]

# 올바른 패턴 (✅): 호출 후 즉시 다음 단계 진행
에이전트 A 호출 → 결과 수신 → TodoWrite 갱신 → 에이전트 B 즉시 호출 → ...
```

### 병렬 실행 최적화
- 독립적인 에이전트(예: plan-writer × N)는 반드시 동시에 호출한다.
- 순차 의존이 있는 에이전트(예: prd-writer → database-architect)는 앞선 결과를 받은 후 호출한다.

## 공통 규칙
- 각 단계는 이전 단계의 산출물을 명시적으로 참조한다.
- 문서 수정 시 기존 포맷과 컨벤션을 유지한다.
- 단계 실패 시 에러를 보고하고 해당 단계를 재시도한다. (최대 3회)
- 3회 재시도 후에도 실패하면 사용자에게 보고하고 대기한다.

## 도메인 결정 (Phase 0)
파이프라인 시작 전, 작업 대상 기능이 속하는 **도메인**을 결정한다.
- 도메인 목록: `voice`, `music`, `member`, `channel`, `auth`, `gemini`, `web`, `newbie`, `status-prefix`, `general`, `sticky-message`, `monitoring`, `voice-co-presence`, `inactive-member`
- 결정된 도메인에 해당하는 문서만 각 에이전트에 전달하여 컨텍스트를 최소화한다.

### 프로젝트 구조
```
nest-dhyunbot/
├── apps/
│   ├── api/          # NestJS Backend (TypeORM + PostgreSQL + Redis + Discord.js)
│   └── web/          # Next.js Frontend Dashboard (React 19 + Tailwind CSS)
├── libs/
│   └── shared/       # 공유 타입 및 상수
├── docs/
│   └── specs/        # 기능 명세 문서
│       ├── prd/      # PRD 문서
│       └── database/ # DB 스키마 문서
└── prompt/           # AI 워크플로우 프롬프트
```

### 문서 참조 규칙
| 문서 유형 | 전역 (항상 읽음) | 기능별 (도메인에 따라 선택) |
|-----------|-----------------|---------------------------|
| PRD | `/docs/specs/prd/_index.md` | `/docs/specs/prd/{domain}.md` |
| DB 스키마 | `/docs/specs/database/_index.md` | — |

## 실행 파이프라인

### Phase 1: 문서 작성
1. [prd-writer] → 입력: 요구사항 / 출력: `/docs/specs/prd/{domain}.md` 갱신

### Phase 2: 설계
2. [database-architect] → 입력: PRD diff / 출력: `/docs/specs/database/_index.md` (변경 시)
3. [database-critic] → 입력: database/_index.md diff / 출력: 리뷰 반영된 database/_index.md
4. **[Migration 생성]** → 조건: database/_index.md 변경 시 또는 신규 Entity 추가 시
    - **Entity 파일이 이미 존재하는 경우**: Entity 파일 수정
    - **Entity 파일이 없는 경우**: PRD/DB 스키마 문서를 기반으로 Entity 파일 신규 작성 후 모듈에 등록
    - 자동 생성 시도: 컨테이너 내에서 `docker exec -w //workspace/apps/api nest-api sh -c "TS_NODE_TRANSPILE_ONLY=1 TS_NODE_COMPILER_OPTIONS='{\"experimentalDecorators\":true,\"emitDecoratorMetadata\":true,\"strict\":false,\"useDefineForClassFields\":false}' ts-node -r tsconfig-paths/register ./node_modules/typeorm/cli.js migration:generate src/migrations/{timestamp}-{Name} -d src/data-source.ts"` 실행
    - **자동 생성 결과 검토**: TypeORM `migration:generate`는 현재 Entity와 DB 스키마의 **전체 diff**를 출력하므로, 불필요한 변경(기존 인덱스/FK 재생성, 컬럼 타입 재정의 등)이 포함될 수 있다. 이 경우 **해당 기능에 필요한 변경만 포함하도록 마이그레이션 파일을 수동으로 정리**한다.
    - **수동 작성이 필요한 경우**: 자동 생성 실패 또는 결과가 지나치게 복잡할 때, PRD의 데이터 모델 정의를 기반으로 `CREATE TABLE`, `CREATE INDEX` SQL을 직접 작성한다.
    - 마이그레이션 실행: `docker exec -w //workspace/apps/api nest-api sh -c "TS_NODE_TRANSPILE_ONLY=1 TS_NODE_COMPILER_OPTIONS='{\"experimentalDecorators\":true,\"emitDecoratorMetadata\":true,\"strict\":false,\"useDefineForClassFields\":false}' ts-node -r tsconfig-paths/register ./node_modules/typeorm/cli.js migration:run -d src/data-source.ts"` 로 실행하여 테이블 생성 확인
    - 출력: `/apps/api/src/migrations/*.ts`

### Phase 3: 계획
5. [common-task-planner] → 조건: **다중 도메인 변경 시에만** 실행 / 입력: PRD (도메인별) / 출력: 공통 모듈 판단 결과
6. [plan-writer] × N (병렬, 모듈 단위) → 출력: 각 모듈별 구현 계획

### Phase 4: 구현
7. [implementer] × N (병렬, 계획 단위) → 출력: 변경된 코드

### Phase 5: 검증
8. [quality-enforcer] × N (병렬, 구현 단위) → 입력: 변경된 코드 / 출력: 코드 품질 검수 결과 및 수정

### Phase 6: 완료
9. 변경 요약 출력
    - 수정된 파일 목록
    - 주요 변경 사항 요약

---

## 파이프라인 시각화

```
[도메인 결정] ──AUTO──► [문서] ──AUTO──► [설계] ──AUTO──► [계획] ──AUTO──► [구현] ──AUTO──► [검증] ──AUTO──► [완료]
     │                   │                │                │                │                │                │
     │                   │                │                │                │                │                │
  0. 도메인 결정      1. prd-writer    2. db-architect  5. common-task   7. implementer   8. quality-      9. 변경 요약
                                        3. db-critic        planner?        × N (병렬)      enforcer
                                        4. migration?    6. plan-writer                     × N (병렬)
                                                            × N (병렬)

  ※ AUTO = 사용자 확인 없이 자동 전환
  ※ 실패 시: 각 단계 최대 3회 재시도, 초과 시 사용자 보고
  ※ common-task-planner는 다중 도메인 변경 시에만 실행
```
