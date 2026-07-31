import { setRequestLocale } from "next-intl/server";
import { apiServerWithSession } from "@/lib/session";
import { AdminDepositsSection } from "../admin-sections";
import { requireAdmin } from "../require-admin";
import type { AdminConfig, AdminDepositRow } from "../admin-types";

export default async function AdminDepositsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const auth = await requireAdmin(locale);
  if (auth.forbidden || !auth.me) return auth.forbidden;

  const [depositData, config] = await Promise.all([
    apiServerWithSession<{ items: AdminDepositRow[] }>("/v1/admin/deposits"),
    apiServerWithSession<AdminConfig>("/v1/admin/config"),
  ]);
  if (!depositData || !config) return auth.forbidden;

  return (
    <AdminDepositsSection
      deposits={depositData.items}
      chainAdapter={config.chainAdapter}
      currentUserId={auth.me.id}
    />
  );
}
