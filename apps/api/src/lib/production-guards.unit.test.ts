import { describe, expect, test } from "bun:test";
import { assertProductionGuards } from "./production-guards";
import type { AppConfig } from "../config";

function baseConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/xs_share",
    API_PORT: 5181,
    WEB_ORIGIN: "http://localhost:5180",
    SESSION_SECRET: "change-me-to-a-long-random-string",
    AUTH_DEV_LOGIN: false,
    COOKIE_SECURE: true,
    NODE_ENV: "production",
    OAUTH_CALLBACK_BASE_URL: "http://localhost:5181",
    CHAIN_ADAPTER: "tron",
    S3_REGION: "us-east-1",
    S3_ENDPOINT: "https://s3.example.com",
    S3_BUCKET: "kairo-uploads",
    S3_ACCESS_KEY_ID: "key",
    S3_SECRET_ACCESS_KEY: "secret",
    S3_PUBLIC_BASE_URL: "https://cdn.example.com",
    TELEGRAM_BOT_TOKEN: "bot-token",
    SMTP_HOST: "smtp.example.com",
    SMTP_PORT: 587,
    SMTP_SECURE: false,
    SMTP_FROM: "noreply@example.com",
    isProduction: true,
    allowDevLogin: false,
    ...overrides,
  };
}

describe("production guards", () => {
  test("accepts complete production config", () => {
    expect(() => assertProductionGuards(baseConfig())).not.toThrow();
  });

  test("rejects mock chain in production", () => {
    expect(() =>
      assertProductionGuards(baseConfig({ CHAIN_ADAPTER: "mock" })),
    ).toThrow(/CHAIN_ADAPTER=mock/);
  });

  test("rejects missing smtp in production", () => {
    expect(() =>
      assertProductionGuards(
        baseConfig({
          SMTP_HOST: undefined,
          SMTP_FROM: undefined,
        }),
      ),
    ).toThrow(/SMTP/);
  });
});
