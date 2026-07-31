"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createAppKit } from "@reown/appkit/react";
import { useState, type ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import {
  appKitMetadata,
  appKitNetworks,
  appKitProjectId,
  tronAdapter,
  wagmiAdapter,
} from "./appkit-config";

let appKitInitialized = false;

function ensureAppKit() {
  if (appKitInitialized) return;
  createAppKit({
    adapters: [wagmiAdapter, tronAdapter],
    networks: appKitNetworks,
    projectId: appKitProjectId,
    metadata: appKitMetadata,
    features: {
      analytics: false,
      email: false,
      socials: false,
      swaps: false,
      onramp: false,
    },
    themeMode: "light",
  });
  appKitInitialized = true;
}

export function DepositAppKitProvider({ children }: { children: ReactNode }) {
  ensureAppKit();
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={wagmiAdapter.wagmiConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
