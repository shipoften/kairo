"use client";

import type { IconSvgElement } from "@hugeicons/react";
import {
  Briefcase01Icon,
  Globe02Icon,
  Login01Icon,
  Logout01Icon,
  Megaphone01Icon,
  Notification01Icon,
  Settings01Icon,
  Share01Icon,
  Shield01Icon,
  TaskDaily01Icon,
  Wallet01Icon,
} from "@hugeicons/core-free-icons";
import { useTranslations } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { SiteLogo } from "@/components/site-logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";
import { apiFetch } from "@/lib/api";

type Me = {
  id: string;
  displayName: string;
  preferredMode: string;
  role: string;
} | null;

function NavLink({
  href,
  label,
  icon,
  active = false,
  badge,
}: {
  href: string;
  label: string;
  icon?: IconSvgElement;
  active?: boolean;
  badge?: number;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 transition hover:text-foreground",
        active ? "text-accent" : "text-muted",
      )}
    >
      {icon ? <Icon icon={icon} size={16} /> : null}
      <span>{label}</span>
      {badge && badge > 0 ? <Badge variant="accent">{badge}</Badge> : null}
    </Link>
  );
}

export function SiteHeader({
  locale,
  me,
  unreadCount = 0,
}: {
  locale: string;
  me: Me;
  unreadCount?: number;
}) {
  const t = useTranslations();
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await apiFetch("/v1/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  async function switchMode(mode: "publish" | "earn") {
    if (!me) return;
    await apiFetch("/v1/me", {
      method: "PATCH",
      body: JSON.stringify({ preferredMode: mode }),
    });
    router.refresh();
    router.push(mode === "publish" ? "/publish" : "/earn");
  }

  const otherLocale = locale === "en" ? "zh" : "en";

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-surface/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <SiteLogo name={t("brand.name")} />

        <nav className="flex flex-wrap items-center justify-end gap-1 text-sm">
          <NavLink
            href="/tasks"
            label={t("nav.tasks")}
            icon={TaskDaily01Icon}
            active={pathname.startsWith("/tasks")}
          />

          {me ? (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={cn(
                  "rounded-full px-2.5",
                  me.preferredMode === "publish" ? "text-accent" : "text-muted",
                )}
                onClick={() => switchMode("publish")}
              >
                <Icon icon={Megaphone01Icon} size={16} />
                {t("mode.publish")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={cn(
                  "rounded-full px-2.5",
                  me.preferredMode === "earn" ? "text-accent" : "text-muted",
                )}
                onClick={() => switchMode("earn")}
              >
                <Icon icon={Briefcase01Icon} size={16} />
                {t("mode.earn")}
              </Button>
              <NavLink
                href="/wallet"
                label={t("nav.wallet")}
                icon={Wallet01Icon}
                active={pathname.startsWith("/wallet")}
              />
              <NavLink
                href="/notifications"
                label={t("nav.notifications")}
                icon={Notification01Icon}
                active={pathname.startsWith("/notifications")}
                badge={unreadCount}
              />
              <NavLink
                href="/invite"
                label={t("nav.invite")}
                icon={Share01Icon}
                active={pathname.startsWith("/invite")}
              />
              <NavLink
                href="/settings"
                label={t("nav.settings")}
                icon={Settings01Icon}
                active={pathname.startsWith("/settings")}
              />
              {me.role === "admin" ? (
                <NavLink
                  href="/admin"
                  label={t("nav.admin")}
                  icon={Shield01Icon}
                  active={pathname.startsWith("/admin")}
                />
              ) : null}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="rounded-full px-2.5 text-muted"
                onClick={logout}
              >
                <Icon icon={Logout01Icon} size={16} />
                {t("nav.logout")}
              </Button>
            </>
          ) : (
            <NavLink
              href="/login"
              label={t("nav.login")}
              icon={Login01Icon}
              active={pathname.startsWith("/login")}
            />
          )}

          <Link
            href={pathname}
            locale={otherLocale}
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 uppercase text-muted transition hover:text-foreground"
          >
            <Icon icon={Globe02Icon} size={16} />
            {otherLocale}
          </Link>
        </nav>
      </div>
    </header>
  );
}
