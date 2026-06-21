// Local barrel for the public Plugin SDK surface. Production code in this
// package imports from here, never from openclaw core `src/**`.
export { definePluginEntry } from "openclaw/plugin-sdk/core";
export type {
  AnyAgentTool,
  OpenClawPluginApi,
  OpenClawPluginToolContext,
  OpenClawPluginToolFactory,
} from "openclaw/plugin-sdk/core";
