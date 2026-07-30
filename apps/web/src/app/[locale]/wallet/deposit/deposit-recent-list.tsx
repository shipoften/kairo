"use client";

import { MoneyReceive01Icon } from "@hugeicons/core-free-icons";
import { useTranslations } from "next-intl";
import { TRONSCAN_TX_URL } from "@xs-share/shared";
import { Card } from "@/components/ui/card";
import { Empty } from "@/components/ui/empty";
import { displayUsdt } from "@/lib/money";
import {
  depositStatusVariant,
  StatusBadge,
} from "../wallet-status";

export type DepositRow = {
  id: string;
  amountMicros: number;
  status: string;
  txHash: string;
  confirmations: number;
  requiredConfirmations: number;
};

export function DepositRecentList({
  deposits,
  loading,
}: {
  deposits: DepositRow[];
  loading: boolean;
}) {
  const t = useTranslations("wallet");

  return (
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
          const statusLabel = t.has(statusKey) ? t(statusKey) : item.status;
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
  );
}
