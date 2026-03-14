#!/bin/bash
# =============================================================================
# 운영서버 DB → 로컬 개발 Docker DB 동기화 스크립트
#
# 사용법:
#   ./scripts/sync-db-from-prod.sh [SSH_HOST]
#
# 사전 조건:
#   - 운영서버에 SSH 키 인증 설정 완료
#   - 로컬 Docker(postgres 컨테이너)가 실행 중
#   - 운영서버에서 docker exec 권한 보유
#
# 환경변수 (선택, 기본값 있음):
#   PROD_SSH_HOST   - 운영서버 SSH 주소 (user@host 형식)
#   PROD_SSH_KEY    - SSH 키 파일 경로 (기본: ~/.ssh/id_rsa)
#   PROD_CONTAINER  - 운영 DB 컨테이너명 (기본: postgres-prod)
#   LOCAL_CONTAINER - 로컬 DB 컨테이너명 (기본: postgres)
#   DB_USER         - DB 사용자 (기본: dhyun)
#   DB_NAME         - DB 이름 (기본: dhyunbot)
# =============================================================================

set -euo pipefail

# ─── 설정 ────────────────────────────────────────────────────────────────────
PROD_SSH_HOST="${PROD_SSH_HOST:-${1:-}}"
PROD_SSH_KEY="${PROD_SSH_KEY:-$HOME/.ssh/id_rsa}"
PROD_CONTAINER="${PROD_CONTAINER:-postgres-prod}"
LOCAL_CONTAINER="${LOCAL_CONTAINER:-postgres}"
DB_USER="${DB_USER:-dhyun}"
DB_NAME="${DB_NAME:-dhyunbot}"

DUMP_FILE="/tmp/dhyunbot_prod_dump_$(date +%Y%m%d_%H%M%S).dump"
SKIP_CONFIRM="${SKIP_CONFIRM:-false}"

# ─── 유효성 검사 ─────────────────────────────────────────────────────────────
if [[ -z "$PROD_SSH_HOST" ]]; then
  echo "❌ 운영서버 SSH 주소가 필요합니다."
  echo ""
  echo "사용법:"
  echo "  ./scripts/sync-db-from-prod.sh user@your-server-ip"
  echo "  PROD_SSH_HOST=user@host ./scripts/sync-db-from-prod.sh"
  exit 1
fi

if ! docker ps --format '{{.Names}}' | grep -q "^${LOCAL_CONTAINER}$"; then
  echo "❌ 로컬 Docker 컨테이너 '${LOCAL_CONTAINER}'가 실행 중이 아닙니다."
  echo "   먼저 docker compose up -d db 를 실행하세요."
  exit 1
fi

# ─── 확인 프롬프트 ───────────────────────────────────────────────────────────
echo "============================================"
echo "  운영 DB → 로컬 DB 동기화"
echo "============================================"
echo ""
echo "  운영서버:     ${PROD_SSH_HOST}"
echo "  운영 컨테이너: ${PROD_CONTAINER}"
echo "  로컬 컨테이너: ${LOCAL_CONTAINER}"
echo "  DB:           ${DB_NAME} (user: ${DB_USER})"
echo ""
echo "⚠️  로컬 DB의 모든 데이터가 덮어쓰기됩니다!"
echo ""
if [[ "$SKIP_CONFIRM" != "true" ]]; then
  read -rp "계속하시겠습니까? (y/N): " confirm
  if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
    echo "취소되었습니다."
    exit 0
  fi
fi

echo ""

# ─── Step 1: 운영서버에서 pg_dump 실행 → 로컬로 전송 ────────────────────────
echo "📦 [1/3] 운영서버에서 DB 덤프 중..."
ssh -i "$PROD_SSH_KEY" "$PROD_SSH_HOST" \
  "docker exec ${PROD_CONTAINER} pg_dump -U ${DB_USER} -d ${DB_NAME} --format=custom --clean --if-exists" \
  > "$DUMP_FILE"

DUMP_SIZE=$(du -h "$DUMP_FILE" | cut -f1)
echo "   ✅ 덤프 완료 (${DUMP_SIZE}): ${DUMP_FILE}"

# ─── Step 2: 로컬 DB 초기화 ─────────────────────────────────────────────────
echo ""
echo "🗑️  [2/3] 로컬 DB 초기화 중..."
docker exec "${LOCAL_CONTAINER}" psql -U "${DB_USER}" -d postgres -c \
  "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${DB_NAME}' AND pid <> pg_backend_pid();" \
  > /dev/null 2>&1 || true

docker exec "${LOCAL_CONTAINER}" dropdb -U "${DB_USER}" --if-exists "${DB_NAME}"
docker exec "${LOCAL_CONTAINER}" createdb -U "${DB_USER}" "${DB_NAME}"
echo "   ✅ DB 재생성 완료"

# ─── Step 3: pg_restore로 복원 ───────────────────────────────────────────────
echo ""
echo "📥 [3/3] 로컬 DB에 복원 중..."
docker exec -i "${LOCAL_CONTAINER}" pg_restore -U "${DB_USER}" -d "${DB_NAME}" --no-owner --no-privileges \
  < "$DUMP_FILE"

echo "   ✅ 복원 완료"

# ─── 정리 ────────────────────────────────────────────────────────────────────
rm -f "$DUMP_FILE"
echo ""
echo "============================================"
echo "  ✅ 동기화 완료!"
echo "============================================"
echo ""
echo "로컬 DB 확인: docker exec -it ${LOCAL_CONTAINER} psql -U ${DB_USER} -d ${DB_NAME}"
