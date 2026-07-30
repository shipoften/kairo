import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { buildLoginRedirect } from "@/lib/login-redirect";
import { getMe, apiServerWithSession } from "@/lib/session";
import { AdminActions } from "./admin-actions";
import type {
  AdminConfig,
  AdminDepositRow,
  AdminDisputeRow,
  AdminOverview,
  AdminWithdrawalRow,
} from "./admin-types";

export default async function AdminPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin");
  const me = await getMe();
  if (!me) redirect(buildLoginRedirect(locale, "/admin"));
  if (me.role !== "admin") {
    return <p className="text-red-700">{t("forbidden")}</p>;
  }

  const [
    overview,
    config,
    depositData,
    withdrawalData,
    userData,
    taskData,
    disputeData,
  ] = await Promise.all([
    apiServerWithSession<AdminOverview>("/v1/admin/overview"),
    apiServerWithSession<AdminConfig>("/v1/admin/config"),
    apiServerWithSession<{ items: AdminDepositRow[] }>("/v1/admin/deposits"),
    apiServerWithSession<{ items: AdminWithdrawalRow[] }>("/v1/admin/withdrawals"),
    apiServerWithSession<{
      items: Array<{
        id: string;
        displayName: string;
        role: string;
        bannedAt: string | null;
        referralEnabled: boolean;
      }>;
    }>("/v1/admin/users"),
    apiServerWithSession<{ items: Array<{ id: string; title: string; status: string }> }>(
      "/v1/admin/tasks",
    ),
    apiServerWithSession<{ items: AdminDisputeRow[] }>("/v1/admin/disputes"),
  ]);

  if (
    !overview ||
    !config ||
    !depositData ||
    !withdrawalData ||
    !userData ||
    !taskData ||
    !disputeData
  ) {
    return <p className="text-red-700">{t("forbidden")}</p>;
  }

  return (
    <main className="space-y-8">
      <h1 className="font-[family-name:var(--font-display)] text-4xl">{t("title")}</h1>
      <AdminActions
        data={{
          overview,
          config,
          deposits: depositData.items,
          withdrawals: withdrawalData.items,
          users: userData.items,
          tasks: taskData.items,
          disputes: disputeData.items,
          currentUserId: me.id,
        }}
      />
    </main>
  );
}
