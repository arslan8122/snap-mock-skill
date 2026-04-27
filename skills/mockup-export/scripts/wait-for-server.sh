#!/usr/bin/env bash
# wait-for-server.sh — poll http://localhost:$PORT until 200 or timeout
set -euo pipefail

PLUGIN_DATA="${CLAUDE_PLUGIN_DATA:-/tmp/snap-mock-skill}"
PORT="${PORT:-}"
TIMEOUT="${TIMEOUT:-30}"

if [ -z "$PORT" ] && [ -f "$PLUGIN_DATA/dev.pid" ]; then
  PORT=$(sed -n 2p "$PLUGIN_DATA/dev.pid")
fi
PORT="${PORT:-3000}"

echo "[wait] polling http://localhost:$PORT (timeout ${TIMEOUT}s)"
SECS=0
until curl -fsS "http://localhost:$PORT" -o /dev/null 2>&1; do
  if [ "$SECS" -ge "$TIMEOUT" ]; then
    echo "[wait] timeout after ${TIMEOUT}s — dev server didn't start" >&2
    if [ -f "$PLUGIN_DATA/dev.log" ]; then
      echo "[wait] last 30 lines of dev.log:" >&2
      tail -30 "$PLUGIN_DATA/dev.log" >&2
    fi
    exit 1
  fi
  sleep 1
  SECS=$((SECS + 1))
done

echo "[wait] ready after ${SECS}s"
