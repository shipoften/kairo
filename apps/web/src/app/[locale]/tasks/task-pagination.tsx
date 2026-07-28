import { getTranslations } from "next-intl/server";
import { ButtonLink } from "@/components/ui/button-link";

type TaskPaginationProps = {
  page: number;
  totalPages: number;
  query: Record<string, string | undefined>;
};

function hrefForPage(
  query: Record<string, string | undefined>,
  page: number,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (!value || key === "page") continue;
    params.set(key, value);
  }
  if (page > 1) params.set("page", String(page));
  const queryString = params.toString();
  return queryString ? `/tasks?${queryString}` : "/tasks";
}

export async function TaskPagination({
  page,
  totalPages,
  query,
}: TaskPaginationProps) {
  if (totalPages <= 1) return null;

  const t = await getTranslations("tasks");

  return (
    <nav
      className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4"
      aria-label="Pagination"
    >
      <p className="text-sm text-muted">
        {t("pageOf", { page, totalPages })}
      </p>
      <div className="flex gap-2">
        <ButtonLink
          href={hrefForPage(query, Math.max(1, page - 1))}
          variant="secondary"
          size="sm"
          aria-disabled={page <= 1 || undefined}
          className={page <= 1 ? "pointer-events-none opacity-40" : undefined}
        >
          {t("pagePrev")}
        </ButtonLink>
        <ButtonLink
          href={hrefForPage(query, Math.min(totalPages, page + 1))}
          variant="secondary"
          size="sm"
          aria-disabled={page >= totalPages || undefined}
          className={
            page >= totalPages ? "pointer-events-none opacity-40" : undefined
          }
        >
          {t("pageNext")}
        </ButtonLink>
      </div>
    </nav>
  );
}
