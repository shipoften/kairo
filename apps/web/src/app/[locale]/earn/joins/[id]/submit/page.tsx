import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { buildLoginRedirect } from "@/lib/login-redirect";
import { apiServerWithSession } from "@/lib/session";
import { SubmitProofForm } from "./submit-proof-form";

export default async function SubmitProofPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("earn");

  const joins = await apiServerWithSession<{
    items: Array<{ id: string; taskId: string }>;
  }>("/v1/joins");
  if (!joins) redirect(buildLoginRedirect(locale, `/earn/joins/${id}/submit`));

  const join = joins.items.find((item) => item.id === id);
  if (!join) redirect(`/${locale}/earn/joins`);

  const task = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5181"}/v1/public/tasks/${join.taskId}`,
    { cache: "no-store" },
  ).then((response) =>
    response.ok ? (response.json() as Promise<{ proofSchema: Record<string, unknown> }>) : null,
  );

  return (
    <main className="mx-auto w-full max-w-md space-y-6">
      <h1 className="font-[family-name:var(--font-display)] text-3xl">{t("submit")}</h1>
      <SubmitProofForm joinId={id} proofSchema={task?.proofSchema ?? {}} />
    </main>
  );
}
