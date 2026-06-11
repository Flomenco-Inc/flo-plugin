#!/usr/bin/env bash
# Cross-platform entry is scripts/run-mcp.js (node). This wrapper remains for
# manual invocations on macOS/Linux where bash is available.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec node "$SCRIPT_DIR/run-mcp.js"
