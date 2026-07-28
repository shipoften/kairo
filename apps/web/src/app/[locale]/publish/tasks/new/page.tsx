"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { apiFetch } from "@/lib/api";
import { displayUsdt, usdtToMicros } from "@/lib/money";

const TYPES = [
  "x_follow",
  "x_like",
  "x_repost",
  "x_post",
  "cpa_register",
  "custom",
] as const;

export default function NewTaskPage() {
  const t = useTranslations("publish");
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<(typeof TYPES)[number]>("x_follow");
  const [targetUrl, setTargetUrl] = useState("");
  const [unitPriceUsdt, setUnitPriceUsdt] = useState(1);
  const [totalQuota, setTotalQuota] = useState(10);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unitPriceMicros = usdtToMicros(unitPriceUsdt);
  const freezeMicros = unitPriceMicros * totalQuota;

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!confirmed) {
      setError(t("confirmFreezeRequired"));
      return;
    }
    setError(null);
    try {
      const result = await apiFetch<{ task: { id: string } }>("/v1/tasks", {
        method: "POST",
        body: JSON.stringify({
          title,
          description,
          type,
          targetUrl,
          unitPriceMicros,
          totalQuota,
          publish: true,
        }),
      });
      router.push(`/publish/tasks/${result.task.id}/submissions`);
      router.refresh();
    } catch (err) {
      const message =
        typeof err === "object" && err && "message" in err
          ? String((err as { message: string }).message)
          : "Failed";
      setError(message);
    }
  }

  return (
    <main className="mx-auto w-full max-w-xl space-y-6">
      <h1 className="font-[family-name:var(--font-display)] text-3xl">
        {t("create")}
      </h1>
      <form
        onSubmit={onSubmit}
        className="space-y-4 rounded-2xl border border-line bg-surface p-6"
      >
        <label className="block space-y-1 text-sm">
          <span>{t("fieldTitle")}</span>
          <input
            className="w-full rounded-xl border border-line px-3 py-2"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span>{t("fieldDescription")}</span>
          <textarea
            className="w-full rounded-xl border border-line px-3 py-2"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={4}
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span>{t("fieldType")}</span>
          <Select
            aria-label={t("fieldType")}
            value={type}
            options={TYPES.map((item) => ({ value: item, label: item }))}
            onValueChange={(value) => setType(value as (typeof TYPES)[number])}
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span>{t("fieldTargetUrl")}</span>
          <input
            className="w-full rounded-xl border border-line px-3 py-2"
            value={targetUrl}
            onChange={(event) => setTargetUrl(event.target.value)}
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span>{t("fieldUnitPrice")}</span>
          <input
            type="number"
            min={0}
            step="0.01"
            className="w-full rounded-xl border border-line px-3 py-2"
            value={unitPriceUsdt}
            onChange={(event) => setUnitPriceUsdt(Number(event.target.value))}
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span>{t("fieldQuota")}</span>
          <input
            type="number"
            className="w-full rounded-xl border border-line px-3 py-2"
            value={totalQuota}
            onChange={(event) => setTotalQuota(Number(event.target.value))}
          />
        </label>
        <div className="rounded-xl bg-surface p-4 text-sm">
          <p className="font-medium">{t("freezeSummary")}</p>
          <p className="mt-1 text-muted">
            {t("freezeAmount", { amount: displayUsdt(freezeMicros) })}
          </p>
          <label className="mt-3 flex items-center gap-2">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            {t("freezeConfirm")}
          </label>
        </div>
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        <Button type="submit">{t("create")}</Button>
      </form>
    </main>
  );
}
