# Flo Plugin for Claude

MCP server that connects Claude to [Flo](https://floapp.co) — the AI-native media operations platform.

## What it does

Once installed, Claude can search your Flo library, query assets, run logo QC, and execute Flo workflows directly from Claude Desktop or Claude Code.

**Available tools:**

| Tool | Description |
|---|---|
| `flo_auth_login` | Authenticate via browser OAuth (PKCE) |
| `flo_auth_status` | Check current auth state |
| `flo_auth_logout` | Clear cached token |
| `flo_auth_setup_help` | Troubleshoot OAuth configuration |
| `flo_search` | Search your Flo asset library |
| `flo_query` | Filename-first asset lookup |
| `flo_analyze` | Analyze an asset |
| `flo_skill_routing` | List available actions for an asset |
| `flo_qc_logo` | Run logo QC against a reference image |
| `flo_command` | Run any raw `/flo:*` command |
| `flo_plugin_healthcheck` | Verify config, auth, and runtime connectivity |
| `flo_happy_path_run` | End-to-end search → QC validation in one call |

## Install

### Claude Desktop (recommended)

Add the following to your `claude_desktop_config.json`:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`  
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "flo-plugin": {
      "command": "npx",
      "args": ["-y", "@flomenco/claude-plugin-mcp"],
      "env": {
        "FLO_PLUGIN_ENV": "prod"
      }
    }
  }
}
```

Then restart Claude Desktop and run `flo_auth_login` to authenticate.

> Your Flo OAuth credentials are fetched automatically from the Flo bootstrap API on first run. You can also set them explicitly — see [Configuration](#configuration) below.

### Claude Code

```bash
claude mcp add flo-plugin -- npx -y @flomenco/claude-plugin-mcp
```

## Authentication

The plugin uses OAuth 2.0 PKCE. On first use, run the `flo_auth_login` tool — it opens a browser window, you sign in to Flo, and the token is cached locally at `~/.flo/claude-plugin-mcp-token.json`.

Tokens are refreshed automatically. Run `flo_auth_logout` to clear the cache.

## Configuration

All configuration is via environment variables. Most are auto-discovered from the Flo bootstrap API when `FLO_PLUGIN_ENV` is set.

| Variable | Default | Description |
|---|---|---|
| `FLO_PLUGIN_ENV` | `dev` | Environment: `dev`, `stg`, or `prod` |
| `FLO_INTERFACE_AGENT_INVOCATION_URL` | _(from env)_ | Full invocation endpoint URL |
| `FLO_OAUTH_AUTHORIZE_URL` | _(from env)_ | OAuth authorize URL (Flo web app `/auth/callback`) |
| `FLO_OAUTH_TOKEN_URL` | _(from env)_ | Cognito token endpoint |
| `FLO_OAUTH_CLIENT_ID` | _(from env)_ | Cognito app client ID |
| `FLO_OAUTH_REDIRECT_URI` | `http://127.0.0.1:8787/callback` | Local loopback for auth code |
| `FLO_OAUTH_SCOPES` | `openid email profile` | OAuth scopes |
| `FLO_AUTH_TOKEN` | _(none)_ | Static bearer token (skips OAuth) |

## Development

```bash
git clone https://github.com/Flomenco-Inc/flo-plugin.git
cd flo-plugin
npm install
node src/index.js
```

### Install locally into Claude Desktop

```bash
# Optionally set AWS_PROFILE for auto-discovery of OAuth client
export AWS_PROFILE=your-profile
node tools/install-claude-desktop.js
```

## Contributing

Issues and pull requests welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

[MIT](LICENSE) — © Flomenco, Inc.
