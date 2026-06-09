# /flo-skill-routing

List available actions for a Flo asset after search or lookup.

## Usage

```
/flo-skill-routing <assetId>
```

## Behavior

1. If no asset ID was provided, ask the user to supply one (or run `/flo-search` first).
2. Invoke the `flo_skill_routing` MCP tool with the asset ID.
3. Present the returned skills as a numbered menu (label + command).
4. If the user wants logo QC, guide them to `/flo-qc-logo` with the same asset ID and a reference logo asset.

## Notes

- Requires active Flo authentication. Run `flo_auth_login` first if not already authenticated.
- This step is required in the happy path between search and `/flo-qc-logo`.
