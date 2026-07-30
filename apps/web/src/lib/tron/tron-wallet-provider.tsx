"use client";

import { TronLinkAdapter } from "@tronweb3/tronwallet-adapters";
import { WalletProvider } from "@tronweb3/tronwallet-adapter-react-hooks";
import { useMemo, type ReactNode } from "react";

export function TronWalletProvider({ children }: { children: ReactNode }) {
  const adapters = useMemo(() => [new TronLinkAdapter()], []);

  return (
    <WalletProvider adapters={adapters} disableAutoConnectOnLoad>
      {children}
    </WalletProvider>
  );
}
