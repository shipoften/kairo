"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";

export function SubmitProofForm({
  joinId,
  proofSchema,
}: {
  joinId: string;
  proofSchema: Record<string, unknown>;
}) {
  const t = useTranslations("earn");
  const router = useRouter();
  const [proofUrl, setProofUrl] = useState("");
  const [note, setNote] = useState("");
  const [screenshot, setScreenshot] = useState("");
  const [error, setError] = useState<string | null>(null);

  const fields = Object.keys(proofSchema);
  const showUrl = fields.length === 0 || fields.includes("url");
  const showNote = fields.length === 0 || fields.includes("note");
  const showScreenshot = fields.includes("screenshot");

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      const proofPayload: Record<string, string> = {};
      if (showUrl) proofPayload.proofUrl = proofUrl;
      if (showNote) proofPayload.note = note;
      if (showScreenshot) proofPayload.screenshot = screenshot;
      await apiFetch(`/v1/joins/${joinId}/submit`, {
        method: "POST",
        body: JSON.stringify({ proofPayload }),
      });
      router.push("/earn/joins");
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
    <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-line bg-surface p-6">
      {showUrl ? (
        <label className="block space-y-1 text-sm">
          <span>{t("proofUrl")}</span>
          <input
            className="w-full rounded-xl border border-line px-3 py-2"
            value={proofUrl}
            onChange={(event) => setProofUrl(event.target.value)}
            required
          />
        </label>
      ) : null}
      {showScreenshot ? (
        <label className="block space-y-1 text-sm">
          <span>{t("screenshot")}</span>
          <input
            className="w-full rounded-xl border border-line px-3 py-2"
            value={screenshot}
            onChange={(event) => setScreenshot(event.target.value)}
            placeholder="https://"
          />
        </label>
      ) : null}
      {showNote ? (
        <label className="block space-y-1 text-sm">
          <span>{t("note")}</span>
          <textarea
            className="w-full rounded-xl border border-line px-3 py-2"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={3}
          />
        </label>
      ) : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <Button type="submit">{t("submit")}</Button>
    </form>
  );
}
