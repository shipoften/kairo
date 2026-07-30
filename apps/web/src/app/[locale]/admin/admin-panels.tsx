"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  TRONSCAN_ADDRESS_URL,
  TRONSCAN_TX_URL,
  WithdrawalStatus,
} from "@xs-share/shared";
import { displayUsdt } from "@/lib/money";
import {
  depositStatusVariant,
  formatWalletDate,
  StatusBadge,
  withdrawStatusVariant,
} from "../wallet/wallet-status";
import type {
  AdminConfig,
  AdminData,
  AdminDepositRow,
  AdminDisputeRow,
  AdminOverview,
  AdminTab,
  AdminWithdrawalRow,
} from "./admin-types";

const DEPOSIT_IN_PROGRESS_STATUSES = new Set(["detecting", "confirming"]);

type AdminHandlers = {
  onSaveConfig: (config: AdminConfig) => Promise<void>;
  onSimulateDeposit: (userId: string, amountUsdt: number) => Promise<void>;
  onApproveWithdrawal: (id: string) => Promise<void>;
  onMarkPaid: (id: string, txHash: string) => Promise<void>;
  onRejectWithdrawal: (id: string, note?: string) => Promise<void>;
  onTakeDownTask: (id: string) => Promise<void>;
  onBanUser: (id: string) => Promise<void>;
  onUnbanUser: (id: string) => Promise<void>;
  onToggleReferral: (id: string, enabled: boolean) => Promise<void>;
  onResolveDispute: (id: string, decision: "approve" | "reject") => Promise<void>;
  onCopy: (value: string) => void;
  onNavigateTab: (tab: AdminTab) => void;
};

export function AdminOverviewPanel({
  overview,
  onNavigateTab,
}: {
  overview: AdminOverview;
  onNavigateTab: (tab: AdminTab) => void;
}) {
  const t = useTranslations("admin");

  const cards = [
    {
      key: "pendingWithdrawals",
      label: t("pendingWithdrawals"),
      value: String(overview.pendingWithdrawals),
      sub: displayUsdt(overview.pendingWithdrawalAmountMicros),
      tab: "withdrawals" as const,
    },
    {
      key: "openDisputes",
      label: t("openDisputes"),
      value: String(overview.openDisputes),
      tab: "disputes" as const,
    },
    {
      key: "todayDeposits",
      label: t("todayDeposits"),
      value: String(overview.todayDeposits),
      sub: displayUsdt(overview.todayDepositAmountMicros),
      tab: "deposits" as const,
    },
    {
      key: "activeTasks",
      label: t("activeTasks"),
      value: String(overview.activeTasks),
      tab: "tasks" as const,
    },
    {
      key: "totalUsers",
      label: t("totalUsers"),
      value: String(overview.totalUsers),
      tab: "users" as const,
    },
  ];

  return (
    <section className="space-y-4">
      <p className="text-sm text-muted">
        {t("chainAdapter")}:{" "}
        {overview.chainAdapter === "tron"
          ? t("chainAdapterTron")
          : t("chainAdapterMock")}
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <button
            key={card.key}
            type="button"
            onClick={() => onNavigateTab(card.tab)}
            className="rounded-2xl border border-line bg-surface p-4 text-left transition hover:border-accent/40"
          >
            <p className="text-sm text-muted">{card.label}</p>
            <p className="mt-1 font-[family-name:var(--font-display)] text-3xl">
              {card.value}
            </p>
            {card.sub ? (
              <p className="mt-1 text-sm text-muted">{card.sub}</p>
            ) : null}
          </button>
        ))}
      </div>
    </section>
  );
}

