# /flo-moderate

Run a content appropriateness check on a media asset using the Flo Appropriateness Checker agent.

## Usage

```
/flo-moderate
```

## Behavior

When this command is invoked:

1. Ask the user for the following required inputs:
   - **Asset ID**: The media asset ID to moderate
   - **Target Rating**: The intended content rating (e.g. G, PG, PG-13, TV-14, TV-MA)
   - **Target Platform**: The distribution platform (e.g. Netflix, Prime Video, YouTube, Broadcast)

2. Confirm the inputs with the user before proceeding.

3. Invoke the `flo_query` MCP tool with a prompt structured as follows:

```
Run a content appropriateness check on asset [ASSET_ID].

Target rating: [TARGET_RATING]
Target platform: [TARGET_PLATFORM]

Check for:
- Violence (intensity, frequency, context)
- Language (profanity, slurs, adult dialogue)
- Sexual content (nudity, suggestive material)
- Substance use (drugs, alcohol, tobacco)
- Platform-specific policy violations for [TARGET_PLATFORM]

Return a structured moderation report with:
- Overall pass/fail against the target rating
- Per-category severity scores
- Timecode references for flagged segments
- Platform policy compliance status
- Recommended action (approve / flag for review / reject)
```

4. Present the moderation report clearly, grouping flags by category with timecodes.

## Notes

- Requires active Flo authentication. Run `flo_auth_login` first if not already authenticated.
- Platform policy rules are maintained by the Flo platform and may be updated independently of this plugin.
- For delivery spec validation, use `/flo-deliver`.
