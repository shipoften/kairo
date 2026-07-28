import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { ButtonLink } from "@/components/ui/button-link";
import { buildLoginRedirect } from "@/lib/login-redirect";
import { apiServerWithSession } from "@/lib/session";

export default async function WalletPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("wallet");
  const wallet = await apiServerWithSession<{
    availableCents: number;
    frozenCents: number;
  }>("/v1/wallet");
  if (!wallet) redirect(buildLoginRedirect(locale, "/wallet"));

  const transactions = await apiServerWithSession<{
    items: Array<{ type: string; amountCents: number }>;
  }>("/v1/wallet/transactions");

  const totalEarned =
    transactions?.items
      .filter((item) => item.type === "commission" || item.type === "referral_reward")
      .reduce((sum, item) => sum + item.amountCents, 0) ?? 0;

  return (
    <main className="space-y-6">
      <h1 className="font-[family-name:var(--font-display)] text-4xl">{t("title")}</h1>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-line bg-surface p-5">
          <p className="text-sm text-muted">{t("available")}</p>
          <p className="mt-2 text-3xl">{(wallet.availableCents / 100).toFixed(2)}</p>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-5">
          <p className="text-sm text-muted">{t("frozen")}</p>
          <p className="mt-2 text-3xl">{(wallet.frozenCents / 100).toFixed(2)}</p>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-5">
          <p className="text-sm text-muted">{t("totalEarned")}</p>
          <p className="mt-2 text-3xl">{(totalEarned / 100).toFixed(2)}</p>
        </div>
      </div>
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
      <p className="text-sm text-muted">{t("manualDepositNote")}</p>
    </main>
  );
}
