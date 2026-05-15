# Flo Plugin for Claude Code

The official Flomenco plugin for Claude Code. Brings Flo's AI-powered media automation directly into your development workflow via slash commands.

---

## Commands

| Command | Description |
|---|---|
| `/flo-qc` | Run a QC check on a media asset, including logo consistency validation |
| `/flo-moderate` | Run a content appropriateness check against a target rating and platform |
| `/flo-deliver` | Validate a media asset against platform delivery specifications |

---

## Prerequisites

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code/overview) installed and running
- Node.js 18+ (required by `@flomenco/claude-plugin-mcp`)
- Flo platform credentials — contact your Flomenco administrator

---

## Installation

### 1. Set environment variables

Copy `env.example` to `.env` and fill in your credentials:

```bash
cp env.example .env
```

Then add the variables to your shell profile (`~/.zshrc` or `~/.bashrc`):

```bash
export FLO_PLUGIN_ENV=prod
export FLO_INTERFACE_AGENT_INVOCATION_URL=https://plugin.floapp.co/invocations
export FLO_OAUTH_AUTHORIZE_URL=https://floapp.co/settings/integrations/auth/callback
export FLO_OAUTH_TOKEN_URL=https://flomenco.auth.us-east-1.amazoncognito.com/oauth2/token
export FLO_OAUTH_CLIENT_ID=your_client_id
export FLO_OAUTH_USER_POOL_ID=your_pool_id
export FLO_OAUTH_USER_POOL_NAME=your_pool_name
export FLO_OAUTH_EXPECTED_CLIENT_NAME=your_client_name
export FLO_OAUTH_REDIRECT_URI=http://127.0.0.1:8787/callback
export FLO_OAUTH_SCOPES="openid email profile"
```

Reload your shell:

```bash
source ~/.zshrc   # or ~/.bashrc
```

### 2. Add the Flomenco marketplace

From within Claude Code:

```
/plugin marketplace add https://github.com/premsundaram-flo/flo-claude-plugin
```

### 3. Install the plugin

```
/plugin install flo-plugin
```

### 4. Authenticate

```
/flo-auth
```

Or invoke directly via the MCP tool:

```
flo_auth_login
```

### 5. Verify the installation

Run the following in Claude Code and confirm all three pass:

```
flo_auth_login
flo_plugin_healthcheck
flo_query with query: "list available agents"
```

---

## Usage

### `/flo-qc`

Runs a QC check on a media asset. You will be prompted for:

- **Asset ID** — the media asset to check
- **Logo Asset ID** — the reference logo to validate consistency against

Claude will invoke the Flo QC Agent and return a structured report with pass/fail status per check, confidence scores, and timecode references for any failures.

### `/flo-moderate`

Runs a content appropriateness check. You will be prompted for:

- **Asset ID** — the media asset to moderate
- **Target Rating** — e.g. `G`, `PG`, `PG-13`, `TV-14`, `TV-MA`
- **Target Platform** — e.g. `Netflix`, `Prime Video`, `YouTube`, `Broadcast`

Returns a per-category moderation report with severity scores, flagged timecodes, and platform policy compliance status.

### `/flo-deliver`

Validates a media asset against platform delivery specs. You will be prompted for:

- **Asset ID** — the media asset to validate
- **Target Platform** — e.g. `Netflix`, `Disney+`, `Prime Video`
- **Spec Version** *(optional)* — leave blank to use the latest spec

Returns a delivery validation report grouped by severity: blocking issues first, then warnings, then advisories.

---

## Troubleshooting

**`flo_auth_login` fails**
Verify your `FLO_OAUTH_CLIENT_ID` and `FLO_OAUTH_TOKEN_URL` are set correctly for your environment. Check with your Flomenco administrator.

**`flo_plugin_healthcheck` returns unhealthy**
Confirm `FLO_INTERFACE_AGENT_INVOCATION_URL` points to the correct environment endpoint and that you have network access to it.

**`npx @flomenco/claude-plugin-mcp` not found**
Ensure Node.js 18+ is installed and `npx` is on your PATH. Run `node --version` to confirm.

**Plugin commands not appearing after install**
Run `/reload-plugins` inside Claude Code, or fully restart Claude Code.

---

## Development

To run against the dev environment, set:

```bash
export FLO_PLUGIN_ENV=dev
export FLO_INTERFACE_AGENT_INVOCATION_URL=https://plugin.dev.floapp.co/invocations
export FLO_OAUTH_AUTHORIZE_URL=https://dev.floapp.co/settings/integrations/auth/callback
export FLO_OAUTH_TOKEN_URL=https://flomenco-dev.auth.us-east-1.amazoncognito.com/oauth2/token
```

---

## Internal Use Only

This plugin is for internal Flomenco use. Do not distribute externally without authorization.

For access or support, contact your Flomenco administrator.
