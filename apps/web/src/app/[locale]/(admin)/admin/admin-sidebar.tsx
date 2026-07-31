"use client";

import {
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
} from "@hugeicons/core-free-icons";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { SiteLogo } from "@/components/site-logo";
import { cn } from "@/lib/cn";
import {
  ADMIN_TAB_ICONS,
  ADMIN_TABS,
  adminHref,
  adminTabFromPathname,
} from "./admin-nav";
import type { AdminTab } from "./admin-types";

export function AdminSidebar({
  badges,
  collapsed,
  onToggleCollapsed,
  className,
}: {
  badges: Partial<Record<AdminTab, number>>;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  className?: string;
}) {
  const t = useTranslations("admin");
  const tBrand = useTranslations("brand");
  const pathname = usePathname();
  const activeTab = adminTabFromPathname(pathname);

  function tabLabel(tab: AdminTab) {
    if (tab === "overview") return t("overview");
    return t(tab);
  }

  return (
    <aside
      className={cn(
        "flex h-full shrink-0 flex-col border-r border-line bg-surface transition-[width] duration-200 ease-out",
        collapsed ? "w-16" : "w-60",
        className,
      )}
    >
      <div
        className={cn(
          "shrink-0 border-b border-line",
          collapsed ? "px-2 py-4" : "px-4 py-4",
        )}
      >
        <SiteLogo
          name={tBrand("name")}
          size={28}
          showName={!collapsed}
          className={cn(collapsed && "justify-center")}
        />
        {!collapsed ? (
          <p className="mt-2 text-xs font-medium tracking-wide text-muted uppercase">
            {t("consoleLabel")}
          </p>
        ) : null}
      </div>

      <nav
        className={cn(
          "flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto",
          collapsed ? "p-2" : "p-3",
        )}
        aria-label={t("title")}
      >
        {ADMIN_TABS.map((tab) => {
          const badge = badges[tab];
          const active = activeTab === tab;
          const label = tabLabel(tab);
          return (
            <Link
              key={tab}
              href={adminHref(tab)}
              title={collapsed ? label : undefined}
              aria-label={label}
              className={cn(
                "relative inline-flex items-center rounded-xl text-sm transition",
                collapsed ? "justify-center px-0 py-2.5" : "gap-2.5 px-3 py-2.5",
                active
                  ? "bg-accent/10 font-medium text-accent"
                  : "text-muted hover:bg-background hover:text-foreground",
              )}
            >
              <Icon icon={ADMIN_TAB_ICONS[tab]} size={18} />
              {!collapsed ? <span className="flex-1">{label}</span> : null}
              {!collapsed && badge && badge > 0 ? (
                <Badge variant="accent" className="px-1.5 py-0">
                  {badge}
                </Badge>
              ) : null}
              {collapsed && badge && badge > 0 ? (
                <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-accent" />
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="shrink-0 border-t border-line p-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          fullWidth
          className={cn(
            "justify-start gap-2.5 text-muted",
            collapsed && "justify-center px-0",
          )}
          onClick={onToggleCollapsed}
          aria-expanded={!collapsed}
          aria-label={collapsed ? t("expandSidebar") : t("collapseSidebar")}
          title={collapsed ? t("expandSidebar") : t("collapseSidebar")}
        >
          <Icon
            icon={collapsed ? PanelLeftOpenIcon : PanelLeftCloseIcon}
            size={18}
          />
          {!collapsed ? <span>{t("collapseSidebar")}</span> : null}
        </Button>
      </div>
    </aside>
  );
}
