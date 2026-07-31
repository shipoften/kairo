import { setRequestLocale } from "next-intl/server";
import { apiServerWithSession } from "@/lib/session";
import { AdminConfigSection } from "../admin-sections";
import { requireAdmin } from "../require-admin";
import type { AdminConfig } from "../admin-types";

export default async function AdminConfigPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const auth = await requireAdmin(locale);
  if (auth.forbidden) return auth.forbidden;

  const config = await apiServerWithSession<AdminConfig>("/v1/admin/config");
  if (!config) return auth.forbidden;

  return <AdminConfigSection config={config} />;
}
