import { getTranslations } from "next-intl/server";
import { SiteLogo } from "@/components/site-logo";

export async function SiteFooter() {
  const t = await getTranslations("footer");
  const brand = await getTranslations("brand");

  return (
    <footer className="mt-auto border-t border-line bg-surface/60">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <SiteLogo name={brand("name")} size={28} />
          <p className="max-w-md text-sm text-muted">{t("tagline")}</p>
        </div>
        <p className="text-sm text-muted">
          {t("rights", { year: new Date().getFullYear() })}
        </p>
      </div>
    </footer>
  );
}
