"use client";

import { Chain } from "@xs-share/shared";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ChainSwitcher } from "@/components/wallet/chain-switcher";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button-link";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { apiFetch } from "@/lib/api";
import { DepositAppKitProvider } from "@/lib/wallet/appkit-provider";
import { DepositManualPanel, type DepositAddressInfo } from "./deposit-manual-panel";
import { DepositRecentList, type DepositRow } from "./deposit-recent-list";
import { DepositWalletPanel } from "./deposit-wallet-panel";

type DepositMethod = "manual" | "wallet";

export default function DepositPage() {
  const t = useTranslations("wallet");
  const [chain, setChain] = useState<string>(Chain.TRC20);
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
      setLoading(true);
      setError(null);
      try {
        const [address, list] = await Promise.all([
          apiFetch<DepositAddressInfo>(
            `/v1/wallet/deposit-address?chain=${encodeURIComponent(chain)}`,
          ),
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
        setAddressInfo(null);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [chain, t]);

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

      <ChainSwitcher value={chain} onChange={setChain} disabled={loading} />

      {error ? <Alert variant="error">{error}</Alert> : null}
      {loading ? <p className="text-sm text-muted">{t("loading")}</p> : null}

      {addressInfo ? (
        <>
          <SegmentedControl
            value={method}
            onValueChange={(next) => setMethod(next as DepositMethod)}
            options={[
              { value: "wallet", label: t("depositMethodWallet") },
              { value: "manual", label: t("depositMethodManual") },
            ]}
          />

          {method === "wallet" ? (
            <DepositAppKitProvider>
              <DepositWalletPanel
                addressInfo={addressInfo}
                onDepositsChange={setDeposits}
              />
            </DepositAppKitProvider>
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
