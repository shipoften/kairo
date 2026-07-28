import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { buildLoginRedirect } from "@/lib/login-redirect";
import { apiServerWithSession } from "@/lib/session";
import { SubmissionActions } from "./submission-actions";

type JoinItem = {
  id: string;
  status: string;
  earnerId: string;
  proofPayload: unknown;
  rejectReason: string | null;
};

export default async function SubmissionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { locale, id } = await params;
  const { status } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("publish");

  const data = await apiServerWithSession<{ items: JoinItem[] }>(
    `/v1/tasks/${id}/submissions`,
  );
  if (!data) redirect(buildLoginRedirect(locale, `/publish/tasks/${id}/submissions`));

  const items = status
    ? data.items.filter((item) => item.status === status)
    : data.items;

  return (
    <main className="space-y-6">
      <h1 className="font-[family-name:var(--font-display)] text-3xl">{t("submissions")}</h1>
      <div className="flex gap-2 text-sm">
        <a href={`?`} className={!status ? "text-accent" : "text-muted"}>
          {t("filterAll")}
        </a>
        <a href={`?status=submitted`} className={status === "submitted" ? "text-accent" : "text-muted"}>
          {t("filterPending")}
        </a>
      </div>
      <SubmissionActions
        items={items}
        defaultReason={t("defaultRejectReason")}
      />
    </main>
  );
}
