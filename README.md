# Flo Plugin for Claude

The official Flomenco plugin for Claude. Brings Flo's AI-powered media
automation directly into Claude Code via slash commands, and connects Claude
Desktop to the Flo platform via MCP.

---

## Quick start

### 1. Get your OAuth client ID

Sign in to [floapp.co](https://floapp.co), go to **Settings → API**, and copy
your OAuth client ID.

### 2. Add it to your shell profile

```bash
# ~/.zshrc or ~/.bashrc
export FLO_OAUTH_CLIENT_ID=<your-client-id>
```

Reload your shell:

```bash
source ~/.zshrc
```

### 3. Install the plugin

```bash
claude plugin install Flomenco-Inc/flo-plugin
```

### 4. Authenticate

Ask Claude to run `flo_auth_login` — it opens a browser window, completes the
OAuth flow, and caches your token locally. You only need to do this once (or
when your token expires).

---

## Commands

| Command | Description |
|---------|-------------|
| `/flo-qc` | QC a media asset — logo consistency, spec compliance, timecode issues |
| `/flo-moderate` | Content moderation against a target rating and platform |
| `/flo-deliver` | Validate a media asset against platform delivery specs |
| `/flo-search` | Search for assets in your Flo library |
| `/flo-query` | Filename-first asset lookup |
| `/flo-analyze` | Analyze a media asset directly |
| `/flo-config` | Show current auth and config status |

---

## MCP tools

The plugin also exposes lower-level MCP tools for use in any MCP-capable
client (Claude Desktop, Claude Code, etc.):

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

**`flo_auth_login` fails with "Invalid URL"**
Your `FLO_OAUTH_CLIENT_ID` env var is not set. Go to
[floapp.co/settings/api](https://floapp.co/settings/api) to get your client ID,
add `export FLO_OAUTH_CLIENT_ID=<id>` to your shell profile, reload, and
reinstall the plugin.

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
