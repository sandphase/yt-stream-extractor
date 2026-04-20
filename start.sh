#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

BACK_PORT="${BACK_PORT:-8090}"
FRONT_PORT="${FRONT_PORT:-3000}"

kill_port() {
  local port=$1
  if command -v lsof >/dev/null 2>&1; then
    local pids
    pids="$(lsof -ti:"$port" -sTCP:LISTEN 2>/dev/null || true)"
    if [[ -n "${pids}" ]]; then
      # shellcheck disable=SC2086
      kill -9 ${pids} 2>/dev/null || true
    fi
  elif command -v fuser >/dev/null 2>&1; then
    fuser -k "${port}/tcp" 2>/dev/null || true
  fi
}

echo "[YTDown] Reiniciando: liberando puertos ${BACK_PORT} y ${FRONT_PORT}..."
kill_port "$BACK_PORT"
kill_port "$FRONT_PORT"
sleep 1

if [[ -f "${ROOT}/setup.sh" ]]; then
  echo "[YTDown] Ejecutando setup.sh..."
  bash "${ROOT}/setup.sh"
fi

export PATH="${ROOT}/tools/bin:${PATH}"

echo "[YTDown] Backend (Go) en puerto ${BACK_PORT}..."
go run ./cmd/server &
BACK_PID=$!

sleep 2

echo "[YTDown] Frontend (serve carpeta web) en puerto ${FRONT_PORT}..."
npx --yes serve web -l "$FRONT_PORT" --no-clipboard &
FRONT_PID=$!

cleanup() {
  kill "$BACK_PID" "$FRONT_PID" 2>/dev/null || true
}
trap cleanup INT TERM

echo ""
echo "UI:  http://127.0.0.1:${FRONT_PORT}/"
echo "API: http://127.0.0.1:${BACK_PORT}/health"
echo "Ctrl+C detiene backend y frontend."
echo ""

wait
