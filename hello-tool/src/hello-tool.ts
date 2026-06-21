import { Type } from "@sinclair/typebox";
import type { OpenClawPluginApi } from "../runtime-api.js";

/**
 * Minimal example tool. Returns a greeting for the provided name.
 *
 * Tool-schema note: prefer plain string fields and string enums; some model
 * providers reject `anyOf`/`oneOf`/unions in tool input schemas.
 */
export function createHelloTool(api: OpenClawPluginApi) {
  // `api.pluginConfig` holds this plugin's own config, validated against
  // `configSchema` in openclaw.plugin.json. (`api.config` is the full gateway config.)
  const config = (api.pluginConfig ?? {}) as { greeting?: string };
  const greeting =
    typeof config.greeting === "string" && config.greeting.trim()
      ? config.greeting.trim()
      : "Hello";

  return {
    name: "hello",
    label: "Hello",
    description: "Return a friendly greeting for a given name.",
    parameters: Type.Object({
      name: Type.String({ description: "Name to greet." }),
    }),
    async execute(_id: string, params: Record<string, unknown>) {
      const name = typeof params.name === "string" ? params.name.trim() : "";
      if (!name) {
        throw new Error("name required");
      }

      const message = `${greeting}, ${name}!`;
      api.logger?.debug?.(`hello-tool: ${message}`);

      return {
        content: [{ type: "text", text: message }],
        details: { greeting, name, message },
      };
    },
  };
}
