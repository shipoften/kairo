"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { usePathname, useSearchParams } from "next/navigation";
import { Select } from "@/components/ui/select";

const taskTypes = [
  "x_follow",
  "x_like",
  "x_repost",
  "x_post",
  "cpa_register",
  "custom",
] as const;

export function TaskFilters({ locale }: { locale: string }) {
  const t = useTranslations("tasks");
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const basePath = pathname.replace(`/${locale}`, "") || "/tasks";

  function href(updates: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (!value) params.delete(key);
      else params.set(key, value);
    }
    const query = params.toString();
    return `/${locale}${basePath}${query ? `?${query}` : ""}`;
  }

  return (
    <form className="flex flex-wrap gap-3 rounded-2xl border border-line bg-surface p-4 text-sm">
      <label className="min-w-[10rem] flex-1 space-y-1">
        <span className="text-muted">{t("filterType")}</span>
        <Select
          aria-label={t("filterType")}
          value={searchParams.get("type") ?? ""}
          options={[
            { value: "", label: t("filterAll") },
            ...taskTypes.map((type) => ({ value: type, label: type })),
          ]}
          onValueChange={(value) => {
            window.location.href = href({ type: value || undefined });
          }}
        />
      </label>
      <label className="min-w-[10rem] flex-1 space-y-1">
        <span className="text-muted">{t("filterSort")}</span>
        <Select
          aria-label={t("filterSort")}
          value={searchParams.get("sort") ?? "newest"}
          options={[
            { value: "newest", label: t("sortNewest") },
            { value: "price", label: t("sortPrice") },
            { value: "deadline", label: t("sortDeadline") },
          ]}
          onValueChange={(value) => {
            window.location.href = href({ sort: value });
          }}
        />
      </label>
      <label className="min-w-[10rem] flex-1 space-y-1">
        <span className="text-muted">{t("filterLanguage")}</span>
        <Select
          aria-label={t("filterLanguage")}
          value={searchParams.get("languageTag") ?? ""}
          options={[
            { value: "", label: t("filterAll") },
            { value: "en", label: "English" },
            { value: "zh", label: "中文" },
          ]}
          onValueChange={(value) => {
            window.location.href = href({ languageTag: value || undefined });
          }}
        />
      </label>
      <Link href={href({})} className="self-end text-accent">
        {t("clearFilters")}
      </Link>
    </form>
  );
}
