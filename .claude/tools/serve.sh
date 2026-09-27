#!/usr/bin/env bash
# Static server for browser tests, rooted at the repo so /products/... paths
# resolve exactly like on GitHub Pages.
#   bash .claude/tools/serve.sh start [port]   (default 8813; waits until it answers)
#   bash .claude/tools/serve.sh stop  [port]   (kills EVERY listener on the port)
# `stop` kills all listeners because leftover servers from earlier sessions
# have repeatedly squatted on the same port and served stale files.
set -u
cmd="${1:-start}"; port="${2:-8813}"
root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

kill_port(){
  if command -v netstat >/dev/null 2>&1 && command -v taskkill >/dev/null 2>&1; then
    netstat -ano 2>/dev/null | grep ":$port " | grep LISTEN | awk '{print $NF}' | sort -u | while read -r pid; do
      [ -n "$pid" ] && [ "$pid" != "0" ] && taskkill //PID "$pid" //F >/dev/null 2>&1
    done
  elif command -v fuser >/dev/null 2>&1; then
    fuser -k "$port/tcp" >/dev/null 2>&1
  fi
}

case "$cmd" in
  start)
    kill_port
    (cd "$root" && nohup python -m http.server "$port" >/dev/null 2>&1 &)
    for _ in $(seq 1 30); do
      code=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$port/products/gold-track/html/index.html" 2>/dev/null)
      [ "$code" = "200" ] && { echo "serving $root on http://localhost:$port"; exit 0; }
      sleep 0.3
    done
    echo "server did not come up on port $port" >&2; exit 1 ;;
  stop)
    kill_port; echo "stopped listeners on $port" ;;
  *) echo "usage: serve.sh start|stop [port]" >&2; exit 2 ;;
esac
