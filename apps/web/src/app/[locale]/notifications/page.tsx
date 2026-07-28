import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { buildLoginRedirect } from "@/lib/login-redirect";
import { apiServerWithSession } from "@/lib/session";
import { MarkReadButton } from "@/components/mark-read-button";

type Notification = {
  id: string;
  title: string;
  body: string;
  type: string;
  createdAt: string;
  readAt: string | null;
};

export default async function NotificationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("notifications");
  const data = await apiServerWithSession<{ items: Notification[] }>(
    "/v1/notifications",
  );
  if (!data) redirect(buildLoginRedirect(locale, "/notifications"));

  return (
    <main className="space-y-6">
      <h1 className="font-[family-name:var(--font-display)] text-3xl">{t("title")}</h1>
      {data.items.length === 0 ? (
        <p className="text-muted">{t("empty")}</p>
      ) : (
        <ul className="space-y-2">
          {data.items.map((item) => (
            <li
              key={item.id}
              className={`rounded-xl border border-line bg-surface px-4 py-3 ${item.readAt ? "opacity-70" : ""}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{item.title}</p>
                  <p className="text-sm text-muted">{item.body}</p>
                  <p className="mt-1 text-xs text-muted">
                    {t(`types.${item.type}`, { defaultValue: item.type })}
                  </p>
                </div>
                {!item.readAt ? (
                  <MarkReadButton notificationId={item.id} label={t("markRead")} />
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
