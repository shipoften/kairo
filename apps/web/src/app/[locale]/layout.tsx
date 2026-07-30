import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { DM_Sans, Lora } from "next/font/google";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { routing } from "@/i18n/routing";
import { apiServerWithSession, getMe } from "@/lib/session";
import "../globals.css";

const display = Lora({
  subsets: ["latin"],
  variable: "--font-display",
});

const body = DM_Sans({
  subsets: ["latin"],
  variable: "--font-body",
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as "en" | "zh")) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();
  const me = await getMe();
  const notifications = me
    ? await apiServerWithSession<{ unreadCount: number }>("/v1/notifications")
    : null;

  return (
    <html lang={locale} className={`${display.variable} ${body.variable} h-full`}>
      <body className="min-h-full flex flex-col antialiased">
        <NextIntlClientProvider messages={messages}>
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
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
