import { setRequestLocale } from "next-intl/server";
import { apiServerWithSession } from "@/lib/session";
import { AdminWithdrawalsSection } from "../admin-sections";
import { requireAdmin } from "../require-admin";
import type { AdminWithdrawalRow } from "../admin-types";

export default async function AdminWithdrawalsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const auth = await requireAdmin(locale);
  if (auth.forbidden) return auth.forbidden;

  const data = await apiServerWithSession<{ items: AdminWithdrawalRow[] }>(
    "/v1/admin/withdrawals",
  );
  if (!data) return auth.forbidden;

  return <AdminWithdrawalsSection withdrawals={data.items} />;
}
