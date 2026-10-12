#!/usr/bin/env bash
# Start the whole app locally: Ollama (4 parallel requests), the API and the web app.
# Usage: scripts/run-local.sh      then open http://localhost:5173
set -euo pipefail
cd "$(dirname "$0")/.."

if ! curl -s -m 1 http://localhost:11434/api/tags >/dev/null; then
  echo "Starting Ollama (OLLAMA_NUM_PARALLEL=4)…"
  OLLAMA_NUM_PARALLEL=4 OLLAMA_KEEP_ALIVE=30m nohup ollama serve >/tmp/rem-ollama.log 2>&1 &
  until curl -s -m 1 http://localhost:11434/api/tags >/dev/null; do sleep 0.5; done
fi
ollama list | grep -q '^mistral' || ollama pull mistral

export USE_LLM=true LLM_BACKEND=ollama LLM_MODEL_NAME=mistral LLM_TIMEOUT_SECONDS=180 LLM_STREAM_CONCURRENCY=4
(cd backend && .venv/bin/uvicorn main:app --port 8000) &
API_PID=$!
trap 'kill $API_PID 2>/dev/null' EXIT
until curl -s -m 1 http://localhost:8000/api/health >/dev/null; do sleep 0.5; done
echo "API ready on http://localhost:8000 — web app on http://localhost:5173"
npm run dev -- --port 5173
