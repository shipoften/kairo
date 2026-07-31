"use client";

import {
  Chain,
  getExplorerTxUrl,
  usdtToMicros,
} from "@xs-share/shared";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { apiFetch } from "@/lib/api";
import { displayUsdt } from "@/lib/money";
import { resolveApiErrorMessage } from "@/lib/resolve-api-error";
import { getClientChainEnv } from "@/lib/wallet/chain-env";
import {
  ConnectWalletControls,
  useDepositWalletConnection,
} from "@/lib/wallet/connect-wallet-controls";
import { sendUsdtDeposit } from "@/lib/wallet/send-usdt-deposit";
import type { DepositAddressInfo } from "./deposit-manual-panel";
import type { DepositRow } from "./deposit-recent-list";

const POLL_INTERVAL_MS = 8_000;
const POLL_MAX_ATTEMPTS = 30;

function mapWalletError(code: string, translate: (key: string) => string): string {
  const keys: Record<string, string> = {
    WALLET_NOT_INSTALLED: "walletNotInstalled",
    TRONLINK_NOT_INSTALLED: "walletNotInstalled",
    WALLET_NOT_READY: "walletNotReady",
    TRONLINK_NOT_READY: "walletNotReady",
    WRONG_NETWORK: "wrongNetwork",
    TRANSFER_FAILED: "transferFailed",
  };
  const key = keys[code];
  if (key) {
    try {
      return translate(key);
    } catch {
      return code;
    }
  }
  return code;
}

export function DepositWalletPanel({
  addressInfo,
  onDepositsChange,
}: {
  addressInfo: DepositAddressInfo;
  onDepositsChange: (items: DepositRow[]) => void;
}) {
  const t = useTranslations("wallet");
  const tCommon = useTranslations("common");
  const { connected, address } = useDepositWalletConnection(addressInfo.chain);
  const [amountUsdt, setAmountUsdt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingTxHash, setPendingTxHash] = useState<string | null>(null);
  const pollAttemptsRef = useRef(0);
  const chainEnv = getClientChainEnv();

  const refreshDeposits = useCallback(async () => {
    const list = await apiFetch<{ items: DepositRow[] }>("/v1/wallet/deposits");
    onDepositsChange(list.items);
    return list.items;
  }, [onDepositsChange]);

  const registerAndPoll = useCallback(
    async (txHash: string) => {
      pollAttemptsRef.current = 0;
      setPendingTxHash(txHash);

      const poll = async () => {
        pollAttemptsRef.current += 1;
        try {
          await apiFetch<{ deposit: DepositRow; credited: boolean }>(
            "/v1/wallet/deposits/register",
            {
              method: "POST",
              body: JSON.stringify({
                txHash,
                chain: addressInfo.chain,
              }),
            },
          );
        } catch (registerError) {
          if (
            typeof registerError === "object" &&
            registerError &&
            "code" in registerError &&
            String((registerError as { code: string }).code) !== "NOT_FOUND"
          ) {
            setError(
              resolveApiErrorMessage(registerError, tCommon, t("transferFailed")),
            );
            setPendingTxHash(null);
            return;
          }
        }

        const items = await refreshDeposits();
        const matched = items.find((item) => item.txHash === txHash);
        if (matched?.status === "confirmed") {
          setPendingTxHash(null);
          return;
        }
        if (pollAttemptsRef.current >= POLL_MAX_ATTEMPTS) {
          setPendingTxHash(null);
          setError(t("depositPendingTimeout"));
          return;
        }
        window.setTimeout(() => {
          void poll();
        }, POLL_INTERVAL_MS);
      };

      void poll();
    },
    [addressInfo.chain, refreshDeposits, t, tCommon],
  );

  useEffect(() => {
    return () => {
      pollAttemptsRef.current = POLL_MAX_ATTEMPTS;
    };
  }, []);

  async function handleDeposit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const amountMicros = usdtToMicros(Number(amountUsdt));
    if (!Number.isFinite(Number(amountUsdt)) || amountMicros <= 0) {
      setError(t("invalidAmount"));
      return;
    }
    if (amountMicros < addressInfo.minDepositMicros) {
      setError(
        t("amountBelowMinDeposit", {
          amount: displayUsdt(addressInfo.minDepositMicros),
        }),
      );
      return;
    }
    if (!connected) {
      setError(t("connectWalletFirst"));
      return;
    }

    setLoading(true);
    try {
      const txHash = await sendUsdtDeposit({
        chain: addressInfo.chain,
        toAddress: addressInfo.address,
        amountMicros,
        fromAddress: address ?? undefined,
      });
      await registerAndPoll(txHash);
      setAmountUsdt("");
    } catch (transferError) {
      if (transferError instanceof Error) {
        const mapped = mapWalletError(transferError.message, (key) => t(key));
        if (mapped !== transferError.message) {
          setError(mapped);
        } else if (transferError.message.toLowerCase().includes("reject")) {
          setError(t("userRejected"));
        } else {
          setError(
            resolveApiErrorMessage(transferError, tCommon, t("transferFailed")),
          );
        }
      } else {
        setError(t("transferFailed"));
      }
    } finally {
      setLoading(false);
    }
  }

  const networkFeeHint =
    addressInfo.chain === Chain.ERC20
      ? t("networkFeeSelfPayEvm")
      : t("networkFeeSelfPay");

  return (
    <Card className="space-y-5 p-6">
      <Alert variant="info">{t("connectWalletHint")}</Alert>
      <p className="text-sm text-muted">{networkFeeHint}</p>

      <ConnectWalletControls chain={addressInfo.chain} />

      <form className="space-y-4" onSubmit={(event) => void handleDeposit(event)}>
        <label className="block space-y-1 text-sm">
          <span>{t("amountUsdt")}</span>
          <input
            type="number"
            min={0}
            step="0.000001"
            className="w-full rounded-xl border border-line px-3 py-2"
            value={amountUsdt}
            onChange={(event) => setAmountUsdt(event.target.value)}
            placeholder={displayUsdt(addressInfo.minDepositMicros)}
          />
        </label>
        <p className="text-sm text-muted">
          {t("minDeposit", {
            amount: displayUsdt(addressInfo.minDepositMicros),
          })}
        </p>
        <Button type="submit" loading={loading} disabled={!connected}>
          {t("depositWithWallet")}
        </Button>
      </form>

      {pendingTxHash ? (
        <Alert variant="info">
          {t("depositSubmitted")}{" "}
          <a
            className="text-accent underline"
            href={getExplorerTxUrl(
              addressInfo.chain === Chain.ERC20 ? Chain.ERC20 : Chain.TRC20,
              pendingTxHash,
              chainEnv,
            )}
            target="_blank"
            rel="noreferrer"
          >
            {pendingTxHash.slice(0, 18)}…
          </a>
        </Alert>
      ) : null}

      {error ? <Alert variant="error">{error}</Alert> : null}
    </Card>
  );
}
