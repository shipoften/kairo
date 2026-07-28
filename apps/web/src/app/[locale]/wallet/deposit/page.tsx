"use client";

import { useEffect, useState } from "react";
import { MoneyReceive01Icon } from "@hugeicons/core-free-icons";
import { useTranslations } from "next-intl";
import {
  TRONSCAN_ADDRESS_URL,
  TRONSCAN_TX_URL,
} from "@xs-share/shared";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { Card } from "@/components/ui/card";
import { Empty } from "@/components/ui/empty";
import { apiFetch } from "@/lib/api";
import { displayUsdt } from "@/lib/money";
import { DepositQr } from "../deposit-qr";
import {
  depositStatusVariant,
  StatusBadge,
} from "../wallet-status";

type DepositAddress = {
  chain: string;
  address: string;
  minDepositMicros: number;
  trc20Confirmations: number;
  currency: string;
};

type DepositRow = {
  id: string;
  amountMicros: number;
  status: string;
  txHash: string;
  confirmations: number;
  requiredConfirmations: number;
};

export default function DepositPage() {
  const t = useTranslations("wallet");
  const [addressInfo, setAddressInfo] = useState<DepositAddress | null>(null);
  const [deposits, setDeposits] = useState<DepositRow[]>([]);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [address, list] = await Promise.all([
          apiFetch<DepositAddress>("/v1/wallet/deposit-address"),
          apiFetch<{ items: DepositRow[] }>("/v1/wallet/deposits"),
        ]);
        setAddressInfo(address);
        setDeposits(list.items);
      } catch (err) {
        setError(
          typeof err === "object" && err && "message" in err
            ? String((err as { message: string }).message)
            : t("loading"),
        );
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [t]);

  async function copyAddress() {
    if (!addressInfo) return;
    await navigator.clipboard.writeText(addressInfo.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <main className="mx-auto w-full max-w-lg space-y-6">
      <div className="space-y-2">
        <ButtonLink href="/wallet" variant="link" size="sm">
          {t("backToWallet")}
        </ButtonLink>
        <h1 className="font-[family-name:var(--font-display)] text-3xl">
          {t("deposit")}
        </h1>
        <p className="text-sm text-muted">{t("depositHint")}</p>
      </div>

      {error ? <Alert variant="error">{error}</Alert> : null}
      {loading ? <p className="text-sm text-muted">{t("loading")}</p> : null}

      {addressInfo ? (
        <Card className="space-y-5 p-6">
          <Alert variant="info">{t("depositOnlyUsdt")}</Alert>
          <p className="text-sm text-muted">{t("networkTrc20")}</p>
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            <DepositQr address={addressInfo.address} label={t("qrLabel")} />
            <div className="min-w-0 flex-1 space-y-3">
              <div className="break-all rounded-xl border border-line bg-bg px-3 py-3 font-mono text-sm">
                {addressInfo.address}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" onClick={copyAddress}>
                  {copied ? t("copied") : t("copyAddress")}
                </Button>
                <a
                  className="inline-flex items-center rounded-xl px-3 py-2 text-sm text-accent underline"
                  href={`${TRONSCAN_ADDRESS_URL}/${addressInfo.address}`}
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
                  count: addressInfo.trc20Confirmations,
                })}
              </p>
            </div>
          </div>
        </Card>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-lg font-medium">{t("recentDeposits")}</h2>
        {!loading && deposits.length === 0 ? (
          <Empty icon={MoneyReceive01Icon} title={t("noDeposits")} size="sm" />
        ) : (
          deposits.map((item) => {
            const statusKey =
              `depositStatus.${item.status}` as
                | "depositStatus.detecting"
                | "depositStatus.confirming"
                | "depositStatus.confirmed"
                | "depositStatus.ignored";
            const statusLabel = t.has(statusKey)
              ? t(statusKey)
              : item.status;
            return (
              <Card key={item.id} className="space-y-2 px-4 py-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">
                    {displayUsdt(item.amountMicros)}
                  </span>
                  <StatusBadge
                    label={statusLabel}
                    variant={depositStatusVariant(item.status)}
                  />
                </div>
                <p className="text-muted">
                  {item.confirmations}/{item.requiredConfirmations}
                </p>
                <a
                  className="text-accent underline"
                  href={`${TRONSCAN_TX_URL}/${item.txHash}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {item.txHash.slice(0, 18)}…
                </a>
              </Card>
            );
          })
        )}
      </section>
    </main>
  );
}
