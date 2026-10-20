#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

if ! curl -fsS http://localhost:3000/api/me >/dev/null 2>&1; then
  echo "Starting Muzic backend..."
  (cd "$REPO_DIR" && npm start) &
  BACKEND_PID=$!
  for _ in {1..40}; do
    if curl -fsS http://localhost:3000/api/me >/dev/null 2>&1; then
      break
    fi
    sleep 0.25
  done
  if ! curl -fsS http://localhost:3000/api/me >/dev/null 2>&1; then
    echo "Backend did not start. Check npm/node and try: npm start"
    kill "$BACKEND_PID" >/dev/null 2>&1 || true
    exit 1
  fi
fi

cd "$SCRIPT_DIR"
swift run
