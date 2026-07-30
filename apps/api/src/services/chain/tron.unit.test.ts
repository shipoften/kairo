import { describe, expect, test } from "bun:test";
import { HDKey } from "@scure/bip32";
import { generateMnemonic, mnemonicToSeedSync } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import { getPublicKey } from "@noble/secp256k1";
import { isValidTrc20Address } from "@xs-share/shared";
import {
  deriveTronAddressFromXpub,
  parseUsdtTokenAmount,
  tronAddressFromPublicKey,
  TRON_DEPOSIT_XPUB_PATH,
} from "./tron";

function depositXpubFromMnemonic(mnemonic: string): string {
  const seed = mnemonicToSeedSync(mnemonic);
  const root = HDKey.fromMasterSeed(seed);
  const account = root.derive(TRON_DEPOSIT_XPUB_PATH);
  if (!account.publicExtendedKey) {
    throw new Error("Missing public extended key");
  }
  return account.publicExtendedKey;
}

function tronAddressFromMnemonic(mnemonic: string, derivationIndex: number) {
  const seed = mnemonicToSeedSync(mnemonic);
  const root = HDKey.fromMasterSeed(seed);
  const child = root.derive(`m/44'/195'/0'/0/${derivationIndex}`);
  if (!child.privateKey) throw new Error("Missing private key");
  return tronAddressFromPublicKey(getPublicKey(child.privateKey, false));
}

describe("tron chain helpers", () => {
  test("parseUsdtTokenAmount handles 6 decimals as micro-USDT", () => {
    expect(parseUsdtTokenAmount("10000000", 6)).toBe(10_000_000);
    expect(parseUsdtTokenAmount("0", 6)).toBeNull();
    expect(parseUsdtTokenAmount("abc", 6)).toBeNull();
  });

  test("parseUsdtTokenAmount scales other decimals", () => {
    expect(parseUsdtTokenAmount("1000000000000000000", 18)).toBe(1_000_000);
    expect(parseUsdtTokenAmount("10", 0)).toBe(10_000_000);
  });

  test("deriveTronAddressFromXpub matches mnemonic-derived addresses", () => {
    const mnemonic = generateMnemonic(wordlist);
    const xpub = depositXpubFromMnemonic(mnemonic);
    const first = deriveTronAddressFromXpub(xpub, 0);
    const again = deriveTronAddressFromXpub(xpub, 0);
    const second = deriveTronAddressFromXpub(xpub, 1);
    expect(first).toBe(again);
    expect(first).toBe(tronAddressFromMnemonic(mnemonic, 0));
    expect(second).toBe(tronAddressFromMnemonic(mnemonic, 1));
    expect(first).not.toBe(second);
    expect(isValidTrc20Address(first)).toBe(true);
    expect(isValidTrc20Address(second)).toBe(true);
  });
});
