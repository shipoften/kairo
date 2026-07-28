"use client";

import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";

export function TaskStatusActions({
  taskId,
  status,
}: {
  taskId: string;
  status: string;
}) {
  const t = useTranslations("publish");
  const router = useRouter();

  async function updateStatus(nextStatus: string) {
    await apiFetch(`/v1/tasks/${taskId}`, {
      method: "PATCH",
      body: JSON.stringify({ status: nextStatus }),
    });
    router.refresh();
  }

  if (status === "draft") {
    return (
      <Button
        type="button"
        variant="link"
        size="sm"
        onClick={async () => {
          await apiFetch(`/v1/tasks/${taskId}/publish`, { method: "POST" });
          router.refresh();
        }}
      >
        {t("publishTask")}
      </Button>
    );
  }

  if (status === "recruiting") {
    return (
      <>
        <Button
          type="button"
          variant="link"
          size="sm"
          onClick={() => updateStatus("paused")}
        >
          {t("pause")}
        </Button>
        <Button
          type="button"
          variant="link"
          size="sm"
          onClick={() => updateStatus("ended")}
        >
          {t("end")}
        </Button>
      </>
    );
  }

  if (status === "paused") {
    return (
      <Button
        type="button"
        variant="link"
        size="sm"
        onClick={() => updateStatus("recruiting")}
      >
        {t("resume")}
      </Button>
    );
  }

  return null;
}
