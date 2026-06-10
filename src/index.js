#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ErrorCode,
} from "@modelcontextprotocol/sdk/types.js";
import { createHash, randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const PACKAGE_VERSION = require("../package.json").version;

const DEFAULT_TIMEOUT_MS = 60_000;
const OAUTH_WAIT_TIMEOUT_MS = 180_000;
const TOKEN_REFRESH_SKEW_SECONDS = 60;
const ASSET_ID_REGEX = /^[A-Za-z0-9._-]+$/;
const DEFAULT_TOKEN_CACHE_PATH = path.join(
  os.homedir(),
  ".flo",
  "claude-plugin-mcp-token.json"
);
const DEFAULT_MCP_ENV_FILE = path.join(
  os.homedir(),
  ".flo",
  "claude-plugin-mcp.env"
);
const LEGACY_CLAUDE_JSON_PATH = path.join(os.homedir(), ".claude.json");
const LEGACY_MCP_SERVER_NAME = "flo-plugin";

async function applyEnvOverrides(env) {
  if (!env || typeof env !== "object") {
    return;
  }
  for (const [key, value] of Object.entries(env)) {
    if (value == null || value === "") {
      continue;
    }
    if (!process.env[key]) {
      process.env[key] = String(value);
    }
  }
}

async function loadDotEnvFile(filePath) {
  try {
    const raw = await readFile(filePath, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }
      const eq = trimmed.indexOf("=");
      if (eq <= 0) {
        continue;
      }
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (key && !process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // optional local overrides
  }
}

async function mergeMcpEnvFromUserConfig() {
  const envFile = (process.env.FLO_MCP_ENV_FILE || DEFAULT_MCP_ENV_FILE).trim();
  if (envFile) {
    await loadDotEnvFile(envFile);
  }

  try {
    const raw = await readFile(LEGACY_CLAUDE_JSON_PATH, "utf8");
    const config = JSON.parse(raw);
    await applyEnvOverrides(config?.mcpServers?.[LEGACY_MCP_SERVER_NAME]?.env);
  } catch {
    // optional legacy MCP config in ~/.claude.json
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
  // Non-prod environments require explicit FLO_INTERFACE_AGENT_INVOCATION_URL.
  return "";
}

function defaultUserPoolNameForEnv() {
  const env = normalizedPluginEnv();
  if (env === "prod") {
    return "flo-prd";
  }
  // Non-prod environments must set FLO_OAUTH_USER_POOL_NAME explicitly.
  return "";
}

function defaultExpectedClientNameForEnv() {
  const env = normalizedPluginEnv();
  if (env === "prod") {
    return "flo-prd-spa";
  }
  // Non-prod environments must set FLO_OAUTH_EXPECTED_CLIENT_NAME explicitly.
  return "";
}

function defaultOAuthAuthorizeUrlForEnv() {
  const env = normalizedPluginEnv();
  if (env === "prod") {
    return "https://floapp.co/auth/callback";
  }
  return "";
}

function defaultOAuthTokenUrlForEnv() {
  const env = normalizedPluginEnv();
  if (env === "prod") {
    return "https://flomenco-prd.auth.us-east-1.amazoncognito.com/oauth2/token";
  }
  return "";
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

function getInvocationUrl() {
  const raw =
    process.env.FLO_INTERFACE_AGENT_INVOCATION_URL ||
    process.env.FLO_INTERFACE_AGENT_URL ||
    defaultInvocationUrlForEnv();
  if (!raw) {
    throw new McpError(
      ErrorCode.InvalidRequest,
      "Missing FLO_INTERFACE_AGENT_INVOCATION_URL (or FLO_INTERFACE_AGENT_URL)."
    );
  }
  const trimmed = raw.trim().replace(/\/+$/, "");
  return trimmed.endsWith("/invocations") ? trimmed : `${trimmed}/invocations`;
}

function getDefaultAuthToken() {
  return (process.env.FLO_AUTH_TOKEN || "").trim();
}

function getOAuthConfig(strict = false) {
  const authorizeUrl = (
    process.env.FLO_OAUTH_AUTHORIZE_URL || defaultOAuthAuthorizeUrlForEnv()
  ).trim();
  const tokenUrl = (
    process.env.FLO_OAUTH_TOKEN_URL || defaultOAuthTokenUrlForEnv()
  ).trim();
  const clientId = (process.env.FLO_OAUTH_CLIENT_ID || "").trim();
  const scope = (process.env.FLO_OAUTH_SCOPES || "openid email profile").trim();
  const redirectUri = (
    process.env.FLO_OAUTH_REDIRECT_URI || "http://127.0.0.1:8787/callback"
  ).trim();
  const audience = (process.env.FLO_OAUTH_AUDIENCE || "").trim();
  const region = (process.env.AWS_REGION || "us-east-1").trim();
  const userPoolId = (process.env.FLO_OAUTH_USER_POOL_ID || "").trim();
  const userPoolName = (
    process.env.FLO_OAUTH_USER_POOL_NAME || defaultUserPoolNameForEnv()
  ).trim();
  const expectedClientName = (
    process.env.FLO_OAUTH_EXPECTED_CLIENT_NAME || defaultExpectedClientNameForEnv()
  ).trim();
  const settingsUrl = (
    process.env.FLO_OAUTH_SETTINGS_URL ||
    process.env.FLO_OAUTH_CLIENT_ID_HELP_URL ||
    defaultSettingsUrlForEnv()
  ).trim();
  const rawAppLoginUrl = (process.env.FLO_OAUTH_APP_LOGIN_URL || "").trim();
  const appLoginUrl = rawAppLoginUrl || `${defaultWebAppUrlForEnv()}/login`;

  const ready = Boolean(authorizeUrl && tokenUrl && clientId);
  if (strict && !ready) {
    throw new McpError(
      ErrorCode.InvalidRequest,
      "OAuth not configured. Set FLO_OAUTH_AUTHORIZE_URL, FLO_OAUTH_TOKEN_URL, and FLO_OAUTH_CLIENT_ID."
    );
  }

  return {
    ready,
    authorizeUrl,
    tokenUrl,
    clientId,
    scope,
    redirectUri,
    audience,
    region,
    userPoolId,
    userPoolName,
    expectedClientName,
    settingsUrl,
    appLoginUrl,
  };
}

function getTokenCachePath() {
  return (process.env.FLO_OAUTH_TOKEN_CACHE_PATH || DEFAULT_TOKEN_CACHE_PATH).trim();
}

function base64Url(input) {
  const buff = Buffer.isBuffer(input) ? input : Buffer.from(input, "utf8");
  return buff
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function readCachedToken() {
  try {
    const raw = await readFile(getTokenCachePath(), "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

async function writeCachedToken(tokenPayload) {
  const tokenPath = getTokenCachePath();
  await mkdir(path.dirname(tokenPath), { recursive: true });
  await writeFile(tokenPath, JSON.stringify(tokenPayload, null, 2), "utf8");
}

async function clearCachedToken() {
  try {
    await rm(getTokenCachePath(), { force: true });
  } catch {
    // Ignore cache-clear failures; callers receive success semantics.
  }
}

function tokenIsUsable(tokenPayload) {
  if (!tokenPayload || typeof tokenPayload.access_token !== "string") {
    return false;
  }
  if (!tokenPayload.expires_at) {
    return true;
  }
  const expiresAt = Number(tokenPayload.expires_at);
  if (!Number.isFinite(expiresAt)) {
    return false;
  }
  const nowSeconds = Math.floor(Date.now() / 1000);
  return expiresAt > nowSeconds + TOKEN_REFRESH_SKEW_SECONDS;
}

async function exchangeToken(params) {
  const oauth = getOAuthConfig(true);
  const body = new URLSearchParams(params);
  const response = await fetch(oauth.tokenUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new McpError(
      ErrorCode.InternalError,
      `OAuth token endpoint failed (${response.status}): ${JSON.stringify(json).slice(0, 500)}`
    );
  }
  if (!json.access_token) {
    throw new McpError(
      ErrorCode.InternalError,
      "OAuth token endpoint succeeded but no access_token was returned."
    );
  }
  const nowSeconds = Math.floor(Date.now() / 1000);
  const expiresIn = Number(json.expires_in || 3600);
  return {
    access_token: String(json.access_token),
    refresh_token:
      json.refresh_token !== undefined ? String(json.refresh_token) : undefined,
    token_type: json.token_type ? String(json.token_type) : "Bearer",
    scope: json.scope ? String(json.scope) : undefined,
    expires_at: nowSeconds + Math.max(1, expiresIn),
  };
}

async function refreshAccessTokenIfPossible(cachedToken) {
  if (!cachedToken?.refresh_token) {
    return null;
  }
  const oauth = getOAuthConfig(false);
  if (!oauth.ready) {
    return null;
  }
  try {
    const refreshed = await exchangeToken({
      grant_type: "refresh_token",
      refresh_token: String(cachedToken.refresh_token),
      client_id: oauth.clientId,
    });
    if (!refreshed.refresh_token) {
      refreshed.refresh_token = String(cachedToken.refresh_token);
    }
    await writeCachedToken(refreshed);
    return refreshed;
  } catch {
    return null;
  }
}

function openBrowser(url) {
  if (process.env.FLO_OAUTH_SKIP_BROWSER === "true") {
    return false;
  }
  try {
    if (process.platform === "darwin") {
      const p = spawn("open", [url], { detached: true, stdio: "ignore" });
      p.unref();
      return true;
    }
    if (process.platform === "win32") {
      const p = spawn("cmd", ["/c", "start", "", url], {
        detached: true,
        stdio: "ignore",
      });
      p.unref();
      return true;
    }
    const p = spawn("xdg-open", [url], { detached: true, stdio: "ignore" });
    p.unref();
    return true;
  } catch {
    return false;
  }
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderOAuthCallbackPage({ status, title, message, details }) {
  const isSuccess = status === "success";
  const badgeText = isSuccess ? "Flo Connected" : "Flo Connection Error";
  const badgeColor = isSuccess ? "#22c55e" : "#ef4444";
  const symbol = isSuccess ? "✓" : "!";
  const detailsHtml = details
    ? `<pre class="details">${escapeHtml(details)}</pre>`
    : "";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      :root {
        color-scheme: dark;
      }
      body {
        margin: 0;
        min-height: 100vh;
        font-family:
          Inter,
          -apple-system,
          BlinkMacSystemFont,
          "Segoe UI",
          Roboto,
          "Helvetica Neue",
          Arial,
          sans-serif;
        background: radial-gradient(circle at top, #1a2138 0%, #0b1020 58%);
        color: #e5e7eb;
        display: grid;
        place-items: center;
        padding: 24px;
      }
      .card {
        width: min(560px, 100%);
        border: 1px solid rgba(148, 163, 184, 0.28);
        background: rgba(15, 23, 42, 0.76);
        backdrop-filter: blur(8px);
        border-radius: 16px;
        padding: 26px;
        box-shadow: 0 16px 42px rgba(2, 6, 23, 0.35);
      }
      .badge {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        border-radius: 999px;
        border: 1px solid ${badgeColor};
        color: ${badgeColor};
        padding: 6px 10px;
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.02em;
      }
      .badge span {
        display: inline-grid;
        place-items: center;
        width: 16px;
        height: 16px;
        border-radius: 999px;
        background: ${badgeColor};
        color: #ffffff;
        font-size: 12px;
        line-height: 1;
      }
      h1 {
        margin: 14px 0 10px;
        font-size: 24px;
        line-height: 1.2;
      }
      p {
        margin: 0;
        color: #cbd5e1;
        line-height: 1.5;
      }
      .hint {
        margin-top: 16px;
        border-top: 1px solid rgba(148, 163, 184, 0.2);
        padding-top: 14px;
        font-size: 14px;
        color: #94a3b8;
      }
      .details {
        margin: 14px 0 0;
        padding: 12px;
        border-radius: 10px;
        border: 1px solid rgba(148, 163, 184, 0.26);
        background: rgba(2, 6, 23, 0.55);
        color: #dbeafe;
        white-space: pre-wrap;
        word-break: break-word;
        font-size: 12px;
        line-height: 1.45;
      }
    </style>
  </head>
  <body>
    <main class="card">
      <div class="badge"><span>${symbol}</span>${badgeText}</div>
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(message)}</p>
      ${detailsHtml}
      <p class="hint">You can close this tab and return to Claude.</p>
    </main>
  </body>
</html>`;
}

async function waitForOAuthCode(redirectUri, expectedState) {
  const parsed = new URL(redirectUri);
  if (parsed.protocol !== "http:") {
    throw new McpError(
      ErrorCode.InvalidRequest,
      `Unsupported FLO_OAUTH_REDIRECT_URI protocol: ${parsed.protocol}. Use http://127.0.0.1:<port>/callback`
    );
  }
  const port = Number(parsed.port || "80");
  const hostname = parsed.hostname;
  const pathname = parsed.pathname || "/";

  const server = createServer();
  const code = await new Promise((resolve, reject) => {
    const onRequest = (req, res) => {
      try {
        const reqUrl = new URL(req.url || "/", `http://${req.headers.host}`);
        if (reqUrl.pathname !== pathname) {
          res.statusCode = 404;
          res.end("Not found");
          return;
        }

        const oauthError = reqUrl.searchParams.get("error");
        const returnedCode = reqUrl.searchParams.get("code");
        const returnedState = reqUrl.searchParams.get("state");

        if (oauthError) {
          clearTimeout(timer);
          res.statusCode = 400;
          res.setHeader("content-type", "text/html; charset=utf-8");
          res.end(
            renderOAuthCallbackPage({
              status: "error",
              title: "Flo OAuth failed",
              message: "The identity provider returned an error.",
              details: `error=${oauthError}`,
            })
          );
          reject(new Error(`OAuth provider returned error=${oauthError}`));
          return;
        }
        if (!returnedCode) {
          clearTimeout(timer);
          res.statusCode = 400;
          res.setHeader("content-type", "text/html; charset=utf-8");
          res.end(
            renderOAuthCallbackPage({
              status: "error",
              title: "Flo OAuth failed",
              message: "The callback did not include an authorization code.",
            })
          );
          reject(new Error("OAuth callback missing code"));
          return;
        }
        if (returnedState !== expectedState) {
          clearTimeout(timer);
          res.statusCode = 400;
          res.setHeader("content-type", "text/html; charset=utf-8");
          res.end(
            renderOAuthCallbackPage({
              status: "error",
              title: "Flo OAuth failed",
              message: "State mismatch detected. Please retry login.",
            })
          );
          reject(new Error("OAuth state mismatch"));
          return;
        }

        clearTimeout(timer);
        res.statusCode = 200;
        res.setHeader("content-type", "text/html; charset=utf-8");
        res.end(
          renderOAuthCallbackPage({
            status: "success",
            title: "Flo OAuth complete",
            message:
              "Authentication succeeded and your plugin token is now linked.",
          })
        );
        resolve(returnedCode);
      } catch (err) {
        clearTimeout(timer);
        reject(err);
      }
    };

    const timeoutMs = Number(process.env.FLO_OAUTH_TIMEOUT_MS || OAUTH_WAIT_TIMEOUT_MS);
    const timer = setTimeout(() => {
      reject(
        new Error("Timed out waiting for OAuth callback. Re-run flo_auth_login.")
      );
    }, timeoutMs);

    server.once("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    server.on("request", onRequest);
    server.listen(port, hostname);
  }).finally(async () => {
    await new Promise((done) => server.close(() => done()));
  });

  return code;
}

async function runInteractiveOAuthLogin() {
  const oauth = getOAuthConfig(true);
  const verifier = base64Url(randomBytes(32));
  const challenge = base64Url(
    createHash("sha256").update(verifier, "utf8").digest()
  );
  const state = base64Url(randomBytes(24));
  const authUrl = new URL(oauth.authorizeUrl);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", oauth.clientId);
  authUrl.searchParams.set("redirect_uri", oauth.redirectUri);
  authUrl.searchParams.set("scope", oauth.scope);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("code_challenge", challenge);
  authUrl.searchParams.set("code_challenge_method", "S256");
  if (oauth.audience) {
    authUrl.searchParams.set("audience", oauth.audience);
  }

  const opened = openBrowser(authUrl.toString());
  if (!opened) {
    throw new McpError(
      ErrorCode.InternalError,
      `Unable to auto-open browser. Open this URL manually and re-run flo_auth_login:\n${authUrl.toString()}`
    );
  }

  const code = await waitForOAuthCode(oauth.redirectUri, state);
  const token = await exchangeToken({
    grant_type: "authorization_code",
    code,
    client_id: oauth.clientId,
    redirect_uri: oauth.redirectUri,
    code_verifier: verifier,
  });
  await writeCachedToken(token);
  return token;
}

async function resolveAuthToken(explicitAuthToken, interactive) {
  const override = explicitAuthToken?.trim();
  if (override) {
    return override;
  }

  const envToken = getDefaultAuthToken();
  if (envToken) {
    return envToken;
  }

  const cachedToken = await readCachedToken();
  if (tokenIsUsable(cachedToken)) {
    return cachedToken.access_token;
  }

  const oauth = getOAuthConfig(false);
  if (!oauth.ready) {
    if (!interactive) {
      return "";
    }
    throw new McpError(
      ErrorCode.InvalidRequest,
      "OAuth not configured. Set FLO_OAUTH_CLIENT_ID (Settings → API → Claude Plugin, or flo_auth_setup_help)."
    );
  }

  const refreshedToken = await refreshAccessTokenIfPossible(cachedToken);
  if (tokenIsUsable(refreshedToken)) {
    return refreshedToken.access_token;
  }

  if (!interactive) {
    return "";
  }

  const freshToken = await runInteractiveOAuthLogin();
  return freshToken.access_token;
}

async function buildHeaders(explicitAuthToken, interactiveAuth = true) {
  const headers = { "content-type": "application/json" };
  const token = await resolveAuthToken(explicitAuthToken, interactiveAuth);
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

async function invokeInterfaceAgent(prompt, explicitAuthToken, interactiveAuth = true) {
  const response = await fetch(getInvocationUrl(), {
    method: "POST",
    headers: await buildHeaders(explicitAuthToken, interactiveAuth),
    body: JSON.stringify({ prompt }),
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
  });

  const bodyText = await response.text();
  if (!response.ok) {
    throw new McpError(
      ErrorCode.InternalError,
      `interface-agent returned HTTP ${response.status}: ${bodyText.slice(0, 500)}`
    );
  }

  return bodyText;
}

function coerceAgentCorePayload(parsed) {
  if (parsed === null || parsed === undefined) {
    return null;
  }
  if (typeof parsed !== "object") {
    return parsed;
  }
  const inner = parsed.text;
  if (typeof inner === "string" && inner.trim().startsWith("{")) {
    try {
      return JSON.parse(inner);
    } catch {
      // Inner JSON may be split across streamed chunks; assembly handles that.
    }
  }
  return parsed;
}

function parseEmbeddedJsonObject(text) {
  const trimmed = (text || "").trim();
  if (!trimmed) {
    return null;
  }

  const tryParse = (candidate) => {
    try {
      return coerceAgentCorePayload(JSON.parse(candidate));
    } catch {
      return null;
    }
  };

  let payload = tryParse(trimmed);
  if (payload !== null) {
    return payload;
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    payload = tryParse(trimmed.slice(start, end + 1));
    if (payload !== null) {
      return payload;
    }
  }

  return null;
}

function assembleAgentCoreTextFromStream(raw) {
  const trimmed = (raw || "").trim();
  if (!trimmed) {
    return "";
  }

  let assembled = "";
  for (const line of trimmed.split(/\r?\n/)) {
    const stripped = line.trim();
    if (!stripped.startsWith("data:")) {
      continue;
    }
    const chunk = stripped.slice(5).trim();
    if (!chunk) {
      continue;
    }
    try {
      const event = JSON.parse(chunk);
      if (event && typeof event.text === "string") {
        assembled += event.text;
      }
    } catch {
      continue;
    }
  }

  if (assembled) {
    return assembled;
  }

  const envelope = parseEmbeddedJsonObject(trimmed);
  if (envelope && typeof envelope === "object" && typeof envelope.text === "string") {
    return envelope.text;
  }

  return trimmed;
}

function parseMaybeJson(text) {
  const trimmed = (text || "").trim();
  if (!trimmed) {
    return null;
  }

  const assembled = assembleAgentCoreTextFromStream(trimmed);
  if (assembled) {
    const fromAssembled = parseEmbeddedJsonObject(assembled);
    if (fromAssembled !== null) {
      return fromAssembled;
    }
  }

  return parseEmbeddedJsonObject(trimmed);
}

function requireParsedInterfaceResponse(raw, context) {
  const payload = parseMaybeJson(raw);
  if (!payload) {
    const preview = (raw || "").replace(/\s+/g, " ").trim().slice(0, 240);
    throw new McpError(
      ErrorCode.InternalError,
      `${context}: response was not valid JSON. Preview: ${preview}`
    );
  }
  return payload;
}

function asTextResult(value) {
  if (typeof value === "string") {
    return { content: [{ type: "text", text: value }] };
  }
  return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }] };
}

function requireString(value, fieldName) {
  if (typeof value !== "string" || !value.trim()) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `\`${fieldName}\` must be a non-empty string.`
    );
  }
  return value.trim();
}

function requireAssetId(value, fieldName) {
  const assetId = requireString(value, fieldName);
  if (assetId.length > 128 || !ASSET_ID_REGEX.test(assetId)) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `\`${fieldName}\` must match ^[A-Za-z0-9._-]+$ and be <= 128 chars.`
    );
  }
  return assetId;
}

function assertSearchPayload(payload) {
  if (!payload || payload.status !== "ok" || !Array.isArray(payload.menuItems)) {
    throw new McpError(
      ErrorCode.InternalError,
      "Search payload did not match expected contract."
    );
  }
  const first = payload.menuItems[0];
  if (!first || typeof first.assetId !== "string" || !first.assetId) {
    throw new McpError(
      ErrorCode.InternalError,
      "Search payload missing first menu item assetId."
    );
  }
  return first.assetId;
}

function assertSkillRoutingPayload(payload) {
  if (!payload || payload.status !== "ok" || !Array.isArray(payload.skills)) {
    throw new McpError(
      ErrorCode.InternalError,
      "Skill routing payload did not match expected contract."
    );
  }
}

// Find the first skill whose command contains any of the given keywords (in priority order).
function pickSkillCommand(skills, keywords) {
  for (const keyword of keywords) {
    const match = skills.find(
      (s) => s && typeof s === "object" && typeof s.command === "string" && s.command.includes(keyword)
    );
    if (match) return match.command;
  }
  return null;
}

function assertQcPayload(payload) {
  if (!payload || payload.status !== "ok" || typeof payload.result !== "object") {
    throw new McpError(
      ErrorCode.InternalError,
      "QC payload did not match expected contract."
    );
  }
  const result = payload.result || {};
  const required = ["overall", "summary", "assetId", "assetUrl", "findings"];
  for (const key of required) {
    if (!(key in result)) {
      throw new McpError(
        ErrorCode.InternalError,
        `QC payload missing result.${key}.`
      );
    }
  }
}

async function probeInvocation(explicitAuthToken) {
  let url;
  try {
    url = getInvocationUrl();
  } catch (err) {
    return {
      configured: false,
      invocationUrl: null,
      reachable: false,
      statusCode: null,
      responsePreview:
        err instanceof Error ? err.message : "Missing invocation URL",
    };
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: await buildHeaders(explicitAuthToken, false),
      body: JSON.stringify({ prompt: "healthcheck" }),
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    });
    const text = await response.text();
    return {
      configured: true,
      invocationUrl: url,
      reachable: true,
      statusCode: response.status,
      responsePreview: text.slice(0, 300),
    };
  } catch (err) {
    return {
      configured: true,
      invocationUrl: url,
      reachable: false,
      statusCode: null,
      responsePreview: err instanceof Error ? err.message : String(err),
    };
  }
}

