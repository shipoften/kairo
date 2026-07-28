import { createHash, createHmac, randomBytes } from "node:crypto";

export type OAuthStatePayload = {
  provider: string;
  nonce: string;
  locale: string;
  inviteCode?: string;
  bindUserId?: string;
  codeVerifier?: string;
  returnTo?: string;
};

function sign(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function encodeOAuthState(payload: OAuthStatePayload, secret: string) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = sign(body, secret);
  return `${body}.${signature}`;
}

export function decodeOAuthState(
  state: string,
  secret: string,
): OAuthStatePayload | null {
  const [body, signature] = state.split(".");
  if (!body || !signature) return null;
  const expected = sign(body, secret);
  if (signature !== expected) return null;
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as OAuthStatePayload;
  } catch {
    return null;
  }
}

export function createCodeVerifier() {
  return randomBytes(32).toString("base64url");
}

export function createCodeChallenge(verifier: string) {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function sanitizeReturnTo(path: string | undefined): string | undefined {
  if (!path) return undefined;
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("://")) {
    return undefined;
  }
  return path;
}
