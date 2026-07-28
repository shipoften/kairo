import { Suspense } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { CardLink } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { apiServerFetch } from "@/lib/api";
import { TaskFilters } from "./task-filters";

export const dynamic = "force-dynamic";

type TaskItem = {
  id: string;
  title: string;
  type: string;
  unitPriceCents: number;
  remainingQuota: number;
  publisherName: string | null;
  currency: string;
  languageTag: string;
  endsAt: string | null;
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

export default async function TasksPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ type?: string; sort?: string; languageTag?: string }>;
}) {
  const { locale } = await params;
  const filters = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("tasks");

  const query = new URLSearchParams();
  if (filters.type) query.set("type", filters.type);
  if (filters.sort) query.set("sort", filters.sort);
  if (filters.languageTag) query.set("languageTag", filters.languageTag);
  const queryString = query.toString();

  let items: TaskItem[] = [];
  try {
    const data = await apiServerFetch<{ items: TaskItem[] }>(
      `/v1/public/tasks${queryString ? `?${queryString}` : ""}`,
    );
    items = data.items;
  } catch {
    items = [];
  }

  return (
    <main className="space-y-6">
      <PageHeader title={t("title")} />
      <Suspense fallback={null}>
        <TaskFilters locale={locale} />
      </Suspense>
      {items.length === 0 ? (
        <EmptyState title={t("empty")} />
      ) : (
        <ul className="space-y-3">
          {items.map((task) => (
            <li key={task.id}>
              <CardLink href={`/tasks/${task.id}`} className="px-5 py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-xl font-medium">{task.title}</h2>
                  <Badge variant="accent">
                    {t("price")}: {(task.unitPriceCents / 100).toFixed(2)}{" "}
                    {task.currency}
                  </Badge>
                </div>
                <p className="mt-2 text-sm text-muted">
                  {task.type} · {t("quota")}: {task.remainingQuota} ·{" "}
                  {task.languageTag}
                  {task.endsAt
                    ? ` · ${new Date(task.endsAt).toLocaleDateString(locale)}`
                    : ""}
                  {task.publisherName ? ` · ${task.publisherName}` : ""}
                </p>
              </CardLink>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
