# /flo-qc

Run a QC workflow on a Flo media asset.

## Usage

```
/flo-qc
```

## Behavior

1. Ask the user which QC workflow they need:
   - **Logo QC** — compare on-screen logos against a reference image (`/flo-qc-logo`)
   - **Content moderation** — rating and platform appropriateness check (`/flo-moderate`)
2. Route the user to the selected command and collect any required inputs before invoking MCP tools.

## Notes

- Requires active Flo authentication. Run `flo_auth_login` first if not already authenticated.
- For delivery spec validation, use `/flo-deliver`.
