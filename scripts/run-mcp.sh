#!/usr/bin/env bash
set -euo pipefail

ROOT="${CLAUDE_PLUGIN_ROOT:?'CLAUDE_PLUGIN_ROOT is required'}"
FLO_ENV_FILE="${FLO_MCP_ENV_FILE:-$HOME/.flo/claude-plugin-mcp.env}"
if [[ -f "$FLO_ENV_FILE" ]]; then
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%%#*}"
    line="${line#"${line%%[![:space:]]*}"}"
    [[ -z "$line" ]] && continue
    if [[ "$line" != *=* ]]; then
      continue
    fi
    key="${line%%=*}"
    key="${key%"${key##*[![:space:]]}"}"
    value="${line#*=}"
    value="${value#"${value%%[![:space:]]*}"}"
    if [[ "$value" == \"*\" && "$value" == *\" ]]; then
      value="${value:1:${#value}-2}"
    elif [[ "$value" == \'*\' && "$value" == *\' ]]; then
      value="${value:1:${#value}-2}"
    fi
    export "${key}=${value}"
  done < "$FLO_ENV_FILE"
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
