"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";

declare global {
  interface Window {
    xsTelegramAuth?: (user: Record<string, string>) => void;
  }
}

export function TelegramLoginWidget({
  botName,
  onAuth,
  label,
}: {
  botName: string;
  onAuth: (user: Record<string, string>) => void;
  label?: string;
}) {
  const t = useTranslations("login");

  useEffect(() => {
    window.xsTelegramAuth = onAuth;
    const container = document.getElementById("telegram-login-widget");
    if (!container) return;
    container.innerHTML = "";
    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.setAttribute("data-telegram-login", botName);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-onauth", "xsTelegramAuth(user)");
    script.setAttribute("data-request-access", "write");
    container.appendChild(script);
    return () => {
      delete window.xsTelegramAuth;
    };
  }, [botName, onAuth]);

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted">{label ?? t("continueTelegram")}</p>
      <div id="telegram-login-widget" />
    </div>
  );
}
