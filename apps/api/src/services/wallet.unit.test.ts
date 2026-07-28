import { describe, expect, test } from "bun:test";
import {
  MIN_DEPOSIT_MICROS,
  MIN_WITHDRAW_MICROS,
  WITHDRAW_NETWORK_FEE_MICROS,
  formatUsdt,
  fromMicros,
  toMicros,
} from "@xs-share/shared";
import { MockChainAdapter } from "../services/chain";
import { bpsAmount } from "../services/config";

describe("usdt money helpers", () => {
  test("toMicros and fromMicros round trip", () => {
    expect(toMicros(10)).toBe(10_000_000);
    expect(fromMicros(10_000_000)).toBe(10);
    expect(formatUsdt(1_500_000)).toBe("1.50");
  });

  test("default wallet thresholds", () => {
    expect(MIN_DEPOSIT_MICROS).toBe(10_000_000);
    expect(MIN_WITHDRAW_MICROS).toBe(20_000_000);
    expect(WITHDRAW_NETWORK_FEE_MICROS).toBe(1_000_000);
    expect(MIN_WITHDRAW_MICROS).toBeGreaterThan(WITHDRAW_NETWORK_FEE_MICROS);
  });

  test("bpsAmount on micros", () => {
    expect(bpsAmount(1_000_000, 1000)).toBe(100_000);
    expect(bpsAmount(1_000_000, 0)).toBe(0);
  });
});

describe("mock chain adapter", () => {
  test("allocates valid TRC20-shaped address", async () => {
    const adapter = new MockChainAdapter();
    const address = await adapter.allocateAddress("user-1", 0);
    expect(adapter.isValidAddress(address)).toBe(true);
    expect(address.startsWith("T")).toBe(true);
  });

  test("rejects invalid address", () => {
    const adapter = new MockChainAdapter();
    expect(adapter.isValidAddress("not-an-address")).toBe(false);
    expect(adapter.isValidAddress("T0invalid")).toBe(false);
  });

  test("inject and list incoming transfers", async () => {
    const adapter = new MockChainAdapter();
    const address = await adapter.allocateAddress("user-2", 1);
    adapter.injectIncoming({
      txHash: "tx1",
      fromAddress: address,
      toAddress: address,
      amountMicros: 10_000_000,
      confirmations: 20,
      blockTimestamp: new Date(),
    });
    const list = await adapter.listIncomingUsdt(address);
    expect(list).toHaveLength(1);
    expect(await adapter.getConfirmations("tx1")).toBe(20);
  });
});
