import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { buildLoginRedirect } from "@/lib/login-redirect";
import { apiServerWithSession } from "@/lib/session";
import { DisputeButton } from "./dispute-button";

type JoinItem = {
  id: string;
  taskId: string;
  taskTitle: string | null;
  status: string;
  rejectReason: string | null;
};

export default async function JoinsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("earn");
  const data = await apiServerWithSession<{ items: JoinItem[] }>("/v1/joins");
  if (!data) redirect(buildLoginRedirect(locale, "/earn/joins"));

  return (
    <main className="space-y-6">
      <h1 className="font-[family-name:var(--font-display)] text-3xl">{t("myJoins")}</h1>
      <ul className="space-y-3">
        {data.items.map((item) => (
          <li key={item.id} className="rounded-2xl border border-line bg-surface px-4 py-3">
            <p className="font-medium">{item.taskTitle ?? item.taskId.slice(0, 8)}</p>
            <p className="text-sm text-muted">{t(`status.${item.status}`)}</p>
            {item.rejectReason ? (
              <p className="mt-1 text-sm text-red-700">{item.rejectReason}</p>
            ) : null}
            <div className="mt-2 flex flex-wrap gap-3 text-sm">
              {item.status === "joined" || item.status === "rejected" ? (
                <Link href={`/earn/joins/${item.id}/submit`} className="text-accent">
                  {t("submit")}
                </Link>
              ) : null}
              {item.status === "rejected" ? (
                <DisputeButton joinId={item.id} />
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
