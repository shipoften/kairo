"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
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
import type {
  AdminConfig,
  AdminDepositRow,
  AdminDisputeRow,
  AdminOverview,
  AdminTaskRow,
  AdminUserRow,
  AdminWithdrawalRow,
} from "./admin-types";

async function postAction(path: string, body?: unknown) {
  await apiFetch(path, {
    method: "POST",
    body: body ? JSON.stringify(body) : undefined,
  });
}

export function AdminOverviewSection({ overview }: { overview: AdminOverview }) {
  return <AdminOverviewPanel overview={overview} />;
}

export function AdminWithdrawalsSection({
  withdrawals,
}: {
  withdrawals: AdminWithdrawalRow[];
}) {
  const t = useTranslations("admin");
  const router = useRouter();

  async function refresh() {
    router.refresh();
  }

  async function approveWithdrawal(id: string) {
    if (!confirm(t("confirmApprove"))) return;
    await postAction(`/v1/admin/withdrawals/${id}/approve`);
    await refresh();
  }

  async function markPaid(id: string, txHash: string) {
    await postAction(`/v1/admin/withdrawals/${id}/paid`, { txHash });
    await refresh();
  }

  async function rejectWithdrawal(id: string, note?: string) {
    await postAction(`/v1/admin/withdrawals/${id}/reject`, { note });
    await refresh();
  }

  async function copyText(value: string) {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // ignore clipboard failures
    }
  }

  return (
    <AdminWithdrawalsPanel
      withdrawals={withdrawals}
      handlers={{
        onApproveWithdrawal: approveWithdrawal,
        onMarkPaid: markPaid,
        onRejectWithdrawal: rejectWithdrawal,
        onCopy: copyText,
      }}
    />
  );
}

export function AdminDisputesSection({
  disputes,
}: {
  disputes: AdminDisputeRow[];
}) {
  const t = useTranslations("admin");
  const router = useRouter();

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
    router.refresh();
  }

  return (
    <AdminDisputesPanel disputes={disputes} onResolveDispute={resolveDispute} />
  );
}

export function AdminDepositsSection({
  deposits,
  chainAdapter,
  currentUserId,
}: {
  deposits: AdminDepositRow[];
  chainAdapter: string;
  currentUserId: string;
}) {
  const router = useRouter();

  async function simulateDeposit(userId: string, amountUsdt: number) {
    await postAction("/v1/admin/deposits/simulate", {
      userId,
      amountMicros: Math.round(amountUsdt * 1_000_000),
    });
    router.refresh();
  }

  return (
    <AdminDepositsPanel
      deposits={deposits}
      chainAdapter={chainAdapter}
      currentUserId={currentUserId}
      onSimulateDeposit={simulateDeposit}
    />
  );
}

export function AdminUsersSection({ users }: { users: AdminUserRow[] }) {
  const t = useTranslations("admin");
  const router = useRouter();

  async function banUser(id: string) {
    if (!confirm(t("confirmBan"))) return;
    await postAction(`/v1/admin/users/${id}/ban`);
    router.refresh();
  }

  async function unbanUser(id: string) {
    if (!confirm(t("confirmUnban"))) return;
    await postAction(`/v1/admin/users/${id}/unban`);
    router.refresh();
  }

  async function toggleReferral(id: string, currentlyDisabled: boolean) {
    const message = currentlyDisabled
      ? t("confirmEnableReferral")
      : t("confirmDisableReferral");
    if (!confirm(message)) return;
    await postAction(`/v1/admin/users/${id}/referral`, {
      enabled: currentlyDisabled,
    });
    router.refresh();
  }

  return (
    <AdminUsersPanel
      users={users}
      handlers={{
        onBanUser: banUser,
        onUnbanUser: unbanUser,
        onToggleReferral: toggleReferral,
      }}
    />
  );
}

export function AdminTasksSection({ tasks }: { tasks: AdminTaskRow[] }) {
  const t = useTranslations("admin");
  const router = useRouter();

  async function takeDownTask(id: string) {
    if (!confirm(t("confirmTakeDown"))) return;
    await postAction(`/v1/admin/tasks/${id}/take-down`);
    router.refresh();
  }

  return <AdminTasksPanel tasks={tasks} onTakeDownTask={takeDownTask} />;
}

export function AdminConfigSection({ config }: { config: AdminConfig }) {
  const router = useRouter();

  async function saveConfig(next: AdminConfig & { textModelApiKey?: string }) {
    await apiFetch("/v1/admin/config", {
      method: "PATCH",
      body: JSON.stringify({
        platformFeeRateBps: next.platformFeeRateBps,
        referralEnabled: next.referralEnabled,
        referralEarnRateBps: next.referralEarnRateBps,
        referralPublishRateBps: next.referralPublishRateBps,
        minDepositMicros: next.minDepositMicros,
        minWithdrawMicros: next.minWithdrawMicros,
        withdrawNetworkFeeMicros: next.withdrawNetworkFeeMicros,
        trc20Confirmations: next.trc20Confirmations,
        erc20Confirmations: next.erc20Confirmations,
        textModelBaseUrl: next.textModelBaseUrl,
        textModelName: next.textModelName,
        ...(next.textModelApiKey ? { textModelApiKey: next.textModelApiKey } : {}),
      }),
    });
    router.refresh();
  }

  return (
    <AdminConfigPanel
      key={[
        config.textModelBaseUrl,
        config.textModelName,
        config.textModelApiKeyMasked,
        config.platformFeeRateBps,
      ].join("|")}
      config={config}
      onSave={saveConfig}
    />
  );
}
