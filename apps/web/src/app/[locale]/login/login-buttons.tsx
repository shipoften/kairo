"use client";

import { useLocale, useTranslations } from "next-intl";
import { SiteLogo } from "@/components/site-logo";
import { TelegramLoginWidget } from "@/components/telegram-login-widget";
import { Alert } from "@/components/ui/alert";
import { ButtonAnchor } from "@/components/ui/button-anchor";
import { Card } from "@/components/ui/card";
import { oauthStartUrl } from "@/lib/auth-url";
import { API_URL } from "@/lib/api";
import { resolvePostLoginPath } from "@/lib/login-redirect";
import DevLoginForm from "./dev-login-form";

type Providers = {
  google: boolean;
  x: boolean;
  telegram: boolean;
  devLogin: boolean;
};

export function LoginButtons({
  providers,
  inviteCode,
  inviteValid,
  errorKey,
  returnTo,
  telegramBotName,
  loadingLabel,
}: {
  providers: Providers;
  inviteCode: string;
  inviteValid: boolean | null;
  errorKey: string | null;
  returnTo: string | null;
  telegramBotName: string | null;
  loadingLabel: string;
}) {
  const t = useTranslations("login");
  const brand = useTranslations("brand");
  const locale = useLocale();

  async function onTelegramAuth(user: Record<string, string>) {
    const response = await fetch(`${API_URL}/v1/auth/telegram/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        ...user,
        locale,
        inviteCode: inviteCode || undefined,
        returnTo: returnTo ?? undefined,
      }),
    });
    if (!response.ok) {
      window.location.href = `/${locale}/login?error=telegram_failed${
        returnTo ? `&returnTo=${encodeURIComponent(returnTo)}` : ""
      }${inviteCode ? `&invite=${encodeURIComponent(inviteCode)}` : ""}`;
      return;
    }
    const data = (await response.json()) as { redirectTo: string };
    window.location.href = `/${locale}${resolvePostLoginPath(data.redirectTo)}`;
  }

  const oauthOptions = {
    invite: inviteCode || undefined,
    returnTo: returnTo ?? undefined,
  };

  return (
    <main className="mx-auto w-full max-w-md space-y-6">
      <div className="space-y-4 text-center">
        <div className="flex justify-center">
          <SiteLogo name={brand("name")} showName={false} size={56} />
        </div>
        <div className="space-y-2">
          <h1 className="font-[family-name:var(--font-display)] text-3xl">
            {t("title")}
          </h1>
          <p className="text-muted">{t("subtitle")}</p>
          <p className="text-sm text-muted">{t("autoRegisterHint")}</p>
        </div>
      </div>

      {inviteCode ? (
        <Alert variant={inviteValid === false ? "error" : "success"}>
          {inviteValid === false
            ? t("inviteInvalid")
            : t("inviteApplied", { code: inviteCode })}
        </Alert>
      ) : null}

      {errorKey ? (
        <Alert variant="error">
          {t.has(`errors.${errorKey}`)
            ? t(`errors.${errorKey}`)
            : t("errors.oauth_failed")}
        </Alert>
      ) : null}

      <Card className="space-y-3 p-6">
        {providers.x ? (
          <ButtonAnchor
            href={oauthStartUrl("x", locale, oauthOptions)}
            variant="secondary"
            fullWidth
          >
            {t("continueX")}
          </ButtonAnchor>
        ) : null}
        {providers.google ? (
          <ButtonAnchor
            href={oauthStartUrl("google", locale, oauthOptions)}
            variant="secondary"
            fullWidth
          >
            {t("continueGoogle")}
          </ButtonAnchor>
        ) : null}
        {providers.telegram && telegramBotName ? (
          <TelegramLoginWidget
            botName={telegramBotName}
            onAuth={onTelegramAuth}
          />
        ) : null}
        {!providers.google && !providers.x && !providers.telegram ? (
          <p className="text-sm text-muted">{t("oauthNotConfigured")}</p>
        ) : null}
      </Card>

      {providers.devLogin &&
      !providers.google &&
      !providers.x &&
      !providers.telegram ? (
        <DevLoginForm
          inviteCode={inviteCode}
          returnTo={returnTo}
          loadingLabel={loadingLabel}
        />
      ) : null}
    </main>
  );
}
