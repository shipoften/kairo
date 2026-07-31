import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { buildLoginRedirect } from "@/lib/login-redirect";
import { apiServerWithSession } from "@/lib/session";
import { InviteCopyClient } from "./invite-copy";

type ReferralData = {
  inviteCode: string;
  inviteUrl: string;
  inviteeCount: number;
  totalRewardMicros: number;
  rewards: Array<{ id: string; amountMicros: number; trigger: string }>;
};

export default async function InvitePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("invite");
  const data = await apiServerWithSession<ReferralData>("/v1/referral");
  if (!data) redirect(buildLoginRedirect(locale, "/invite"));

  return (
    <main className="space-y-6">
      <h1 className="font-[family-name:var(--font-display)] text-4xl">{t("title")}</h1>
      <div className="space-y-2 rounded-2xl border border-line bg-surface p-5">
        <p className="text-sm text-muted">{t("code")}</p>
        <p className="text-2xl font-medium">{data.inviteCode}</p>
        <p className="break-all text-sm">{data.inviteUrl}</p>
        <InviteCopyClient url={data.inviteUrl} label={t("copy")} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-line bg-surface p-5">
          <p className="text-sm text-muted">{t("invitees")}</p>
          <p className="mt-2 text-3xl">{data.inviteeCount}</p>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-5">
          <p className="text-sm text-muted">{t("total")}</p>
          <p className="mt-2 text-3xl">{(data.totalRewardMicros / 1_000_000).toFixed(2)}</p>
        </div>
      </div>
      <ul className="space-y-2">
        {data.rewards.map((reward) => (
          <li key={reward.id} className="rounded-xl border border-line bg-surface px-4 py-3 text-sm">
            {reward.trigger}: {(reward.amountMicros / 1_000_000).toFixed(2)}
          </li>
        ))}
      </ul>
    </main>
  );
}
