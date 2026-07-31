"use client";

import {
  Chain,
  getExplorerAddressUrl,
  parseChain,
} from "@xs-share/shared";
import { useTranslations } from "next-intl";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { displayUsdt } from "@/lib/money";
import { getClientChainEnv } from "@/lib/wallet/chain-env";
import { DepositQr } from "../deposit-qr";

export type DepositAddressInfo = {
  chain: string;
  address: string;
  minDepositMicros: number;
  trc20Confirmations: number;
  erc20Confirmations?: number;
  requiredConfirmations?: number;
  currency: string;
};

export function DepositManualPanel({
  addressInfo,
  copied,
  onCopy,
}: {
  addressInfo: DepositAddressInfo;
  copied: boolean;
  onCopy: () => void;
}) {
  const t = useTranslations("wallet");
  const chain = parseChain(addressInfo.chain);
  const chainEnv = getClientChainEnv();
  const confirmations =
    addressInfo.requiredConfirmations ??
    (chain === Chain.ERC20
      ? (addressInfo.erc20Confirmations ?? addressInfo.trc20Confirmations)
      : addressInfo.trc20Confirmations);
  const networkLabel =
    chain === Chain.ERC20 ? t("networkErc20") : t("networkTrc20");

  return (
    <Card className="space-y-5 p-6">
      <Alert variant="info">{t("depositOnlyUsdt")}</Alert>
      <p className="text-sm text-muted">{networkLabel}</p>
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        <DepositQr address={addressInfo.address} label={t("qrLabel")} />
        <div className="min-w-0 flex-1 space-y-3">
          <div className="break-all rounded-xl border border-line bg-bg px-3 py-3 font-mono text-sm">
            {addressInfo.address}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={onCopy}>
              {copied ? t("copied") : t("copyAddress")}
            </Button>
            <a
              className="inline-flex items-center rounded-xl px-3 py-2 text-sm text-accent underline"
              href={getExplorerAddressUrl(chain, addressInfo.address, chainEnv)}
              target="_blank"
              rel="noreferrer"
            >
              {t("viewOnExplorer")}
            </a>
          </div>
          <p className="text-sm text-muted">
            {t("minDeposit", {
              amount: displayUsdt(addressInfo.minDepositMicros),
            })}
          </p>
          <p className="text-sm text-muted">
            {t("confirmationsHint", {
              count: confirmations,
            })}
          </p>
        </div>
      </div>
    </Card>
  );
}
