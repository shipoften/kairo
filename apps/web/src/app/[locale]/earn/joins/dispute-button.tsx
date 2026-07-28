"use client";

import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";

export function DisputeButton({ joinId }: { joinId: string }) {
  const t = useTranslations("earn");
  const router = useRouter();

  async function openDispute() {
    const reason = prompt(t("disputePrompt"));
    if (!reason) return;
    await apiFetch("/v1/disputes", {
      method: "POST",
      body: JSON.stringify({ joinId, reason }),
    });
    router.refresh();
  }

  return (
    <Button type="button" variant="link" size="sm" onClick={openDispute}>
      {t("openDispute")}
    </Button>
  );
}
