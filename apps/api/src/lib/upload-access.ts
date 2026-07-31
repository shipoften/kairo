import { createHmac, timingSafeEqual } from "node:crypto";
import { API_PREFIX } from "@xs-share/shared";
import type { AppConfig } from "../config";

const DEFAULT_ACCESS_TTL_SECONDS = 7 * 24 * 60 * 60;

export function signUploadAccessToken(input: {
  uploadId: string;
  expiresAt: number;
  secret: string;
}) {
  return createHmac("sha256", input.secret)
    .update(`${input.uploadId}:${input.expiresAt}`)
    .digest("hex");
}

export function createUploadAccessUrl(
  config: AppConfig,
  uploadId: string,
  expiresInSeconds = DEFAULT_ACCESS_TTL_SECONDS,
) {
  const expiresAt = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const token = signUploadAccessToken({
    uploadId,
    expiresAt,
    secret: config.SESSION_SECRET,
  });
  const base = config.OAUTH_CALLBACK_BASE_URL.replace(/\/$/, "");
  const query = new URLSearchParams({
    expires: String(expiresAt),
    token,
  });
  return `${base}${API_PREFIX}/uploads/${uploadId}/file?${query.toString()}`;
}

export function verifyUploadAccessToken(input: {
  uploadId: string;
  expiresAt: number;
  token: string;
  secret: string;
}) {
  if (!Number.isInteger(input.expiresAt) || input.expiresAt <= 0) return false;
  if (input.expiresAt < Math.floor(Date.now() / 1000)) return false;
  if (!/^[a-f0-9]{64}$/i.test(input.token)) return false;

  const expected = signUploadAccessToken({
    uploadId: input.uploadId,
    expiresAt: input.expiresAt,
    secret: input.secret,
  });
  const left = Buffer.from(expected, "utf8");
  const right = Buffer.from(input.token, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
