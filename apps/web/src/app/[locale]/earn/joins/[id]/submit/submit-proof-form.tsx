"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ProofImageUpload } from "@/components/proof-image-upload";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import { apiFetch } from "@/lib/api";
import { resolveApiErrorMessage } from "@/lib/resolve-api-error";
import type { ProofSchema } from "@xs-share/shared";

function resolveFields(proofSchema: Record<string, unknown>) {
  const keys = Object.keys(proofSchema);
  if (keys.length === 0) {
    return {
      showUrl: true,
      showNote: true,
      showScreenshot: false,
      urlRequired: true,
      noteRequired: false,
      screenshotRequired: false,
    };
  }
  const schema = proofSchema as ProofSchema;
  return {
    showUrl: Boolean(schema.proofUrl),
    showNote: Boolean(schema.note),
    showScreenshot: Boolean(schema.screenshot),
    urlRequired: Boolean(schema.proofUrl?.required),
    noteRequired: Boolean(schema.note?.required),
    screenshotRequired: Boolean(schema.screenshot?.required),
  };
}

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

  const fields = resolveFields(proofSchema);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const proofPayload: Record<string, string> = {};
      if (fields.showUrl) proofPayload.proofUrl = proofUrl;
      if (fields.showNote) proofPayload.note = note;
      if (fields.showScreenshot) proofPayload.screenshot = screenshot;
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
      {fields.showUrl ? (
        <label className="block space-y-1 text-sm">
          <span>{t("proofUrl")}</span>
          <input
            className="w-full rounded-xl border border-line px-3 py-2"
            value={proofUrl}
            onChange={(event) => setProofUrl(event.target.value)}
            placeholder={t("proofUrlPlaceholder")}
            required={fields.urlRequired}
          />
        </label>
      ) : null}
      {fields.showScreenshot ? (
        <div className="space-y-1 text-sm">
          <span>{t("screenshot")}</span>
          <ProofImageUpload value={screenshot} onChange={setScreenshot} />
          {fields.screenshotRequired && !screenshot ? (
            <p className="text-xs text-muted">{t("screenshotRequired")}</p>
          ) : null}
        </div>
      ) : null}
      {fields.showNote ? (
        <label className="block space-y-1 text-sm">
          <span>{t("note")}</span>
          <textarea
            className="w-full rounded-xl border border-line px-3 py-2"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={4}
            required={fields.noteRequired}
          />
        </label>
      ) : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <Button
        type="submit"
        loading={loading}
        disabled={fields.screenshotRequired && !screenshot}
      >
        {t("submitProof")}
      </Button>
    </form>
  );
}
