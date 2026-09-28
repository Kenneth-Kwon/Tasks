#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
PORT="${PORT:-3000}"
LOG_DIR="$ROOT/logs"
LOG_FILE="$LOG_DIR/app.log"
PID_FILE="$LOG_DIR/app.pid"

mkdir -p "$LOG_DIR"

pids_on_port() {
  lsof -t -nP -iTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true
}

project_pids() {
  # 이 프로젝트 디렉터리에서 뜬 next 프로세스만 대상으로 한다
  pgrep -f "${ROOT}/node_modules/next" 2>/dev/null || true
}

stop_existing() {
  local pids
  pids="$(printf '%s\n%s\n' "$(pids_on_port)" "$(project_pids)" | awk 'NF && !seen[$0]++')"

  if [ -z "$pids" ]; then
    echo "실행 중인 서비스 없음 (port ${PORT})"
    return 0
  fi

  echo "기존 프로세스 종료: $(echo "$pids" | tr '\n' ' ')"
  # shellcheck disable=SC2086
  kill $pids 2>/dev/null || true

  for _ in 1 2 3 4 5; do
    sleep 0.4
    pids="$(printf '%s\n%s\n' "$(pids_on_port)" "$(project_pids)" | awk 'NF && !seen[$0]++')"
    [ -z "$pids" ] && break
  done

  if [ -n "$pids" ]; then
    echo "강제 종료: $(echo "$pids" | tr '\n' ' ')"
    # shellcheck disable=SC2086
    kill -9 $pids 2>/dev/null || true
    sleep 0.3
  fi
}

start_service() {
  cd "$ROOT"

  if [ ! -d "$ROOT/.next" ]; then
    echo "프로덕션 빌드가 없어 npm run build 실행"
    npm run build
  fi

  echo "백그라운드 시작: npm start (port ${PORT})"
  nohup npm start >>"$LOG_FILE" 2>&1 &
  echo $! >"$PID_FILE"

  for _ in $(seq 1 20); do
    if [ -n "$(pids_on_port)" ]; then
      echo "준비됨: http://localhost:${PORT}"
      echo "로그: ${LOG_FILE}"
      return 0
    fi
    sleep 0.5
  done

  echo "시작은 했지만 port ${PORT} 응답이 아직 없습니다. 로그를 확인하세요: ${LOG_FILE}"
  return 1
}

stop_existing
start_service
