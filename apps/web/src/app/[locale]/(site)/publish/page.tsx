import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { ButtonLink } from "@/components/ui/button-link";
import { buildLoginRedirect } from "@/lib/login-redirect";
import { apiServerWithSession } from "@/lib/session";

export default async function PublishPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("publish");
  const me = await apiServerWithSession<{ id: string }>("/v1/me");
  if (!me) redirect(buildLoginRedirect(locale, "/publish"));

  const summary = await apiServerWithSession<{
    activeTasks: number;
    pendingReviews: number;
    frozenMicros: number;
  }>("/v1/tasks/summary");

  return (
    <main className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-[family-name:var(--font-display)] text-4xl">{t("title")}</h1>
        <ButtonLink href="/publish/tasks/new" size="sm">
          {t("create")}
        </ButtonLink>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-line bg-surface p-5">
          <p className="text-sm text-muted">{t("activeTasks")}</p>
          <p className="mt-2 text-3xl">{summary?.activeTasks ?? 0}</p>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-5">
          <p className="text-sm text-muted">{t("pendingReview")}</p>
          <p className="mt-2 text-3xl">{summary?.pendingReviews ?? 0}</p>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-5">
          <p className="text-sm text-muted">{t("frozenBudget")}</p>
          <p className="mt-2 text-3xl">
            {((summary?.frozenMicros ?? 0) / 1_000_000).toFixed(2)}
          </p>
        </div>
      </div>

      <ButtonLink href="/publish/tasks" variant="link" size="sm">
        {t("myTasks")} →
      </ButtonLink>
    </main>
  );
}