const tools = [
  {
    name: "flo_auth_login",
    description:
      "Start OAuth login (browser PKCE flow), cache token locally, and return auth status. If prompted by hosted login UI, first sign in via appLoginUrl.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "flo_auth_status",
    description: "Show current auth mode and cached OAuth token status.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "flo_auth_setup_help",
    description:
      "Show where to find/configure FLO_OAUTH_CLIENT_ID and expected Cognito app client details.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "flo_auth_logout",
    description: "Clear cached OAuth token from local disk.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "flo_analyze",
    description:
      "Analyze any asset (image or video). Automatically routes to the correct analysis skill for the asset type via skill routing — no need to call skill routing first.",
    inputSchema: {
      type: "object",
      properties: {
        assetId: {
          type: "string",
          minLength: 1,
          maxLength: 128,
          pattern: "^[A-Za-z0-9._-]+$",
        },
        authToken: {
          type: "string",
          description: "Optional bearer token override for this call only.",
        },
      },
      required: ["assetId"],
      additionalProperties: false,
    },
  },
  {
    name: "flo_search",
    description:
      "Run /flo:search against interface-agent and return plugin menu items.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", minLength: 1 },
        authToken: {
          type: "string",
          description: "Optional bearer token override for this call only.",
        },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "flo_query",
    description:
      "Run /flo:query against interface-agent and return filename-first candidates plus follow-up commands.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", minLength: 1 },
        authToken: {
          type: "string",
          description: "Optional bearer token override for this call only.",
        },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "flo_skill_routing",
    description:
      "List available actions for an asset (what can I do with this file?).",
    inputSchema: {
      type: "object",
      properties: {
        assetId: {
          type: "string",
          minLength: 1,
          maxLength: 128,
          pattern: "^[A-Za-z0-9._-]+$",
        },
        authToken: {
          type: "string",
          description: "Optional bearer token override for this call only.",
        },
      },
      required: ["assetId"],
      additionalProperties: false,
    },
  },
  {
    name: "flo_qc_logo",
    description:
      "Run /flo:qc-logo using stored-image reference mode for the Claude plugin happy path.",
    inputSchema: {
      type: "object",
      properties: {
        assetId: { type: "string", minLength: 1 },
        referenceAssetId: { type: "string", minLength: 1 },
        includePdf: {
          type: "boolean",
          default: false,
          description: "Whether to include PDF output in qc result.",
        },
        authToken: {
          type: "string",
          description: "Optional bearer token override for this call only.",
        },
      },
      required: ["assetId", "referenceAssetId"],
      additionalProperties: false,
    },
  },
  {
    name: "flo_command",
    description:
      "Run a raw /flo:* slash command against interface-agent for troubleshooting.",
    inputSchema: {
      type: "object",
      properties: {
        command: { type: "string", minLength: 1 },
        authToken: {
          type: "string",
          description: "Optional bearer token override for this call only.",
        },
      },
      required: ["command"],
      additionalProperties: false,
    },
  },
  {
    name: "flo_plugin_healthcheck",
    description:
      "Check config/auth/runtime reachability for the Flo Claude Co-Work plugin.",
    inputSchema: {
      type: "object",
      properties: {
        authToken: {
          type: "string",
          description: "Optional bearer token override for this healthcheck.",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "flo_happy_path_run",
    description:
      "Run search -> skill routing -> qc logo in one tool call for end-to-end validation.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          default: "hail mary",
          description: "Search query used when assetId is not provided.",
        },
        assetId: {
          type: "string",
          description: "Optional preselected asset ID; skips search when set.",
        },
        referenceAssetId: {
          type: "string",
          minLength: 1,
          description: "Stored image asset ID used as logo reference.",
        },
        includePdf: {
          type: "boolean",
          default: false,
          description: "Whether to include PDF output in qc result.",
        },
        authToken: {
          type: "string",
          description: "Optional bearer token override for this run.",
        },
      },
      required: ["referenceAssetId"],
      additionalProperties: false,
    },
  },
];

