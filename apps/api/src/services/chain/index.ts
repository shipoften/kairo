import { createHash } from "node:crypto";
import {
  Chain,
  DEFAULT_TRON_USDT_CONTRACT,
  isValidTrc20Address,
} from "@xs-share/shared";
import { TronChainAdapter } from "./tron";
import type { ChainAdapter, IncomingUsdtTransfer } from "./types";

export type { ChainAdapter, IncomingUsdtTransfer } from "./types";
export {
  TronChainAdapter,
  deriveTronAddressFromXpub,
  parseUsdtTokenAmount,
  tronAddressFromPublicKey,
  TRON_DEPOSIT_XPUB_PATH,
} from "./tron";

const mockIncomingByAddress = new Map<string, IncomingUsdtTransfer[]>();
const mockConfirmations = new Map<string, number>();

const BASE58_ALPHABET =
  "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function mockAddressFor(userId: string, derivationIndex: number): string {
  const digest = createHash("sha256")
    .update(`${userId}:${derivationIndex}:trc20`)
    .digest();
  let address = "T";
  for (let index = 0; index < 33; index += 1) {
    address += BASE58_ALPHABET[digest[index % digest.length]! % BASE58_ALPHABET.length];
  }
  return address;
}

export class MockChainAdapter implements ChainAdapter {
  readonly name = "mock";

  async allocateAddress(userId: string, derivationIndex: number) {
    return mockAddressFor(userId, derivationIndex);
  }

  isValidAddress(address: string) {
    return isValidTrc20Address(address);
  }

  async getConfirmations(txHash: string) {
    return mockConfirmations.get(txHash) ?? 0;
  }

  async listIncomingUsdt(address: string, since?: Date) {
    const items = mockIncomingByAddress.get(address) ?? [];
    if (!since) return [...items];
    return items.filter((item) => item.blockTimestamp >= since);
  }

  async getIncomingUsdtByTxHash(txHash: string, toAddress: string) {
    const items = mockIncomingByAddress.get(toAddress) ?? [];
    return items.find((item) => item.txHash === txHash) ?? null;
  }

  injectIncoming(transfer: IncomingUsdtTransfer) {
    const list = mockIncomingByAddress.get(transfer.toAddress) ?? [];
    const existing = list.findIndex((item) => item.txHash === transfer.txHash);
    if (existing >= 0) {
      list[existing] = transfer;
    } else {
      list.push(transfer);
    }
    mockIncomingByAddress.set(transfer.toAddress, list);
    mockConfirmations.set(transfer.txHash, transfer.confirmations);
  }

  setConfirmations(txHash: string, confirmations: number) {
    mockConfirmations.set(txHash, confirmations);
    for (const [, list] of mockIncomingByAddress) {
      for (const item of list) {
        if (item.txHash === txHash) {
          item.confirmations = confirmations;
        }
      }
    }
  }
}

let cached: ChainAdapter | null = null;

export function getChainAdapter(): ChainAdapter {
  if (cached) return cached;
  const mode = (process.env.CHAIN_ADAPTER ?? "mock").toLowerCase();
  if (mode === "tron") {
    cached = new TronChainAdapter();
  } else {
    cached = new MockChainAdapter();
  }
  return cached;
}

export function resetChainAdapterForTests() {
  cached = null;
  mockIncomingByAddress.clear();
  mockConfirmations.clear();
}

export function getMockChainAdapter(): MockChainAdapter {
  const adapter = getChainAdapter();
  if (!(adapter instanceof MockChainAdapter)) {
    throw new Error("Expected MockChainAdapter");
  }
  return adapter;
}

export const DEFAULT_CHAIN = Chain.TRC20;
