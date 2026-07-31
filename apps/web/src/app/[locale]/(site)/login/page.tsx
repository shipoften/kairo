import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { fetchAuthProviders } from "@/lib/auth-url";
import { apiServerFetch } from "@/lib/api";
import {
  resolvePostLoginPath,
  sanitizeReturnPath,
} from "@/lib/login-redirect";
import { getMe } from "@/lib/session";
import { LoginButtons } from "./login-buttons";

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    invite?: string;
    error?: string;
    returnTo?: string;
  }>;
}) {
  const { locale } = await params;
  const query = await searchParams;
  setRequestLocale(locale);

  const returnTo = sanitizeReturnPath(query.returnTo);
  const me = await getMe();
  if (me) {
    redirect(`/${locale}${resolvePostLoginPath(returnTo)}`);
  }

  const t = await getTranslations("login");
  const providers = await fetchAuthProviders();
  const telegramBotName = process.env.NEXT_PUBLIC_TELEGRAM_BOT_NAME ?? null;
  const inviteCode = query.invite ?? "";

  let inviteValid: boolean | null = null;
  if (inviteCode) {
    try {
      const check = await apiServerFetch<{ valid: boolean }>(
        `/v1/auth/invite/${encodeURIComponent(inviteCode)}/check`,
      );
      inviteValid = check.valid;
    } catch {
      inviteValid = false;
    }
  }

  return (
    <LoginButtons
      providers={providers}
      inviteCode={inviteCode}
      inviteValid={inviteValid}
      errorKey={query.error ?? null}
      returnTo={returnTo}
      telegramBotName={telegramBotName}
      loadingLabel={t("loading")}
    />
  );
}
