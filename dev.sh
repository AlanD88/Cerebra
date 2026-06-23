#!/usr/bin/env bash
#
# One-command local dev: seeds the database (first run), then starts the API and
# the web dev server together. Ctrl-C stops both.
#
#   ./dev.sh
#
# API  → http://localhost:8000  (FastAPI, auto-reload)
# Web  → http://localhost:5173  (Vite, proxies /api → :8000)

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API="$ROOT/api"
WEB="$ROOT/web"
PY="$API/.venv/bin/python"

# --- Preflight ------------------------------------------------------------- #
if [ ! -x "$PY" ]; then
  echo "✗ Python venv not found at $API/.venv"
  echo "  Create it, e.g.:  cd api && python -m venv .venv && .venv/bin/pip install -e '.[dev]'"
  exit 1
fi

if [ ! -d "$WEB/node_modules" ]; then
  echo "→ Installing web dependencies (first run)…"
  (cd "$WEB" && npm install)
fi

# --- Seed once ------------------------------------------------------------- #
# The seed is idempotent (force=False); we only run it when the dev DB is absent
# so subsequent starts are instant.
if [ ! -f "$API/cerebra.db" ]; then
  echo "→ Seeding dev database…"
  (cd "$API" && "$PY" -m app.seed)
fi

# --- Start the API in the background --------------------------------------- #
echo "→ API  on http://localhost:8000"
(cd "$API" && exec "$PY" -m uvicorn app.main:app --reload --port 8000) &
API_PID=$!

cleanup() {
  echo
  echo "→ Shutting down…"
  kill "$API_PID" 2>/dev/null || true
  pkill -P "$API_PID" 2>/dev/null || true   # uvicorn --reload spawns a child worker
  wait "$API_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# --- Start the web server in the foreground (Ctrl-C lands here) ------------ #
echo "→ Web  on http://localhost:5173"
(cd "$WEB" && npm run dev)
