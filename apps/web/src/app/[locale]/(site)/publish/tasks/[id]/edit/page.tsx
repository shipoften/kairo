import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import type { LocalizedStringMap } from "@xs-share/shared";
import { Alert } from "@/components/ui/alert";
import { PageHeader } from "@/components/ui/page-header";
import { buildLoginRedirect } from "@/lib/login-redirect";
import { apiServerWithSession } from "@/lib/session";
import { EditTaskForm } from "./edit-task-form";

export default async function EditTaskPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("publish");

  const data = await apiServerWithSession<{
    items: Array<{
      id: string;
      title: string;
      description: string;
      titleI18n?: LocalizedStringMap;
      descriptionI18n?: LocalizedStringMap;
      sourceLocale?: string;
      targetUrl: string | null;
      status: string;
    }>;
  }>("/v1/tasks");
  if (!data) redirect(buildLoginRedirect(locale, `/publish/tasks/${id}/edit`));

  const task = data.items.find((item) => item.id === id);
  if (!task || task.status !== "draft") {
    return (
      <main className="mx-auto w-full max-w-2xl">
        <Alert variant="error">{t("editDraftOnly")}</Alert>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-8">
      <PageHeader title={t("edit")} description={t("editDescription")} />
      <EditTaskForm
        taskId={id}
        initialTitleI18n={task.titleI18n ?? { en: task.title }}
        initialDescriptionI18n={
          task.descriptionI18n ?? { en: task.description }
        }
        initialSourceLocale={task.sourceLocale ?? "en"}
        initialTargetUrl={task.targetUrl ?? ""}
      />
    </main>
  );
}
