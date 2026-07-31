import { HDKey } from "@scure/bip32";
import { base58check } from "@scure/base";
import { Point } from "@noble/secp256k1";
import { keccak_256 } from "@noble/hashes/sha3.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { DEFAULT_TRON_USDT_CONTRACT, Chain, isValidTrc20Address } from "@xs-share/shared";
import type { ChainAdapter, IncomingUsdtTransfer } from "./types";

/** External receive chain xpub: export at m/44'/195'/0'/0, then derive /{index}. */
export const TRON_DEPOSIT_XPUB_PATH = "m/44'/195'/0'/0";
const DEFAULT_TRON_API_URL = "https://api.trongrid.io";

const b58c = base58check(sha256);

export type TronAdapterOptions = {
  apiUrl: string;
  apiKey?: string;
  usdtContract: string;
  depositXpub: string;
};

export function parseUsdtTokenAmount(
  value: string,
  decimals: number,
): number | null {
  if (!/^\d+$/.test(value) || decimals < 0 || decimals > 18) return null;
  if (decimals === 6) {
    const amount = Number(value);
    return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
  }
  if (decimals > 6) {
    const factor = 10 ** (decimals - 6);
    if (!Number.isInteger(factor)) return null;
    const raw = BigInt(value);
    if (raw % BigInt(factor) !== 0n) return null;
    const micros = Number(raw / BigInt(factor));
    return Number.isSafeInteger(micros) && micros > 0 ? micros : null;
  }
  const factor = 10 ** (6 - decimals);
  const micros = Number(BigInt(value) * BigInt(factor));
  return Number.isSafeInteger(micros) && micros > 0 ? micros : null;
}

export function tronAddressFromPublicKey(publicKey: Uint8Array): string {
  const uncompressed =
    publicKey.length === 65
      ? publicKey
      : Point.fromBytes(publicKey).toBytes(false);
  const hash = keccak_256(uncompressed.slice(1));
  const addressBytes = new Uint8Array(21);
  addressBytes[0] = 0x41;
  addressBytes.set(hash.slice(-20), 1);
  return b58c.encode(addressBytes);
}

export function deriveTronAddressFromXpub(
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
    throw new Error("Invalid TRON_DEPOSIT_XPUB");
  }
  if (account.privateKey) {
    throw new Error("TRON_DEPOSIT_XPUB must be a public extended key");
  }
  const child = account.deriveChild(derivationIndex);
  if (!child.publicKey) {
    throw new Error("Failed to derive deposit public key");
  }
  return tronAddressFromPublicKey(child.publicKey);
}

function loadTronOptionsFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): TronAdapterOptions {
  const depositXpub = env.TRON_DEPOSIT_XPUB?.trim();
  if (!depositXpub) {
    throw new Error("TRON_DEPOSIT_XPUB is required when CHAIN_ADAPTER=tron");
  }
  return {
    apiUrl: (env.TRON_API_URL?.trim() || DEFAULT_TRON_API_URL).replace(
      /\/$/,
      "",
    ),
    apiKey: env.TRON_API_KEY?.trim() || undefined,
    usdtContract: env.TRON_USDT_CONTRACT?.trim() || DEFAULT_TRON_USDT_CONTRACT,
    depositXpub,
  };
}

type TronGridTrc20Item = {
  transaction_id?: string;
  from?: string;
  to?: string;
  value?: string;
  block_timestamp?: number;
  token_info?: { decimals?: string | number; address?: string };
};

export class TronChainAdapter implements ChainAdapter {
  readonly name = "tron";
  readonly chain = Chain.TRC20;
  private readonly options: TronAdapterOptions;

  constructor(options?: TronAdapterOptions) {
    this.options = options ?? loadTronOptionsFromEnv();
    deriveTronAddressFromXpub(this.options.depositXpub, 0);
  }

  async allocateAddress(_userId: string, derivationIndex: number) {
    return deriveTronAddressFromXpub(
      this.options.depositXpub,
      derivationIndex,
    );
  }

  isValidAddress(address: string) {
    return isValidTrc20Address(address);
  }

