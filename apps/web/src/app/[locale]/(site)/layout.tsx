import { setRequestLocale } from "next-intl/server";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { apiServerWithSession, getMe } from "@/lib/session";

export default async function SiteLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const me = await getMe();
  const notifications = me
    ? await apiServerWithSession<{ unreadCount: number }>("/v1/notifications")
    : null;

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader
        locale={locale}
        me={
          me
            ? {
                id: me.id,
                displayName: me.displayName,
                preferredMode: me.preferredMode,
                role: me.role,
              }
            : null
        }
        unreadCount={notifications?.unreadCount ?? 0}
      />
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-8">
        {children}
      </div>
      <SiteFooter />
    </div>
  );
}