await mergeMcpEnvFromUserConfig();

const server = new Server(
  {
    name: "flo-claude-plugin-mcp",
    version: PACKAGE_VERSION,
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const name = request.params.name;
  const args = request.params.arguments || {};

  if (name === "flo_auth_login") {
    const token = await runInteractiveOAuthLogin();
    return asTextResult({
      status: "ok",
      mode: "oauth",
      expiresAt: token.expires_at,
      cachePath: getTokenCachePath(),
    });
  }

  if (name === "flo_auth_status") {
    const oauth = getOAuthConfig(false);
    const envToken = Boolean(getDefaultAuthToken());
    const cachedToken = await readCachedToken();
    return asTextResult({
      oauthConfigured: oauth.ready,
      oauthClientIdConfigured: Boolean(oauth.clientId),
      oauthClientId: oauth.clientId || null,
      oauthExpectedClientName: oauth.expectedClientName,
      oauthUserPoolName: oauth.userPoolName,
      oauthUserPoolId: oauth.userPoolId || null,
      oauthSettingsUrl: oauth.settingsUrl,
      appLoginUrl: oauth.appLoginUrl,
      envTokenConfigured: envToken,
      cachePath: getTokenCachePath(),
      cachedTokenPresent: Boolean(cachedToken?.access_token),
      cachedTokenUsable: tokenIsUsable(cachedToken),
      cachedTokenExpiresAt: cachedToken?.expires_at || null,
    });
  }

  if (name === "flo_auth_setup_help") {
    const oauth = getOAuthConfig(false);
    return asTextResult({
      status: "ok",
      pluginEnv: normalizedPluginEnv(),
      runtimeInvocationUrl: getInvocationUrl(),
      oauthAuthorizeUrl: oauth.authorizeUrl || null,
      oauthTokenUrl: oauth.tokenUrl || null,
      oauthClientIdConfigured: Boolean(oauth.clientId),
      oauthClientId: oauth.clientId || null,
      oauthExpectedClientName: oauth.expectedClientName,
      oauthUserPoolName: oauth.userPoolName,
      oauthUserPoolId: oauth.userPoolId || null,
      oauthSettingsUrl: oauth.settingsUrl,
      appLoginUrl: oauth.appLoginUrl,
      message:
        "If hosted login UI appears, sign in at appLoginUrl first, then run flo_auth_login again. Open oauthSettingsUrl to copy client id for oauthExpectedClientName into FLO_OAUTH_CLIENT_ID.",
    });
  }

  if (name === "flo_analyze") {
    const assetId = requireAssetId(args.assetId, "assetId");

    // Discover the right analysis command for this asset type via skill routing.
    const skillRaw = await invokeInterfaceAgent(`/flo:skill-routing ${assetId}`, args.authToken);
    const skillPayload = parseMaybeJson(skillRaw);
    const skills = skillPayload?.skills ?? [];
    // Priority: dedicated analyze skill → summarize (for video) → qc → fallback
    const analyzeCommand =
      pickSkillCommand(skills, ["analyze", "summarize", "qc"]) ?? "/flo:analyze-image";

    const bodyText = await invokeInterfaceAgent(`${analyzeCommand} ${assetId}`, args.authToken);
    return asTextResult(parseMaybeJson(bodyText) || bodyText);
  }

  if (name === "flo_auth_logout") {
    await clearCachedToken();
    return asTextResult({
      status: "ok",
      message: "OAuth token cache cleared.",
      cachePath: getTokenCachePath(),
    });
  }

  if (name === "flo_search") {
    const query = requireString(args.query, "query");
    const prompt = `/flo:search ${query}`;
    const bodyText = await invokeInterfaceAgent(prompt, args.authToken);
    return asTextResult(parseMaybeJson(bodyText) || bodyText);
  }

  if (name === "flo_query") {
    const query = requireString(args.query, "query");
    const prompt = `/flo:query ${query}`;
    const bodyText = await invokeInterfaceAgent(prompt, args.authToken);
    return asTextResult(parseMaybeJson(bodyText) || bodyText);
  }

  if (name === "flo_skill_routing") {
    const assetId = requireAssetId(args.assetId, "assetId");
    const prompt = `/flo:skill-routing ${assetId}`;
    const bodyText = await invokeInterfaceAgent(prompt, args.authToken);
    return asTextResult(parseMaybeJson(bodyText) || bodyText);
  }

  if (name === "flo_qc_logo") {
    const assetId = requireString(args.assetId, "assetId");
    const referenceAssetId = requireString(args.referenceAssetId, "referenceAssetId");
    if (args.includePdf !== undefined && typeof args.includePdf !== "boolean") {
      throw new McpError(
        ErrorCode.InvalidParams,
        "`includePdf` must be a boolean when provided."
      );
    }
    const payload = {
      assetId,
      reference: {
        source: "stored_image",
        referenceAssetId,
      },
      options: {
        includePdf: Boolean(args.includePdf),
      },
    };
    const prompt = `/flo:qc-logo ${JSON.stringify(payload)}`;
    const bodyText = await invokeInterfaceAgent(prompt, args.authToken);
    return asTextResult(parseMaybeJson(bodyText) || bodyText);
  }

  if (name === "flo_command") {
    const command = requireString(args.command, "command");
    const bodyText = await invokeInterfaceAgent(command, args.authToken);
    return asTextResult(parseMaybeJson(bodyText) || bodyText);
  }

  if (name === "flo_plugin_healthcheck") {
    const oauth = getOAuthConfig(false);
    const envToken = Boolean(getDefaultAuthToken());
    const cachedToken = await readCachedToken();
    const probe = await probeInvocation(args.authToken);
    return asTextResult({
      status: "ok",
      mcpPackageVersion: PACKAGE_VERSION,
      auth: {
        oauthConfigured: oauth.ready,
        envTokenConfigured: envToken,
        cachePath: getTokenCachePath(),
        cachedTokenPresent: Boolean(cachedToken?.access_token),
        cachedTokenUsable: tokenIsUsable(cachedToken),
        cachedTokenExpiresAt: cachedToken?.expires_at || null,
      },
      runtime: probe,
    });
  }

  if (name === "flo_happy_path_run") {
    const referenceAssetId = requireString(args.referenceAssetId, "referenceAssetId");
    if (args.includePdf !== undefined && typeof args.includePdf !== "boolean") {
      throw new McpError(
        ErrorCode.InvalidParams,
        "`includePdf` must be a boolean when provided."
      );
    }

    let selectedAssetId =
      typeof args.assetId === "string" && args.assetId.trim()
        ? args.assetId.trim()
        : "";
    const query = typeof args.query === "string" && args.query.trim() ? args.query.trim() : "hail mary";
    const steps = [];

    if (!selectedAssetId) {
      const searchPrompt = `/flo:search ${query}`;
      const searchRaw = await invokeInterfaceAgent(searchPrompt, args.authToken);
      const searchPayload = requireParsedInterfaceResponse(
        searchRaw,
        "Search response during happy-path run"
      );
      selectedAssetId = assertSearchPayload(searchPayload);
      steps.push({
        name: "search",
        query,
        selectedAssetId,
        response: searchPayload,
      });
    }

    const skillPrompt = `/flo:skill-routing ${selectedAssetId}`;
    const skillRaw = await invokeInterfaceAgent(skillPrompt, args.authToken);
    const skillPayload = requireParsedInterfaceResponse(
      skillRaw,
      "Skill-routing response during happy-path run"
    );
    assertSkillRoutingPayload(skillPayload);
    const qcCommand = pickSkillCommand(skillPayload.skills ?? [], ["qc-logo", "qc"]) ?? "/flo:qc-logo";
    steps.push({
      name: "skill_routing",
      response: skillPayload,
    });

    const qcCommandPayload = {
      assetId: selectedAssetId,
      reference: {
        source: "stored_image",
        referenceAssetId,
      },
      options: {
        includePdf: Boolean(args.includePdf),
      },
    };
    const qcPrompt = `${qcCommand} ${JSON.stringify(qcCommandPayload)}`;
    const qcRaw = await invokeInterfaceAgent(qcPrompt, args.authToken);
    const qcPayload = requireParsedInterfaceResponse(
      qcRaw,
      "QC response during happy-path run"
    );
    assertQcPayload(qcPayload);
    steps.push({
      name: "qc_logo",
      response: qcPayload,
    });

    return asTextResult({
      status: "ok",
      selectedAssetId,
      steps,
    });
  }

  throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
});

const transport = new StdioServerTransport();
await server.connect(transport);
