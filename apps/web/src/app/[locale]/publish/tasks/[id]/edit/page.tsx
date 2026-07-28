import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
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
      targetUrl: string | null;
      status: string;
    }>;
  }>("/v1/tasks");
  if (!data) redirect(buildLoginRedirect(locale, `/publish/tasks/${id}/edit`));

  const task = data.items.find((item) => item.id === id);
  if (!task || task.status !== "draft") {
    return <p className="text-red-700">{t("editDraftOnly")}</p>;
  }

  return (
    <main className="mx-auto w-full max-w-xl space-y-6">
      <h1 className="font-[family-name:var(--font-display)] text-3xl">{t("edit")}</h1>
      <EditTaskForm
        taskId={id}
        initialTitle={task.title}
        initialDescription={task.description}
        initialTargetUrl={task.targetUrl ?? ""}
      />
    </main>
  );
}
