import { setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { apiServerWithSession } from "@/lib/session";
import { AdminOverviewSection } from "./admin-sections";
import { adminHref, isAdminTab } from "./admin-nav";
import { requireAdmin } from "./require-admin";
import type { AdminOverview } from "./admin-types";

export default async function AdminOverviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const query = await searchParams;
  const rawTab = Array.isArray(query.tab) ? query.tab[0] : query.tab;
  if (isAdminTab(rawTab) && rawTab !== "overview") {
    redirect({ href: adminHref(rawTab), locale });
  }

  const auth = await requireAdmin(locale);
  if (auth.forbidden) return auth.forbidden;

  const overview = await apiServerWithSession<AdminOverview>("/v1/admin/overview");
  if (!overview) return auth.forbidden;

  return <AdminOverviewSection overview={overview} />;
}