export function AdminWithdrawalsPanel({
  withdrawals,
  handlers,
}: {
  withdrawals: AdminWithdrawalRow[];
  handlers: Pick<
    AdminHandlers,
    | "onApproveWithdrawal"
    | "onMarkPaid"
    | "onRejectWithdrawal"
    | "onCopy"
  >;
}) {
  const t = useTranslations("admin");
  const locale = useLocale();
  const [filter, setFilter] = useState<
    "queue" | "pending" | "approved" | "paid" | "rejected" | "all"
  >("queue");
  const [copyHint, setCopyHint] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (filter === "all") return withdrawals;
    if (filter === "queue") {
      return withdrawals.filter(
        (item) =>
          item.status === WithdrawalStatus.pending ||
          item.status === WithdrawalStatus.approved,
      );
    }
    return withdrawals.filter((item) => item.status === filter);
  }, [filter, withdrawals]);

  function handleCopy(value: string) {
    handlers.onCopy(value);
    setCopyHint(t("copied"));
    window.setTimeout(() => setCopyHint(null), 1500);
  }

  return (
    <section className="space-y-3">
      <p className="text-sm text-muted">{t("withdrawOpsHint")}</p>
      {copyHint ? <p className="text-sm text-accent">{copyHint}</p> : null}
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["queue", t("filterQueue")],
            ["pending", t("filterPendingOnly")],
            ["approved", t("filterApproved")],
            ["paid", t("filterPaid")],
            ["rejected", t("filterRejected")],
            ["all", t("filterAll")],
          ] as const
        ).map(([value, label]) => (
          <Button
            key={value}
            type="button"
            size="sm"
            variant={filter === value ? "primary" : "secondary"}
            onClick={() => setFilter(value)}
          >
            {label}
          </Button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <EmptyState />
      ) : (
        filtered.map((item) => (
          <WithdrawalCard
            key={item.id}
            item={item}
            locale={locale}
            handlers={{
              ...handlers,
              onCopy: handleCopy,
            }}
          />
        ))
      )}
    </section>
  );
}

