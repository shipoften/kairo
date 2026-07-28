import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { buildLoginRedirect } from "@/lib/login-redirect";
import { apiServerWithSession } from "@/lib/session";

type Ledger = {
  id: string;
  type: string;
  amountCents: number;
  createdAt: string;
  note: string | null;
};

export default async function TransactionsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("wallet");
  const data = await apiServerWithSession<{ items: Ledger[] }>(
    "/v1/wallet/transactions",
  );
  if (!data) redirect(buildLoginRedirect(locale, "/wallet/transactions"));

  return (
    <main className="space-y-6">
      <h1 className="font-[family-name:var(--font-display)] text-3xl">{t("transactions")}</h1>
      <ul className="space-y-2">
        {data.items.map((item) => (
          <li key={item.id} className="rounded-xl border border-line bg-surface px-4 py-3 text-sm">
            <div className="flex justify-between gap-3">
              <span>{t(`ledger.${item.type}`)}</span>
              <span>{(item.amountCents / 100).toFixed(2)}</span>
            </div>
            {item.note ? <p className="mt-1 text-muted">{item.note}</p> : null}
          </li>
        ))}
      </ul>
    </main>
  );
}
