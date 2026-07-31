import {
  Chain,
  parseChainEnv,
  type ChainEnv,
} from "@xs-share/shared";

export function getClientChainEnv(): ChainEnv {
  return parseChainEnv(process.env.NEXT_PUBLIC_CHAIN_ENV);
}

export function isErc20Chain(chain: string): boolean {
  return chain === Chain.ERC20;
}

export function shortenAddress(address: string): string {
  const trimmed = address.trim();
  if (trimmed.length <= 12) return trimmed;
  return `${trimmed.slice(0, 6)}…${trimmed.slice(-4)}`;
}
