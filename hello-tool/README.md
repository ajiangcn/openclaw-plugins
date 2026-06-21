# hello-tool

Example OpenClaw plugin. Registers a single agent tool, `hello`, that returns a
greeting for a given name. Use it as a starting template for new plugins.

## Layout

```
hello-tool/
  openclaw.plugin.json   # manifest: id, name, configSchema, uiHints
  package.json           # name/id aligned, runtime deps in "dependencies"
  index.ts               # plugin entry (registers capabilities)
  runtime-api.ts         # local barrel re-exporting openclaw/plugin-sdk
  src/hello-tool.ts      # tool implementation
  tsconfig.json
```

## Config

```json5
{
  plugins: {
    entries: {
      "hello-tool": {
        enabled: true,
        config: { greeting: "Hi" }, // optional, defaults to "Hello"
      },
    },
  },
}
```

## Install (development)

```bash
openclaw plugins install --link ./hello-tool
openclaw plugins enable hello-tool
openclaw plugins inspect hello-tool
```

Restart the gateway to load it, then ask the agent to use the `hello` tool.
