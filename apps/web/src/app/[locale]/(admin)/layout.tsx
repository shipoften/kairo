import { setRequestLocale } from "next-intl/server";
import { AdminShell } from "./admin/admin-shell";

export default async function AdminGroupLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <AdminShell locale={locale}>{children}</AdminShell>;
}
