# Contributing to flo-plugin

Thank you for contributing. This document covers the two main contribution
tracks: **MCP server changes** and **Claude Code plugin additions**.

## Getting started

```bash
git clone https://github.com/Flomenco-Inc/flo-plugin.git
cd flo-plugin
npm install
```

Test the server starts cleanly:

```bash
node src/index.js
# Should hang waiting for MCP stdio — that's correct. Ctrl-C to exit.
```

## Adding a new MCP tool

All tools live in `src/index.js`. The pattern is:

1. **Declare the tool** — add an entry to the `tools` array:

```js
{
  name: "flo_my_tool",
  description: "One-sentence description for Claude to select this tool.",
  inputSchema: {
    type: "object",
    properties: {
      myParam: { type: "string", minLength: 1 },
    },
    required: ["myParam"],
    additionalProperties: false,
  },
},
```

2. **Handle the tool** — add a block in the `CallToolRequestSchema` handler:

```js
if (name === "flo_my_tool") {
  const myParam = requireString(args.myParam, "myParam");
  const bodyText = await invokeInterfaceAgent(`/flo:my-command ${myParam}`, args.authToken);
  return asTextResult(parseMaybeJson(bodyText) || bodyText);
}
```

3. **Don't add external npm dependencies** without discussion — this is
   installed via `npx` and startup latency matters.

## Adding Claude Code plugin content

The Claude Code plugin layer (skills, slash commands, marketplace manifest)
lives alongside the MCP server in this repo. If you're adding it:

**Suggested structure:**

```
flo-plugin/
├── .claude-plugin/
│   └── plugin.json          # plugin manifest (name, version, description)
├── marketplace.json         # marketplace catalog
├── skills/
│   └── <skill-name>/
│       └── SKILL.md
└── commands/
    └── <command-name>.md
```

**`plugin.json` minimum:**

```json
{
  "name": "flo-plugin",
  "description": "Connect Claude to the Flo AI media platform",
  "version": "1.0.0"
}
```

**`marketplace.json` minimum:**

```json
{
  "name": "flo-plugins",
  "owner": { "name": "Flomenco, Inc." },
  "plugins": [
    {
      "name": "flo-plugin",
      "source": { "source": "github", "repo": "Flomenco-Inc/flo-plugin" },
      "description": "Connect Claude to the Flo AI media platform"
    }
  ]
}
```

See the [Claude Code plugin docs](https://code.claude.com/docs/en/plugins) for
the full schema.

## Versioning and publishing

We use [Conventional Commits](https://www.conventionalcommits.org/):
- `feat:` → minor version bump
- `fix:` → patch version bump
- `chore:` → patch or no bump

To publish a new version:

1. Bump `version` in `package.json`
2. Commit: `chore: bump to vX.Y.Z`
3. Tag: `git tag vX.Y.Z && git push origin vX.Y.Z`
4. GitHub Actions publishes to npm automatically

Do **not** run `npm publish` manually — use the tag workflow so provenance
attestation is included.

## Security

This is a **public repo**. Never commit:

- API keys, tokens, or secrets of any kind
- Private infrastructure URLs (anything not under `*.floapp.co`)
- AWS account IDs or ARNs
- Personal employee information

The Cognito domain URLs and OAuth client/pool names in the defaults are
intentionally public (they appear in any JWT `iss` claim from the service).

## Questions

Open an issue or reach out in the internal Slack `#platform-ai` channel.
