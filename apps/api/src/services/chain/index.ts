import { createHash } from "node:crypto";
import {
  Chain,
  isValidErc20Address,
  isValidTrc20Address,
  parseChain,
} from "@xs-share/shared";
import { EvmChainAdapter } from "./evm";
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
export {
  EvmChainAdapter,
  deriveEthAddressFromXpub,
  ETH_DEPOSIT_XPUB_PATH,
} from "./evm";

const mockIncomingByAddress = new Map<string, IncomingUsdtTransfer[]>();
const mockConfirmations = new Map<string, number>();

const BASE58_ALPHABET =
  "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function mockTrc20Address(userId: string, derivationIndex: number): string {
  const digest = createHash("sha256")
    .update(`${userId}:${derivationIndex}:trc20`)
    .digest();
  let address = "T";
  for (let index = 0; index < 33; index += 1) {
    address +=
      BASE58_ALPHABET[digest[index % digest.length]! % BASE58_ALPHABET.length];
  }
  return address;
}

function mockErc20Address(userId: string, derivationIndex: number): string {
  const digest = createHash("sha256")
    .update(`${userId}:${derivationIndex}:erc20`)
    .digest("hex");
  return `0x${digest.slice(0, 40)}`;
}

export class MockChainAdapter implements ChainAdapter {
  readonly name = "mock";
  readonly chain: Chain;

  constructor(chain: Chain = Chain.TRC20) {
    this.chain = chain;
  }

  async allocateAddress(userId: string, derivationIndex: number) {
    if (this.chain === Chain.ERC20) {
      return mockErc20Address(userId, derivationIndex);
    }
    return mockTrc20Address(userId, derivationIndex);
  }

  isValidAddress(address: string) {
    if (this.chain === Chain.ERC20) {
      return isValidErc20Address(address);
    }
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

const cached = new Map<Chain, ChainAdapter>();

function adapterMode(env: NodeJS.ProcessEnv = process.env): "mock" | "live" {
  const mode = (env.CHAIN_ADAPTER ?? "mock").toLowerCase();
  return mode === "mock" ? "mock" : "live";
}

function createLiveAdapter(chain: Chain): ChainAdapter {
  if (chain === Chain.ERC20) {
    return new EvmChainAdapter();
  }
  return new TronChainAdapter();
}

export function getChainAdapter(chain: Chain | string = DEFAULT_CHAIN): ChainAdapter {
  const resolved = parseChain(typeof chain === "string" ? chain : chain);
  const existing = cached.get(resolved);
  if (existing) return existing;

  const adapter =
    adapterMode() === "mock"
      ? new MockChainAdapter(resolved)
      : createLiveAdapter(resolved);
  cached.set(resolved, adapter);
  return adapter;
}

export function listEnabledChains(env: NodeJS.ProcessEnv = process.env): Chain[] {
  if (adapterMode(env) === "mock") {
    return [Chain.TRC20, Chain.ERC20];
  }
  const enabled: Chain[] = [];
  if (env.TRON_DEPOSIT_XPUB?.trim()) {
    enabled.push(Chain.TRC20);
  }
  if (env.ETH_DEPOSIT_XPUB?.trim() && env.ETH_RPC_URL?.trim()) {
    enabled.push(Chain.ERC20);
  }
  if (enabled.length === 0) {
    // Live mode without xpubs still exposes TRC20 for address validation paths
    // that construct adapters lazily; deposit allocation will fail with clear errors.
    enabled.push(Chain.TRC20);
  }
  return enabled;
}

export function isChainEnabled(
  chain: Chain,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return listEnabledChains(env).includes(chain);
}

export function resetChainAdapterForTests() {
  cached.clear();
  mockIncomingByAddress.clear();
  mockConfirmations.clear();
}

export function getMockChainAdapter(
  chain: Chain = Chain.TRC20,
): MockChainAdapter {
  const adapter = getChainAdapter(chain);
  if (!(adapter instanceof MockChainAdapter)) {
    throw new Error("Expected MockChainAdapter");
  }
  return adapter;
}

export const DEFAULT_CHAIN = Chain.TRC20;
