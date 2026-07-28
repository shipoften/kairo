import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { Invoice01Icon } from "@hugeicons/core-free-icons";
import { TRONSCAN_TX_URL } from "@xs-share/shared";
import { ButtonLink } from "@/components/ui/button-link";
import { Card } from "@/components/ui/card";
import { Empty } from "@/components/ui/empty";
import { displayUsdt } from "@/lib/money";
import { buildLoginRedirect } from "@/lib/login-redirect";
import { apiServerWithSession } from "@/lib/session";
import { formatWalletDate, ledgerTypeKey } from "../wallet-status";

type LedgerItem = {
  id: string;
  type: string;
  amountMicros: number;
  note: string | null;
  txHash: string | null;
  createdAt: string;
};

export default async function TransactionsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("wallet");
  const data = await apiServerWithSession<{ items: LedgerItem[] }>(
    "/v1/wallet/transactions",
  );
  if (!data) redirect(buildLoginRedirect(locale, "/wallet/transactions"));

  return (
    <main className="space-y-6">
      <div className="space-y-2">
        <ButtonLink href="/wallet" variant="link" size="sm">
          {t("backToWallet")}
        </ButtonLink>
        <h1 className="font-[family-name:var(--font-display)] text-3xl">
          {t("transactions")}
        </h1>
      </div>

      {data.items.length === 0 ? (
        <Empty
          icon={Invoice01Icon}
          title={t("noTransactions")}
          subtitle={t("noTransactionsHint")}
        >
          <ButtonLink href="/wallet/deposit" size="sm">
            {t("deposit")}
          </ButtonLink>
        </Empty>
      ) : (
        <div className="space-y-2">
          {data.items.map((item) => {
            const typeKey = ledgerTypeKey(item.type);
            const label = t.has(typeKey) ? t(typeKey) : item.type;
            const positive = item.amountMicros >= 0;
            return (
              <Card
                key={item.id}
                className="flex flex-col gap-1 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 space-y-1">
                  <p className="font-medium">{label}</p>
                  <p className="text-muted">
                    {formatWalletDate(item.createdAt, locale)}
                  </p>
                  {item.note ? (
                    <p className="truncate text-muted">{item.note}</p>
                  ) : null}
                  {item.txHash ? (
                    <a
                      className="text-accent underline"
                      href={`${TRONSCAN_TX_URL}/${item.txHash}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {item.txHash.slice(0, 18)}…
                    </a>
                  ) : null}
                </div>
                <span
                  className={
                    positive
                      ? "shrink-0 font-medium text-accent"
                      : "shrink-0 font-medium"
                  }
                >
                  {positive ? "+" : ""}
                  {displayUsdt(item.amountMicros)}
                </span>
              </Card>
            );
          })}
        </div>
      )}
    </main>
  );
}
