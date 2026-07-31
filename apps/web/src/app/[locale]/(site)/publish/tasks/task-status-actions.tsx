"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { resolveApiErrorMessage } from "@/lib/resolve-api-error";

export function TaskStatusActions({
  taskId,
  status,
}: {
  taskId: string;
  status: string;
}) {
  const t = useTranslations("publish");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<void>) {
    setLoading(true);
    setError(null);
    try {
      await action();
      router.refresh();
    } catch (err) {
      setError(resolveApiErrorMessage(err, tCommon, t("actionFailed")));
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(nextStatus: string) {
    if (nextStatus === "ended" && !confirm(t("endConfirm"))) return;
    await run(async () => {
      await apiFetch(`/v1/tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      });
    });
  }

  const actions = (
    <>
      {status === "draft" ? (
        <Button
          type="button"
          variant="link"
          size="sm"
          loading={loading}
          onClick={() =>
            void run(async () => {
              await apiFetch(`/v1/tasks/${taskId}/publish`, { method: "POST" });
            })
          }
        >
          {t("publishTask")}
        </Button>
      ) : null}
      {status === "recruiting" ? (
        <>
          <Button
            type="button"
            variant="link"
            size="sm"
            loading={loading}
            onClick={() => void updateStatus("paused")}
          >
            {t("pause")}
          </Button>
          <Button
            type="button"
            variant="link"
            size="sm"
            loading={loading}
            onClick={() => void updateStatus("ended")}
          >
            {t("end")}
          </Button>
        </>
      ) : null}
      {status === "paused" ? (
        <>
          <Button
            type="button"
            variant="link"
            size="sm"
            loading={loading}
            onClick={() => void updateStatus("recruiting")}
          >
            {t("resume")}
          </Button>
          <Button
            type="button"
            variant="link"
            size="sm"
            loading={loading}
            onClick={() => void updateStatus("ended")}
          >
            {t("end")}
          </Button>
        </>
      ) : null}
      {status === "full" ? (
        <Button
          type="button"
          variant="link"
          size="sm"
          loading={loading}
          onClick={() => void updateStatus("ended")}
        >
          {t("end")}
        </Button>
      ) : null}
    </>
  );

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-2">{actions}</div>
      {error ? <p className="text-xs text-red-700">{error}</p> : null}
    </div>
  );
}
