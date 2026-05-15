import os from "node:os";
import path from "node:path";
import { readFile, writeFile } from "node:fs/promises";

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

async function main() {
  const configPath = process.env.CLAUDE_DESKTOP_CONFIG_PATH || defaultDesktopConfigPath();
  let raw;
  try {
    raw = await readFile(configPath, "utf8");
  } catch {
    console.log(`No Claude config found at ${configPath}; nothing to uninstall.`);
    return;
  }

  const config = JSON.parse(raw);
  if (!config.mcpServers || !config.mcpServers[SERVER_KEY]) {
    console.log(`"${SERVER_KEY}" not present in ${configPath}; nothing to uninstall.`);
    return;
  }

  delete config.mcpServers[SERVER_KEY];
  await writeFile(configPath, JSON.stringify(config, null, 2) + "\n", "utf8");
  console.log(`Removed "${SERVER_KEY}" from ${configPath}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
