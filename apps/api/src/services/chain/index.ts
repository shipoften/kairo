import { createHash } from "node:crypto";
import { Chain } from "@xs-share/shared";

export type IncomingUsdtTransfer = {
  txHash: string;
  fromAddress: string;
  toAddress: string;
  amountMicros: number;
  confirmations: number;
  blockTimestamp: Date;
};

export type ChainAdapter = {
  readonly name: string;
  allocateAddress(userId: string, derivationIndex: number): Promise<string>;
  isValidAddress(address: string): boolean;
  getConfirmations(txHash: string): Promise<number>;
  listIncomingUsdt(
    address: string,
    since?: Date,
  ): Promise<IncomingUsdtTransfer[]>;
  /** Mock/dev only: inject a transfer for testing. */
  injectIncoming?(transfer: IncomingUsdtTransfer): void;
};

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
    return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address);
  }

  async getConfirmations(txHash: string) {
    return mockConfirmations.get(txHash) ?? 0;
  }

  async listIncomingUsdt(address: string, since?: Date) {
    const items = mockIncomingByAddress.get(address) ?? [];
    if (!since) return [...items];
    return items.filter((item) => item.blockTimestamp >= since);
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

export class UnimplementedTronAdapter implements ChainAdapter {
  readonly name = "tron";

  async allocateAddress(): Promise<string> {
    throw new Error("Tron adapter not implemented; set CHAIN_ADAPTER=mock");
  }

  isValidAddress(address: string) {
    return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address);
  }

  async getConfirmations(): Promise<number> {
    throw new Error("Tron adapter not implemented");
  }

  async listIncomingUsdt(): Promise<IncomingUsdtTransfer[]> {
    throw new Error("Tron adapter not implemented");
  }
}

let cached: ChainAdapter | null = null;

export function getChainAdapter(): ChainAdapter {
  if (cached) return cached;
  const mode = (process.env.CHAIN_ADAPTER ?? "mock").toLowerCase();
  if (mode === "tron") {
    cached = new UnimplementedTronAdapter();
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
