import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { TaskDaily01Icon } from "@hugeicons/core-free-icons";
import { ButtonLink } from "@/components/ui/button-link";
import { Empty } from "@/components/ui/empty-state";
import { Link } from "@/i18n/navigation";
import { buildLoginRedirect } from "@/lib/login-redirect";
import { apiServerWithSession } from "@/lib/session";
import { DisputeButton } from "@/components/dispute-button";
import { SubmitDeadlineHint } from "./submit-deadline-hint";

type JoinStatus =
  | "joined"
  | "submitted"
  | "approved"
  | "rejected"
  | "expired"
  | "disputed";

type JoinItem = {
  id: string;
  taskId: string;
  taskTitle: string | null;
  status: JoinStatus;
  rejectReason: string | null;
  submitDeadlineAt: string | null;
  allowResubmit: boolean;
};

const STATUS_FILTERS: JoinStatus[] = [
  "joined",
  "submitted",
  "approved",
  "rejected",
  "expired",
  "disputed",
];

export default async function JoinsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { locale } = await params;
  const { status } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("earn");

  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  const data = await apiServerWithSession<{ items: JoinItem[] }>(
    `/v1/joins${query}`,
  );
  if (!data) redirect(buildLoginRedirect(locale, "/earn/joins"));

  const activeFilter =
    status && STATUS_FILTERS.includes(status as JoinStatus)
      ? (status as JoinStatus)
      : null;

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-[family-name:var(--font-display)] text-3xl">
          {t("myJoins")}
        </h1>
        <ButtonLink href="/tasks" size="sm" variant="secondary">
          {t("browseTasks")}
        </ButtonLink>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        <Link
          href="/earn/joins"
          className={!activeFilter ? "text-accent" : "text-muted"}
        >
          {t("filterAll")}
        </Link>
        {STATUS_FILTERS.map((item) => (
          <Link
            key={item}
            href={`/earn/joins?status=${item}`}
            className={activeFilter === item ? "text-accent" : "text-muted"}
          >
            {t(`status.${item}`)}
          </Link>
        ))}
      </div>

      {data.items.length === 0 ? (
        <Empty
          icon={TaskDaily01Icon}
          title={activeFilter ? t("emptyFiltered") : t("emptyJoins")}
          subtitle={activeFilter ? undefined : t("emptyJoinsHint")}
        >
          {!activeFilter ? (
            <ButtonLink href="/tasks" size="sm">
              {t("browseTasks")}
            </ButtonLink>
          ) : null}
        </Empty>
      ) : (
        <ul className="space-y-3">
          {data.items.map((item) => {
            const canSubmit =
              item.status === "joined" ||
              (item.status === "rejected" && item.allowResubmit);
            const canDispute =
              item.status === "submitted" || item.status === "rejected";

            return (
              <li
                key={item.id}
                className="rounded-2xl border border-line bg-surface px-4 py-3"
              >
                <p className="font-medium">
                  {item.taskTitle ?? item.taskId.slice(0, 8)}
                </p>
                <p className="text-sm text-muted">{t(`status.${item.status}`)}</p>
                {item.status === "joined" ? (
                  <div className="mt-1">
                    <SubmitDeadlineHint deadlineAt={item.submitDeadlineAt} />
                  </div>
                ) : null}
                {item.rejectReason ? (
                  <p className="mt-2 text-sm text-red-700">
                    <span className="font-medium">
                      {t("rejectReasonLabel")}:{" "}
                    </span>
                    {item.rejectReason}
                  </p>
                ) : null}
                {item.status === "rejected" && !item.allowResubmit ? (
                  <p className="mt-1 text-xs text-muted">
                    {t("resubmitNotAllowed")}
                  </p>
                ) : null}
                <div className="mt-2 flex flex-wrap items-start gap-3 text-sm">
                  {canSubmit ? (
                    <Link
                      href={`/earn/joins/${item.id}/submit`}
                      className="text-accent"
                    >
                      {item.status === "rejected" ? t("resubmit") : t("submit")}
                    </Link>
                  ) : null}
                  {canDispute ? <DisputeButton joinId={item.id} /> : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
