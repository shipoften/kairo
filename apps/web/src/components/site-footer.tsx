import { getTranslations } from "next-intl/server";
import { SiteLogo } from "@/components/site-logo";
import { Link } from "@/i18n/navigation";

export async function SiteFooter() {
  const t = await getTranslations("footer");
  const brand = await getTranslations("brand");

  return (
    <footer className="mt-auto border-t border-line bg-surface/60">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <SiteLogo name={brand("name")} size={28} />
          <p className="max-w-md text-sm text-muted">{t("tagline")}</p>
        </div>
        <div className="flex flex-col gap-3 sm:items-end">
          <nav className="flex flex-wrap gap-x-5 gap-y-2 text-sm" aria-label={t("legalNav")}>
            <Link
              href="/privacy"
              className="text-muted transition-colors hover:text-foreground"
            >
              {t("privacy")}
            </Link>
            <Link
              href="/terms"
              className="text-muted transition-colors hover:text-foreground"
            >
              {t("terms")}
            </Link>
          </nav>
          <p className="text-sm text-muted">
            {t("rights", { year: new Date().getFullYear() })}
          </p>
        </div>
      </div>
    </footer>
  );
}
