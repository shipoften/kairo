import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TaskStatus, TaskType } from "@xs-share/shared";
import { formatUsdt } from "@xs-share/shared";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { apiServerFetch } from "@/lib/api";
import { apiServerWithSession, getMe } from "@/lib/session";
import { ProofRequirements } from "./proof-requirements";
import { TaskDetailActions } from "./task-detail-actions";

export const dynamic = "force-dynamic";

type TaskDetail = {
  id: string;
  title: string;
  description: string;
  type: string;
  targetUrl: string | null;
  unitPriceMicros: number;
  currency: string;
  totalQuota: number;
  remainingQuota: number;
  publisherName: string | null;
  publisherId: string;
  status: string;
  endsAt: string | null;
  createdAt: string;
  proofSchema: Record<string, unknown>;
  submitDeadlineHours: number;
  reviewDeadlineHours: number;
  allowResubmit: boolean;
  availableLocales?: string[];
};

function typeLabelKey(type: string): string {
  if (Object.values(TaskType).includes(type as TaskType)) {
    return `types.${type}`;
  }
  return "types.custom";
}

function languageLabelKey(tag: string): string {
  if (tag === "en" || tag === "zh") {
    return `languages.${tag}`;
  }
  return "languages.en";
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { id, locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("tasks");
  try {
    const task = await apiServerFetch<TaskDetail>(
      `/v1/public/tasks/${id}?locale=${locale}`,
    );
    return {
      title: task.title,
      description: task.description.slice(0, 160),
    };
  } catch {
    return { title: t("detail") };
  }
}

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("tasks");
  const me = await getMe();

  let task: TaskDetail;
  try {
    task = await apiServerFetch<TaskDetail>(
      `/v1/public/tasks/${id}?locale=${locale}`,
    );
  } catch {
    notFound();
  }

  let myJoinId: string | null = null;
  if (me && me.id !== task.publisherId) {
    const joins = await apiServerWithSession<{
      items: Array<{ id: string; taskId: string }>;
    }>("/v1/joins");
    myJoinId =
      joins?.items.find((item) => item.taskId === task.id)?.id ?? null;
  }

  const locales = task.availableLocales ?? [];
  const typeLabel = t(typeLabelKey(task.type));
  const isFull =
    task.status === TaskStatus.full || task.remainingQuota <= 0;
  const isPaused = task.status === TaskStatus.paused;
  const now = new Date();
  const isExpired = task.endsAt
    ? new Date(task.endsAt).getTime() <= now.getTime()
    : false;
  const endsAtLabel = task.endsAt
    ? new Date(task.endsAt).toLocaleString(locale)
    : t("noDeadline");
  const postedAtLabel = new Date(task.createdAt).toLocaleDateString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  const joinDisabled =
    isPaused || isFull || isExpired || Boolean(myJoinId);
  const joinDisabledReason = myJoinId
    ? t("alreadyJoined")
    : isPaused
      ? t("cannotJoinPaused")
      : isFull
        ? t("cannotJoinFull")
        : isExpired
          ? t("cannotJoinExpired")
          : undefined;

  return (
    <main className="space-y-6">
      <Link href="/tasks" className="text-sm text-muted hover:text-foreground">
        ← {t("title")}
      </Link>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="min-w-0 space-y-8">
          <header className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="accent">{typeLabel}</Badge>
              {locales.map((item) => (
                <Badge key={item} variant="muted">
                  {t(languageLabelKey(item))}
                </Badge>
              ))}
              {isFull ? (
                <Badge variant="muted">{t("statusFull")}</Badge>
              ) : null}
              {isPaused ? (
                <Badge variant="warning">{t("statusPaused")}</Badge>
              ) : null}
              {isExpired ? (
                <Badge variant="danger">{t("statusExpired")}</Badge>
              ) : null}
            </div>
            <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-tight">
              {task.title}
            </h1>
            <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
              {task.publisherName ? (
                <span>
                  {t("publisher")}: {task.publisherName}
                </span>
              ) : null}
              <span>
                {t("postedAt")}: {postedAtLabel}
              </span>
            </p>
          </header>

          {task.description ? (
            <section className="space-y-3">
              <h2 className="text-sm font-medium text-foreground">
                {t("sectionDescription")}
              </h2>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted">
                {task.description}
              </p>
            </section>
          ) : null}

          {task.targetUrl ? (
            <section className="space-y-3">
              <h2 className="text-sm font-medium text-foreground">
                {t("sectionTarget")}
              </h2>
              <a
                href={task.targetUrl}
                className="block rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-accent transition hover:bg-surface/80"
                target="_blank"
                rel="noreferrer"
              >
                <span className="font-medium">{t("openTarget")}</span>
                <span className="mt-1 block truncate text-muted">
                  {task.targetUrl}
                </span>
              </a>
            </section>
          ) : null}

          <section className="space-y-3 rounded-2xl border border-line bg-surface p-5">
            <h2 className="text-sm font-medium text-foreground">
              {t("sectionRules")}
            </h2>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div className="space-y-0.5">
                <dt className="text-muted">{t("submitDeadline")}</dt>
                <dd className="font-medium text-foreground">
                  {t("hoursValue", { hours: task.submitDeadlineHours })}
                </dd>
              </div>
              <div className="space-y-0.5">
                <dt className="text-muted">{t("reviewDeadline")}</dt>
                <dd className="font-medium text-foreground">
                  {t("hoursValue", { hours: task.reviewDeadlineHours })}
                </dd>
              </div>
              <div className="space-y-0.5">
                <dt className="text-muted">{t("endsAt")}</dt>
                <dd className="font-medium text-foreground">{endsAtLabel}</dd>
              </div>
              <div className="space-y-0.5">
                <dt className="text-muted">{t("resubmitPolicy")}</dt>
                <dd className="font-medium text-foreground">
                  {task.allowResubmit
                    ? t("resubmitAllowed")
                    : t("resubmitNotAllowed")}
                </dd>
              </div>
            </dl>
          </section>

          <ProofRequirements schema={task.proofSchema} />
        </div>

        <aside className="space-y-4 lg:sticky lg:top-6">
          <div className="space-y-5 rounded-2xl border border-line bg-surface p-5">
            <div className="space-y-1 text-center">
              <p className="text-xs uppercase tracking-wide text-muted">
                {t("price")}
              </p>
              <p className="font-[family-name:var(--font-display)] text-4xl tracking-tight text-accent">
                {formatUsdt(task.unitPriceMicros)}
              </p>
              <p className="text-xs uppercase tracking-wide text-muted">
                {task.currency}
              </p>
            </div>

            <dl className="space-y-3 border-t border-line pt-4 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted">{t("quota")}</dt>
                <dd className="font-medium text-foreground">
                  {t("quotaOf", {
                    remaining: task.remainingQuota,
                    total: task.totalQuota,
                  })}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted">{t("submitDeadline")}</dt>
                <dd className="font-medium text-foreground">
                  {t("hoursValue", { hours: task.submitDeadlineHours })}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted">{t("endsAt")}</dt>
                <dd className="text-right font-medium text-foreground">
                  {endsAtLabel}
                </dd>
              </div>
            </dl>

            <div className="border-t border-line pt-4">
              <TaskDetailActions
                taskId={task.id}
                publisherId={task.publisherId}
                submitDeadlineHours={task.submitDeadlineHours}
                joinDisabled={joinDisabled}
                joinDisabledReason={joinDisabledReason}
                myJoinId={myJoinId}
                me={me}
              />
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
