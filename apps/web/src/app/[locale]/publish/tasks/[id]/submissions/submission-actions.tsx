"use client";

import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { apiFetch } from "@/lib/api";

type JoinItem = {
  id: string;
  status: string;
  earnerId: string;
  proofPayload: unknown;
  rejectReason: string | null;
};

export function SubmissionActions({
  items,
  defaultReason,
}: {
  items: JoinItem[];
  defaultReason: string;
}) {
  const t = useTranslations("publish");
  const router = useRouter();
  const [reason, setReason] = useState(defaultReason);
  const [error, setError] = useState<string | null>(null);

  async function approve(joinId: string) {
    setError(null);
    try {
      await apiFetch(`/v1/reviews/${joinId}/approve`, { method: "POST" });
      router.refresh();
    } catch (err) {
      setError(
        typeof err === "object" && err && "message" in err
          ? String((err as { message: string }).message)
          : "Failed",
      );
    }
  }

  async function reject(joinId: string) {
    if (!reason.trim()) {
      setError(t("rejectReasonRequired"));
      return;
    }
    setError(null);
    try {
      await apiFetch(`/v1/reviews/${joinId}/reject`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
      router.refresh();
    } catch (err) {
      setError(
        typeof err === "object" && err && "message" in err
          ? String((err as { message: string }).message)
          : "Failed",
      );
    }
  }

  return (
    <>
      <label className="block max-w-md space-y-1 text-sm">
        <span>{t("rejectReason")}</span>
        <input
          className="w-full rounded-xl border border-line px-3 py-2"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </label>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.id} className="rounded-2xl border border-line bg-surface p-4">
            <p className="text-sm">
              {item.id.slice(0, 8)} · {item.status}
            </p>
            <pre className="mt-2 overflow-auto text-xs text-muted">
              {JSON.stringify(item.proofPayload, null, 2)}
            </pre>
            {item.status === "submitted" || item.status === "disputed" ? (
              <div className="mt-3 flex gap-2">
                <Button type="button" size="xs" onClick={() => approve(item.id)}>
                  {t("approve")}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="xs"
                  onClick={() => reject(item.id)}
                >
                  {t("reject")}
                </Button>
              </div>
            ) : null}
            {item.rejectReason ? (
              <p className="mt-2 text-sm text-red-700">{item.rejectReason}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </>
  );
}
