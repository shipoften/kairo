"use client";

import { TaskType } from "@xs-share/shared";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Link, usePathname, useRouter } from "@/i18n/navigation";

const taskTypes = Object.values(TaskType);

export function TaskFilters() {
  const t = useTranslations("tasks");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const minPriceFromUrl = searchParams.get("minPrice") ?? "";

  function navigate(
    updates: Record<string, string | undefined>,
    resetPage = true,
  ) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (!value) params.delete(key);
      else params.set(key, value);
    }
    if (resetPage) params.delete("page");
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  function applyMinPrice(formData: FormData) {
    const trimmed = String(formData.get("minPrice") ?? "").trim();
    if (!trimmed) {
      navigate({ minPrice: undefined });
      return;
    }
    const dollars = Number(trimmed);
    if (!Number.isFinite(dollars) || dollars < 0) return;
    navigate({ minPrice: String(dollars) });
  }

  const hasFilters = Boolean(
    searchParams.get("type") ||
      searchParams.get("minPrice") ||
      searchParams.get("languageTag") ||
      (searchParams.get("sort") && searchParams.get("sort") !== "newest"),
  );

  return (
    <aside className="space-y-5 rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium tracking-wide text-foreground">
          {t("filtersTitle")}
        </h2>
        {hasFilters ? (
          <Link href="/tasks" className="text-sm text-accent hover:text-accent/80">
            {t("clearFilters")}
          </Link>
        ) : null}
      </div>

      <label className="block space-y-1.5">
        <span className="text-xs text-muted">{t("filterType")}</span>
        <Select
          aria-label={t("filterType")}
          value={searchParams.get("type") ?? ""}
          options={[
            { value: "", label: t("filterAll") },
            ...taskTypes.map((type) => ({
              value: type,
              label: t(`types.${type}`),
            })),
          ]}
          onValueChange={(value) => {
            navigate({ type: value || undefined });
          }}
        />
      </label>

      <form
        className="block space-y-1.5"
        onSubmit={(event) => {
          event.preventDefault();
          applyMinPrice(new FormData(event.currentTarget));
        }}
      >
        <span className="text-xs text-muted">{t("filterMinPrice")}</span>
        <Input
          key={minPriceFromUrl}
          name="minPrice"
          inputMode="decimal"
          placeholder={t("minPricePlaceholder")}
          defaultValue={minPriceFromUrl}
          aria-label={t("filterMinPrice")}
        />
        <Button type="submit" variant="secondary" size="sm" fullWidth>
          {t("applyFilters")}
        </Button>
      </form>

      <label className="block space-y-1.5">
        <span className="text-xs text-muted">{t("filterLanguage")}</span>
        <Select
          aria-label={t("filterLanguage")}
          value={searchParams.get("languageTag") ?? ""}
          options={[
            { value: "", label: t("filterAll") },
            { value: "en", label: t("languages.en") },
            { value: "zh", label: t("languages.zh") },
            { value: "both", label: t("languages.both") },
          ]}
          onValueChange={(value) => {
            navigate({ languageTag: value || undefined });
          }}
        />
      </label>

      <label className="block space-y-1.5">
        <span className="text-xs text-muted">{t("filterSort")}</span>
        <Select
          aria-label={t("filterSort")}
          value={searchParams.get("sort") ?? "newest"}
          options={[
            { value: "newest", label: t("sortNewest") },
            { value: "price", label: t("sortPrice") },
            { value: "deadline", label: t("sortDeadline") },
          ]}
          onValueChange={(value) => {
            navigate({ sort: value === "newest" ? undefined : value });
          }}
        />
      </label>
    </aside>
  );
}
