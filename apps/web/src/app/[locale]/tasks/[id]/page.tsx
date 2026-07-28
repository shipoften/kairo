import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ButtonLink } from "@/components/ui/button-link";
import { buildLoginPath } from "@/lib/login-redirect";
import { Link } from "@/i18n/navigation";
import { apiServerFetch } from "@/lib/api";
import { getMe } from "@/lib/session";
import { JoinButton } from "./join-button";

export const dynamic = "force-dynamic";

type TaskDetail = {
  id: string;
  title: string;
  description: string;
  type: string;
  targetUrl: string | null;
  unitPriceCents: number;
  currency: string;
  remainingQuota: number;
  publisherName: string | null;
  publisherId: string;
  status: string;
  proofSchema: Record<string, unknown>;
  submitDeadlineHours: number;
  languageTag: string;
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  try {
    const task = await apiServerFetch<TaskDetail>(`/v1/public/tasks/${id}`);
    return {
      title: task.title,
      description: task.description.slice(0, 160),
    };
  } catch {
    return { title: "Task" };
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
    task = await apiServerFetch<TaskDetail>(`/v1/public/tasks/${id}`);
  } catch {
    notFound();
  }

  return (
    <main className="space-y-6">
      <Link href="/tasks" className="text-sm text-muted">
        ← {t("title")}
      </Link>
      <div className="space-y-3">
        <p className="text-sm uppercase tracking-wide text-accent">{task.type}</p>
        <h1 className="font-[family-name:var(--font-display)] text-4xl">{task.title}</h1>
        <p className="text-muted">{task.description}</p>
        <p className="text-sm">
          {t("price")}: {(task.unitPriceCents / 100).toFixed(2)} {task.currency} ·{" "}
          {t("quota")}: {task.remainingQuota} · {task.languageTag}
        </p>
        <p className="text-sm text-muted">
          {t("submitDeadline")}: {task.submitDeadlineHours}h
        </p>
        {task.publisherName ? (
          <p className="text-sm text-muted">
            {t("publisher")}: {task.publisherName}
          </p>
        ) : null}
        {Object.keys(task.proofSchema).length > 0 ? (
          <div className="rounded-xl border border-line bg-surface p-4 text-sm">
            <p className="font-medium">{t("proofRequirements")}</p>
            <pre className="mt-2 overflow-auto text-xs text-muted">
              {JSON.stringify(task.proofSchema, null, 2)}
            </pre>
          </div>
        ) : null}
        {task.targetUrl ? (
          <a href={task.targetUrl} className="text-sm text-accent underline" target="_blank" rel="noreferrer">
            {task.targetUrl}
          </a>
        ) : null}
      </div>
      {me ? (
        me.id === task.publisherId ? (
          <Link href={`/publish/tasks/${task.id}/submissions`} className="text-accent">
            {t("manageTask")}
          </Link>
        ) : (
          <JoinButton
            taskId={task.id}
            label={t("join")}
            confirmMessage={t("joinConfirm", { hours: task.submitDeadlineHours })}
          />
        )
      ) : (
        <ButtonLink href={buildLoginPath(`/tasks/${task.id}`)}>
          {t("loginToJoin")}
        </ButtonLink>
      )}
    </main>
  );
}
