import { createHash, createHmac } from "node:crypto";
import type { AppConfig } from "../config";
import type { OAuthStatePayload } from "./oauth-state";

export type OAuthProfile = {
  providerUserId: string;
  displayName: string;
  avatarUrl?: string | null;
  email?: string | null;
};

function callbackUrl(config: AppConfig, provider: string) {
  const base = config.OAUTH_CALLBACK_BASE_URL.replace(/\/$/, "");
  return `${base}/v1/auth/${provider}/callback`;
}

export function buildGoogleAuthUrl(
  config: AppConfig,
  state: string,
) {
  const params = new URLSearchParams({
    client_id: config.GOOGLE_CLIENT_ID!,
    redirect_uri: callbackUrl(config, "google"),
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    prompt: "select_account",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export function buildXAuthUrl(
  config: AppConfig,
  state: string,
  codeChallenge: string,
) {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: config.X_CLIENT_ID!,
    redirect_uri: callbackUrl(config, "x"),
    scope: "tweet.read users.read offline.access",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });
  return `https://twitter.com/i/oauth2/authorize?${params}`;
}

export async function exchangeGoogleCode(
  config: AppConfig,
  code: string,
): Promise<OAuthProfile> {
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.GOOGLE_CLIENT_ID!,
      client_secret: config.GOOGLE_CLIENT_SECRET!,
      redirect_uri: callbackUrl(config, "google"),
      grant_type: "authorization_code",
    }),
  });
  if (!tokenResponse.ok) {
    throw new Error("Google token exchange failed");
  }
  const tokenData = (await tokenResponse.json()) as { access_token: string };
  const profileResponse = await fetch(
    "https://www.googleapis.com/oauth2/v2/userinfo",
    {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    },
  );
  if (!profileResponse.ok) {
    throw new Error("Google profile fetch failed");
  }
  const profile = (await profileResponse.json()) as {
    id: string;
    name?: string;
    email?: string;
    picture?: string;
  };
  return {
    providerUserId: profile.id,
    displayName: profile.name ?? profile.email ?? "Google user",
    avatarUrl: profile.picture ?? null,
    email: profile.email ?? null,
  };
}

export async function exchangeXCode(
  config: AppConfig,
  code: string,
  codeVerifier: string,
): Promise<OAuthProfile> {
  const basic = Buffer.from(
    `${config.X_CLIENT_ID!}:${config.X_CLIENT_SECRET!}`,
  ).toString("base64");
  const tokenResponse = await fetch("https://api.twitter.com/2/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basic}`,
    },
    body: new URLSearchParams({
      code,
      grant_type: "authorization_code",
      redirect_uri: callbackUrl(config, "x"),
      code_verifier: codeVerifier,
    }),
  });
  if (!tokenResponse.ok) {
    throw new Error("X token exchange failed");
  }
  const tokenData = (await tokenResponse.json()) as { access_token: string };
  const profileResponse = await fetch("https://api.twitter.com/2/users/me", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  if (!profileResponse.ok) {
    throw new Error("X profile fetch failed");
  }
  const profile = (await profileResponse.json()) as {
    data: { id: string; name: string; username: string; profile_image_url?: string };
  };
  return {
    providerUserId: profile.data.id,
    displayName: profile.data.name || profile.data.username,
    avatarUrl: profile.data.profile_image_url ?? null,
  };
}

export function verifyTelegramAuth(
  config: AppConfig,
  params: Record<string, string>,
): OAuthProfile | null {
  const hash = params.hash;
  if (!hash || !params.id) return null;

  const entries = Object.entries(params)
    .filter(([key]) => key !== "hash")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`);
  const dataCheckString = entries.join("\n");
  const secret = createHash("sha256")
    .update(config.TELEGRAM_BOT_TOKEN!)
    .digest();
  const computed = createHmac("sha256", secret)
    .update(dataCheckString)
    .digest("hex");
  if (computed !== hash) return null;

  const authDate = Number(params.auth_date);
  if (!authDate || Date.now() / 1000 - authDate > 86_400) {
    return null;
  }

  const displayName = [params.first_name, params.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  return {
    providerUserId: params.id,
    displayName: displayName || params.username || "Telegram user",
    avatarUrl: params.photo_url ?? null,
  };
}

export function providerConfigured(
  config: AppConfig,
  provider: string,
): boolean {
  if (provider === "google") {
    return Boolean(config.GOOGLE_CLIENT_ID && config.GOOGLE_CLIENT_SECRET);
  }
  if (provider === "x") {
    return Boolean(config.X_CLIENT_ID && config.X_CLIENT_SECRET);
  }
  if (provider === "telegram") {
    return Boolean(config.TELEGRAM_BOT_TOKEN);
  }
  return false;
}

export function webRedirectUrl(
  config: AppConfig,
  locale: string,
  path = "/tasks",
) {
  const base = config.WEB_ORIGIN.replace(/\/$/, "");
  return `${base}/${locale}${path}`;
}

export function webErrorRedirect(
  config: AppConfig,
  locale: string,
  error: string,
) {
  const base = config.WEB_ORIGIN.replace(/\/$/, "");
  return `${base}/${locale}/login?error=${encodeURIComponent(error)}`;
}

export type { OAuthStatePayload };
