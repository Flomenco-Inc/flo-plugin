# AI Agent Context — `flo-plugin`

This is the **public** standalone repository for the Flo plugin for Claude.
It was extracted from the `flo` monorepo (`packages/flo-claude-plugin-mcp`) on
2026-05-14 to enable public distribution, Anthropic marketplace listing, and
community contributions.

## What this repo is

An [MCP (Model Context Protocol)](https://modelcontextprotocol.io) server that
bridges Claude (Desktop, Code, or any MCP-capable client) to the Flo AI media
platform. Users install it via `npx @flomenco/claude-plugin-mcp` — no repo
clone required.

The plugin also serves as the foundation for a Claude Code plugin
(skills, slash commands, `marketplace.json`) which a coworker is integrating
in a separate PR. See `CONTRIBUTING.md` for how to add that content.

## Repo layout

```
flo-plugin/
├── src/
│   └── index.js              # MCP server entry point — all tool definitions live here
├── tools/
│   ├── install-claude-desktop.js    # dev helper: writes claude_desktop_config.json
│   ├── uninstall-claude-desktop.js  # dev helper: removes the entry
│   └── print-bootstrap-config.js    # dev helper: prints bootstrap JSON for operators
├── .github/
│   └── workflows/
│       └── publish.yml       # auto-publish to npm on v* tags
├── .cursor/
│   └── rules/
│       └── flo-plugin.mdc    # Cursor rules for this repo
├── AGENTS.md                 # ← you are here
├── CONTRIBUTING.md
├── README.md
├── LICENSE                   # MIT
└── package.json
```

## Key facts for LLMs working here

### This is a PUBLIC repo — do not add:
- Hardcoded secrets, tokens, or API keys
- Internal-only infra URLs beyond the public `floapp.co` / `*.floapp.co` domains
- AWS account IDs or private ARNs
- Employee emails or personal info
- Anything that should not be visible to the open internet

The Cognito hosted-UI domain (`flomenco*.auth.us-east-1.amazoncognito.com`),
pool names (`flo-prod/stg/dev`), and OAuth client names are **intentionally
public** — they are discoverable from any OAuth token's `iss` claim.

### MCP server (`src/index.js`)
- Single-file, plain ESM Node.js — no build step, no TypeScript
- All tools are defined in the `tools` array near the bottom and handled in
  the `CallToolRequestSchema` handler
- Auth flow: PKCE OAuth → loopback callback server → token cached at
  `~/.flo/claude-plugin-mcp-token.json`
- New tools follow the same pattern: add an entry to `tools[]`, add a handler
  block in the `CallToolRequestSchema` handler
- Do NOT introduce external dependencies without strong justification — this
  package is installed via `npx` and startup time matters

### Developer tools (`tools/`)
- Internal-only scripts for Flomenco developers who have AWS credentials
- They use the AWS CLI to auto-discover Cognito pool/client IDs
- **Not included in the published npm artifact** — `tools/` is intentionally
  excluded from the `files` array in `package.json`. They are developer helpers
  for Flomenco engineers with AWS credentials; external users should never need
  them.

### npm publishing
- Package: `@flomenco/claude-plugin-mcp` on the public npm registry
- Trigger: push a tag `vX.Y.Z` — GitHub Actions verifies the tag matches
  `package.json` version, then publishes with provenance
- Requires `NPM_TOKEN` secret set in GitHub repo settings
- Bump `package.json` version **before** tagging

### Claude Code plugin additions (in progress)
The coworker's contribution will add:
- `.claude-plugin/plugin.json` — plugin manifest
- `marketplace.json` — marketplace catalog
- `skills/` — SKILL.md files
- `commands/` — slash command definitions

When reviewing those PRs, ensure they don't add runtime dependencies to
`src/index.js` without discussion.

## Relationship to the `flo` monorepo

`packages/flo-claude-plugin-mcp` in `Flomenco-Inc/flo` now tracks changes
made here. The monorepo copy is the **source of integration truth** for how
the plugin connects to the interface-agent; this repo is the **source of truth
for the published artifact**.

When making changes:
1. PR here first → merge → tag → publish to npm
2. Keep `flo` monorepo's copy in sync manually or via a periodic sync script
   (not automated yet — see `docs/MIGRATION.md` for context)

## Known gaps / open items

| Item | Detail |
|------|--------|
| `flo-dev-claude-plugin` Cognito client | Doesn't exist in dev yet — `flo-dev-spa` is used as a fallback. Should be created in Terraform to mirror the prod `flo-prod-claude-plugin` client with correct redirect URIs. |
| Prod client ID in `.mcp.json` | Currently `${FLO_OAUTH_CLIENT_ID}` (user must set env var). Could hardcode once prod client ID is confirmed. See README step 1. |
| Bootstrap auto-discovery | `GET /integrations/claude-plugin/bootstrap` could be made public so the MCP server self-configures on startup — zero env vars for users. Not yet implemented. |
| Monorepo OAuth fix | `fix: preserve oauth start params through tanstack router on callback route` is on `feature/flo-346-347-brand-rules` in `Flomenco-Inc/flo` — not yet merged to main. |

## Related repos

| Repo | Purpose |
|------|---------|
| `Flomenco-Inc/flo` | Main product monorepo (private) |
| `Flomenco-Inc/flo-docs` | Org-wide conventions and runbooks (private) |
