import { HDKey } from "@scure/bip32";
import { Point } from "@noble/secp256k1";
import { keccak_256 } from "@noble/hashes/sha3.js";
import {
  Chain,
  DEFAULT_ETH_USDT_CONTRACT,
  isValidErc20Address,
} from "@xs-share/shared";
import { parseUsdtTokenAmount } from "./tron";
import type { ChainAdapter, IncomingUsdtTransfer } from "./types";

/** External receive chain xpub: export at m/44'/60'/0'/0, then derive /{index}. */
export const ETH_DEPOSIT_XPUB_PATH = "m/44'/60'/0'/0";

const ERC20_TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

export type EvmAdapterOptions = {
  rpcUrl: string;
  usdtContract: string;
  depositXpub: string;
};

function toHexAddress(bytes: Uint8Array): string {
  return `0x${Buffer.from(bytes).toString("hex")}`;
}

export function ethAddressFromPublicKey(publicKey: Uint8Array): string {
  const uncompressed =
    publicKey.length === 65
      ? publicKey
      : Point.fromBytes(publicKey).toBytes(false);
  const hash = keccak_256(uncompressed.slice(1));
  return toHexAddress(hash.slice(-20));
}

export function deriveEthAddressFromXpub(
  xpub: string,
  derivationIndex: number,
): string {
  if (!Number.isInteger(derivationIndex) || derivationIndex < 0) {
    throw new Error("Invalid derivation index");
  }
  let account: HDKey;
  try {
    account = HDKey.fromExtendedKey(xpub.trim());
  } catch {
    throw new Error("Invalid ETH_DEPOSIT_XPUB");
  }
  if (account.privateKey) {
    throw new Error("ETH_DEPOSIT_XPUB must be a public extended key");
  }
  const child = account.deriveChild(derivationIndex);
  if (!child.publicKey) {
    throw new Error("Failed to derive deposit public key");
  }
  return ethAddressFromPublicKey(child.publicKey);
}

function loadEvmOptionsFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): EvmAdapterOptions {
  const depositXpub = env.ETH_DEPOSIT_XPUB?.trim();
  const rpcUrl = env.ETH_RPC_URL?.trim();
  if (!depositXpub) {
    throw new Error("ETH_DEPOSIT_XPUB is required for ERC20 deposits");
  }
  if (!rpcUrl) {
    throw new Error("ETH_RPC_URL is required for ERC20 deposits");
  }
  return {
    rpcUrl: rpcUrl.replace(/\/$/, ""),
    usdtContract: (
      env.ETH_USDT_CONTRACT?.trim() || DEFAULT_ETH_USDT_CONTRACT
    ).toLowerCase(),
    depositXpub,
  };
}

function normalizeAddress(address: string): string {
  return address.trim().toLowerCase();
}

function topicToAddress(topic: string): string {
  const hex = topic.startsWith("0x") ? topic.slice(2) : topic;
  return `0x${hex.slice(-40)}`.toLowerCase();
}

type RpcLog = {
  address?: string;
  topics?: string[];
  data?: string;
  transactionHash?: string;
  blockNumber?: string;
  blockTimestamp?: string;
};

export class EvmChainAdapter implements ChainAdapter {
  readonly name = "evm";
  readonly chain = Chain.ERC20;
  private readonly options: EvmAdapterOptions;

  constructor(options?: EvmAdapterOptions) {
    this.options = options ?? loadEvmOptionsFromEnv();
    deriveEthAddressFromXpub(this.options.depositXpub, 0);
  }

  async allocateAddress(_userId: string, derivationIndex: number) {
    return deriveEthAddressFromXpub(this.options.depositXpub, derivationIndex);
  }

  isValidAddress(address: string) {
    return isValidErc20Address(address);
  }

  async getConfirmations(txHash: string) {
    const receipt = await this.rpc<{ blockNumber?: string } | null>(
      "eth_getTransactionReceipt",
      [txHash],
    );
    if (!receipt?.blockNumber) return 0;
    const latestHex = await this.rpc<string>("eth_blockNumber", []);
    const txBlock = Number.parseInt(receipt.blockNumber, 16);
    const latest = Number.parseInt(latestHex, 16);
    if (!Number.isFinite(txBlock) || !Number.isFinite(latest)) return 0;
    return Math.max(0, latest - txBlock + 1);
  }

