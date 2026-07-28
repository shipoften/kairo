import { getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { TaskStatus, TaskType } from "@xs-share/shared";

export type TaskListItem = {
  id: string;
  title: string;
  type: string;
  unitPriceMicros: number;
  remainingQuota: number;
  totalQuota: number;
  publisherName: string | null;
  currency: string;
  languageTag: string;
  endsAt: string | null;
  status: string;
};

function typeLabelKey(type: string): string {
  if (Object.values(TaskType).includes(type as TaskType)) {
    return `types.${type}`;
  }
  return "types.custom";
}

function languageLabelKey(tag: string): string {
  if (tag === "en" || tag === "zh" || tag === "both") {
    return `languages.${tag}`;
  }
  return "languages.en";
}

export async function TaskRow({
  task,
  locale,
}: {
  task: TaskListItem;
  locale: string;
}) {
  const t = await getTranslations("tasks");
  const isFull = task.status === TaskStatus.full || task.remainingQuota <= 0;
  const price = (task.unitPriceMicros / 1_000_000).toFixed(2);
  const deadline = task.endsAt
    ? new Date(task.endsAt).toLocaleDateString(locale, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : null;

  return (
    <li>
      <Link
        href={`/tasks/${task.id}`}
        className="group block border-b border-line px-1 py-4 transition last:border-b-0 hover:bg-surface/80 sm:px-3"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="default">{t(typeLabelKey(task.type))}</Badge>
              {isFull ? (
                <Badge variant="muted">{t("statusFull")}</Badge>
              ) : null}
              <Badge variant="muted">{t(languageLabelKey(task.languageTag))}</Badge>
            </div>
            <h2 className="truncate text-lg font-medium text-foreground group-hover:text-accent">
              {task.title}
            </h2>
            <p className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted">
              <span>
                {t("quotaOf", {
                  remaining: task.remainingQuota,
                  total: task.totalQuota,
                })}
              </span>
              <span>
                {deadline
                  ? `${t("deadline")}: ${deadline}`
                  : t("noDeadline")}
              </span>
              {task.publisherName ? (
                <span>
                  {t("publisher")}: {task.publisherName}
                </span>
              ) : null}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="font-[family-name:var(--font-display)] text-2xl tracking-tight text-accent">
              {price}
            </p>
            <p className="text-xs uppercase tracking-wide text-muted">
              {task.currency}
            </p>
          </div>
        </div>
      </Link>
    </li>
  );
}
