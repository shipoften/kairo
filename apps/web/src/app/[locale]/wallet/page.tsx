import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { Wallet01Icon } from "@hugeicons/core-free-icons";
import { ButtonLink } from "@/components/ui/button-link";
import { Card } from "@/components/ui/card";
import { Empty } from "@/components/ui/empty";
import { PageHeader } from "@/components/ui/page-header";
import { displayUsdt } from "@/lib/money";
import { buildLoginRedirect } from "@/lib/login-redirect";
import { apiServerWithSession } from "@/lib/session";
import { formatWalletDate, ledgerTypeKey } from "./wallet-status";

type LedgerItem = {
  id: string;
  type: string;
  amountMicros: number;
  createdAt: string;
};

type WithdrawalItem = {
  id: string;
  amountMicros: number;
  status: string;
};

export default async function WalletPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("wallet");
  const wallet = await apiServerWithSession<{
    availableMicros: number;
    frozenMicros: number;
  }>("/v1/wallet");
  if (!wallet) redirect(buildLoginRedirect(locale, "/wallet"));

  const [transactions, withdrawals] = await Promise.all([
    apiServerWithSession<{ items: LedgerItem[] }>("/v1/wallet/transactions"),
    apiServerWithSession<{ items: WithdrawalItem[] }>("/v1/wallet/withdrawals"),
  ]);

  const totalEarned =
    transactions?.items
      .filter(
        (item) =>
          item.type === "commission" || item.type === "referral_reward",
      )
      .reduce((sum, item) => sum + item.amountMicros, 0) ?? 0;

  const recent = transactions?.items.slice(0, 5) ?? [];
  const pendingWithdrawals =
    withdrawals?.items.filter(
      (item) => item.status === "pending" || item.status === "approved",
    ) ?? [];

  return (
    <main className="space-y-8">
      <PageHeader title={t("title")} description={t("depositHint")}>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href="/wallet/deposit" size="sm">
            {t("deposit")}
          </ButtonLink>
          <ButtonLink href="/wallet/withdraw" variant="secondary" size="sm">
            {t("withdraw")}
          </ButtonLink>
          <ButtonLink href="/wallet/transactions" variant="secondary" size="sm">
            {t("transactions")}
          </ButtonLink>
        </div>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="p-5">
          <p className="text-sm text-muted">{t("available")}</p>
          <p className="mt-2 text-3xl tracking-tight">
            {displayUsdt(wallet.availableMicros)}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted">{t("frozen")}</p>
          <p className="mt-2 text-3xl tracking-tight">
            {displayUsdt(wallet.frozenMicros)}
          </p>
        </Card>
      </div>

      <p className="text-sm text-muted">
        {t("totalEarned")}: {displayUsdt(totalEarned)}
      </p>

      {pendingWithdrawals.length > 0 ? (
        <Card className="space-y-3 p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-medium">{t("recentWithdrawals")}</h2>
            <ButtonLink href="/wallet/withdraw" variant="link" size="sm">
              {t("viewAll")}
            </ButtonLink>
          </div>
          <ul className="space-y-2 text-sm">
            {pendingWithdrawals.slice(0, 3).map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-3"
              >
                <span>{displayUsdt(item.amountMicros)}</span>
                <span className="text-muted">
                  {t(
                    `withdrawStatus.${item.status}` as
                      | "withdrawStatus.pending"
                      | "withdrawStatus.approved",
                  )}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-medium">{t("recentActivity")}</h2>
          <ButtonLink href="/wallet/transactions" variant="link" size="sm">
            {t("viewAll")}
          </ButtonLink>
        </div>
        {recent.length === 0 ? (
          <Empty
            icon={Wallet01Icon}
            title={t("noTransactions")}
            subtitle={t("noTransactionsHint")}
            size="sm"
          >
            <ButtonLink href="/wallet/deposit" size="sm">
              {t("deposit")}
            </ButtonLink>
          </Empty>
        ) : (
          <div className="space-y-2">
            {recent.map((item) => {
              const typeKey = ledgerTypeKey(item.type);
              const label = t.has(typeKey) ? t(typeKey) : item.type;
              return (
                <Card
                  key={item.id}
                  className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
                >
                  <div>
                    <p>{label}</p>
                    <p className="text-muted">
                      {formatWalletDate(item.createdAt, locale)}
                    </p>
                  </div>
                  <span className="font-medium">
                    {displayUsdt(item.amountMicros)}
                  </span>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
