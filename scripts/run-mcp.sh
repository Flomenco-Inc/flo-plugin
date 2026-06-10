#!/usr/bin/env bash
set -euo pipefail

ROOT="${CLAUDE_PLUGIN_ROOT:?'CLAUDE_PLUGIN_ROOT is required'}"
cd "$ROOT"

if [[ ! -d node_modules/@modelcontextprotocol/sdk ]]; then
  if [[ -f package-lock.json ]]; then
    npm ci --omit=dev --no-audit --no-fund
  else
    npm install --omit=dev --no-audit --no-fund
  fi
fi

exec node "$ROOT/src/index.js"
