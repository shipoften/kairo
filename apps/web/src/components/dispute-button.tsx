"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { resolveApiErrorMessage } from "@/lib/resolve-api-error";

export function DisputeButton({ joinId }: { joinId: string }) {
  const t = useTranslations("earn");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submitDispute(event: React.FormEvent) {
    event.preventDefault();
    if (!reason.trim()) {
      setError(t("disputeReasonRequired"));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await apiFetch("/v1/disputes", {
        method: "POST",
        body: JSON.stringify({ joinId, reason: reason.trim() }),
      });
      setOpen(false);
      setReason("");
      router.refresh();
    } catch (err) {
      setError(resolveApiErrorMessage(err, tCommon, t("actionFailed")));
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <Button
        type="button"
        variant="link"
        size="sm"
        onClick={() => setOpen(true)}
      >
        {t("openDispute")}
      </Button>
    );
  }

  return (
    <form
      onSubmit={(event) => void submitDispute(event)}
      className="mt-2 w-full max-w-md space-y-2 rounded-xl border border-line bg-background p-3"
    >
      <label className="block space-y-1 text-sm">
        <span>{t("disputeReason")}</span>
        <textarea
          className="w-full rounded-xl border border-line px-3 py-2"
          rows={3}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder={t("disputePrompt")}
          required
        />
      </label>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" loading={loading}>
          {t("disputeSubmit")}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={loading}
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
        >
          {t("disputeCancel")}
        </Button>
      </div>
    </form>
  );
}
