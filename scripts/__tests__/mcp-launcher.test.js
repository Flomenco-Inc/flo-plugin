import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { loadLocalEnvFile, resolvePluginRoot } from "../mcp-launcher.js";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const pluginRoot = path.resolve(testDir, "..", "..");

describe("resolvePluginRoot", () => {
  const original = process.env.CLAUDE_PLUGIN_ROOT;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.CLAUDE_PLUGIN_ROOT;
    } else {
      process.env.CLAUDE_PLUGIN_ROOT = original;
    }
  });

  it("falls back to parent of scripts directory", () => {
    delete process.env.CLAUDE_PLUGIN_ROOT;
    assert.equal(resolvePluginRoot(), pluginRoot);
  });

  it("uses CLAUDE_PLUGIN_ROOT when set", () => {
    process.env.CLAUDE_PLUGIN_ROOT = pluginRoot;
    assert.equal(resolvePluginRoot(), pluginRoot);
  });
});

describe("loadLocalEnvFile", () => {
  it("loads values and does not override existing env", async () => {
    const filePath = path.join(os.tmpdir(), `flo-mcp-env-${Date.now()}.env`);
    const { writeFile, unlink } = await import("node:fs/promises");
    process.env.FLO_TEST_MCP_LAUNCHER = "existing";
    await writeFile(
      filePath,
      "FLO_TEST_MCP_LAUNCHER=from_file\nFLO_TEST_MCP_LAUNCHER_NEW=hello\n",
      "utf8"
    );
    await loadLocalEnvFile(filePath);
    assert.equal(process.env.FLO_TEST_MCP_LAUNCHER, "existing");
    assert.equal(process.env.FLO_TEST_MCP_LAUNCHER_NEW, "hello");
    delete process.env.FLO_TEST_MCP_LAUNCHER;
    delete process.env.FLO_TEST_MCP_LAUNCHER_NEW;
    await unlink(filePath);
  });
});
