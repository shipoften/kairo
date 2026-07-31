"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { AdminSidebar } from "./admin-sidebar";
import { AdminTopbar } from "./admin-topbar";
import type { AdminTab } from "./admin-types";

const STORAGE_KEY = "xs-admin-sidebar-collapsed";
const CHANGE_EVENT = "xs-admin-sidebar-collapsed-change";

function subscribe(onStoreChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onStoreChange);
  return () => window.removeEventListener(CHANGE_EVENT, onStoreChange);
}

function getCollapsedSnapshot() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function getServerCollapsedSnapshot() {
  return false;
}

function useSidebarCollapsed() {
  const collapsed = useSyncExternalStore(
    subscribe,
    getCollapsedSnapshot,
    getServerCollapsedSnapshot,
  );

  const setCollapsed = useCallback((next: boolean) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch {
      // ignore storage failures
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  return [collapsed, setCollapsed] as const;
}

export function AdminFrame({
  locale,
  badges,
  children,
}: {
  locale: string;
  badges: Partial<Record<AdminTab, number>>;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useSidebarCollapsed();

  const toggleCollapsed = useCallback(() => {
    setCollapsed(!getCollapsedSnapshot());
  }, [setCollapsed]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey)) return;
      if (event.altKey || event.shiftKey) return;
      if (event.key.toLowerCase() !== "b") return;

      const target = event.target;
      if (target instanceof HTMLElement) {
        const tagName = target.tagName;
        if (
          tagName === "INPUT" ||
          tagName === "TEXTAREA" ||
          tagName === "SELECT" ||
          target.isContentEditable
        ) {
          return;
        }
      }

      event.preventDefault();
      toggleCollapsed();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggleCollapsed]);

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <AdminSidebar
        badges={badges}
        collapsed={collapsed}
        onToggleCollapsed={toggleCollapsed}
        className="hidden lg:flex"
      />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <AdminTopbar locale={locale} badges={badges} />
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </div>
      </div>
    </div>
  );
}
