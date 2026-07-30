"use client";

import { useEffect, useMemo, useState } from "react";
import { MoneySend01Icon } from "@hugeicons/core-free-icons";
import { useTranslations } from "next-intl";
import { isValidTrc20Address, TRONSCAN_TX_URL } from "@xs-share/shared";
import { useRouter } from "@/i18n/navigation";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { Card } from "@/components/ui/card";
import { Empty } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api";
import { displayUsdt, usdtToMicros } from "@/lib/money";
import {
  StatusBadge,
  withdrawStatusVariant,
} from "../wallet-status";

type WalletInfo = {
  availableMicros: number;
  minWithdrawMicros: number;
  withdrawNetworkFeeMicros: number;
};

type WithdrawalRow = {
  id: string;
  amountMicros: number;
  networkFeeMicros: number;
  netPayoutMicros: number;
  toAddress: string;
  status: string;
  txHash: string | null;
  createdAt: string;
};

export default function WithdrawPage() {
  const t = useTranslations("wallet");
  const router = useRouter();
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRow[]>([]);
  const [amountUsdt, setAmountUsdt] = useState(20);
  const [toAddress, setToAddress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [data, list] = await Promise.all([
          apiFetch<WalletInfo>("/v1/wallet"),
          apiFetch<{ items: WithdrawalRow[] }>("/v1/wallet/withdrawals"),
        ]);
        setWallet(data);
        setWithdrawals(list.items);
        setAmountUsdt(data.minWithdrawMicros / 1_000_000);
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

  const amountMicros = usdtToMicros(amountUsdt);
  const feeMicros = wallet?.withdrawNetworkFeeMicros ?? 1_000_000;
  const minMicros = wallet?.minWithdrawMicros ?? 20_000_000;
  const availableMicros = wallet?.availableMicros ?? 0;
  const netMicros = Math.max(0, amountMicros - feeMicros);

  const preview = useMemo(
    () => ({
      fee: displayUsdt(feeMicros),
      net: displayUsdt(netMicros),
    }),
    [feeMicros, netMicros],
  );

  function validate(): string | null {
    if (!isValidTrc20Address(toAddress)) return t("invalidAddress");
    if (amountMicros < minMicros) return t("amountTooLow");
    if (amountMicros <= feeMicros) return t("amountMustExceedFee");
    if (amountMicros > availableMicros) return t("amountExceedsBalance");
    return null;
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      setSuccess(false);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch("/v1/wallet/withdrawals", {
        method: "POST",
        body: JSON.stringify({ amountMicros, toAddress: toAddress.trim() }),
      });
      setSuccess(true);
      const list = await apiFetch<{ items: WithdrawalRow[] }>(
        "/v1/wallet/withdrawals",
      );
      setWithdrawals(list.items);
      const refreshed = await apiFetch<WalletInfo>("/v1/wallet");
      setWallet(refreshed);
      router.refresh();
    } catch (err) {
      setError(
        typeof err === "object" && err && "message" in err
          ? String((err as { message: string }).message)
          : "Failed",
      );
      setSuccess(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-md space-y-6">
      <div className="space-y-2">
        <ButtonLink href="/wallet" variant="link" size="sm">
          {t("backToWallet")}
        </ButtonLink>
        <h1 className="font-[family-name:var(--font-display)] text-3xl">
          {t("withdraw")}
        </h1>
        <p className="text-sm text-muted">{t("withdrawHint")}</p>
      </div>

      {loading ? <p className="text-sm text-muted">{t("loading")}</p> : null}

      {wallet ? (
        <Card className="space-y-1 p-4 text-sm">
          <p>
            {t("available")}:{" "}
            <span className="font-medium">
              {displayUsdt(wallet.availableMicros)}
            </span>
          </p>
          <p className="text-muted">
            {t("minWithdraw", {
              amount: displayUsdt(wallet.minWithdrawMicros),
            })}
          </p>
        </Card>
      ) : null}

      <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-line bg-surface p-6">
        <div className="space-y-1">
          <Label htmlFor="amount">{t("amountUsdt")}</Label>
          <Input
            id="amount"
            type="number"
            min={0}
            step="0.01"
            value={amountUsdt}
            onChange={(event) => setAmountUsdt(Number(event.target.value))}
            placeholder={t("amountPlaceholder")}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="toAddress">{t("toAddress")}</Label>
          <Input
            id="toAddress"
            type="text"
            className="font-mono"
            value={toAddress}
            onChange={(event) => setToAddress(event.target.value)}
            placeholder={t("toAddressPlaceholder")}
            required
          />
        </div>
        <p className="text-sm text-muted">
          {t("networkFeePreview", { fee: preview.fee, net: preview.net })}
        </p>
        {error ? <Alert variant="error">{error}</Alert> : null}
        {success ? (
          <Alert variant="success">{t("withdrawSubmitted")}</Alert>
        ) : null}
        <Button type="submit" disabled={submitting || loading}>
          {submitting ? t("submitting") : t("withdraw")}
        </Button>
      </form>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">{t("recentWithdrawals")}</h2>
        {!loading && withdrawals.length === 0 ? (
          <Empty icon={MoneySend01Icon} title={t("noWithdrawals")} size="sm" />
        ) : (
          withdrawals.map((item) => {
            const statusKey =
              `withdrawStatus.${item.status}` as
                | "withdrawStatus.pending"
                | "withdrawStatus.approved"
                | "withdrawStatus.paid"
                | "withdrawStatus.rejected";
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
                    variant={withdrawStatusVariant(item.status)}
                  />
                </div>
                <p className="text-muted">
                  {t("netPayout")}: {displayUsdt(item.netPayoutMicros)}
                </p>
                <p className="break-all font-mono text-xs text-muted">
                  {item.toAddress}
                </p>
                {item.txHash ? (
                  <a
                    className="text-accent underline"
                    href={`${TRONSCAN_TX_URL}/${item.txHash}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t("viewOnExplorer")}
                  </a>
                ) : null}
              </Card>
            );
          })
        )}
      </section>
    </main>
  );
}
