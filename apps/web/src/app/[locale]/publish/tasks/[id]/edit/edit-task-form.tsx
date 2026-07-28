"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";

export function EditTaskForm({
  taskId,
  initialTitle,
  initialDescription,
  initialTargetUrl,
}: {
  taskId: string;
  initialTitle: string;
  initialDescription: string;
  initialTargetUrl: string;
}) {
  const t = useTranslations("publish");
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [targetUrl, setTargetUrl] = useState(initialTargetUrl);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await apiFetch(`/v1/tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify({ title, description, targetUrl }),
      });
      router.push("/publish/tasks");
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
      <label className="block space-y-1 text-sm">
        <span>{t("fieldTitle")}</span>
        <input className="w-full rounded-xl border border-line px-3 py-2" value={title} onChange={(e) => setTitle(e.target.value)} required />
      </label>
      <label className="block space-y-1 text-sm">
        <span>{t("fieldDescription")}</span>
        <textarea className="w-full rounded-xl border border-line px-3 py-2" value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
      </label>
      <label className="block space-y-1 text-sm">
        <span>{t("fieldTargetUrl")}</span>
        <input className="w-full rounded-xl border border-line px-3 py-2" value={targetUrl} onChange={(e) => setTargetUrl(e.target.value)} />
      </label>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <Button type="submit">{t("save")}</Button>
    </form>
  );
}
