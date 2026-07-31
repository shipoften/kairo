import type { IconSvgElement } from "@hugeicons/react";
import {
  Analytics01Icon,
  MoneyReceive01Icon,
  MoneySend01Icon,
  Settings01Icon,
  TaskDaily01Icon,
  UserMultiple02Icon,
  JusticeScale01Icon,
} from "@hugeicons/core-free-icons";
import type { AdminTab } from "./admin-types";

export const ADMIN_TABS: AdminTab[] = [
  "overview",
  "withdrawals",
  "disputes",
  "deposits",
  "users",
  "tasks",
  "config",
];

export const ADMIN_TAB_ICONS: Record<AdminTab, IconSvgElement> = {
  overview: Analytics01Icon,
  withdrawals: MoneySend01Icon,
  disputes: JusticeScale01Icon,
  deposits: MoneyReceive01Icon,
  users: UserMultiple02Icon,
  tasks: TaskDaily01Icon,
  config: Settings01Icon,
};

export function isAdminTab(value: string | null | undefined): value is AdminTab {
  return Boolean(value && ADMIN_TABS.includes(value as AdminTab));
}

export function adminHref(tab: AdminTab) {
  return tab === "overview" ? "/admin" : `/admin/${tab}`;
}

export function adminTabFromPathname(pathname: string): AdminTab {
  const normalized = pathname.replace(/\/$/, "") || "/";
  if (normalized === "/admin") return "overview";
  const match = normalized.match(/^\/admin\/([^/]+)$/);
  if (match && isAdminTab(match[1])) return match[1];
  return "overview";
}
