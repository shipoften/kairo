import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { ButtonLink } from "@/components/ui/button-link";
import { buildLoginRedirect } from "@/lib/login-redirect";
import { apiServerWithSession } from "@/lib/session";

export default async function EarnPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("earn");
  const me = await apiServerWithSession<{ id: string }>("/v1/me");
  if (!me) redirect(buildLoginRedirect(locale, "/earn"));

  const summary = await apiServerWithSession<{
    inProgress: number;
    pendingReview: number;
    approved: number;
  }>("/v1/joins/summary");

  return (
    <main className="space-y-6">
      <h1 className="font-[family-name:var(--font-display)] text-4xl">{t("title")}</h1>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-line bg-surface p-5">
          <p className="text-sm text-muted">{t("inProgress")}</p>
          <p className="mt-2 text-3xl">{summary?.inProgress ?? 0}</p>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-5">
          <p className="text-sm text-muted">{t("pendingReview")}</p>
          <p className="mt-2 text-3xl">{summary?.pendingReview ?? 0}</p>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-5">
          <p className="text-sm text-muted">{t("approved")}</p>
          <p className="mt-2 text-3xl">{summary?.approved ?? 0}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        <ButtonLink href="/tasks" size="sm">
          {t("browseTasks")}
        </ButtonLink>
        <ButtonLink href="/earn/joins" variant="secondary" size="sm">
          {t("myJoins")}
        </ButtonLink>
      </div>
    </main>
  );
}