  async getConfirmations(txHash: string) {
    const info = await this.postJson<{ blockNumber?: number }>(
      "/wallet/gettransactioninfobyid",
      { value: normalizeTxHash(txHash) },
    );
    if (typeof info.blockNumber !== "number") return 0;
    const now = await this.postJson<{
      block_header?: { raw_data?: { number?: number } };
    }>("/wallet/getnowblock", {});
    const current = now.block_header?.raw_data?.number;
    if (typeof current !== "number") return 0;
    return Math.max(0, current - info.blockNumber + 1);
  }

  async listIncomingUsdt(address: string, since?: Date) {
    const params = new URLSearchParams({
      only_to: "true",
      contract_address: this.options.usdtContract,
      limit: "200",
      order_by: "block_timestamp,desc",
    });
    const payload = await this.getJson<{ data?: TronGridTrc20Item[] }>(
      `/v1/accounts/${encodeURIComponent(address)}/transactions/trc20?${params}`,
    );
    const items = payload.data ?? [];
    const results: IncomingUsdtTransfer[] = [];

    for (const item of items) {
      if (!item.transaction_id || !item.to || !item.value) continue;
      if (item.to !== address) continue;
      const tokenAddress = item.token_info?.address;
      if (tokenAddress && tokenAddress !== this.options.usdtContract) continue;

      const decimals = Number(item.token_info?.decimals ?? 6);
      const amountMicros = parseUsdtTokenAmount(item.value, decimals);
      if (amountMicros == null) continue;

      const blockTimestamp = item.block_timestamp
        ? new Date(item.block_timestamp)
        : new Date(0);
      if (since && blockTimestamp < since) continue;

      let confirmations = 0;
      try {
        confirmations = await this.getConfirmations(item.transaction_id);
      } catch {
        confirmations = 0;
      }

      results.push({
        txHash: item.transaction_id,
        fromAddress: item.from ?? "",
        toAddress: item.to,
        amountMicros,
        confirmations,
        blockTimestamp,
      });
    }

    return results;
  }

  async getIncomingUsdtByTxHash(txHash: string, toAddress: string) {
    const incoming = await this.listIncomingUsdt(toAddress);
    const found = incoming.find((item) => item.txHash === txHash);
    if (found) return found;

    try {
      const payload = await this.getJson<{ data?: TronGridTrc20Item[] }>(
        `/v1/transactions/${encodeURIComponent(txHash)}/events`,
      );
      for (const item of payload.data ?? []) {
        if (item.transaction_id !== txHash || item.to !== toAddress) continue;
        const decimals = Number(item.token_info?.decimals ?? 6);
        const amountMicros = parseUsdtTokenAmount(item.value ?? "", decimals);
        if (amountMicros == null) continue;
        const confirmations = await this.getConfirmations(txHash);
        return {
          txHash,
          fromAddress: item.from ?? "",
          toAddress,
          amountMicros,
          confirmations,
          blockTimestamp: item.block_timestamp
            ? new Date(item.block_timestamp)
            : new Date(),
        };
      }
    } catch {
      // transaction may not be indexed yet
    }
    return null;
  }

  private headers(): HeadersInit {
    const headers: Record<string, string> = {
      accept: "application/json",
      "content-type": "application/json",
    };
    if (this.options.apiKey) {
      headers["TRON-PRO-API-KEY"] = this.options.apiKey;
    }
    return headers;
  }

  private async getJson<T>(path: string): Promise<T> {
    const response = await fetch(`${this.options.apiUrl}${path}`, {
      method: "GET",
      headers: this.headers(),
    });
    if (!response.ok) {
      throw new Error(`Tron API GET ${path} failed: ${response.status}`);
    }
    return (await response.json()) as T;
  }

  private async postJson<T>(path: string, body: unknown): Promise<T> {
    const response = await fetch(`${this.options.apiUrl}${path}`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error(`Tron API POST ${path} failed: ${response.status}`);
    }
    return (await response.json()) as T;
  }
}

function normalizeTxHash(txHash: string) {
  return txHash.startsWith("0x") ? txHash.slice(2) : txHash;
}
