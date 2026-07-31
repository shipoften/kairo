import { setRequestLocale } from "next-intl/server";
import { apiServerWithSession } from "@/lib/session";
import { AdminTasksSection } from "../admin-sections";
import { requireAdmin } from "../require-admin";
import type { AdminTaskRow } from "../admin-types";

export default async function AdminTasksPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const auth = await requireAdmin(locale);
  if (auth.forbidden) return auth.forbidden;

  const data = await apiServerWithSession<{ items: AdminTaskRow[] }>(
    "/v1/admin/tasks",
  );
  if (!data) return auth.forbidden;

  return <AdminTasksSection tasks={data.items} />;
}
