"use client";

import { Button } from "@/components/ui/button";
import { DisputeButton } from "@/components/dispute-button";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { resolveApiErrorMessage } from "@/lib/resolve-api-error";

type JoinItem = {
  id: string;
  status: string;
  earnerId: string;
  earnerName: string | null;
  proofPayload: unknown;
  rejectReason: string | null;
  submittedAt: string | null;
};

function proofLines(payload: unknown): Array<{ label: string; value: string }> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return payload == null
      ? []
      : [{ label: "payload", value: String(payload) }];
  }
  return Object.entries(payload as Record<string, unknown>).map(
    ([key, value]) => ({
      label: key,
      value:
        typeof value === "string" ? value : JSON.stringify(value, null, 2),
    }),
  );
}

export function SubmissionActions({
  items,
  defaultReason,
}: {
  items: JoinItem[];
  defaultReason: string;
}) {
  const t = useTranslations("publish");
  const tEarn = useTranslations("earn");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [reason, setReason] = useState(defaultReason);
  const [error, setError] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function approve(joinId: string) {
    setError(null);
    setLoadingId(joinId);
    try {
      await apiFetch(`/v1/reviews/${joinId}/approve`, { method: "POST" });
      router.refresh();
    } catch (err) {
      setError(resolveApiErrorMessage(err, tCommon, t("actionFailed")));
    } finally {
      setLoadingId(null);
    }
  }

  async function reject(joinId: string) {
    if (!reason.trim()) {
      setError(t("rejectReasonRequired"));
      return;
    }
    setError(null);
    setLoadingId(joinId);
    try {
      await apiFetch(`/v1/reviews/${joinId}/reject`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
      router.refresh();
    } catch (err) {
      setError(resolveApiErrorMessage(err, tCommon, t("actionFailed")));
    } finally {
      setLoadingId(null);
    }
  }

  if (items.length === 0) {
    return null;
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
        {items.map((item) => {
          const lines = proofLines(item.proofPayload);
          const statusKey = item.status as
            | "joined"
            | "submitted"
            | "approved"
            | "rejected"
            | "expired"
            | "disputed";
          return (
            <li
              key={item.id}
              className="rounded-2xl border border-line bg-surface p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <p>
                  {t("earner")}: {item.earnerName ?? item.earnerId.slice(0, 8)}
                </p>
                <p className="text-muted">
                  {tEarn.has(`status.${statusKey}`)
                    ? tEarn(`status.${statusKey}`)
                    : item.status}
                </p>
              </div>
              {item.submittedAt ? (
                <p className="mt-1 text-xs text-muted">
                  {t("submittedAt")}:{" "}
                  {new Date(item.submittedAt).toLocaleString()}
                </p>
              ) : null}
              <div className="mt-3 space-y-1 text-sm">
                <p className="font-medium">{t("proof")}</p>
                {lines.length === 0 ? (
                  <p className="text-muted">—</p>
                ) : (
                  lines.map((line) => (
                    <p key={line.label} className="break-all text-muted">
                      <span className="text-foreground">{line.label}:</span>{" "}
                      {line.value.startsWith("http") ? (
                        <a
                          href={line.value}
                          target="_blank"
                          rel="noreferrer"
                          className="text-accent underline"
                        >
                          {line.value}
                        </a>
                      ) : (
                        line.value
                      )}
                    </p>
                  ))
                )}
              </div>
              {item.status === "submitted" || item.status === "disputed" ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="xs"
                    loading={loadingId === item.id}
                    onClick={() => void approve(item.id)}
                  >
                    {t("approve")}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="xs"
                    loading={loadingId === item.id}
                    onClick={() => void reject(item.id)}
                  >
                    {t("reject")}
                  </Button>
                </div>
              ) : null}
              {item.status === "submitted" || item.status === "rejected" ? (
                <DisputeButton joinId={item.id} />
              ) : null}
              {item.rejectReason ? (
                <p className="mt-2 text-sm text-red-700">{item.rejectReason}</p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </>
  );
}
