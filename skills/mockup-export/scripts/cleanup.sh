#!/usr/bin/env bash
# cleanup.sh — invoked by SessionEnd hook. Kill the dev server we started.
# Per anthropics/claude-code #43944 background processes can leak past session exit;
# this hook is the documented mitigation. Belt-and-suspenders trap in start-dev.sh too.
set -uo pipefail  # no -e — cleanup must always finish

PLUGIN_DATA="${CLAUDE_PLUGIN_DATA:-/tmp/snap-mock-skill}"
PIDFILE="$PLUGIN_DATA/dev.pid"

if [ ! -f "$PIDFILE" ]; then
  exit 0
fi

DEV_PID=$(sed -n 1p "$PIDFILE" 2>/dev/null || echo "")
PORT=$(sed -n 2p "$PIDFILE" 2>/dev/null || echo "3000")

if [ -n "$DEV_PID" ] && kill -0 "$DEV_PID" 2>/dev/null; then
  echo "[cleanup] killing dev server pid=$DEV_PID"
  # Kill the whole process group (npm spawns next-server as a child)
  kill -TERM -- "-$DEV_PID" 2>/dev/null || kill -TERM "$DEV_PID" 2>/dev/null || true
  sleep 1
  kill -KILL "$DEV_PID" 2>/dev/null || true
fi

# Belt-and-suspenders: anything still listening on the port dies too
if lsof -ti:"$PORT" >/dev/null 2>&1; then
  echo "[cleanup] killing residual listeners on port $PORT"
  lsof -ti:"$PORT" | xargs -r kill -9 2>/dev/null || true
fi

rm -f "$PIDFILE"
exit 0
