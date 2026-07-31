import { Suspense } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { FilterRemoveIcon, TaskDaily01Icon } from "@hugeicons/core-free-icons";
import { ButtonLink } from "@/components/ui/button-link";
import { Empty } from "@/components/ui/empty";
import { apiServerFetch } from "@/lib/api";
import { TaskFilters } from "./task-filters";
import { TaskPagination } from "./task-pagination";
import { TaskRow, type TaskListItem } from "./task-row";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

type TasksResponse = {
  items: TaskListItem[];
  total: number;
  limit: number;
  offset: number;
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: locale === "zh" ? "任务广场" : "Task Board",
    description:
      locale === "zh"
        ? "在 Kairo 浏览开放中的推广任务"
        : "Browse open promotion tasks on Kairo",
  };
}

function usdtToMicrosQuery(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const usdt = Number(value);
  if (!Number.isFinite(usdt) || usdt < 0) return undefined;
  return String(Math.round(usdt * 1_000_000));
}

export default async function TasksPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    type?: string;
    sort?: string;
    localeFilter?: string;
    languageTag?: string;
    minPrice?: string;
    page?: string;
  }>;
}) {
  const { locale } = await params;
  const filters = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("tasks");

  const page = Math.max(Number(filters.page ?? 1) || 1, 1);
  const offset = (page - 1) * PAGE_SIZE;
  const minPriceMicros = usdtToMicrosQuery(filters.minPrice);
  const localeFilter = filters.localeFilter || filters.languageTag;

  const query = new URLSearchParams();
  if (filters.type) query.set("type", filters.type);
  if (filters.sort) query.set("sort", filters.sort);
  if (localeFilter) query.set("localeFilter", localeFilter);
  query.set("locale", locale);
  if (minPriceMicros) query.set("minPrice", minPriceMicros);
  query.set("limit", String(PAGE_SIZE));
  query.set("offset", String(offset));

  const filterQuery = {
    type: filters.type,
    sort: filters.sort,
    localeFilter,
    minPrice: filters.minPrice,
  };
  const hasActiveFilters = Boolean(
    filters.type ||
      filters.minPrice ||
      localeFilter ||
      (filters.sort && filters.sort !== "newest"),
  );

  let items: TaskListItem[] = [];
  let total = 0;
  try {
    const data = await apiServerFetch<TasksResponse>(
      `/v1/public/tasks?${query.toString()}`,
    );
    items = data.items;
    total = data.total;
  } catch {
    items = [];
    total = 0;
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

  return (
    <main className="space-y-8">
      <header className="space-y-2 border-b border-line pb-6">
        <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-tight">
          {t("title")}
        </h1>
        <p className="max-w-2xl text-muted">{t("subtitle")}</p>
        <p className="text-sm text-muted">{t("results", { count: total })}</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)] lg:items-start">
        <div className="lg:sticky lg:top-6">
          <Suspense
            fallback={
              <div className="h-64 animate-pulse rounded-2xl border border-line bg-surface" />
            }
          >
            <TaskFilters />
          </Suspense>
        </div>

        <section className="min-w-0 space-y-4">
          {items.length === 0 ? (
            <Empty
              icon={hasActiveFilters ? FilterRemoveIcon : TaskDaily01Icon}
              title={hasActiveFilters ? t("emptyFiltered") : t("empty")}
              subtitle={
                hasActiveFilters ? t("emptyFilteredHint") : undefined
              }
            >
              {hasActiveFilters ? (
                <ButtonLink href="/tasks" variant="secondary" size="sm">
                  {t("clearFilters")}
                </ButtonLink>
              ) : null}
            </Empty>
          ) : (
            <>
              <ul className="rounded-2xl border border-line bg-surface/70 px-2 sm:px-1">
                {items.map((task) => (
                  <TaskRow key={task.id} task={task} locale={locale} />
                ))}
              </ul>
              <TaskPagination
                page={safePage}
                totalPages={totalPages}
                query={filterQuery}
              />
            </>
          )}
        </section>
      </div>
    </main>
  );
}
