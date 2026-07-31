import { describe, expect, test } from "bun:test";
import { parseUsdtTokenAmount } from "./tron";

describe("evm usdt amount parsing", () => {
  test("parses 6-decimal token amounts", () => {
    expect(parseUsdtTokenAmount("10000000", 6)).toBe(10_000_000);
    expect(parseUsdtTokenAmount("0", 6)).toBe(null);
    expect(parseUsdtTokenAmount("abc", 6)).toBe(null);
  });
});
