import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_KEY = "flo-plugin";

function defaultDesktopConfigPath() {
  if (process.platform === "darwin") {
    return path.join(
      os.homedir(),
      "Library",
      "Application Support",
      "Claude",
      "claude_desktop_config.json"
    );
  }
  if (process.platform === "win32") {
    const appData = process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
    return path.join(appData, "Claude", "claude_desktop_config.json");
  }
  return path.join(os.homedir(), ".config", "Claude", "claude_desktop_config.json");
}

async function readJson(filePath) {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function normalizedPluginEnv() {
  const raw = (process.env.FLO_PLUGIN_ENV || "dev").trim().toLowerCase();
  if (raw === "prod" || raw === "production") {
    return "prod";
  }
  if (raw === "stg" || raw === "stage" || raw === "staging") {
    return "stg";
  }
  return "dev";
}

function defaultInvocationUrlForEnv() {
  const env = normalizedPluginEnv();
  if (env === "prod") {
    return "https://plugin.floapp.co/invocations";
  }
  if (env === "stg") {
    return "https://plugin.stg.floapp.co/invocations";
  }
  return "https://plugin.dev.floapp.co/invocations";
}

function defaultUserPoolNameForEnv() {
  const env = normalizedPluginEnv();
  if (env === "prod") {
    return "flo-prod";
  }
  if (env === "stg") {
    return "flo-stg";
  }
  return "flo-dev";
}

function defaultPluginClientNameForEnv() {
  const env = normalizedPluginEnv();
  if (env === "prod") {
    return "flo-prod-claude-plugin";
  }
  if (env === "stg") {
    return "flo-stg-claude-plugin";
  }
  return "flo-dev-claude-plugin";
}

function defaultSettingsUrlForEnv() {
  const env = normalizedPluginEnv();
  if (env === "prod") {
    return "https://floapp.co/settings/api";
  }
  if (env === "stg") {
    return "https://stg.floapp.co/settings/api";
  }
  return "https://dev.floapp.co/settings/api";
}

function defaultWebAppUrlForEnv() {
  const env = normalizedPluginEnv();
  if (env === "prod") {
    return "https://floapp.co";
  }
  if (env === "stg") {
    return "https://stg.floapp.co";
  }
  return "https://dev.floapp.co";
}

function defaultTokenUrlForEnv() {
  const env = normalizedPluginEnv();
  if (env === "prod") {
    return "https://flomenco.auth.us-east-1.amazoncognito.com/oauth2/token";
  }
  if (env === "stg") {
    return "https://flomenco-stg.auth.us-east-1.amazoncognito.com/oauth2/token";
  }
  return "https://flomenco-dev.auth.us-east-1.amazoncognito.com/oauth2/token";
}

function runAwsJson(args) {
  const profile = (process.env.AWS_PROFILE || "").trim();
  const cmdArgs = [...args];
  if (profile) {
    cmdArgs.push("--profile", profile);
  }
  const stdout = execFileSync("aws", cmdArgs, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return JSON.parse(stdout);
}

function discoverOauthClient() {
  const explicit = (process.env.FLO_OAUTH_CLIENT_ID || "").trim();
  const region = (process.env.AWS_REGION || "us-east-1").trim();
  const userPoolName = (
    process.env.FLO_COGNITO_USER_POOL_NAME || defaultUserPoolNameForEnv()
  ).trim();
  const preferredClientName = (
    process.env.FLO_COGNITO_PLUGIN_CLIENT_NAME || defaultPluginClientNameForEnv()
  ).trim();
  const fallbackClientName = (
    process.env.FLO_COGNITO_FALLBACK_CLIENT_NAME || `${userPoolName}-spa`
  ).trim();

  if (explicit) {
    return {
      clientId: explicit,
      clientName: "(manual)",
      userPoolId: (process.env.FLO_OAUTH_USER_POOL_ID || "").trim(),
      userPoolName,
      region,
      settingsUrl:
        (process.env.FLO_OAUTH_SETTINGS_URL || "").trim() ||
        (process.env.FLO_OAUTH_CLIENT_ID_HELP_URL || "").trim() ||
        defaultSettingsUrlForEnv(),
    };
  }

  const pools = runAwsJson([
    "cognito-idp",
    "list-user-pools",
    "--region",
    region,
    "--max-results",
    "60",
    "--output",
    "json",
  ]);
  const userPool = (pools.UserPools || []).find((p) => p?.Name === userPoolName);
  if (!userPool?.Id) {
    throw new Error(
      `Could not find Cognito user pool "${userPoolName}". Set FLO_OAUTH_CLIENT_ID manually.`
    );
  }

  const clients = runAwsJson([
    "cognito-idp",
    "list-user-pool-clients",
    "--region",
    region,
    "--user-pool-id",
    userPool.Id,
    "--max-results",
    "60",
    "--output",
    "json",
  ]);
  const list = clients.UserPoolClients || [];
  const preferred = list.find((c) => c?.ClientName === preferredClientName);
  const fallback = list.find((c) => c?.ClientName === fallbackClientName);
  const picked = preferred || fallback;
  if (!picked?.ClientId) {
    throw new Error(
      `Could not find Cognito app client "${preferredClientName}" (or "${fallbackClientName}") in pool "${userPoolName}". Set FLO_OAUTH_CLIENT_ID manually.`
    );
  }
  return {
    clientId: picked.ClientId,
    clientName: picked.ClientName || preferredClientName,
    userPoolId: userPool.Id,
    userPoolName,
    region,
    settingsUrl:
      (process.env.FLO_OAUTH_SETTINGS_URL || "").trim() ||
      (process.env.FLO_OAUTH_CLIENT_ID_HELP_URL || "").trim() ||
      defaultSettingsUrlForEnv(),
  };
}

function resolveInvocationUrl() {
  if ((process.env.FLO_INTERFACE_AGENT_INVOCATION_URL || "").trim()) {
    return process.env.FLO_INTERFACE_AGENT_INVOCATION_URL.trim();
  }
  return defaultInvocationUrlForEnv();
}

async function resolveServerConfig() {
  // In the standalone repo the entry point is src/index.js at the repo root.
  const serverPath = path.resolve(__dirname, "..", "src", "index.js");

  const invocationUrl = resolveInvocationUrl();
  const authorizeUrl =
    process.env.FLO_OAUTH_AUTHORIZE_URL ||
    `${defaultWebAppUrlForEnv()}/auth/callback`;
  const tokenUrl = process.env.FLO_OAUTH_TOKEN_URL || defaultTokenUrlForEnv();
  const oauthClient = discoverOauthClient();

  return {
    command: "node",
    args: [serverPath],
    env: {
      FLO_INTERFACE_AGENT_INVOCATION_URL: invocationUrl,
      FLO_PLUGIN_ENV: normalizedPluginEnv(),
      FLO_OAUTH_AUTHORIZE_URL: authorizeUrl,
      FLO_OAUTH_TOKEN_URL: tokenUrl,
      FLO_OAUTH_CLIENT_ID: oauthClient.clientId,
      FLO_OAUTH_USER_POOL_ID: oauthClient.userPoolId,
      FLO_OAUTH_USER_POOL_NAME: oauthClient.userPoolName,
      FLO_OAUTH_EXPECTED_CLIENT_NAME: oauthClient.clientName,
      FLO_OAUTH_SETTINGS_URL: oauthClient.settingsUrl,
      FLO_OAUTH_REDIRECT_URI:
        process.env.FLO_OAUTH_REDIRECT_URI || "http://127.0.0.1:8787/callback",
      FLO_OAUTH_SCOPES: process.env.FLO_OAUTH_SCOPES || "openid email profile",
    },
  };
}

async function main() {
  const configPath = process.env.CLAUDE_DESKTOP_CONFIG_PATH || defaultDesktopConfigPath();
  const config = await readJson(configPath);
  config.mcpServers = config.mcpServers || {};
  config.mcpServers[SERVER_KEY] = await resolveServerConfig();

  await mkdir(path.dirname(configPath), { recursive: true });
  await writeFile(configPath, JSON.stringify(config, null, 2) + "\n", "utf8");

  console.log(`Installed "${SERVER_KEY}" into ${configPath}`);
  const env = config.mcpServers[SERVER_KEY].env;
  console.log(`OAuth client ID: ${env.FLO_OAUTH_CLIENT_ID}`);
  console.log(`OAuth settings URL: ${env.FLO_OAUTH_SETTINGS_URL}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
