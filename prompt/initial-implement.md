먼저 다음과 같이 초기문서 작성 작업하라.
각 단계는 모두 직렬로 수행하되, usecase-writer 에이전트만 병렬로 수행한다.

1. prd-writer 에이전트를 사용하여 /docs/prd.md 경로에 PRD 문서를 작성하라.
2. userflow-writer 에이전트를 사용하여 /docs/userflow.md 경로에 Userflow 문서를 작성하라.
3. database-architect 에이전트를 사용하여 /docs/specs/database/_index.md 경로에 데이터베이스 설계를 작성하라.
4. database-critic 에이전트를 사용하여 /docs/specs/database/_index.md 경로에 있는 데이터베이스 설계를 개선하라.
5. `/docs/userflow.md` 문서를 읽고, 여기 언급된 기능들에대해 usecase-writer 에이전트를 사용하여 유스케이스 문서를 작성하라.

위 작업을 모두 끝냈다면 다음과 같이 구현작업 진행한다.
plan-writer 에이전트로 모든 계획을 병렬로 작성한 뒤, implementer 에이전트를 병렬로 사용해서 구현한다.

1. common-task-planner 에이전트를 사용하여 /docs/common-modules.md 경로에 공통 모듈 작업 계획을 작성하라.
2. implementer 에이전트를 사용해서 작성한 공통 모듈 작업 계획을 정확히 구현하라.
3. plan-writer 에이전트를 사용하여 PRD에 포함된 페이지에 대한 구현 계획을 `docs/pages/N-name/plan.md` 경로에 작성하라. 이들은 모두 병렬로 실행되어야한다.
4. implementer 에이전트를 사용해서 작성한 구현 계획을 정확히 구현하라. 이들은 모두 병렬로 실행되어야한다.