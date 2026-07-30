"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api";
import {
  AdminConfigPanel,
  AdminDepositsPanel,
  AdminDisputesPanel,
  AdminOverviewPanel,
  AdminTasksPanel,
  AdminUsersPanel,
  AdminWithdrawalsPanel,
} from "./admin-panels";
import type { AdminConfig, AdminData, AdminTab } from "./admin-types";

const TABS: AdminTab[] = [
  "overview",
  "withdrawals",
  "disputes",
  "deposits",
  "users",
  "tasks",
  "config",
];

export function AdminActions({ data }: { data: AdminData }) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");

  async function refresh() {
    router.refresh();
  }

  async function saveConfig(config: AdminConfig) {
    await apiFetch("/v1/admin/config", {
      method: "PATCH",
      body: JSON.stringify({
        platformFeeRateBps: config.platformFeeRateBps,
        referralEnabled: config.referralEnabled,
        referralEarnRateBps: config.referralEarnRateBps,
        referralPublishRateBps: config.referralPublishRateBps,
        minDepositMicros: config.minDepositMicros,
        minWithdrawMicros: config.minWithdrawMicros,
        withdrawNetworkFeeMicros: config.withdrawNetworkFeeMicros,
        trc20Confirmations: config.trc20Confirmations,
      }),
    });
    await refresh();
  }

  async function postAction(path: string, body?: unknown) {
    await apiFetch(path, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    });
    await refresh();
  }

  async function approveWithdrawal(id: string) {
    if (!confirm(t("confirmApprove"))) return;
    await postAction(`/v1/admin/withdrawals/${id}/approve`);
  }

  async function markPaid(id: string) {
    const txHash = window.prompt(t("enterTxHash"));
    if (!txHash?.trim()) return;
    await postAction(`/v1/admin/withdrawals/${id}/paid`, {
      txHash: txHash.trim(),
    });
  }

  async function rejectWithdrawal(id: string) {
    if (!confirm(t("rejectWithdrawal"))) return;
    const note = window.prompt(t("rejectWithdrawalNote"));
    if (note === null) return;
    await postAction(`/v1/admin/withdrawals/${id}/reject`, {
      note: note.trim() || undefined,
    });
  }

  async function resolveDispute(id: string, decision: "approve" | "reject") {
    const note = window.prompt(
      decision === "approve" ? t("disputeApproveNote") : t("disputeRejectNote"),
      decision === "approve" ? t("disputeApproveDefault") : t("disputeRejectDefault"),
    );
    if (note === null) return;
    await postAction(`/v1/admin/disputes/${id}/resolve`, {
      decision,
      note: note.trim() || undefined,
    });
  }

  async function simulateDeposit(userId: string, amountUsdt: number) {
    await postAction("/v1/admin/deposits/simulate", {
      userId,
      amountMicros: Math.round(amountUsdt * 1_000_000),
    });
  }

  async function takeDownTask(id: string) {
    if (!confirm(t("confirmTakeDown"))) return;
    await postAction(`/v1/admin/tasks/${id}/take-down`);
  }

  async function banUser(id: string) {
    if (!confirm(t("confirmBan"))) return;
    await postAction(`/v1/admin/users/${id}/ban`);
  }

  async function unbanUser(id: string) {
    if (!confirm(t("confirmUnban"))) return;
    await postAction(`/v1/admin/users/${id}/unban`);
  }

  async function toggleReferral(id: string, currentlyDisabled: boolean) {
    const message = currentlyDisabled
      ? t("confirmEnableReferral")
      : t("confirmDisableReferral");
    if (!confirm(message)) return;
    await postAction(`/v1/admin/users/${id}/referral`, {
      enabled: currentlyDisabled,
    });
  }

  async function copyText(value: string) {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // ignore clipboard failures
    }
  }

  function tabLabel(tab: AdminTab) {
    if (tab === "overview") return t("overview");
    return t(tab);
  }

  function tabBadge(tab: AdminTab) {
    if (tab === "withdrawals" && data.overview.pendingWithdrawals > 0) {
      return data.overview.pendingWithdrawals;
    }
    if (tab === "disputes" && data.overview.openDisputes > 0) {
      return data.overview.openDisputes;
    }
    return null;
  }

  return (
    <div className="space-y-6">
      <nav className="flex flex-wrap gap-2">
        {TABS.map((tab) => {
          const badge = tabBadge(tab);
          return (
            <Button
              key={tab}
              type="button"
              size="sm"
              variant={activeTab === tab ? "primary" : "secondary"}
              onClick={() => setActiveTab(tab)}
            >
              {tabLabel(tab)}
              {badge !== null ? ` (${badge})` : ""}
            </Button>
          );
        })}
      </nav>

      {activeTab === "overview" ? (
        <AdminOverviewPanel
          overview={data.overview}
          onNavigateTab={setActiveTab}
        />
      ) : null}

      {activeTab === "withdrawals" ? (
        <AdminWithdrawalsPanel
          withdrawals={data.withdrawals}
          handlers={{
            onApproveWithdrawal: approveWithdrawal,
            onMarkPaid: markPaid,
            onRejectWithdrawal: rejectWithdrawal,
            onCopy: copyText,
          }}
        />
      ) : null}

      {activeTab === "disputes" ? (
        <AdminDisputesPanel
          disputes={data.disputes}
          onResolveDispute={resolveDispute}
        />
      ) : null}

      {activeTab === "deposits" ? (
        <AdminDepositsPanel
          deposits={data.deposits}
          chainAdapter={data.config.chainAdapter}
          currentUserId={data.currentUserId}
          onSimulateDeposit={simulateDeposit}
        />
      ) : null}

      {activeTab === "users" ? (
        <AdminUsersPanel
          users={data.users}
          handlers={{
            onBanUser: banUser,
            onUnbanUser: unbanUser,
            onToggleReferral: toggleReferral,
          }}
        />
      ) : null}

      {activeTab === "tasks" ? (
        <AdminTasksPanel tasks={data.tasks} onTakeDownTask={takeDownTask} />
      ) : null}

      {activeTab === "config" ? (
        <AdminConfigPanel config={data.config} onSave={saveConfig} />
      ) : null}
    </div>
  );
}
