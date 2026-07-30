import { TRON_MAINNET_CHAIN_ID } from "./constants";

export type TronWebInstance = {
  ready?: boolean;
  defaultAddress?: { base58?: string };
  fullNode?: { host?: string };
  contract: () => {
    at: (address: string) => Promise<{
      transfer: (
        to: string,
        amount: string | number,
      ) => { send: (options?: { feeLimit?: number }) => Promise<string> };
    }>;
  };
};

declare global {
  interface Window {
    tronLink?: { ready?: boolean; tronWeb?: TronWebInstance };
    tronWeb?: TronWebInstance;
  }
}

export function getTronWeb(): TronWebInstance | null {
  if (typeof window === "undefined") return null;
  return window.tronWeb ?? window.tronLink?.tronWeb ?? null;
}

export function isTronLinkInstalled(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(window.tronLink || window.tronWeb);
}

export function isTronMainnet(tronWeb: TronWebInstance): boolean {
  const host = tronWeb.fullNode?.host?.toLowerCase() ?? "";
  if (host.includes("shasta") || host.includes("nile")) {
    return false;
  }
  return true;
}

export async function ensureTronMainnet(): Promise<void> {
  const tronWeb = getTronWeb();
  if (!tronWeb?.ready) {
    throw new Error("TRONLINK_NOT_READY");
  }
  if (!isTronMainnet(tronWeb)) {
    throw new Error("WRONG_NETWORK");
  }
}

export function shortenTronAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function normalizeChainId(chainId: unknown): string | null {
  if (typeof chainId === "string") return chainId.toLowerCase();
  if (typeof chainId === "number") return `0x${chainId.toString(16)}`;
  return null;
}

export function isMainnetChainId(chainId: unknown): boolean {
  const normalized = normalizeChainId(chainId);
  return normalized === TRON_MAINNET_CHAIN_ID.toLowerCase();
}
