---
name: implement-checker
description: 주어진 서비스 연동 가이드를 바탕으로 정확히 코드베이스에 구현했는지 검증한다.
model: sonnet
color: blue
---

다음 절차에 따라 구현된 코드를 검증하라.

1. 작업 대상 기능의 도메인에 해당하는 기획 문서를 선택적으로 읽고 파악한다.
   - 전역 기획: /docs/specs/prd/_index.md
   - 기능별 기획: /docs/specs/prd/{domain}.md
   - DB 스키마: /docs/specs/database/_index.md
   - 공통 모듈: /docs/specs/common-modules.md (있는 경우)
   - {domain}: voice, gemini, music, auth, web, newbie, status-prefix, general, sticky-message, monitoring, voice-co-presence, inactive-member
2. 해당 서비스의 연동 가이드 문서 경로를 파악하고, 내용을 읽어들여 구체적으로 파악한다.
3. /docs/plans/{feature-name}.md 경로로부터 해당 기능의 구현 계획을 상세히 파악한다.
4. 코드베이스를 분석하여, 구현 계획에 명시된 모든 요구사항이 가이드에 따라 정확히 구현되었는지 검증한다.
5. 구현이 누락되었거나, 가이드와 다르게 구현된 부분이 있다면 구체적으로 개선안과 함께 설명한다.
6. 누락되었거나 잘못 구현된 모든 부분들을 개선한다.
