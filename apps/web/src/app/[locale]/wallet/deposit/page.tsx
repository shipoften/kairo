"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";

export default function DepositPage() {
  const t = useTranslations("wallet");
  const router = useRouter();
  const [amountCents, setAmountCents] = useState(10000);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    try {
      await apiFetch("/v1/wallet/deposits", {
        method: "POST",
        body: JSON.stringify({ amountCents, note: "manual deposit request" }),
      });
      setSuccess(true);
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
    <main className="mx-auto w-full max-w-md space-y-6">
      <h1 className="font-[family-name:var(--font-display)] text-3xl">{t("deposit")}</h1>
      <p className="text-sm text-muted">{t("manualDepositNote")}</p>
      <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-line bg-surface p-6">
        <label className="block space-y-1 text-sm">
          <span>{t("amountCents")}</span>
          <input
            type="number"
            min={1}
            className="w-full rounded-xl border border-line px-3 py-2"
            value={amountCents}
            onChange={(event) => setAmountCents(Number(event.target.value))}
          />
        </label>
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        {success ? <p className="text-sm text-accent">{t("depositSubmitted")}</p> : null}
        <Button type="submit">{t("deposit")}</Button>
      </form>
    </main>
  );
}
