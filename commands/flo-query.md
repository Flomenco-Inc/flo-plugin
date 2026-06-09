# /flo-query

Filename-first asset lookup in your Flo library.

## Usage

```
/flo-query <query>
```

## Behavior

1. If the user did not provide text after the command, ask for a filename or search phrase.
2. Invoke the `flo_query` MCP tool with the user's query (include any extra context from the prompt).
3. Present filename-first candidates and any suggested follow-up commands from the response.
4. If the user selects an asset, offer `/flo-skill-routing` for the next step.

## Notes

- Requires active Flo authentication. Run `flo_auth_login` first if not already authenticated.
- For broader library search, use `/flo-search`.
