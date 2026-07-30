"use client";

import { useWallet } from "@tronweb3/tronwallet-adapter-react-hooks";
import { TRONSCAN_TX_URL, usdtToMicros } from "@xs-share/shared";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { apiFetch } from "@/lib/api";
import { displayUsdt } from "@/lib/money";
import { resolveApiErrorMessage } from "@/lib/resolve-api-error";
import { TRONLINK_INSTALL_URL } from "@/lib/tron/constants";
import {
  isTronLinkInstalled,
  shortenTronAddress,
} from "@/lib/tron/tron-web";
import { sendUsdtDepositTransfer } from "@/lib/tron/usdt-transfer";
import type { DepositAddressInfo } from "./deposit-manual-panel";
import type { DepositRow } from "./deposit-recent-list";

const POLL_INTERVAL_MS = 8_000;
const POLL_MAX_ATTEMPTS = 30;

function mapWalletError(code: string, translate: (key: string) => string): string {
  const keys: Record<string, string> = {
    TRONLINK_NOT_INSTALLED: "walletNotInstalled",
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
  const { address, connected, connecting, connect, disconnect } = useWallet();
  const [amountUsdt, setAmountUsdt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingTxHash, setPendingTxHash] = useState<string | null>(null);
  const pollAttemptsRef = useRef(0);

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
              body: JSON.stringify({ txHash }),
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
    [refreshDeposits, t, tCommon],
  );

  useEffect(() => {
    return () => {
      pollAttemptsRef.current = POLL_MAX_ATTEMPTS;
    };
  }, []);

  async function handleConnect() {
    setError(null);
    if (!isTronLinkInstalled()) {
      setError(t("walletNotInstalled"));
      return;
    }
    try {
      await connect();
    } catch (connectError) {
      setError(
        resolveApiErrorMessage(connectError, tCommon, t("connectFailed")),
      );
    }
  }

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
      const txHash = await sendUsdtDepositTransfer({
        toAddress: addressInfo.address,
        amountMicros,
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
          setError(resolveApiErrorMessage(transferError, tCommon, t("transferFailed")));
        }
      } else {
        setError(t("transferFailed"));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="space-y-5 p-6">
      <Alert variant="info">{t("connectWalletHint")}</Alert>
      <p className="text-sm text-muted">{t("networkFeeSelfPay")}</p>

      <div className="flex flex-wrap items-center gap-2">
        {connected && address ? (
          <>
            <span className="rounded-xl border border-line bg-bg px-3 py-2 font-mono text-sm">
              {shortenTronAddress(address)}
            </span>
            <Button type="button" variant="secondary" size="sm" onClick={() => void disconnect()}>
              {t("disconnectWallet")}
            </Button>
          </>
        ) : (
          <Button
            type="button"
            size="sm"
            loading={connecting}
            onClick={() => void handleConnect()}
          >
            {t("connectWallet")}
          </Button>
        )}
        {!isTronLinkInstalled() ? (
          <a
            className="text-sm text-accent underline"
            href={TRONLINK_INSTALL_URL}
            target="_blank"
            rel="noreferrer"
          >
            {t("installTronLink")}
          </a>
        ) : null}
      </div>

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
            href={`${TRONSCAN_TX_URL}/${pendingTxHash}`}
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
