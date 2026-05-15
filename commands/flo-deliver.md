# /flo-deliver

Validate a media asset against platform delivery specifications using the Flo Delivery Checker agent.

## Usage

```
/flo-deliver
```

## Behavior

When this command is invoked:

1. Ask the user for the following required inputs:
   - **Asset ID**: The media asset ID to validate
   - **Target Platform**: The delivery destination (e.g. Netflix, Prime Video, Disney+, Broadcast)

2. Optionally ask:
   - **Spec Version**: If the platform has multiple delivery spec versions, ask which to validate against (leave blank to use latest)

3. Confirm the inputs with the user before proceeding.

4. Invoke the `flo_query` MCP tool with a prompt structured as follows:

```
Run a delivery spec validation on asset [ASSET_ID] for [TARGET_PLATFORM].
Spec version: [SPEC_VERSION or "latest"]

Validate against the full delivery specification including:
- Video codec, bitrate, resolution, frame rate, aspect ratio, HDR/SDR profile
- Audio codec, bitrate, channel configuration, loudness (LUFS), sample rate
- Container format and wrapper requirements
- Subtitle and caption format and timing
- Metadata completeness (title, language, runtime, ratings)
- File naming conventions

Return a structured delivery validation report with:
- Overall pass/fail status
- Per-parameter pass/fail with actual vs expected values for failures
- Severity classification for each failure (blocking / warning / advisory)
- Recommended action (approve for delivery / fix required / review required)
```

5. Present the report grouped by severity — blocking issues first, then warnings, then advisories.

## Notes

- Requires active Flo authentication. Run `flo_auth_login` first if not already authenticated.
- Delivery specs are maintained by the Flo platform and updated when platforms publish new requirements.
- For content moderation, use `/flo-moderate`. For logo and visual QC, use `/flo-qc`.
