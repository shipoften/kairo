import { describe, expect, test } from "bun:test";
import { loadConfig } from "../config";
import {
  createUploadAccessUrl,
  signUploadAccessToken,
  verifyUploadAccessToken,
} from "./upload-access";

describe("upload access tokens", () => {
  test("sign and verify upload access token", () => {
    const secret = "test-secret-with-enough-length";
    const uploadId = "00000000-0000-4000-8000-000000000001";
    const expiresAt = Math.floor(Date.now() / 1000) + 3600;
    const token = signUploadAccessToken({ uploadId, expiresAt, secret });
    expect(
      verifyUploadAccessToken({ uploadId, expiresAt, token, secret }),
    ).toBe(true);
    expect(
      verifyUploadAccessToken({
        uploadId,
        expiresAt,
        token: "a".repeat(64),
        secret,
      }),
    ).toBe(false);
    expect(
      verifyUploadAccessToken({
        uploadId,
        expiresAt: expiresAt - 7200,
        token,
        secret,
      }),
    ).toBe(false);
  });

  test("createUploadAccessUrl includes signed query", () => {
    const config = loadConfig({
      ...process.env,
      SESSION_SECRET: "test-secret-with-enough-length",
      OAUTH_CALLBACK_BASE_URL: "http://localhost:5181",
    });
    const url = createUploadAccessUrl(
      config,
      "00000000-0000-4000-8000-000000000001",
    );
    expect(url).toContain("/v1/uploads/00000000-0000-4000-8000-000000000001/file");
    expect(url).toContain("expires=");
    expect(url).toContain("token=");
  });
});
