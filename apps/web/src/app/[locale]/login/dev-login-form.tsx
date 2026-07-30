"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "@/i18n/navigation";
import { apiFetch } from "@/lib/api";
import { resolvePostLoginPath } from "@/lib/login-redirect";
import { resolveLoginErrorMessage } from "@/lib/resolve-api-error";

export default function DevLoginForm({
  inviteCode,
  returnTo,
  loadingLabel,
}: {
  inviteCode: string;
  returnTo: string | null;
  loadingLabel: string;
}) {
  const t = useTranslations("login");
  const router = useRouter();
  const locale = useLocale();
  const [externalId, setExternalId] = useState("dev-admin");
  const [displayName, setDisplayName] = useState("Admin");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await apiFetch("/v1/auth/dev-login", {
        method: "POST",
        body: JSON.stringify({
          externalId,
          displayName,
          inviteCode: inviteCode || undefined,
          locale,
        }),
      });
      router.push(resolvePostLoginPath(returnTo));
      router.refresh();
    } catch (err) {
      setError(
        resolveLoginErrorMessage(err, (key) => t(key as "errors.oauth_failed"), t("errors.oauth_failed")),
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <details className="rounded-2xl border border-line bg-surface p-6">
      <summary className="cursor-pointer text-sm text-muted">{t("devSection")}</summary>
      <form onSubmit={onSubmit} className="mt-4 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="dev-external-id">{t("externalId")}</Label>
          <Input
            id="dev-external-id"
            value={externalId}
            onChange={(event) => setExternalId(event.target.value)}
            placeholder={t("externalIdPlaceholder")}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="dev-display-name">{t("displayName")}</Label>
          <Input
            id="dev-display-name"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder={t("displayNamePlaceholder")}
          />
        </div>
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        <Button type="submit" fullWidth loading={loading}>
          {loading ? loadingLabel : t("devLogin")}
        </Button>
      </form>
    </details>
  );
}
