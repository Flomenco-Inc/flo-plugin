# Flo Plugin for Claude

The official Flomenco plugin for Claude. Brings Flo's AI-powered media
automation into Claude Code via slash commands, and connects Claude Desktop to
the Flo platform via MCP.

---

## Quick start (Claude Code)

### 1. Install the plugin

In Claude Code:

```text
/plugin marketplace add Flomenco-Inc/flo-plugin
/plugin install flo-plugin@flo-plugins
/reload-plugins
```

### 2. Authenticate

Ask Claude to run `flo_auth_login` — it opens a browser window, completes the
OAuth flow, and caches your token locally. You only need to do this once (or
when your token expires).

**Production:** the plugin ships prod defaults in `.mcp.json`. Copy your OAuth
client ID from [floapp.co/settings/api](https://floapp.co/settings/api) (Claude
Plugin tab) into the plugin MCP env only if `flo_auth_login` reports a missing
client ID.

**Dev / staging:** marketplace `.mcp.json` ships prod defaults. Override using
any of:

1. **`~/.flo/claude-plugin-mcp.env`** — copy the env block from **Settings →
   API → Claude Plugin** (recommended).
2. **Legacy `~/.claude.json`** — if you already have `mcpServers.flo-plugin.env`
   for a manual MCP server, the plugin MCP merges those vars automatically.
3. Claude Code plugin MCP env UI for `plugin:flo-plugin:flo-plugin`.

Run `npm run sync-versions` before release so `marketplace.json` matches
`package.json` (required for `/plugin marketplace update` to pull new builds).

### 3. Validate

```text
flo_plugin_healthcheck
flo_happy_path_run
```

---

## Commands

| Command | Description |
|---------|-------------|
| `/flo-search` | Search for assets in your Flo library |
| `/flo-query` | Filename-first asset lookup |
| `/flo-skill-routing` | List available actions for an asset |
| `/flo-qc-logo` | Logo QC against a stored reference image |
| `/flo-qc` | QC workflow picker (logo vs moderation) |
| `/flo-moderate` | Content moderation against a target rating and platform |
| `/flo-deliver` | Validate a media asset against platform delivery specs |
| `/flo-analyze` | Analyze a media asset directly |
| `/flo-config` | Show current auth and config status |

---

## MCP tools

| Tool | Description |
|------|-------------|
| `flo_auth_login` | Start OAuth login (browser PKCE flow) |
| `flo_auth_status` | Show current auth state and token info |
| `flo_auth_logout` | Clear cached token |
| `flo_auth_setup_help` | Show where to find your client ID |
| `flo_search` | Search the Flo asset library |
| `flo_query` | Filename-first asset lookup |
| `flo_analyze` | Analyze a media asset |
| `flo_qc_logo` | Run logo QC against a reference asset |
| `flo_skill_routing` | List available actions for an asset |
| `flo_plugin_healthcheck` | Check auth and connectivity |
| `flo_happy_path_run` | End-to-end validation in one call |
| `flo_command` | Run a raw `/flo:*` command (escape hatch) |

---

## Claude Desktop installation

Run the install script (requires AWS credentials with Cognito read access):

```bash
npx @flomenco/claude-plugin-mcp install:claude-desktop
```

Or clone the repo and run:

```bash
node tools/install-claude-desktop.js
```

Then fully quit and relaunch Claude Desktop.

---

## Troubleshooting

**`flo_auth_login` fails with "Invalid URL" or missing client ID**
Open [floapp.co/settings/api](https://floapp.co/settings/api), copy the OAuth
client ID from the Claude Plugin tab, and set `FLO_OAUTH_CLIENT_ID` in your MCP
env block. For dev, copy the full env block from that page.

**`flo_plugin_healthcheck` returns unreachable**
Check that you have network access to `plugin.floapp.co`. If you're on a VPN,
try disconnecting.

**Commands not appearing after install**
Restart Claude Code, or run `/reload-plugins`.

**Token expired**
Ask Claude to run `flo_auth_logout` followed by `flo_auth_login`.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to add new tools or commands.

## License

MIT — see [LICENSE](LICENSE).
