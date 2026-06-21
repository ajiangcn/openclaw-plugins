const BASE = "https://api.twitter.com/2";

export interface XUser {
  id: string;
  name: string;
  username: string;
  description?: string;
  public_metrics?: { followers_count: number; following_count: number; tweet_count: number };
}

export interface XTweet {
  id: string;
  text: string;
  created_at?: string;
  author_id?: string;
  author?: XUser;
  public_metrics?: { like_count: number; retweet_count: number; reply_count: number; impression_count: number };
}

interface XApiResponse<T> {
  data?: T;
  errors?: Array<{ message: string }>;
  meta?: { result_count: number; next_token?: string };
  includes?: { users?: XUser[] };
}

async function xFetch<T>(path: string, accessToken: string, params?: Record<string, string>): Promise<XApiResponse<T>> {
  const url = new URL(`${BASE}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`X API error (${res.status}): ${text}`);
  }
  return res.json() as Promise<XApiResponse<T>>;
}

export async function getMe(accessToken: string): Promise<XUser> {
  const res = await xFetch<XUser>("/users/me", accessToken, {
    "user.fields": "id,name,username,description,public_metrics",
  });
  if (!res.data) throw new Error("Could not fetch authenticated user");
  return res.data;
}

export async function getFollowing(accessToken: string, userId: string, maxResults = 100): Promise<XUser[]> {
  const res = await xFetch<XUser[]>(`/users/${userId}/following`, accessToken, {
    max_results: String(Math.min(maxResults, 1000)),
    "user.fields": "id,name,username,description,public_metrics",
  });
  return res.data ?? [];
}

export async function getHomeTimeline(accessToken: string, userId: string, maxResults = 20): Promise<XTweet[]> {
  const res = await xFetch<XTweet[]>(`/users/${userId}/timelines/reverse_chronological`, accessToken, {
    max_results: String(Math.min(Math.max(maxResults, 1), 100)),
    "tweet.fields": "id,text,created_at,author_id,public_metrics",
    "user.fields": "id,name,username",
    expansions: "author_id",
  });
  if (!res.data) return [];
  const usersById = new Map<string, XUser>(res.includes?.users?.map((u) => [u.id, u]) ?? []);
  return res.data.map((t) => ({ ...t, author: t.author_id ? usersById.get(t.author_id) : undefined }));
}

export async function getUserTweets(accessToken: string, userId: string, maxResults = 20): Promise<XTweet[]> {
  const res = await xFetch<XTweet[]>(`/users/${userId}/tweets`, accessToken, {
    max_results: String(Math.min(Math.max(maxResults, 1), 100)),
    "tweet.fields": "id,text,created_at,author_id,public_metrics",
    exclude: "retweets,replies",
  });
  return res.data ?? [];
}

export async function resolveUser(accessToken: string, username: string): Promise<XUser> {
  const res = await xFetch<XUser>(`/users/by/username/${encodeURIComponent(username)}`, accessToken, {
    "user.fields": "id,name,username,description,public_metrics",
  });
  if (!res.data) throw new Error(`User @${username} not found`);
  return res.data;
}
