import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const version = JSON.parse(
  readFileSync(path.join(root, "package.json"), "utf8")
).version;

function writeJson(relPath, data) {
  writeFileSync(
    path.join(root, relPath),
    `${JSON.stringify(data, null, 2)}\n`,
    "utf8"
  );
}

for (const relPath of [".claude-plugin/plugin.json", "plugin.json"]) {
  const data = JSON.parse(readFileSync(path.join(root, relPath), "utf8"));
  data.version = version;
  writeJson(relPath, data);
}

const marketplace = JSON.parse(
  readFileSync(path.join(root, ".claude-plugin/marketplace.json"), "utf8")
);
marketplace.version = version;
if (marketplace.plugins?.[0]) {
  marketplace.plugins[0].version = version;
}
writeJson(".claude-plugin/marketplace.json", marketplace);

console.log(`Synced plugin metadata to ${version}`);
