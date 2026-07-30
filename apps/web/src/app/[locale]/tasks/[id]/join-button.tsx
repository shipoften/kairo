"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { resolveApiErrorMessage } from "@/lib/resolve-api-error";

export function JoinButton({
  taskId,
  label,
  confirmMessage,
  disabled,
  disabledReason,
}: {
  taskId: string;
  label: string;
  confirmMessage: string;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const router = useRouter();
  const t = useTranslations("tasks");
  const tCommon = useTranslations("common");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function join() {
    if (disabled) return;
    if (!confirm(confirmMessage)) return;
    setLoading(true);
    setError(null);
    try {
      await apiFetch("/v1/joins", {
        method: "POST",
        body: JSON.stringify({ taskId }),
      });
      router.push("/earn/joins");
      router.refresh();
    } catch (err) {
      setError(resolveApiErrorMessage(err, tCommon, t("actionFailed")));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        loading={loading}
        disabled={disabled}
        fullWidth
        onClick={() => void join()}
      >
        {label}
      </Button>
      {disabled && disabledReason ? (
        <p className="text-sm text-muted">{disabledReason}</p>
      ) : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
