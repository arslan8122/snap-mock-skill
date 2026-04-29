#!/usr/bin/env bash
# start-dev.sh — launch `next dev` in the background, write PID + port to ${CLAUDE_PLUGIN_DATA}/dev.pid
# Belt-and-suspenders: if SessionEnd hook fails, the parent shell exit kills the child too.
set -euo pipefail

PLUGIN_DATA="${CLAUDE_PLUGIN_DATA:-/tmp/snap-mock-skill}"
mkdir -p "$PLUGIN_DATA"

APP_ROOT="${APP_ROOT:-}"
if [ -z "$APP_ROOT" ] && [ -f "$PLUGIN_DATA/scaffold.env" ]; then
  # scaffold.sh writes APP_ROOT here (standalone or in-place mode)
  APP_ROOT="$(grep '^APP_ROOT=' "$PLUGIN_DATA/scaffold.env" | cut -d= -f2-)"
fi
if [ -z "$APP_ROOT" ]; then
  if [ -f "package.json" ]; then APP_ROOT="$(pwd)"
  elif [ -f "frontend/package.json" ]; then APP_ROOT="$(pwd)/frontend"
  else echo "[start-dev] error: cannot locate app root (run scaffold.sh first)" >&2; exit 1
  fi
fi

# Pick a free port: 3000 first, then 3137 if occupied.
PORT="${PORT:-3000}"
if lsof -ti:"$PORT" >/dev/null 2>&1; then
  echo "[start-dev] port $PORT busy, falling back to 3137"
  PORT=3137
fi
if lsof -ti:"$PORT" >/dev/null 2>&1; then
  echo "[start-dev] error: ports 3000 and 3137 both busy" >&2
  echo "[start-dev] free one with: lsof -ti:3000 | xargs kill" >&2
  exit 1
fi

cd "$APP_ROOT"

LOGFILE="$PLUGIN_DATA/dev.log"
: > "$LOGFILE"

# trap "kill 0" EXIT in the launched process so it dies with parent shell
PORT="$PORT" nohup bash -c 'trap "kill 0" EXIT; exec npm run dev' >"$LOGFILE" 2>&1 &
DEV_PID=$!

# Persist PID + port for cleanup.sh and export-screenshots.mjs
printf '%s\n%s\n' "$DEV_PID" "$PORT" > "$PLUGIN_DATA/dev.pid"

echo "[start-dev] launched npm run dev pid=$DEV_PID port=$PORT log=$LOGFILE"
echo "[start-dev] PORT=$PORT"  # so caller can `eval $(./start-dev.sh | grep PORT=)` if desired
