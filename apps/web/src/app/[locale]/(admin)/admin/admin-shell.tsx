import { getTranslations } from "next-intl/server";
import { apiServerWithSession, getMe } from "@/lib/session";
import { AdminFrame } from "./admin-frame";
import type { AdminOverview, AdminTab } from "./admin-types";

export async function AdminShell({
  locale,
  children,
}: {
  locale: string;
  children: React.ReactNode;
}) {
  const me = await getMe();

  if (!me || me.role !== "admin") {
    return (
      <div className="mx-auto flex min-h-full w-full max-w-6xl flex-col px-4 py-8">
        {children}
      </div>
    );
  }

  const overview = await apiServerWithSession<AdminOverview>("/v1/admin/overview");
  const badges: Partial<Record<AdminTab, number>> = {
    withdrawals: overview?.pendingWithdrawals ?? 0,
    disputes: overview?.openDisputes ?? 0,
  };

  const t = await getTranslations("admin");

  return (
    <AdminFrame locale={locale} badges={badges}>
      <p className="sr-only">{t("title")}</p>
      {children}
    </AdminFrame>
  );
}
