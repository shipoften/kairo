"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";

export function JoinButton({
  taskId,
  label,
  confirmMessage,
}: {
  taskId: string;
  label: string;
  confirmMessage: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function join() {
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
      const message =
        typeof err === "object" && err && "message" in err
          ? String((err as { message: string }).message)
          : "Failed";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button type="button" loading={loading} onClick={join}>
        {label}
      </Button>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
