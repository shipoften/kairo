import { setRequestLocale } from "next-intl/server";
import { apiServerWithSession } from "@/lib/session";
import { AdminDisputesSection } from "../admin-sections";
import { requireAdmin } from "../require-admin";
import type { AdminDisputeRow } from "../admin-types";

export default async function AdminDisputesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const auth = await requireAdmin(locale);
  if (auth.forbidden) return auth.forbidden;

  const data = await apiServerWithSession<{ items: AdminDisputeRow[] }>(
    "/v1/admin/disputes",
  );
  if (!data) return auth.forbidden;

  return <AdminDisputesSection disputes={data.items} />;
}
