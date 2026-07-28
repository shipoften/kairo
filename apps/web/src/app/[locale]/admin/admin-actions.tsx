"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api";

type Config = {
  platformFeeRateBps: number;
  referralEnabled: boolean;
  referralEarnRateBps: number;
  referralPublishRateBps: number;
};

type AdminData = {
  config: Config;
  deposits: Array<{ id: string; amountCents: number; status: string }>;
  withdrawals: Array<{ id: string; amountCents: number; status: string }>;
  users: Array<{ id: string; displayName: string; role: string; bannedAt: string | null }>;
  tasks: Array<{ id: string; title: string; status: string }>;
  disputes: Array<{ id: string; status: string; reason: string }>;
};

export function AdminActions({ data }: { data: AdminData }) {
  const t = useTranslations("admin");
  const router = useRouter();

  async function refresh() {
    router.refresh();
  }

  async function saveConfig(config: Config) {
    await apiFetch("/v1/admin/config", {
      method: "PATCH",
      body: JSON.stringify(config),
    });
    await refresh();
  }

  async function confirmAction(path: string, message: string) {
    if (!confirm(message)) return;
    await apiFetch(path, { method: "POST" });
    await refresh();
  }

  return (
    <>
      <section className="space-y-3 rounded-2xl border border-line bg-surface p-5">
        <h2 className="text-lg font-medium">{t("config")}</h2>
        <ConfigEditor config={data.config} onSave={saveConfig} />
      </section>

      <AdminList
        title={t("deposits")}
        items={data.deposits.map((item) => ({
          id: item.id,
          label: `${item.id.slice(0, 8)} · ${item.amountCents} · ${item.status}`,
          actions:
            item.status === "pending"
              ? [
                  {
                    label: t("confirm"),
                    onClick: () =>
                      confirmAction(
                        `/v1/admin/deposits/${item.id}/confirm`,
                        t("confirmDeposit"),
                      ),
                  },
                  {
                    label: t("reject"),
                    onClick: () =>
                      confirmAction(
                        `/v1/admin/deposits/${item.id}/reject`,
                        t("rejectDeposit"),
                      ),
                  },
                ]
              : [],
        }))}
      />

      <AdminList
        title={t("withdrawals")}
        items={data.withdrawals.map((item) => ({
          id: item.id,
          label: `${item.id.slice(0, 8)} · ${item.amountCents} · ${item.status}`,
          actions:
            item.status === "pending"
              ? [
                  {
                    label: t("markPaid"),
                    onClick: () =>
                      confirmAction(
                        `/v1/admin/withdrawals/${item.id}/paid`,
                        t("confirmPaid"),
                      ),
                  },
                  {
                    label: t("reject"),
                    onClick: () =>
                      confirmAction(
                        `/v1/admin/withdrawals/${item.id}/reject`,
                        t("rejectWithdrawal"),
                      ),
                  },
                ]
              : [],
        }))}
      />

      <AdminList
        title={t("tasks")}
        items={data.tasks.map((item) => ({
          id: item.id,
          label: `${item.title} · ${item.status}`,
          actions:
            item.status !== "taken_down"
              ? [
                  {
                    label: t("takeDown"),
                    onClick: () =>
                      confirmAction(
                        `/v1/admin/tasks/${item.id}/take-down`,
                        t("confirmTakeDown"),
                      ),
                  },
                ]
              : [],
        }))}
      />

      <AdminList
        title={t("users")}
        items={data.users.map((item) => ({
          id: item.id,
          label: `${item.displayName} · ${item.role}${item.bannedAt ? ` · ${t("banned")}` : ""}`,
          actions: item.bannedAt
            ? [
                {
                  label: t("unban"),
                  onClick: () =>
                    confirmAction(`/v1/admin/users/${item.id}/unban`, t("confirmUnban")),
                },
              ]
            : [
                {
                  label: t("ban"),
                  onClick: () =>
                    confirmAction(`/v1/admin/users/${item.id}/ban`, t("confirmBan")),
                },
              ],
        }))}
      />

      <section className="space-y-3">
        <h2 className="text-lg font-medium">{t("disputes")}</h2>
        {data.disputes.map((item) => (
          <div key={item.id} className="rounded-xl border border-line bg-surface px-4 py-3 text-sm">
            <p>
              {item.status}: {item.reason}
            </p>
            {item.status === "open" ? (
              <div className="mt-2 flex gap-2">
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  onClick={async () => {
                    await apiFetch(`/v1/admin/disputes/${item.id}/resolve`, {
                      method: "POST",
                      body: JSON.stringify({ decision: "approve", note: "approved" }),
                    });
                    await refresh();
                  }}
                >
                  {t("approve")}
                </Button>
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  onClick={async () => {
                    await apiFetch(`/v1/admin/disputes/${item.id}/resolve`, {
                      method: "POST",
                      body: JSON.stringify({ decision: "reject", note: "rejected" }),
                    });
                    await refresh();
                  }}
                >
                  {t("reject")}
                </Button>
              </div>
            ) : null}
          </div>
        ))}
      </section>
    </>
  );
}

function ConfigEditor({
  config,
  onSave,
}: {
  config: Config;
  onSave: (config: Config) => Promise<void>;
}) {
  const t = useTranslations("admin");
  const [local, setLocal] = useState(config);

  return (
    <div className="space-y-3">
      <label className="block text-sm">
        {t("platformFeeBps")}
        <input
          type="number"
          className="mt-1 w-full rounded-xl border border-line px-3 py-2"
          value={local.platformFeeRateBps}
          onChange={(event) =>
            setLocal({ ...local, platformFeeRateBps: Number(event.target.value) })
          }
        />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={local.referralEnabled}
          onChange={(event) =>
            setLocal({ ...local, referralEnabled: event.target.checked })
          }
        />
        {t("referralEnabled")}
      </label>
      <Button type="button" size="sm" onClick={() => onSave(local)}>
        {t("saveConfig")}
      </Button>
    </div>
  );
}

function AdminList({
  title,
  items,
}: {
  title: string;
  items: Array<{
    id: string;
    label: string;
    actions: Array<{ label: string; onClick: () => void }>;
  }>;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-medium">{title}</h2>
      {items.map((item) => (
        <div
          key={item.id}
          className="flex items-center justify-between rounded-xl border border-line bg-surface px-4 py-3 text-sm"
        >
          <span>{item.label}</span>
          <div className="flex gap-2">
            {item.actions.map((action) => (
              <Button
                key={action.label}
                type="button"
                variant="link"
                size="sm"
                onClick={action.onClick}
              >
                {action.label}
              </Button>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
