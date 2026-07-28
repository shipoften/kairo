import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { buildLoginRedirect } from "@/lib/login-redirect";
import { getMe, apiServerWithSession } from "@/lib/session";
import { AdminActions } from "./admin-actions";

type Config = {
  platformFeeRateBps: number;
  referralEnabled: boolean;
  referralEarnRateBps: number;
  referralPublishRateBps: number;
};

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

  const [config, depositData, withdrawalData, userData, taskData, disputeData] =
    await Promise.all([
      apiServerWithSession<Config>("/v1/admin/config"),
      apiServerWithSession<{
        items: Array<{
          id: string;
          userId: string;
          amountMicros: number;
          status: string;
          txHash: string;
          address: string;
        }>;
      }>("/v1/admin/deposits"),
      apiServerWithSession<{
        items: Array<{
          id: string;
          userId: string;
          amountMicros: number;
          networkFeeMicros: number;
          netPayoutMicros: number;
          toAddress: string;
          status: string;
          txHash: string | null;
        }>;
      }>("/v1/admin/withdrawals"),
      apiServerWithSession<{ items: Array<{ id: string; displayName: string; role: string; bannedAt: string | null }> }>(
        "/v1/admin/users",
      ),
      apiServerWithSession<{ items: Array<{ id: string; title: string; status: string }> }>(
        "/v1/admin/tasks",
      ),
      apiServerWithSession<{ items: Array<{ id: string; status: string; reason: string }> }>(
        "/v1/admin/disputes",
      ),
    ]);

  if (!config || !depositData || !withdrawalData || !userData || !taskData || !disputeData) {
    return <p className="text-red-700">{t("forbidden")}</p>;
  }

  return (
    <main className="space-y-8">
      <h1 className="font-[family-name:var(--font-display)] text-4xl">{t("title")}</h1>
      <AdminActions
        data={{
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
