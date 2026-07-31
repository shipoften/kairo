"use client";

import {
  useAppKit,
  useAppKitAccount,
  useDisconnect,
} from "@reown/appkit/react";
import { Chain } from "@xs-share/shared";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { shortenAddress } from "./chain-env";

export function ConnectWalletControls({
  chain,
}: {
  chain: string;
}) {
  const t = useTranslations("wallet");
  const { open } = useAppKit();
  const { disconnect } = useDisconnect();
  const namespace = chain === Chain.ERC20 ? "eip155" : "tron";
  const account = useAppKitAccount({ namespace });

  if (account.isConnected && account.address) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-xl border border-line bg-bg px-3 py-2 font-mono text-sm">
          {shortenAddress(account.address)}
        </span>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => void disconnect({ namespace })}
        >
          {t("disconnectWallet")}
        </Button>
      </div>
    );
  }

  return (
    <Button
      type="button"
      size="sm"
      onClick={() => void open({ namespace })}
    >
      {t("connectWallet")}
    </Button>
  );
}

export function useDepositWalletConnection(chain: string) {
  const namespace = chain === Chain.ERC20 ? "eip155" : "tron";
  const account = useAppKitAccount({ namespace });
  return {
    connected: Boolean(account.isConnected && account.address),
    address: account.address ?? null,
    namespace,
  };
}
