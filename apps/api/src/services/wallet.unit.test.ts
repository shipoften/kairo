import { describe, expect, test } from "bun:test";
import {
  Chain,
  MIN_DEPOSIT_MICROS,
  MIN_WITHDRAW_MICROS,
  WITHDRAW_NETWORK_FEE_MICROS,
  formatUsdt,
  fromMicros,
  getExplorerTxUrl,
  isValidErc20Address,
  isValidTrc20Address,
  parseChain,
  toMicros,
} from "@xs-share/shared";
import { MockChainAdapter, resetChainAdapterForTests } from "../services/chain";
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

describe("chain helpers", () => {
  test("parseChain defaults to trc20", () => {
    expect(parseChain(undefined)).toBe(Chain.TRC20);
    expect(parseChain("erc20")).toBe(Chain.ERC20);
  });

  test("address validators", () => {
    expect(
      isValidTrc20Address("TJRabPrwbZy45sbavfcjinPJC18kjpRTv8"),
    ).toBe(true);
    expect(
      isValidErc20Address("0x0000000000000000000000000000000000000001"),
    ).toBe(true);
    expect(isValidErc20Address("TMock")).toBe(false);
  });

  test("explorer urls", () => {
    expect(getExplorerTxUrl(Chain.TRC20, "abc")).toContain("tronscan");
    expect(getExplorerTxUrl(Chain.ERC20, "0xabc")).toContain("etherscan");
    expect(getExplorerTxUrl(Chain.ERC20, "0xabc", "testnet")).toContain(
      "sepolia",
    );
  });
});

describe("mock chain adapter", () => {
  test("allocates valid TRC20-shaped address", async () => {
    resetChainAdapterForTests();
    const adapter = new MockChainAdapter(Chain.TRC20);
    const address = await adapter.allocateAddress("user-1", 0);
    expect(adapter.isValidAddress(address)).toBe(true);
    expect(address.startsWith("T")).toBe(true);
    expect(adapter.chain).toBe(Chain.TRC20);
  });

  test("allocates valid ERC20-shaped address", async () => {
    const adapter = new MockChainAdapter(Chain.ERC20);
    const address = await adapter.allocateAddress("user-1", 0);
    expect(adapter.isValidAddress(address)).toBe(true);
    expect(address.startsWith("0x")).toBe(true);
    expect(adapter.chain).toBe(Chain.ERC20);
  });

  test("rejects invalid address", () => {
    const adapter = new MockChainAdapter(Chain.TRC20);
    expect(adapter.isValidAddress("not-an-address")).toBe(false);
    expect(adapter.isValidAddress("T0invalid")).toBe(false);
  });

  test("inject and list incoming transfers", async () => {
    const adapter = new MockChainAdapter(Chain.TRC20);
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
