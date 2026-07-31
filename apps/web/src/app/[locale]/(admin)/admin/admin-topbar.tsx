"use client";

import {
  ArrowRight01Icon,
  Globe02Icon,
  Logout01Icon,
} from "@hugeicons/core-free-icons";
import { useTranslations } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/cn";
import {
  ADMIN_TAB_ICONS,
  ADMIN_TABS,
  adminHref,
  adminTabFromPathname,
} from "./admin-nav";
import type { AdminTab } from "./admin-types";

export function AdminTopbar({
  locale,
  badges,
}: {
  locale: string;
  badges: Partial<Record<AdminTab, number>>;
}) {
  const t = useTranslations();
  const pathname = usePathname();
  const router = useRouter();
  const activeTab = adminTabFromPathname(pathname);
  const otherLocale = locale === "en" ? "zh" : "en";

  async function logout() {
    await apiFetch("/v1/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  function tabLabel(tab: AdminTab) {
    if (tab === "overview") return t("admin.overview");
    return t(`admin.${tab}`);
  }

  return (
    <header className="shrink-0 border-b border-line bg-surface/90 backdrop-blur">
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 lg:px-6">
        <nav aria-label={t("admin.breadcrumb")} className="min-w-0">
          <ol className="flex min-w-0 items-center gap-1.5 text-sm">
            <li className="shrink-0">
              <Link
                href="/admin"
                className="text-muted transition hover:text-foreground"
              >
                {t("admin.title")}
              </Link>
            </li>
            <li aria-hidden className="shrink-0 text-muted">
              <Icon icon={ArrowRight01Icon} size={14} />
            </li>
            <li className="truncate font-medium text-foreground">
              <span>{tabLabel(activeTab)}</span>
            </li>
          </ol>
        </nav>

        <div className="flex shrink-0 items-center gap-0.5">
          <Link
            href={pathname}
            locale={otherLocale}
            className="inline-flex size-9 items-center justify-center rounded-lg uppercase text-muted transition hover:bg-background hover:text-foreground"
            aria-label={otherLocale}
            title={otherLocale}
          >
            <Icon icon={Globe02Icon} size={16} />
          </Link>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="size-9 px-0 text-muted"
            onClick={logout}
            aria-label={t("nav.logout")}
            title={t("nav.logout")}
          >
            <Icon icon={Logout01Icon} size={16} />
          </Button>
        </div>
      </div>

      <nav
        className="flex gap-1 overflow-x-auto border-t border-line px-3 py-2 lg:hidden"
        aria-label={t("admin.title")}
      >
        {ADMIN_TABS.map((tab) => {
          const badge = badges[tab];
          const active = activeTab === tab;
          return (
            <Link
              key={tab}
              href={adminHref(tab)}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs transition",
                active
                  ? "bg-accent/10 font-medium text-accent"
                  : "text-muted hover:bg-background hover:text-foreground",
              )}
            >
              <Icon icon={ADMIN_TAB_ICONS[tab]} size={14} />
              {tabLabel(tab)}
              {badge && badge > 0 ? (
                <Badge variant="accent" className="px-1.5 py-0">
                  {badge}
                </Badge>
              ) : null}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
