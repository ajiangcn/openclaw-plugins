import { Type } from "@sinclair/typebox";
import type { OpenClawPluginApi } from "../../runtime-api.js";
import { getValidTokens, type XConfig } from "../auth.js";
import { getHomeTimeline, getMe } from "../x-client.js";

export function createFollowingTimelineTool(api: OpenClawPluginApi) {
  const config = (api.pluginConfig ?? {}) as unknown as XConfig;

  return {
    name: "x_following_timeline",
    label: "X Following Timeline",
    description:
      "Fetch the reverse-chronological home timeline — recent posts from accounts you follow on X (Twitter). " +
      "Requires user-context OAuth (run x_auth first).",
    parameters: Type.Object({
      count: Type.Optional(
        Type.Number({ description: "Number of tweets to return (1–100, default 20).", minimum: 1, maximum: 100 }),
      ),
    }),
    async execute(_id: string, params: Record<string, unknown>) {
      const tokens = await getValidTokens(config);
      const me = await getMe(tokens.accessToken);
      const count = typeof params.count === "number" ? params.count : 20;
      const tweets = await getHomeTimeline(tokens.accessToken, me.id, count);

      if (tweets.length === 0) {
        return { content: [{ type: "text", text: "No tweets found in your home timeline." }], details: { tweets: [] } };
      }

      const lines = tweets.map((t) => {
        const author = t.author ? `@${t.author.username} (${t.author.name})` : `user:${t.author_id}`;
        const when = t.created_at ? ` [${t.created_at}]` : "";
        const metrics = t.public_metrics
          ? ` | ♥${t.public_metrics.like_count} RT${t.public_metrics.retweet_count}`
          : "";
        return `${author}${when}${metrics}\n${t.text}\nhttps://x.com/i/web/status/${t.id}`;
      });

      api.logger?.debug?.(`x-twitter: fetched ${tweets.length} timeline tweets for @${me.username}`);

      return {
        content: [{ type: "text", text: lines.join("\n\n---\n\n") }],
        details: { count: tweets.length, authenticatedAs: me.username, tweets },
      };
    },
  };
}