function WithdrawalCard({
  item,
  locale,
  handlers,
}: {
  item: AdminWithdrawalRow;
  locale: string;
  handlers: Pick<
    AdminHandlers,
    | "onApproveWithdrawal"
    | "onMarkPaid"
    | "onRejectWithdrawal"
    | "onCopy"
  >;
}) {
  const t = useTranslations("admin");
  const tWallet = useTranslations("wallet");
  const statusKey = `withdrawStatus.${item.status}` as const;
  const statusLabel = tWallet.has(statusKey) ? tWallet(statusKey) : item.status;
  const [showPaidForm, setShowPaidForm] = useState(false);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [txHash, setTxHash] = useState("");
  const [rejectNote, setRejectNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function submitPaid() {
    if (!txHash.trim()) return;
    setBusy(true);
    try {
      await handlers.onMarkPaid(item.id, txHash.trim());
      setShowPaidForm(false);
      setTxHash("");
    } finally {
      setBusy(false);
    }
  }

  async function submitReject() {
    setBusy(true);
    try {
      await handlers.onRejectWithdrawal(item.id, rejectNote.trim() || undefined);
      setShowRejectForm(false);
      setRejectNote("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-line bg-surface px-4 py-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium">
          {item.userName ?? item.userId.slice(0, 8)} ·{" "}
          {displayUsdt(item.amountMicros)}
        </p>
        <StatusBadge
          label={statusLabel}
          variant={withdrawStatusVariant(item.status)}
        />
      </div>
      <p className="mt-1 text-muted">
        {formatWalletDate(item.createdAt, locale)} · {t("netPayout")}:{" "}
        {displayUsdt(item.netPayoutMicros)} USDT{" "}
        <Button
          type="button"
          variant="link"
          size="sm"
          onClick={() => handlers.onCopy(String(item.netPayoutMicros / 1_000_000))}
        >
          {t("copyNet")}
        </Button>
      </p>
      <p className="mt-1 break-all text-muted">
        {t("payoutAddress")}: {item.toAddress}{" "}
        <Button
          type="button"
          variant="link"
          size="sm"
          onClick={() => handlers.onCopy(item.toAddress)}
        >
          {t("copy")}
        </Button>
        <a
          className="text-accent underline"
          href={`${TRONSCAN_ADDRESS_URL}/${item.toAddress}`}
          target="_blank"
          rel="noreferrer"
        >
          {t("viewOnTronscan")}
        </a>
      </p>
      {item.txHash ? (
        <p className="mt-1 break-all text-muted">
          tx:{" "}
          <a
            className="text-accent underline"
            href={`${TRONSCAN_TX_URL}/${item.txHash}`}
            target="_blank"
            rel="noreferrer"
          >
            {item.txHash.slice(0, 18)}…
          </a>
        </p>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-2">
        {item.status === WithdrawalStatus.pending ? (
          <>
            <Button
              type="button"
              variant="link"
              size="sm"
              onClick={() => void handlers.onApproveWithdrawal(item.id)}
            >
              {t("approve")}
            </Button>
            <Button
              type="button"
              variant="link"
              size="sm"
              onClick={() => {
                setShowRejectForm((value) => !value);
                setShowPaidForm(false);
              }}
            >
              {t("reject")}
            </Button>
          </>
        ) : null}
        {item.status === WithdrawalStatus.approved ? (
          <>
            <Button
              type="button"
              variant="link"
              size="sm"
              onClick={() => {
                setShowPaidForm((value) => !value);
                setShowRejectForm(false);
              }}
            >
              {t("markPaid")}
            </Button>
            <Button
              type="button"
              variant="link"
              size="sm"
              onClick={() => {
                setShowRejectForm((value) => !value);
                setShowPaidForm(false);
              }}
            >
              {t("reject")}
            </Button>
          </>
        ) : null}
      </div>
      {showPaidForm ? (
        <div className="mt-3 space-y-2 rounded-xl border border-line bg-background p-3">
          <label className="block text-sm">
            {t("enterTxHash")}
            <input
              className="mt-1 w-full rounded-xl border border-line px-3 py-2 font-mono text-sm"
              value={txHash}
              onChange={(event) => setTxHash(event.target.value)}
              placeholder={t("txHashPlaceholder")}
            />
          </label>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              loading={busy}
              onClick={() => void submitPaid()}
            >
              {t("confirmMarkPaid")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => setShowPaidForm(false)}
            >
              {t("cancel")}
            </Button>
          </div>
        </div>
      ) : null}
      {showRejectForm ? (
        <div className="mt-3 space-y-2 rounded-xl border border-line bg-background p-3">
          <label className="block text-sm">
            {t("rejectWithdrawalNote")}
            <input
              className="mt-1 w-full rounded-xl border border-line px-3 py-2 text-sm"
              value={rejectNote}
              onChange={(event) => setRejectNote(event.target.value)}
            />
          </label>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              loading={busy}
              onClick={() => void submitReject()}
            >
              {t("confirmReject")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => setShowRejectForm(false)}
            >
              {t("cancel")}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function AdminDepositsPanel({
  deposits,
  chainAdapter,
  currentUserId,
  onSimulateDeposit,
}: {
  deposits: AdminDepositRow[];
  chainAdapter: string;
  currentUserId: string;
  onSimulateDeposit: (userId: string, amountUsdt: number) => Promise<void>;
}) {
  const t = useTranslations("admin");
  const tWallet = useTranslations("wallet");
  const locale = useLocale();
  const [filter, setFilter] = useState<"all" | "pending">("all");

  const filtered = useMemo(() => {
    if (filter === "all") return deposits;
    return deposits.filter((item) =>
      DEPOSIT_IN_PROGRESS_STATUSES.has(item.status),
    );
  }, [deposits, filter]);

  const [simulateUserId, setSimulateUserId] = useState(currentUserId);
  const [simulateAmount, setSimulateAmount] = useState(50);

  return (
    <section className="space-y-4">
      {chainAdapter === "mock" ? (
        <div className="space-y-3 rounded-2xl border border-line bg-surface p-5">
          <h3 className="font-medium">{t("simulateDeposit")}</h3>
          <label className="block text-sm">
            {t("simulateUserId")}
            <input
              className="mt-1 w-full rounded-xl border border-line px-3 py-2 font-mono text-sm"
              value={simulateUserId}
              onChange={(event) => setSimulateUserId(event.target.value)}
            />
          </label>
          <label className="block text-sm">
            {t("simulateAmountUsdt")}
            <input
              type="number"
              min={1}
              step="0.01"
              className="mt-1 w-full rounded-xl border border-line px-3 py-2"
              value={simulateAmount}
              onChange={(event) => setSimulateAmount(Number(event.target.value))}
            />
          </label>
          <Button
            type="button"
            size="sm"
            onClick={() => void onSimulateDeposit(simulateUserId, simulateAmount)}
          >
            {t("simulateDeposit")}
          </Button>
        </div>
      ) : null}

      <FilterBar
        filter={filter}
        onChange={(value) => setFilter(value as "all" | "pending")}
        pendingCount={deposits.filter((item) =>
          DEPOSIT_IN_PROGRESS_STATUSES.has(item.status),
        ).length}
        pendingLabel={t("filterInProgress")}
        pendingValue="pending"
        allValue="all"
      />

      {filtered.length === 0 ? (
        <EmptyState />
      ) : (
        filtered.map((item) => {
          const statusKey = `depositStatus.${item.status}` as const;
          const statusLabel = tWallet.has(statusKey)
            ? tWallet(statusKey)
            : item.status;
          return (
            <div
              key={item.id}
              className="rounded-xl border border-line bg-surface px-4 py-3 text-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">
                  {item.userName ?? item.userId.slice(0, 8)} ·{" "}
                  {displayUsdt(item.amountMicros)}
                </p>
                <StatusBadge
                  label={statusLabel}
                  variant={depositStatusVariant(item.status)}
                />
              </div>
              <p className="mt-1 text-muted">
                {formatWalletDate(item.createdAt, locale)} ·{" "}
                {item.confirmations}/{item.requiredConfirmations}
              </p>
              <p className="mt-1 break-all text-muted">
                <a
                  className="text-accent underline"
                  href={`${TRONSCAN_TX_URL}/${item.txHash}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {item.txHash.slice(0, 18)}…
                </a>{" "}
                ·{" "}
                <a
                  className="text-accent underline"
                  href={`${TRONSCAN_ADDRESS_URL}/${item.address}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {t("viewOnTronscan")}
                </a>
              </p>
            </div>
          );
        })
      )}
    </section>
  );
}

export function AdminDisputesPanel({
  disputes,
  onResolveDispute,
}: {
  disputes: AdminDisputeRow[];
  onResolveDispute: (id: string, decision: "approve" | "reject") => Promise<void>;
}) {
  const t = useTranslations("admin");
  const [filter, setFilter] = useState<"open" | "all">("open");

  const filtered = useMemo(() => {
    if (filter === "all") return disputes;
    return disputes.filter((item) => item.status === "open");
  }, [disputes, filter]);

  return (
    <section className="space-y-3">
      <FilterBar
        filter={filter}
        onChange={(value) => setFilter(value as "open" | "all")}
        pendingCount={disputes.filter((item) => item.status === "open").length}
        pendingValue="open"
        allValue="all"
      />
      {filtered.length === 0 ? (
        <EmptyState />
      ) : (
        filtered.map((item) => (
          <div
            key={item.id}
            className="rounded-xl border border-line bg-surface px-4 py-3 text-sm"
          >
            <p className="font-medium">
              {item.taskTitle ?? item.joinId.slice(0, 8)} · {item.status}
            </p>
            <p className="mt-1 text-muted">
              {t("openedBy")}: {item.openedByName ?? "—"} · {t("earner")}:{" "}
              {item.earnerName ?? "—"} · {t("publisher")}:{" "}
              {item.publisherName ?? "—"}
            </p>
            <p className="mt-1">{item.reason}</p>
            {item.taskId ? (
              <p className="mt-2">
                <Link
                  className="text-accent underline"
                  href={`/publish/tasks/${item.taskId}/submissions`}
                >
                  {t("viewSubmissions")}
                </Link>
              </p>
            ) : null}
            {item.status === "open" ? (
              <div className="mt-2 flex gap-2">
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  onClick={() => void onResolveDispute(item.id, "approve")}
                >
                  {t("approve")}
                </Button>
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  onClick={() => void onResolveDispute(item.id, "reject")}
                >
                  {t("reject")}
                </Button>
              </div>
            ) : null}
          </div>
        ))
      )}
    </section>
  );
}

export function AdminUsersPanel({
  users,
  handlers,
}: {
  users: AdminData["users"];
  handlers: Pick<
    AdminHandlers,
    "onBanUser" | "onUnbanUser" | "onToggleReferral"
  >;
}) {
  const t = useTranslations("admin");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return users;
    return users.filter(
      (item) =>
        item.displayName.toLowerCase().includes(normalized) ||
        item.id.toLowerCase().includes(normalized),
    );
  }, [query, users]);

  return (
    <section className="space-y-3">
      <input
        className="w-full rounded-xl border border-line px-3 py-2 text-sm"
        placeholder={t("searchUsers")}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {filtered.length === 0 ? (
        <EmptyState />
      ) : (
        filtered.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between rounded-xl border border-line bg-surface px-4 py-3 text-sm"
          >
            <span className="pr-3">
              {item.displayName} · {item.role}
              {item.bannedAt ? ` · ${t("banned")}` : ""}
              {item.referralEnabled === false ? ` · ${t("referralDisabled")}` : ""}
            </span>
            <div className="flex shrink-0 flex-wrap justify-end gap-2">
              {item.bannedAt ? (
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  onClick={() => void handlers.onUnbanUser(item.id)}
                >
                  {t("unban")}
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  onClick={() => void handlers.onBanUser(item.id)}
                >
                  {t("ban")}
                </Button>
              )}
              <Button
                type="button"
                variant="link"
                size="sm"
                onClick={() =>
                  void handlers.onToggleReferral(
                    item.id,
                    item.referralEnabled === false,
                  )
                }
              >
                {item.referralEnabled === false
                  ? t("enableReferral")
                  : t("disableReferral")}
              </Button>
            </div>
          </div>
        ))
      )}
    </section>
  );
}

export function AdminTasksPanel({
  tasks,
  onTakeDownTask,
}: {
  tasks: AdminData["tasks"];
  onTakeDownTask: (id: string) => Promise<void>;
}) {
  const t = useTranslations("admin");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return tasks.filter((item) => {
      const matchesQuery =
        !normalized ||
        item.title.toLowerCase().includes(normalized) ||
        item.id.toLowerCase().includes(normalized);
      const matchesStatus =
        statusFilter === "all" || item.status === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [query, statusFilter, tasks]);

  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          className="flex-1 rounded-xl border border-line px-3 py-2 text-sm"
          placeholder={t("searchTasks")}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <select
          className="rounded-xl border border-line px-3 py-2 text-sm"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
        >
          <option value="all">{t("filterAll")}</option>
          <option value="recruiting">{t("taskStatus.recruiting")}</option>
          <option value="paused">{t("taskStatus.paused")}</option>
          <option value="full">{t("taskStatus.full")}</option>
          <option value="ended">{t("taskStatus.ended")}</option>
          <option value="taken_down">{t("taskStatus.taken_down")}</option>
        </select>
      </div>
      {filtered.length === 0 ? (
        <EmptyState />
      ) : (
        filtered.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between rounded-xl border border-line bg-surface px-4 py-3 text-sm"
          >
            <span className="pr-3">
              {item.title} · {item.status}
            </span>
            {item.status !== "taken_down" ? (
              <Button
                type="button"
                variant="link"
                size="sm"
                onClick={() => void onTakeDownTask(item.id)}
              >
                {t("takeDown")}
              </Button>
            ) : null}
          </div>
        ))
      )}
    </section>
  );
}

export function AdminConfigPanel({
  config,
  onSave,
}: {
  config: AdminConfig;
  onSave: (config: AdminConfig) => Promise<void>;
}) {
  const t = useTranslations("admin");
  const [local, setLocal] = useState(config);

  function setNumber(key: keyof AdminConfig, value: string) {
    setLocal({
      ...local,
      [key]: Number(value),
    });
  }

  return (
    <section className="space-y-3 rounded-2xl border border-line bg-surface p-5">
      <p className="text-sm text-muted">
        {t("chainAdapter")}:{" "}
        {local.chainAdapter === "tron"
          ? t("chainAdapterTron")
          : t("chainAdapterMock")}
      </p>
      <label className="block text-sm">
        {t("platformFeeBps")}
        <input
          type="number"
          className="mt-1 w-full rounded-xl border border-line px-3 py-2"
          value={local.platformFeeRateBps}
          onChange={(event) => setNumber("platformFeeRateBps", event.target.value)}
        />
      </label>
      <label className="block text-sm">
        {t("minDepositUsdt")}
        <input
          type="number"
          step="0.01"
          className="mt-1 w-full rounded-xl border border-line px-3 py-2"
          value={local.minDepositMicros / 1_000_000}
          onChange={(event) =>
            setLocal({
              ...local,
              minDepositMicros: Math.round(Number(event.target.value) * 1_000_000),
            })
          }
        />
      </label>
      <label className="block text-sm">
        {t("minWithdrawUsdt")}
        <input
          type="number"
          step="0.01"
          className="mt-1 w-full rounded-xl border border-line px-3 py-2"
          value={local.minWithdrawMicros / 1_000_000}
          onChange={(event) =>
            setLocal({
              ...local,
              minWithdrawMicros: Math.round(Number(event.target.value) * 1_000_000),
            })
          }
        />
      </label>
      <label className="block text-sm">
        {t("withdrawNetworkFeeUsdt")}
        <input
          type="number"
          step="0.01"
          className="mt-1 w-full rounded-xl border border-line px-3 py-2"
          value={local.withdrawNetworkFeeMicros / 1_000_000}
          onChange={(event) =>
            setLocal({
              ...local,
              withdrawNetworkFeeMicros: Math.round(
                Number(event.target.value) * 1_000_000,
              ),
            })
          }
        />
      </label>
      <label className="block text-sm">
        {t("trc20Confirmations")}
        <input
          type="number"
          className="mt-1 w-full rounded-xl border border-line px-3 py-2"
          value={local.trc20Confirmations}
          onChange={(event) => setNumber("trc20Confirmations", event.target.value)}
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
      <label className="block text-sm">
        {t("referralEarnBps")}
        <input
          type="number"
          className="mt-1 w-full rounded-xl border border-line px-3 py-2"
          value={local.referralEarnRateBps}
          onChange={(event) => setNumber("referralEarnRateBps", event.target.value)}
        />
      </label>
      <label className="block text-sm">
        {t("referralPublishBps")}
        <input
          type="number"
          className="mt-1 w-full rounded-xl border border-line px-3 py-2"
          value={local.referralPublishRateBps}
          onChange={(event) =>
            setNumber("referralPublishRateBps", event.target.value)
          }
        />
      </label>
      <Button type="button" size="sm" onClick={() => void onSave(local)}>
        {t("saveConfig")}
      </Button>
    </section>
  );
}

function FilterBar({
  filter,
  onChange,
  pendingCount,
  pendingLabel,
  pendingValue,
  allValue,
}: {
  filter: string;
  onChange: (value: string) => void;
  pendingCount: number;
  pendingLabel?: string;
  pendingValue: string;
  allValue: string;
}) {
  const t = useTranslations("admin");

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        size="sm"
        variant={filter === pendingValue ? "primary" : "secondary"}
        onClick={() => onChange(pendingValue)}
      >
        {pendingLabel ?? t("filterPending")} ({pendingCount})
      </Button>
      <Button
        type="button"
        size="sm"
        variant={filter === allValue ? "primary" : "secondary"}
        onClick={() => onChange(allValue)}
      >
        {t("filterAll")}
      </Button>
    </div>
  );
}

function EmptyState() {
  const t = useTranslations("admin");
  return <p className="text-sm text-muted">{t("emptyList")}</p>;
}
