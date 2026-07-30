import { describe, expect, test } from "bun:test";
import { usdtMicrosToTokenAmount, usdtToMicros } from "@xs-share/shared";

describe("usdt transfer helpers", () => {
  test("usdtToMicros converts display amount", () => {
    expect(usdtToMicros(10)).toBe(10_000_000);
    expect(usdtToMicros(0.5)).toBe(500_000);
  });

  test("usdtMicrosToTokenAmount stringifies micro units", () => {
    expect(usdtMicrosToTokenAmount(10_000_000)).toBe("10000000");
  });
});
