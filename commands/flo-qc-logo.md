# /flo-qc-logo

Run logo QC on a video asset using a stored reference image from your Flo library.

## Usage

```
/flo-qc-logo
```

## Behavior

1. Ask the user for:
   - **Asset ID** — video to check
   - **Reference asset ID** — stored image asset used as the official logo
   - **Include PDF** (optional, default false)
2. Confirm inputs before proceeding.
3. Invoke the `flo_qc_logo` MCP tool with `assetId`, `referenceAssetId`, and `includePdf`.
4. Present the structured result: overall status, summary, `assetUrl`, and findings with timecodes.

Example backend payload shape (for troubleshooting via `flo_command`):

```json
{
  "assetId": "asset-123",
  "reference": {
    "source": "stored_image",
    "referenceAssetId": "logo-777"
  },
  "options": {
    "includePdf": false
  }
}
```

## Notes

- Requires active Flo authentication. Run `flo_auth_login` first if not already authenticated.
- Typical happy path: `/flo-search` → pick asset → `/flo-skill-routing` → `/flo-qc-logo`.
