import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { ButtonLink } from "@/components/ui/button-link";
import { Link } from "@/i18n/navigation";
import { buildLoginRedirect } from "@/lib/login-redirect";
import { apiServerWithSession } from "@/lib/session";
import { TaskStatusActions } from "./task-status-actions";

export default async function PublishTasksPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { locale } = await params;
  const { status } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("publish");

  const query = status ? `?status=${status}` : "";
  const data = await apiServerWithSession<{
    items: Array<{
      id: string;
      title: string;
      status: string;
      remainingQuota: number;
    }>;
  }>(`/v1/tasks${query}`);
  if (!data) redirect(buildLoginRedirect(locale, "/publish/tasks"));

  return (
    <main className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-[family-name:var(--font-display)] text-4xl">{t("myTasks")}</h1>
        <ButtonLink href="/publish/tasks/new" size="sm">
          {t("create")}
        </ButtonLink>
      </div>
      <div className="flex gap-2 text-sm">
        <Link href="/publish/tasks" className={!status ? "text-accent" : "text-muted"}>
          {t("filterAll")}
        </Link>
        <Link href="/publish/tasks?status=draft" className={status === "draft" ? "text-accent" : "text-muted"}>
          draft
        </Link>
        <Link href="/publish/tasks?status=recruiting" className={status === "recruiting" ? "text-accent" : "text-muted"}>
          recruiting
        </Link>
      </div>
      <ul className="space-y-2">
        {data.items.map((task) => (
          <li
            key={task.id}
            className="rounded-2xl border border-line bg-surface px-4 py-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium">{task.title}</p>
                <p className="text-sm text-muted">
                  {task.status} · {t("quota")}: {task.remainingQuota}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-sm">
                {task.status === "draft" ? (
                  <Link href={`/publish/tasks/${task.id}/edit`} className="text-accent">
                    {t("edit")}
                  </Link>
                ) : null}
                <Link href={`/publish/tasks/${task.id}/submissions`} className="text-accent">
                  {t("submissions")}
                </Link>
                <TaskStatusActions taskId={task.id} status={task.status} />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
