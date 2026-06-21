import { Type } from "@sinclair/typebox";
import type { OpenClawPluginApi } from "../../runtime-api.js";
import { buildAuthUrl, exchangeCodeForTokens, loadTokens, waitForCallback, type XConfig } from "../auth.js";

export function createAuthTool(api: OpenClawPluginApi) {
  const config = (api.pluginConfig ?? {}) as unknown as XConfig;

  return {
    name: "x_auth",
    label: "X Auth",
    description:
      "Start the X (Twitter) OAuth 2.0 PKCE flow. Returns a URL for the user to open in their browser. " +
      "After they authorize, tokens are saved automatically via a local callback server. " +
      "Run this once; tokens are refreshed automatically on subsequent tool calls.",
    parameters: Type.Object({}),
    async execute(_id: string, _params: Record<string, unknown>) {
      const existing = await loadTokens();
      if (existing && Date.now() < existing.expiresAt - 60_000) {
        return {
          content: [{ type: "text", text: "Already authenticated. Tokens are valid — no need to re-auth." }],
          details: { status: "already_authenticated", expiresAt: new Date(existing.expiresAt).toISOString() },
        };
      }

      if (!config.clientId) {
        throw new Error(
          "Missing clientId in plugin config. Add X_CLIENT_ID (OAuth 2.0 Client ID) to ~/.openclaw/.env",
        );
      }

      const port = config.callbackPort ?? 47832;
      const { authUrl, verifier, state } = buildAuthUrl(config);

      api.logger?.info?.(`x-twitter: OAuth 2.0 PKCE flow started, waiting for callback on port ${port}`);

      // Start listening before surfacing the URL so we don't miss the redirect
      const codePromise = waitForCallback(port, state);

      codePromise
        .then((code) => exchangeCodeForTokens(config, code, verifier))
        .then(() => api.logger?.info?.("x-twitter: tokens saved successfully"))
        .catch((e) => api.logger?.error?.(`x-twitter: OAuth failed: ${e instanceof Error ? e.message : String(e)}`));

      return {
        content: [
          {
            type: "text",
            text:
              `Open the following URL in your browser to authorize X access:\n\n${authUrl}\n\n` +
              `After you approve, the page will say "Authorization successful" and tokens will be saved automatically.`,
          },
        ],
        details: { authUrl, callbackPort: port },
      };
    },
  };
}
