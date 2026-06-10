# FLO-326 closeout (flo-plugin)

See the canonical closeout in the `flo` monorepo:

`agents/interface-agent/docs/claude-plugin-flo-326-closeout.md`

Quick pointers for this repo:

- **Install:** Claude Code marketplace `flo-plugin@flo-plugins` (≥ **0.3.6**).
- **Do not use** `npx @flomenco/claude-plugin-mcp` in Claude Code (npm **0.2.2** is stale).
- **Release:** `npm run sync-versions` before tagging so marketplace updates pull new builds.
- **Dev env:** `~/.flo/claude-plugin-mcp.env` or Settings → API → Claude Plugin env block.
