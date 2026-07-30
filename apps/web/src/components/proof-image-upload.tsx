"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { resolveApiErrorMessage } from "@/lib/resolve-api-error";
import { UPLOAD_MAX_BYTES } from "@xs-share/shared";

type PresignResponse = {
  uploadUrl: string;
  objectKey: string;
  publicUrl: string;
  headers: Record<string, string>;
};

type ConfirmResponse = {
  publicUrl: string;
};

export function ProofImageUpload({
  value,
  onChange,
}: {
  value: string;
  onChange: (url: string) => void;
}) {
  const t = useTranslations("earn");
  const tCommon = useTranslations("common");
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFileChange(file: File | null) {
    if (!file) return;
    setError(null);
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError(t("uploadTypeInvalid"));
      return;
    }
    if (file.size <= 0 || file.size > UPLOAD_MAX_BYTES) {
      setError(t("uploadSizeInvalid"));
      return;
    }

    setLoading(true);
    try {
      const presign = await apiFetch<PresignResponse>("/v1/uploads/presign", {
        method: "POST",
        body: JSON.stringify({
          contentType: file.type,
          sizeBytes: file.size,
        }),
      });
      const putResponse = await fetch(presign.uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": file.type,
          ...(presign.headers ?? {}),
        },
        body: file,
      });
      if (!putResponse.ok) {
        throw new Error("Upload failed");
      }
      const confirmed = await apiFetch<ConfirmResponse>("/v1/uploads/confirm", {
        method: "POST",
        body: JSON.stringify({ objectKey: presign.objectKey }),
      });
      onChange(confirmed.publicUrl);
    } catch (err) {
      setError(resolveApiErrorMessage(err, tCommon, t("uploadFailed")));
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <div className="rounded-xl border border-dashed border-line bg-background px-4 py-5">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(event) =>
            void onFileChange(event.target.files?.[0] ?? null)
          }
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            loading={loading}
            onClick={() => inputRef.current?.click()}
          >
            {value ? t("replaceScreenshot") : t("uploadScreenshot")}
          </Button>
          {value ? (
            <Button
              type="button"
              size="sm"
              variant="link"
              onClick={() => onChange("")}
            >
              {t("removeScreenshot")}
            </Button>
          ) : null}
        </div>
        <p className="mt-2 text-xs text-muted">{t("uploadHint")}</p>
      </div>
      {value ? (
        <a
          href={value}
          target="_blank"
          rel="noreferrer"
          className="block overflow-hidden rounded-xl border border-line"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt=""
            className="max-h-48 w-full object-contain bg-background"
          />
        </a>
      ) : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
