# /flo-analyze

Analyze a media asset. Works for any asset type — the plugin automatically
routes to the correct analysis skill (image analysis, video analysis, etc.)
based on the asset.

## Usage

```
/flo-analyze <assetId>
```

## Behavior

1. Ask the user for the **Asset ID** if not provided in the command.
2. Invoke `flo_analyze` with the asset ID.
3. The tool automatically calls skill routing to determine the correct analysis
   command for the asset type, then executes it — no manual routing needed.
4. Present the analysis result clearly, highlighting key findings.

## Notes

- Requires active Flo authentication. Run `flo_auth_login` first if not
  already authenticated.
- To see all available actions for an asset, use `flo_skill_routing` directly.
