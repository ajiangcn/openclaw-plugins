import { Type } from "@sinclair/typebox";
import type { OpenClawPluginApi } from "../../runtime-api.js";
import { getValidTokens, type XConfig } from "../auth.js";
import { getUserTweets, resolveUser } from "../x-client.js";

export function createUserTweetsTool(api: OpenClawPluginApi) {
  const config = (api.pluginConfig ?? {}) as unknown as XConfig;

  return {
    name: "x_user_tweets",
    label: "X User Tweets",
    description:
      "Fetch recent tweets from a specific X (Twitter) account by @username. " +
      "Excludes retweets and replies so you see only original posts.",
    parameters: Type.Object({
      username: Type.String({ description: "X username without the @ symbol, e.g. \"sama\"." }),
      count: Type.Optional(
        Type.Number({ description: "Number of tweets to return (1–100, default 20).", minimum: 1, maximum: 100 }),
      ),
    }),
    async execute(_id: string, params: Record<string, unknown>) {
      const username = typeof params.username === "string" ? params.username.replace(/^@/, "").trim() : "";
      if (!username) throw new Error("username is required");

      const tokens = await getValidTokens(config);
      const user = await resolveUser(tokens.accessToken, username);
      const count = typeof params.count === "number" ? params.count : 20;
      const tweets = await getUserTweets(tokens.accessToken, user.id, count);

      if (tweets.length === 0) {
        return {
          content: [{ type: "text", text: `No recent tweets found for @${username}.` }],
          details: { user, tweets: [] },
        };
      }

      const lines = tweets.map((t) => {
        const when = t.created_at ? ` [${t.created_at}]` : "";
        const metrics = t.public_metrics
          ? ` | ♥${t.public_metrics.like_count} RT${t.public_metrics.retweet_count}`
          : "";
        return `${when}${metrics}\n${t.text}\nhttps://x.com/i/web/status/${t.id}`;
      });

      api.logger?.debug?.(`x-twitter: fetched ${tweets.length} tweets for @${username}`);

      return {
        content: [{ type: "text", text: `@${user.username} (${user.name})\n\n${lines.join("\n\n---\n\n")}` }],
        details: { count: tweets.length, user, tweets },
      };
    },
  };
}
