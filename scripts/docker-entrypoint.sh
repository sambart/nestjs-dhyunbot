#!/bin/sh
set -e

APP_DIR=$(pwd)
cd /workspace

HASH_FILE="/workspace/node_modules/.package-lock-hash"
LOCK_FILE="/workspace/node_modules/.install-lock"
CURRENT_HASH=$(md5sum /workspace/package-lock.json 2>/dev/null | cut -d' ' -f1 || echo "none")

# Wait for any ongoing installation by another container
WAIT_COUNT=0
while [ -f "$LOCK_FILE" ] && [ $WAIT_COUNT -lt 90 ]; do
  echo "[entrypoint] Waiting for dependency installation..."
  sleep 2
  WAIT_COUNT=$((WAIT_COUNT + 1))
done

# Install dependencies if package-lock.json changed
if [ ! -f "$HASH_FILE" ] || [ "$(cat "$HASH_FILE" 2>/dev/null)" != "$CURRENT_HASH" ]; then
  mkdir -p /workspace/node_modules
  touch "$LOCK_FILE"

  echo "[entrypoint] Installing dependencies..."
  npm install

  echo "$CURRENT_HASH" > "$HASH_FILE"
  rm -f "$LOCK_FILE"
fi

# Install if app-specific node_modules is empty (separate volume)
if [ ! -d "$APP_DIR/node_modules" ] || [ -z "$(ls -A "$APP_DIR/node_modules" 2>/dev/null)" ]; then
  echo "[entrypoint] App-specific dependencies missing, installing..."
  npm install
fi

# Always build shared library (fast, ensures latest source)
echo "[entrypoint] Building shared library..."
npm run build --workspace=@dhyunbot/shared 2>&1 || true

cd "$APP_DIR"
echo "[entrypoint] Starting application..."
exec "$@"