  async listIncomingUsdt(address: string, since?: Date) {
    const toAddress = normalizeAddress(address);
    const latestHex = await this.rpc<string>("eth_blockNumber", []);
    const latest = Number.parseInt(latestHex, 16);
    const fromBlock = Math.max(0, latest - 5_000);
    const logs = await this.rpc<RpcLog[]>("eth_getLogs", [
      {
        fromBlock: `0x${fromBlock.toString(16)}`,
        toBlock: "latest",
        address: this.options.usdtContract,
        topics: [
          ERC20_TRANSFER_TOPIC,
          null,
          `0x${toAddress.slice(2).padStart(64, "0")}`,
        ],
      },
    ]);

    const results: IncomingUsdtTransfer[] = [];
    for (const log of logs) {
      const transfer = await this.logToTransfer(log, toAddress);
      if (!transfer) continue;
      if (since && transfer.blockTimestamp < since) continue;
      results.push(transfer);
    }
    return results;
  }

  async getIncomingUsdtByTxHash(txHash: string, toAddress: string) {
    const normalizedTo = normalizeAddress(toAddress);
    const receipt = await this.rpc<{
      logs?: RpcLog[];
      blockNumber?: string;
    } | null>("eth_getTransactionReceipt", [txHash]);
    if (!receipt?.logs) return null;

    for (const log of receipt.logs) {
      const transfer = await this.logToTransfer(log, normalizedTo, txHash);
      if (transfer) return transfer;
    }
    return null;
  }

  private async logToTransfer(
    log: RpcLog,
    expectedTo: string,
    expectedTxHash?: string,
  ): Promise<IncomingUsdtTransfer | null> {
    if (!log.topics || log.topics.length < 3 || !log.data) return null;
    if (normalizeAddress(log.address ?? "") !== this.options.usdtContract) {
      return null;
    }
    if ((log.topics[0] ?? "").toLowerCase() !== ERC20_TRANSFER_TOPIC) {
      return null;
    }
    const txHash = log.transactionHash ?? expectedTxHash;
    if (!txHash) return null;
    if (expectedTxHash && txHash.toLowerCase() !== expectedTxHash.toLowerCase()) {
      return null;
    }

    const fromAddress = topicToAddress(log.topics[1]!);
    const toAddress = topicToAddress(log.topics[2]!);
    if (toAddress !== expectedTo) return null;

    const rawValue = BigInt(log.data);
    const amountMicros = parseUsdtTokenAmount(rawValue.toString(), 6);
    if (amountMicros == null) return null;

    let confirmations = 0;
    try {
      confirmations = await this.getConfirmations(txHash);
    } catch {
      confirmations = 0;
    }

    let blockTimestamp = new Date();
    if (log.blockNumber) {
      try {
        const block = await this.rpc<{ timestamp?: string } | null>(
          "eth_getBlockByNumber",
          [log.blockNumber, false],
        );
        if (block?.timestamp) {
          blockTimestamp = new Date(Number.parseInt(block.timestamp, 16) * 1000);
        }
      } catch {
        // keep now
      }
    }

    return {
      txHash,
      fromAddress,
      toAddress,
      amountMicros,
      confirmations,
      blockTimestamp,
    };
  }

  private async rpc<T>(method: string, params: unknown[]): Promise<T> {
    const response = await fetch(this.options.rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method,
        params,
      }),
    });
    if (!response.ok) {
      throw new Error(`ETH RPC ${method} failed: ${response.status}`);
    }
    const payload = (await response.json()) as {
      result?: T;
      error?: { message?: string };
    };
    if (payload.error) {
      throw new Error(payload.error.message ?? `ETH RPC ${method} error`);
    }
    return payload.result as T;
  }
}

// Re-export for callers that previously imported parse helpers via chain index
export { parseUsdtTokenAmount };
