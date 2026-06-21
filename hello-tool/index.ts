import { definePluginEntry, type AnyAgentTool, type OpenClawPluginApi } from "./runtime-api.js";
import { createHelloTool } from "./src/hello-tool.js";

export default definePluginEntry({
  id: "hello-tool",
  name: "Hello Tool",
  description: "Example plugin that registers a simple agent tool.",
  register(api: OpenClawPluginApi) {
    api.registerTool(createHelloTool(api) as AnyAgentTool, { optional: true });
  },
});
