"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { resolveApiErrorMessage } from "@/lib/resolve-api-error";

export function SubmitProofForm({
  joinId,
  proofSchema,
}: {
  joinId: string;
  proofSchema: Record<string, unknown>;
}) {
  const t = useTranslations("earn");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [proofUrl, setProofUrl] = useState("");
  const [note, setNote] = useState("");
  const [screenshot, setScreenshot] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fields = Object.keys(proofSchema);
  const showUrl = fields.length === 0 || fields.includes("url");
  const showNote = fields.length === 0 || fields.includes("note");
  const showScreenshot = fields.includes("screenshot");

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
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
      setError(resolveApiErrorMessage(err, tCommon, t("actionFailed")));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={(event) => void onSubmit(event)}
      className="space-y-4 rounded-2xl border border-line bg-surface p-6"
    >
      {showUrl ? (
        <label className="block space-y-1 text-sm">
          <span>{t("proofUrl")}</span>
          <input
            className="w-full rounded-xl border border-line px-3 py-2"
            value={proofUrl}
            onChange={(event) => setProofUrl(event.target.value)}
            placeholder={t("proofUrlPlaceholder")}
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
            placeholder={t("proofUrlPlaceholder")}
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
      <Button type="submit" loading={loading}>
        {t("submit")}
      </Button>
    </form>
  );
}
