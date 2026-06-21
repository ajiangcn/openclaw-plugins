import { definePluginEntry, type AnyAgentTool, type OpenClawPluginApi } from "./runtime-api.js";
import { createAuthTool } from "./src/tools/auth.js";
import { createFollowingTimelineTool } from "./src/tools/following-timeline.js";
import { createGetFollowingTool } from "./src/tools/get-following.js";
import { createUserTweetsTool } from "./src/tools/user-tweets.js";

export default definePluginEntry({
  id: "x-twitter",
  name: "X Twitter",
  description: "OAuth 2.0 PKCE auth + following timeline reader for X (Twitter).",
  register(api: OpenClawPluginApi) {
    api.registerTool(createAuthTool(api) as AnyAgentTool, { optional: true });
    api.registerTool(createFollowingTimelineTool(api) as AnyAgentTool, { optional: true });
    api.registerTool(createGetFollowingTool(api) as AnyAgentTool, { optional: true });
    api.registerTool(createUserTweetsTool(api) as AnyAgentTool, { optional: true });
  },
});
