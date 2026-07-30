"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { TelegramLoginWidget } from "@/components/telegram-login-widget";
import { Button } from "@/components/ui/button";
import { ButtonAnchor } from "@/components/ui/button-anchor";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { API_URL } from "@/lib/api";
import { apiFetch } from "@/lib/api";
import { oauthStartUrl } from "@/lib/auth-url";

type Identity = { provider: string; providerUserId: string };

type Providers = {
  google: boolean;
  x: boolean;
  telegram: boolean;
  devLogin: boolean;
};

function providerLabel(
  provider: string,
  translate: (key: string) => string,
): string {
  const key = `providers.${provider}`;
  try {
    return translate(key);
  } catch {
    return provider;
  }
}

export function SettingsForm({
  displayName: initialName,
  identities,
  providers,
  telegramBotName,
  notifyEmail: initialNotifyEmail,
  notifyTelegram: initialNotifyTelegram,
  notifyEmailEnabled: initialNotifyEmailEnabled,
  telegramChatId,
}: {
  displayName: string;
  identities: Identity[];
  providers: Providers;
  telegramBotName: string | null;
  notifyEmail: string | null;
  notifyTelegram: boolean;
  notifyEmailEnabled: boolean;
  telegramChatId: string | null;
}) {
  const t = useTranslations("settings");
  const locale = useLocale();
  const router = useRouter();
  const [displayName, setDisplayName] = useState(initialName);
  const [notifyEmail, setNotifyEmail] = useState(initialNotifyEmail ?? "");
  const [notifyTelegram, setNotifyTelegram] = useState(initialNotifyTelegram);
  const [notifyEmailEnabled, setNotifyEmailEnabled] = useState(
    initialNotifyEmailEnabled,
  );
  const [message, setMessage] = useState<string | null>(null);

  async function save() {
    await apiFetch("/v1/me", {
      method: "PATCH",
      body: JSON.stringify({
        displayName,
        preferredLocale: locale,
        notifyEmail: notifyEmail.trim() || null,
        notifyTelegram,
        notifyEmailEnabled,
      }),
    });
    setMessage(t("saved"));
    router.refresh();
  }

  async function unbind(provider: string) {
    if (!confirm(t("unbindConfirm"))) return;
    await apiFetch(`/v1/auth/bind/${provider}`, { method: "DELETE" });
    router.refresh();
  }

  async function onTelegramBind(user: Record<string, string>) {
    const response = await fetch(`${API_URL}/v1/auth/telegram/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        ...user,
        locale,
        returnTo: "/settings",
      }),
    });
    if (!response.ok) return;
    router.refresh();
  }

  const boundProviders = new Set(identities.map((item) => item.provider));

  return (
    <>
      <section className="space-y-4 rounded-2xl border border-line bg-surface p-6">
        <h2 className="font-medium">{t("profile")}</h2>
        <div className="space-y-1.5">
          <Label htmlFor="settings-display-name">{t("displayName")}</Label>
          <Input
            id="settings-display-name"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder={t("displayNamePlaceholder")}
          />
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <span className="text-muted">{t("language")}:</span>
          <Link href="/settings" locale="en" className={locale === "en" ? "text-accent" : ""}>
            English
          </Link>
          <Link href="/settings" locale="zh" className={locale === "zh" ? "text-accent" : ""}>
            中文
          </Link>
        </div>
        <Button type="button" size="sm" onClick={save}>
          {t("save")}
        </Button>
        {message ? <p className="text-sm text-accent">{message}</p> : null}
      </section>

      <section className="space-y-4 rounded-2xl border border-line bg-surface p-6">
        <h2 className="font-medium">{t("notifications")}</h2>
        <p className="text-sm text-muted">{t("notificationsHint")}</p>
        <div className="space-y-1.5">
          <Label htmlFor="settings-notify-email">{t("notifyEmail")}</Label>
          <Input
            id="settings-notify-email"
            type="email"
            value={notifyEmail}
            onChange={(event) => setNotifyEmail(event.target.value)}
            placeholder={t("notifyEmailPlaceholder")}
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={notifyEmailEnabled}
            onChange={(event) => setNotifyEmailEnabled(event.target.checked)}
          />
          {t("notifyEmailEnabled")}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={notifyTelegram}
            onChange={(event) => setNotifyTelegram(event.target.checked)}
            disabled={!telegramChatId}
          />
          {t("notifyTelegram")}
        </label>
        {!telegramChatId ? (
          <p className="text-xs text-muted">{t("telegramNotifyHint")}</p>
        ) : null}
        <Button type="button" size="sm" onClick={save}>
          {t("save")}
        </Button>
      </section>

      <section className="space-y-3 rounded-2xl border border-line bg-surface p-6">
        <h2 className="font-medium">{t("bindings")}</h2>
        <ul className="space-y-2 text-sm">
          {identities.map((identity) => (
            <li
              key={`${identity.provider}-${identity.providerUserId}`}
              className="flex items-center justify-between gap-2"
            >
              <span>
                {providerLabel(identity.provider, (key) => t(key as "providers.x"))}:{" "}
                {identity.providerUserId}
              </span>
              {identities.length > 1 ? (
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  onClick={() => unbind(identity.provider)}
                >
                  {t("unbind")}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2">
          {providers.x && !boundProviders.has("x") ? (
            <ButtonAnchor
              href={oauthStartUrl("x", locale, { returnTo: "/settings" })}
              variant="secondary"
              size="xs"
            >
              {t("bindX")}
            </ButtonAnchor>
          ) : null}
          {providers.google && !boundProviders.has("google") ? (
            <ButtonAnchor
              href={oauthStartUrl("google", locale, { returnTo: "/settings" })}
              variant="secondary"
              size="xs"
            >
              {t("bindGoogle")}
            </ButtonAnchor>
          ) : null}
        </div>
        {providers.telegram && telegramBotName && !boundProviders.has("telegram") ? (
          <TelegramLoginWidget
            botName={telegramBotName}
            onAuth={onTelegramBind}
            label={t("bindTelegram")}
          />
        ) : null}
      </section>
    </>
  );
}
