"use client";

import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { TronAdapter } from "@reown/appkit-adapter-tron";
import {
  mainnet,
  sepolia,
  tronMainnet,
  tronNile,
  type AppKitNetwork,
} from "@reown/appkit/networks";
import { TronLinkAdapter } from "@tronweb3/tronwallet-adapter-tronlink";
import { getClientChainEnv } from "./chain-env";

const projectId =
  process.env.NEXT_PUBLIC_REOWN_PROJECT_ID?.trim() ||
  "b56e18d47c72ab683b10814fe9495694";

const chainEnv = getClientChainEnv();

export const evmNetworks: [AppKitNetwork, ...AppKitNetwork[]] =
  chainEnv === "testnet" ? [sepolia] : [mainnet];

export const tronNetworks: [AppKitNetwork, ...AppKitNetwork[]] =
  chainEnv === "testnet" ? [tronNile] : [tronMainnet];

export const appKitNetworks: [AppKitNetwork, ...AppKitNetwork[]] = [
  ...evmNetworks,
  ...tronNetworks,
];

export const wagmiAdapter = new WagmiAdapter({
  ssr: true,
  projectId,
  networks: evmNetworks,
});

export const tronAdapter = new TronAdapter({
  walletAdapters: [
    new TronLinkAdapter({
      openUrlWhenWalletNotFound: false,
      checkTimeout: 3_000,
    }),
  ],
});

export const appKitMetadata = {
  name: "XS Share",
  description: "XS Share wallet deposits",
  url:
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:5180",
  icons: [] as string[],
};

export const appKitProjectId = projectId;

export function getUsdtContractAddress(chain: "trc20" | "erc20"): string {
  if (chain === "erc20") {
    return (
      process.env.NEXT_PUBLIC_ETH_USDT_CONTRACT?.trim() ||
      "0xdac17f958d2ee523a2206206994597c13d831ec7"
    );
  }
  return (
    process.env.NEXT_PUBLIC_TRON_USDT_CONTRACT?.trim() ||
    "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t"
  );
}

export function getExpectedEvmChainId(): number {
  const configured = Number(process.env.NEXT_PUBLIC_ETH_CHAIN_ID);
  if (Number.isFinite(configured) && configured > 0) return configured;
  return chainEnv === "testnet" ? 11155111 : 1;
}
