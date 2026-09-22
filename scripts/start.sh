#!/usr/bin/env bash
set -e

REPO="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="$REPO/logs"
mkdir -p "$LOG_DIR"

# Clear stale port conflicts if any
if lsof -iTCP:3000 -sTCP:LISTEN -n -P >/dev/null 2>&1; then
  fuser -k 3000/tcp >/dev/null 2>&1 || true
fi
if lsof -iTCP:8000 -sTCP:LISTEN -n -P >/dev/null 2>&1; then
  fuser -k 8000/tcp >/dev/null 2>&1 || true
fi

cd "$REPO"
if [ -d venv ]; then
  BACKEND_PY="$REPO/venv/bin/python3"
else
  BACKEND_PY="python3"
fi

echo "Starting backend on :8000"
nohup "$BACKEND_PY" -m uvicorn api.main:app --host 0.0.0.0 --port 8000 \
  > "$LOG_DIR/backend.log" 2>&1 &
BACKEND_PID=$!

echo "Starting frontend on :3000"
cd "$REPO/frontend"
nohup npm run dev -- --host 0.0.0.0 --port 3000 \
  > "$LOG_DIR/frontend.log" 2>&1 &
FRONTEND_PID=$!

cd "$REPO"

for i in $(seq 1 60); do
  sleep 1
  if curl -fsS http://localhost:8000/api/health >/dev/null 2>&1 && \
     curl -I -s http://localhost:3000 >/dev/null 2>&1; then
    echo "ClimateNarrative is alive"
    echo "Frontend: http://localhost:3000"
    echo "Backend:  http://localhost:8000"
    echo "PIDs: backend=$BACKEND_PID frontend=$FRONTEND_PID"
    exit 0
  fi
done

echo "Startup check failed"
tail -n 80 "$LOG_DIR/backend.log" >&2 || true
tail -n 80 "$LOG_DIR/frontend.log" >&2 || true
exit 1
