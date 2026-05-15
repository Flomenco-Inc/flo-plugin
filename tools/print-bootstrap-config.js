import { execFileSync } from "node:child_process";

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
    throw new Error(`Unable to find user pool "${userPoolName}"`);
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
      `Unable to find app client "${preferredClientName}" or "${fallbackClientName}"`
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

async function main() {
  const invocationUrl = resolveInvocationUrl();
  const authorizeUrl =
    process.env.FLO_OAUTH_AUTHORIZE_URL ||
    `${defaultWebAppUrlForEnv()}/auth/callback`;
  const tokenUrl = process.env.FLO_OAUTH_TOKEN_URL || defaultTokenUrlForEnv();
  const oauthClient = discoverOauthClient();
  const redirectUri =
    process.env.FLO_OAUTH_REDIRECT_URI || "http://127.0.0.1:8787/callback";
  const scopes = process.env.FLO_OAUTH_SCOPES || "openid email profile";

  const json = {
    invocationUrl,
    oauthAuthorizeUrl: authorizeUrl,
    oauthTokenUrl: tokenUrl,
    oauthClientId: oauthClient.clientId,
    oauthClientName: oauthClient.clientName,
    oauthUserPoolId: oauthClient.userPoolId,
    oauthUserPoolName: oauthClient.userPoolName,
    oauthSettingsUrl: oauthClient.settingsUrl,
    oauthRedirectUri: redirectUri,
    oauthScopes: scopes,
  };
  process.stdout.write(`${JSON.stringify(json, null, 2)}\n`);
}

try {
  await main();
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
}
