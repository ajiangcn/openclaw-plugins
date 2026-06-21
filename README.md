# openclaw-plugins

Personal monorepo of custom [OpenClaw](https://github.com/openclaw/openclaw) plugins.

Each top-level directory is a self-contained plugin package that follows the
OpenClaw plugin conventions:

- a `openclaw.plugin.json` manifest with an inline `configSchema`
- a `package.json` whose name, plugin id, and npm spec stay aligned
- runtime dependencies declared in `dependencies` (installed with `npm install --omit=dev`)
- `openclaw` kept in `devDependencies` only (the gateway provides
  `openclaw/plugin-sdk/*` at runtime via its jiti alias)
- imports routed through a local `runtime-api.ts` barrel, never into core `src/**`

## Plugins

| Plugin | Id | Description |
|--------|----|-------------|
| [hello-tool](./hello-tool) | `hello-tool` | Example plugin that registers a simple agent tool. |
| [x-twitter](./x-twitter) | `x-twitter` | OAuth 2.0 PKCE auth + following-timeline reader for X (Twitter). |
| [redfin](./redfin) | `redfin` | Redfin for-sale listings + daily new-listings digest for saved searches. |

## Develop

```bash
npm install             # install dev tooling + per-plugin deps (npm workspaces)
npm run typecheck       # type-check every plugin
```

## Install into a running gateway

During development, link a plugin in place (no copy) so edits are picked up:

```bash
openclaw plugins install --link ./hello-tool
openclaw plugins list
openclaw plugins enable hello-tool      # if it starts disabled
openclaw plugins inspect hello-tool
```

Restart the gateway after installing (and after each rebuild) so it loads the
new code. Installing a plugin runs its code — only install paths you trust, and
keep secrets as `${ENV_VAR}` placeholders resolved from `~/.openclaw/.env`.

For a snapshot copy instead of a live link, drop `--link`:

```bash
openclaw plugins install ./hello-tool
```

## Add a new plugin

Copy `hello-tool/` to a new directory, then update:

1. `openclaw.plugin.json` → `id`, `name`, `description`
2. `package.json` → `name` (`@ajiangcn/<id>`), keep `openclaw.extensions` pointing at `./index.ts`
3. `index.ts` → register your tools/commands/providers
4. add the new directory to `workspaces` in the root `package.json`
5. add a row to the table above

Keep the plugin id identical across `openclaw.plugin.json:id` and the package name suffix.
