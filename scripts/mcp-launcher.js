import { access, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const DEFAULT_MCP_ENV_FILE = path.join(
  os.homedir(),
  ".flo",
  "claude-plugin-mcp.env"
);

/** Plugin root from CLAUDE_PLUGIN_ROOT or this file's parent directory. */
export function resolvePluginRoot() {
  const fromEnv = process.env.CLAUDE_PLUGIN_ROOT?.trim();
  if (fromEnv) {
    return path.resolve(fromEnv);
  }
  const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(scriptsDir, "..");
}

/** Load KEY=VALUE lines without overriding existing process.env entries. */
export async function loadLocalEnvFile(filePath) {
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
      if (key && process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  } catch {
    // optional local overrides
  }
}

export async function loadBootstrapEnv(pluginRoot) {
  const envFile = (process.env.FLO_MCP_ENV_FILE || DEFAULT_MCP_ENV_FILE).trim();
  if (envFile) {
    await loadLocalEnvFile(envFile);
  }
  process.env.CLAUDE_PLUGIN_ROOT = pluginRoot;
}

export async function ensureMcpDependencies(pluginRoot) {
  const sdkMarker = path.join(
    pluginRoot,
    "node_modules",
    "@modelcontextprotocol",
    "sdk",
    "package.json"
  );
  try {
    await access(sdkMarker);
    return;
  } catch {
    // first marketplace install — dependencies not yet installed
  }

  const lockPath = path.join(pluginRoot, "package-lock.json");
  let useCi = false;
  try {
    await access(lockPath);
    useCi = true;
  } catch {
    // no lockfile
  }

  const args = useCi
    ? ["ci", "--omit=dev", "--no-audit", "--no-fund"]
    : ["install", "--omit=dev", "--no-audit", "--no-fund"];

  const result = spawnSync("npm", args, {
    cwd: pluginRoot,
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.error) {
    console.error(`Failed to run npm: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

export async function startMcpServer(pluginRoot = resolvePluginRoot()) {
  const root = path.resolve(pluginRoot);
  await loadBootstrapEnv(root);
  process.chdir(root);
  await ensureMcpDependencies(root);
  await import(pathToFileURL(path.join(root, "src", "index.js")).href);
}
