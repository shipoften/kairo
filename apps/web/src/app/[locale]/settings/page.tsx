import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { fetchAuthProviders } from "@/lib/auth-url";
import { buildLoginRedirect } from "@/lib/login-redirect";
import { getMe } from "@/lib/session";
import { SettingsForm } from "./settings-form";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("settings");
  const me = await getMe();
  if (!me) redirect(buildLoginRedirect(locale, "/settings"));

  const providers = await fetchAuthProviders();
  const telegramBotName = process.env.NEXT_PUBLIC_TELEGRAM_BOT_NAME ?? null;

  return (
    <main className="mx-auto w-full max-w-lg space-y-6">
      <h1 className="font-[family-name:var(--font-display)] text-3xl">{t("title")}</h1>
      <SettingsForm
        displayName={me.displayName}
        identities={me.identities}
        providers={providers}
        telegramBotName={telegramBotName}
      />
    </main>
  );
}
