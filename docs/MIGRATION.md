# Migration: `flo` monorepo → `flo-plugin`

## Background

The MCP server code originally lived at `packages/flo-claude-plugin-mcp`
inside the private `Flomenco-Inc/flo` monorepo. On 2026-05-14 it was extracted
into this standalone public repository to:

- Enable public npm distribution without exposing the full product monorepo
- Support the Anthropic Claude plugin marketplace and Verified badge process
- Allow a contributor to add Claude Code plugin content (skills, commands,
  marketplace manifest) without needing access to the private monorepo
- Follow Anthropic's recommendation that published Claude plugins live in a
  public, auditable GitHub repo

## What was copied

| Source (in `flo` monorepo) | Destination (this repo) |
|---------------------------|------------------------|
| `packages/flo-claude-plugin-mcp/src/index.js` | `src/index.js` |
| `packages/flo-claude-plugin-mcp/tools/install-claude-desktop.js` | `tools/install-claude-desktop.js` |
| `packages/flo-claude-plugin-mcp/tools/uninstall-claude-desktop.js` | `tools/uninstall-claude-desktop.js` |
| `packages/flo-claude-plugin-mcp/tools/print-bootstrap-config.js` | `tools/print-bootstrap-config.js` |

## What was changed during migration

### `package.json` (new, not copied)
Created from scratch with:
- Package name changed from `flo-claude-plugin-mcp` → `@flomenco/claude-plugin-mcp`
- License set to `MIT` (was `UNLICENSED` in the private monorepo)
- `repository`, `homepage`, and `bugs` URLs point to this repo
- `private: false` so npm publishing works

### `tools/install-claude-desktop.js`
One path reference updated:
```js
// Before (monorepo-relative):
const serverPath = path.join(rootDir, "packages", "flo-claude-plugin-mcp", "src", "index.js");

// After (standalone-relative):
const serverPath = path.resolve(__dirname, "..", "src", "index.js");
```

### `packages/flo-claude-plugin-mcp/package.json` (in the monorepo)
`repository` and `homepage` fields updated to point here so npm provenance
links correctly.

## Files added in this repo (did not exist in monorepo)

| File | Purpose |
|------|---------|
| `LICENSE` | MIT licence text |
| `.gitignore` | Standard Node.js ignore file |
| `README.md` | Public-facing installation and usage docs |
| `AGENTS.md` | AI agent context (this repo's conventions) |
| `CONTRIBUTING.md` | How to add tools, plugin content, or publish |
| `docs/MIGRATION.md` | This file |
| `.cursor/rules/flo-plugin.mdc` | Cursor persistent rules for AI agents |
| `.github/workflows/publish.yml` | npm publish on `v*.*.*` tag |

## Security review (performed at migration time)

Reviewed all source files for secrets or private data before going public.
**No concerns found.** Specifically:

- No hardcoded API keys, tokens, or passwords
- No private infra IPs or non-public URLs
- No AWS account IDs or private ARNs
- Cognito hosted-UI domain names and OAuth pool/client names are intentionally
  public (they appear in JWT `iss` claims and are required for the PKCE flow)
- GitHub Actions `NPM_TOKEN` is a reference to a repository secret — the
  value is not in the repo

## Ongoing relationship with the `flo` monorepo

`packages/flo-claude-plugin-mcp/` was **fully removed** from the monorepo on
2026-05-14. The monorepo now consumes the plugin exclusively via the published
npm package `@flomenco/claude-plugin-mcp`.

**Workflow going forward:**
1. Make changes in this repo (`flo-plugin`)
2. PR → merge → bump `package.json` version → tag `vX.Y.Z` → push tag
3. GitHub Actions publishes the new version to npm automatically
4. No manual sync to the monorepo is required

The monorepo's `pnpm-workspace.yaml` no longer lists the package, and
there are no source copies to keep in sync.

## OAuth fix applied at migration time

Alongside the migration, a bug was fixed in the frontend OAuth callback
(`flo/packages/frontend/src/routes/auth/callback.tsx`). The root cause was
that TanStack Router v1.144.0 strips unknown query parameters synchronously
during route initialization, so the Claude plugin OAuth start parameters
(`response_type`, `client_id`, `redirect_uri`, `code_challenge`, etc.) were
being lost before the `useEffect` handlers could read them.

**Fix summary:**
- Extended `OAuthCallbackSearchParams` and `validateSearch` to declare all
  Claude plugin OAuth parameters so TanStack Router preserves them
- Replaced `window.location.search` reads with `Route.useSearch()` results
- Removed `isOAuthStartRequestFromWindow()` which relied on the (now stripped)
  raw window URL

This fix is on the `feature/flo-346-347-brand-rules` branch of the `flo` repo.
