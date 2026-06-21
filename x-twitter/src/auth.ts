import * as crypto from "node:crypto";
import * as fs from "node:fs/promises";
import * as http from "node:http";
import * as os from "node:os";
import * as path from "node:path";

const TOKEN_FILE = path.join(os.homedir(), ".openclaw", "x-twitter-tokens.json");
const AUTH_URL = "https://twitter.com/i/oauth2/authorize";
const TOKEN_URL = "https://api.twitter.com/2/oauth2/token";
const SCOPES = "tweet.read users.read follows.read offline.access";

export interface XTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export interface XConfig {
  clientId: string;
  clientSecret?: string;
  callbackPort?: number;
}

function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString("base64url");
}

function generateCodeChallenge(verifier: string): string {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}

export async function loadTokens(): Promise<XTokens | null> {
  try {
    const raw = await fs.readFile(TOKEN_FILE, "utf8");
    return JSON.parse(raw) as XTokens;
  } catch {
    return null;
  }
}

export async function saveTokens(tokens: XTokens): Promise<void> {
  await fs.writeFile(TOKEN_FILE, JSON.stringify(tokens, null, 2), { mode: 0o600 });
}

export async function refreshTokens(config: XConfig, tokens: XTokens): Promise<XTokens> {
  if (!config.clientSecret) {
    throw new Error("clientSecret is required in plugin config to refresh tokens");
  }
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: tokens.refreshToken,
    client_id: config.clientId,
  });
  const credentials = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64");
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token refresh failed (${res.status}): ${text}`);
  }
  const data = (await res.json()) as { access_token: string; refresh_token?: string; expires_in: number };
  const refreshed: XTokens = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? tokens.refreshToken,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  await saveTokens(refreshed);
  return refreshed;
}

export async function getValidTokens(config: XConfig): Promise<XTokens> {
  let tokens = await loadTokens();
  if (!tokens) throw new Error("Not authenticated. Run the x_auth tool first.");
  if (Date.now() > tokens.expiresAt - 60_000) {
    tokens = await refreshTokens(config, tokens);
  }
  return tokens;
}

export function buildAuthUrl(config: XConfig): { authUrl: string; verifier: string; state: string } {
  const port = config.callbackPort ?? 47832;
  const redirectUri = `http://localhost:${port}/callback`;
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  const state = crypto.randomBytes(16).toString("hex");
  const params = new URLSearchParams({
    response_type: "code",
    client_id: config.clientId,
    redirect_uri: redirectUri,
    scope: SCOPES,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });
  return { authUrl: `${AUTH_URL}?${params.toString()}`, verifier: codeVerifier, state };
}

export function waitForCallback(port: number, expectedState: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      if (!req.url?.startsWith("/callback")) { res.writeHead(404).end(); return; }
      const url = new URL(req.url, `http://localhost:${port}`);
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      const error = url.searchParams.get("error");

      res.writeHead(200, { "Content-Type": "text/html" });
      if (error || !code || state !== expectedState) {
        res.end("<h2>Authorization failed — you can close this tab.</h2>");
        server.close();
        reject(new Error(error ?? "missing code or state mismatch"));
        return;
      }
      res.end("<h2>Authorization successful — you can close this tab and return to OpenClaw.</h2>");
      server.close();
      resolve(code);
    });
    server.on("error", reject);
    server.listen(port, "127.0.0.1");
  });
}

export async function exchangeCodeForTokens(
  config: XConfig,
  code: string,
  verifier: string,
): Promise<XTokens> {
  const port = config.callbackPort ?? 47832;
  const redirectUri = `http://localhost:${port}/callback`;

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: config.clientId,
    code_verifier: verifier,
  });
  const headers: Record<string, string> = { "Content-Type": "application/x-www-form-urlencoded" };
  if (config.clientSecret) {
    headers["Authorization"] = `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")}`;
  }
  const res = await fetch(TOKEN_URL, { method: "POST", headers, body: body.toString() });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed (${res.status}): ${text}`);
  }
  const data = (await res.json()) as { access_token: string; refresh_token?: string; expires_in: number };
  const tokens: XTokens = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? "",
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  await saveTokens(tokens);
  return tokens;
}
