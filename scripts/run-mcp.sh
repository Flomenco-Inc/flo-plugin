#!/usr/bin/env bash
set -euo pipefail

ROOT="${CLAUDE_PLUGIN_ROOT:?'CLAUDE_PLUGIN_ROOT is required'}"
FLO_ENV_FILE="${FLO_MCP_ENV_FILE:-$HOME/.flo/claude-plugin-mcp.env}"
if [[ -f "$FLO_ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$FLO_ENV_FILE"
  set +a
fi
cd "$ROOT"

if [[ ! -d node_modules/@modelcontextprotocol/sdk ]]; then
  if [[ -f package-lock.json ]]; then
    npm ci --omit=dev --no-audit --no-fund
  else
    npm install --omit=dev --no-audit --no-fund
  fi
fi

exec node "$ROOT/src/index.js"
