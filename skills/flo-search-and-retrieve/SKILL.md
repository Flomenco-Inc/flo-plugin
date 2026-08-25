---
name: flo-search-and-retrieve
description: Search Flo assets with natural language, inspect metadata, and retrieve the best match. Use when the user asks to find, locate, or pull media from Flo.
---

# Flo search and retrieve

Use the Flo MCP server (`@flomenco/mcp`) with the caller's developer API key.

## Workflow

1. Run `flo_healthcheck` if connectivity is uncertain.
2. Call `flo_api_search_assets` (or `flo_api_unified_search`) with the user's query.
3. If the user named a filename, prefer `flo_api_query_assets` when available.
4. For a chosen asset, call `flo_api_get_asset` with `assetId`.
5. Return: asset id, title/name, type, status, and any download or share links from the response.

## Tips

- Keep queries short and literal first; refine only if results are empty.
- Prefer read-only tools until the user explicitly asks to modify assets.
- Summarize top 3 matches when search returns many hits; ask before picking one.
