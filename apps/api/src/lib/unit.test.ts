import { describe, expect, test } from "bun:test";
import { AppError } from "./errors";
import { ErrorCode } from "@xs-share/shared";
import { checkRateLimit, clearRateLimits } from "./rate-limit";
import { bpsAmount } from "../services/config";
import { hashToken, createInviteCode } from "./crypto";

describe("errors", () => {
  test("AppError serializes api body", () => {
    const error = new AppError(ErrorCode.UNAUTHORIZED, "Unauthorized", 401);
    expect(error.toBody()).toEqual({
      code: "UNAUTHORIZED",
      message: "Unauthorized",
      messageKey: "errors.unauthorized",
    });
  });
});

describe("rate limit", () => {
  test("blocks after limit", () => {
    clearRateLimits();
    expect(checkRateLimit("t1", 2, 60_000).ok).toBe(true);
    expect(checkRateLimit("t1", 2, 60_000).ok).toBe(true);
    expect(checkRateLimit("t1", 2, 60_000).ok).toBe(false);
  });
});

describe("crypto and fees", () => {
  test("hash is stable", () => {
    expect(hashToken("abc", "secret")).toBe(hashToken("abc", "secret"));
    expect(hashToken("abc", "secret")).not.toBe(hashToken("abc", "other"));
  });

  test("invite code length", () => {
    expect(createInviteCode().length).toBe(10);
  });

  test("bpsAmount floors", () => {
    expect(bpsAmount(1000, 500)).toBe(50);
    expect(bpsAmount(999, 1000)).toBe(99);
  });
});
