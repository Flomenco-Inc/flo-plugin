# /flo-search

Search for assets in your Flo library.

## Usage

```
/flo-search <query>
```

## Behavior

1. If the user did not provide a query after the command, ask for a search term.
2. Invoke the `flo_search` MCP tool with the query.
3. Present results as a numbered menu (asset ID, title, type, path, score).
4. Ask the user to pick an asset if they want to continue with skill routing or QC.

## Notes

- Requires active Flo authentication. Run `flo_auth_login` first if not already authenticated.
- For filename-first lookup, use `/flo-query`.
