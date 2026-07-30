"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button-link";
import { apiFetch } from "@/lib/api";
import { TronWalletProvider } from "@/lib/tron/tron-wallet-provider";
import { DepositManualPanel, type DepositAddressInfo } from "./deposit-manual-panel";
import { DepositRecentList, type DepositRow } from "./deposit-recent-list";
import { DepositWalletPanel } from "./deposit-wallet-panel";

type DepositMethod = "manual" | "wallet";

export default function DepositPage() {
  const t = useTranslations("wallet");
  const [method, setMethod] = useState<DepositMethod>("wallet");
  const [addressInfo, setAddressInfo] = useState<DepositAddressInfo | null>(
    null,
  );
  const [deposits, setDeposits] = useState<DepositRow[]>([]);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [address, list] = await Promise.all([
          apiFetch<DepositAddressInfo>("/v1/wallet/deposit-address"),
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
        <>
          <div className="flex gap-2 rounded-xl border border-line bg-surface p-1">
            <button
              type="button"
              className={`flex-1 rounded-lg px-3 py-2 text-sm ${
                method === "wallet"
                  ? "bg-bg font-medium text-foreground"
                  : "text-muted"
              }`}
              onClick={() => setMethod("wallet")}
            >
              {t("depositMethodWallet")}
            </button>
            <button
              type="button"
              className={`flex-1 rounded-lg px-3 py-2 text-sm ${
                method === "manual"
                  ? "bg-bg font-medium text-foreground"
                  : "text-muted"
              }`}
              onClick={() => setMethod("manual")}
            >
              {t("depositMethodManual")}
            </button>
          </div>

          {method === "wallet" ? (
            <TronWalletProvider>
              <DepositWalletPanel
                addressInfo={addressInfo}
                onDepositsChange={setDeposits}
              />
            </TronWalletProvider>
          ) : (
            <DepositManualPanel
              addressInfo={addressInfo}
              copied={copied}
              onCopy={() => void copyAddress()}
            />
          )}
        </>
      ) : null}

      <DepositRecentList deposits={deposits} loading={loading} />
    </main>
  );
}
