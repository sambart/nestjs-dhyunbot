#!/bin/sh
set -e

APP_DIR=$(pwd)
cd /workspace

HASH_FILE="/workspace/node_modules/.pnpm-lock-hash"
LOCK_FILE="/workspace/node_modules/.install-lock"
CURRENT_HASH=$(md5sum /workspace/pnpm-lock.yaml 2>/dev/null | cut -d' ' -f1 || echo "none")

# Wait for any ongoing installation by another container
WAIT_COUNT=0
while [ -f "$LOCK_FILE" ] && [ $WAIT_COUNT -lt 90 ]; do
  echo "[entrypoint] Waiting for dependency installation..."
  sleep 2
  WAIT_COUNT=$((WAIT_COUNT + 1))
done

# Install dependencies if pnpm-lock.yaml changed
if [ ! -f "$HASH_FILE" ] || [ "$(cat "$HASH_FILE" 2>/dev/null)" != "$CURRENT_HASH" ]; then
  mkdir -p /workspace/node_modules
  touch "$LOCK_FILE"

  echo "[entrypoint] Installing dependencies..."
  pnpm install --frozen-lockfile

  echo "$CURRENT_HASH" > "$HASH_FILE"
  rm -f "$LOCK_FILE"
fi

# Always build shared libraries (fast, ensures latest source)
echo "[entrypoint] Building shared library..."
pnpm --filter @onyu/shared build 2>&1 || true
# Build bot-api-client if it has a build script and dist doesn't exist
if [ -f "/workspace/libs/bot-api-client/package.json" ] && [ ! -d "/workspace/libs/bot-api-client/dist" ]; then
  echo "[entrypoint] Building bot-api-client library..."
  cd /workspace/libs/bot-api-client && npx tsc --skipLibCheck 2>&1 || true
  cd /workspace
fi

cd "$APP_DIR"
echo "[entrypoint] Starting application..."
exec "$@"
