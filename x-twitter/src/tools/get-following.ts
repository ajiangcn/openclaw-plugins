import { Type } from "@sinclair/typebox";
import type { OpenClawPluginApi } from "../../runtime-api.js";
import { getValidTokens, type XConfig } from "../auth.js";
import { getFollowing, getMe } from "../x-client.js";

export function createGetFollowingTool(api: OpenClawPluginApi) {
  const config = (api.pluginConfig ?? {}) as unknown as XConfig;

  return {
    name: "x_get_following",
    label: "X Get Following",
    description: "List the accounts you follow on X (Twitter), with follower counts and bios.",
    parameters: Type.Object({
      count: Type.Optional(
        Type.Number({ description: "Max number of accounts to return (1–1000, default 100).", minimum: 1, maximum: 1000 }),
      ),
    }),
    async execute(_id: string, params: Record<string, unknown>) {
      const tokens = await getValidTokens(config);
      const me = await getMe(tokens.accessToken);
      const count = typeof params.count === "number" ? params.count : 100;
      const users = await getFollowing(tokens.accessToken, me.id, count);

      if (users.length === 0) {
        return { content: [{ type: "text", text: "You are not following anyone." }], details: { users: [] } };
      }

      const lines = users.map((u) => {
        const metrics = u.public_metrics
          ? ` | followers: ${u.public_metrics.followers_count}, tweets: ${u.public_metrics.tweet_count}`
          : "";
        const bio = u.description ? `\n  ${u.description}` : "";
        return `@${u.username} (${u.name})${metrics}${bio}`;
      });

      api.logger?.debug?.(`x-twitter: fetched ${users.length} following for @${me.username}`);

      return {
        content: [{ type: "text", text: lines.join("\n\n") }],
        details: { count: users.length, authenticatedAs: me.username, users },
      };
    },
  };
}
