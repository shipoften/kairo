import { and, count, desc, eq, gte, inArray, or, sql } from "drizzle-orm";
import { Elysia, t } from "elysia";
import {
  deposits,
  notifications,
  referralRewards,
  users,
  walletAccounts,
  walletLedgers,
  withdrawals,
  disputes,
  joins,
  tasks,
} from "@xs-share/db";
import {
  API_PREFIX,
  DisputeStatus,
  ErrorCode,
  JoinStatus,
  TaskStatus,
  WithdrawalStatus,
} from "@xs-share/shared";
import type { AppConfig } from "../config";
import { requireAdmin, requireUser } from "../lib/auth";
import { authFromRequest } from "../lib/request-auth";
import { getDb } from "../lib/db";
import { AppError, conflict, notFound, validation } from "../lib/errors";
import {
  approveJoin,
  approveWithdraw,
  ensureDepositAddress,
  markWithdrawPaid,
  registerDepositTx,
  rejectJoin,
  rejectWithdraw,
  releaseTaskHoldRemaining,
  requestWithdraw,
  simulateDeposit,
} from "../services/wallet";
import {
  getPlatformSettings,
  updatePlatformSettings,
} from "../services/config";
import { getChainAdapter } from "../services/chain";
import { notifyUser } from "../services/notify";

async function userNameById(userIds: string[]) {
  if (userIds.length === 0) return new Map<string, string>();
  const db = getDb();
  const userRows = await db.query.users.findMany({
    where: inArray(users.id, userIds),
  });
  return new Map(userRows.map((row) => [row.id, row.displayName]));
}

export function walletModule(config: AppConfig) {
  return new Elysia({ prefix: `${API_PREFIX}/wallet` })
    .get("/", async ({ request }) => {
      const { user } = await authFromRequest(request, config.SESSION_SECRET);
      const current = requireUser(user);
      const db = getDb();
      const wallet = await db.query.walletAccounts.findFirst({
        where: eq(walletAccounts.userId, current.id),
      });
      const settings = await getPlatformSettings();
      return {
        availableMicros: wallet?.availableMicros ?? 0,
        frozenMicros: wallet?.frozenMicros ?? 0,
        currency: "USDT",
        chain: "trc20",
        minDepositMicros: settings.minDepositMicros,
        minWithdrawMicros: settings.minWithdrawMicros,
        withdrawNetworkFeeMicros: settings.withdrawNetworkFeeMicros,
        trc20Confirmations: settings.trc20Confirmations,
      };
    })
    .get("/deposit-address", async ({ request }) => {
      const { user } = await authFromRequest(request, config.SESSION_SECRET);
      const current = requireUser(user);
      const row = await ensureDepositAddress(current.id);
      const settings = await getPlatformSettings();
      return {
        chain: row.chain,
        address: row.address,
        minDepositMicros: settings.minDepositMicros,
        trc20Confirmations: settings.trc20Confirmations,
        currency: "USDT",
      };
    })
    .get("/transactions", async ({ request }) => {
      const { user } = await authFromRequest(request, config.SESSION_SECRET);
      const current = requireUser(user);
      const db = getDb();
      const items = await db.query.walletLedgers.findMany({
        where: eq(walletLedgers.userId, current.id),
        orderBy: [desc(walletLedgers.createdAt)],
        limit: 100,
      });
      return { items };
    })
    .get("/deposits", async ({ request }) => {
      const { user } = await authFromRequest(request, config.SESSION_SECRET);
      const current = requireUser(user);
      const db = getDb();
      const items = await db.query.deposits.findMany({
        where: eq(deposits.userId, current.id),
        orderBy: [desc(deposits.createdAt)],
        limit: 50,
      });
      return { items };
    })
    .get(
      "/deposits/:txHash",
      async ({ request, params }) => {
        const { user } = await authFromRequest(request, config.SESSION_SECRET);
        const current = requireUser(user);
        const db = getDb();
        const row = await db.query.deposits.findFirst({
          where: and(
            eq(deposits.userId, current.id),
            eq(deposits.txHash, params.txHash),
          ),
        });
        if (!row) throw notFound("Deposit not found");
        return { deposit: row };
      },
      { params: t.Object({ txHash: t.String() }) },
    )
    .post(
      "/deposits/register",
      async ({ request, body }) => {
        const { user } = await authFromRequest(request, config.SESSION_SECRET);
        const current = requireUser(user);
        const result = await registerDepositTx({
          userId: current.id,
          txHash: body.txHash,
        });
        return result;
      },
      {
        body: t.Object({
          txHash: t.String({ minLength: 16 }),
        }),
      },
    )
    .get("/withdrawals", async ({ request }) => {
      const { user } = await authFromRequest(request, config.SESSION_SECRET);
      const current = requireUser(user);
      const db = getDb();
      const items = await db.query.withdrawals.findMany({
        where: eq(withdrawals.userId, current.id),
        orderBy: [desc(withdrawals.createdAt)],
        limit: 50,
      });
      return { items };
    })
    .post(
      "/withdrawals",
      async ({ request, body }) => {
        const { user } = await authFromRequest(request, config.SESSION_SECRET);
        const current = requireUser(user);
        const row = await requestWithdraw({
          userId: current.id,
          amountMicros: body.amountMicros,
          toAddress: body.toAddress,
        });
        return { withdrawal: row };
      },
      {
        body: t.Object({
          amountMicros: t.Number(),
          toAddress: t.String({ minLength: 1 }),
        }),
      },
    );
}

export function reviewsModule(config: AppConfig) {
  return new Elysia({ prefix: `${API_PREFIX}/reviews` })
    .post(
      "/:joinId/approve",
      async ({ request, params }) => {
        const { user } = await authFromRequest(request, config.SESSION_SECRET);
        const current = requireUser(user);
        const result = await approveJoin({
          joinId: params.joinId,
          reviewerId: current.id,
          isAdmin: current.role === "admin",
        });
        return result;
      },
      { params: t.Object({ joinId: t.String() }) },
    )
    .post(
      "/:joinId/reject",
      async ({ request, params, body }) => {
        const { user } = await authFromRequest(request, config.SESSION_SECRET);
        const current = requireUser(user);
        await rejectJoin({
          joinId: params.joinId,
          reviewerId: current.id,
          reason: body.reason,
          isAdmin: current.role === "admin",
        });
        return { ok: true };
      },
      {
        params: t.Object({ joinId: t.String() }),
        body: t.Object({ reason: t.String({ minLength: 1 }) }),
      },
    );
}

export function notificationsModule(config: AppConfig) {
  return new Elysia({
    prefix: `${API_PREFIX}/notifications`,
  })
    .get("/", async ({ request }) => {
      const { user } = await authFromRequest(request, config.SESSION_SECRET);
      const current = requireUser(user);
      const db = getDb();
      const items = await db.query.notifications.findMany({
        where: eq(notifications.userId, current.id),
        orderBy: [desc(notifications.createdAt)],
        limit: 50,
      });
      const unreadCount = items.filter((item) => !item.readAt).length;
      return { items, unreadCount };
    })
    .post("/:id/read", async ({ request, params }) => {
      const { user } = await authFromRequest(request, config.SESSION_SECRET);
      const current = requireUser(user);
      const db = getDb();
      await db
        .update(notifications)
        .set({ readAt: new Date() })
        .where(eq(notifications.id, params.id));
      void current;
      return { ok: true };
    });
}

export function referralModule(config: AppConfig) {
  return new Elysia({ prefix: `${API_PREFIX}/referral` }).get(
    "/",
    async ({ request }) => {
      const { user } = await authFromRequest(request, config.SESSION_SECRET);
      const current = requireUser(user);
      const db = getDb();
      const appUrl =
        process.env.WEB_ORIGIN ??
        process.env.NEXT_PUBLIC_APP_URL ??
        "http://localhost:5180";
      const invitees = await db.query.users.findMany({
        where: eq(users.invitedByUserId, current.id),
      });
      const rewards = await db.query.referralRewards.findMany({
        where: eq(referralRewards.inviterId, current.id),
        orderBy: [desc(referralRewards.createdAt)],
        limit: 100,
      });
      const totalMicros = rewards.reduce(
        (sum, row) => sum + row.amountMicros,
        0,
      );
      return {
        inviteCode: current.inviteCode,
        inviteUrl: `${appUrl}/${current.preferredLocale}/login?invite=${current.inviteCode}`,
        inviteeCount: invitees.length,
        totalRewardMicros: totalMicros,
        rewards,
        invitees: invitees.map((row) => ({
          id: row.id,
          displayName: row.displayName,
          createdAt: row.createdAt,
        })),
      };
    },
  );
}

export function disputesModule(config: AppConfig) {
  return new Elysia({ prefix: `${API_PREFIX}/disputes` }).post(
    "/",
    async ({ request, body }) => {
      const { user } = await authFromRequest(request, config.SESSION_SECRET);
      const current = requireUser(user);
      const db = getDb();
      const join = await db.query.joins.findFirst({
        where: eq(joins.id, body.joinId),
      });
      if (!join) throw notFound("Join not found");

      const task = await db.query.tasks.findFirst({
        where: eq(tasks.id, join.taskId),
      });
      if (!task) throw notFound("Join not found");

      const isEarner = join.earnerId === current.id;
      const isPublisher = task.publisherId === current.id;
      if (!isEarner && !isPublisher && current.role !== "admin") {
        throw notFound("Join not found");
      }

      const existingOpen = await db.query.disputes.findFirst({
        where: and(
          eq(disputes.joinId, join.id),
          eq(disputes.status, DisputeStatus.open),
        ),
      });
      if (existingOpen) {
        throw new AppError(
          ErrorCode.DISPUTE_ALREADY_OPEN,
          "An open dispute already exists for this join",
          409,
        );
      }

      if (
        join.status !== JoinStatus.submitted &&
        join.status !== JoinStatus.rejected
      ) {
        throw conflict("Join not disputable");
      }

      const [row] = await db
        .insert(disputes)
        .values({
          joinId: join.id,
          openedByUserId: current.id,
          reason: body.reason,
          status: DisputeStatus.open,
        })
        .returning();
      if (!row) throw conflict("Failed to create dispute");

      await db
        .update(joins)
        .set({ status: JoinStatus.disputed, updatedAt: new Date() })
        .where(eq(joins.id, join.id));

      const counterpartyId = isEarner ? task.publisherId : join.earnerId;
      if (counterpartyId !== current.id) {
        await notifyUser({
          userId: counterpartyId,
          type: "dispute_opened",
          title: "Dispute opened",
          body: `A dispute was opened on "${task.title}".`,
          payload: { disputeId: row.id, joinId: join.id, taskId: task.id },
        });
      }

      return { dispute: row };
    },
    {
      body: t.Object({
        joinId: t.String(),
        reason: t.String({ minLength: 1 }),
      }),
    },
  );
}

export function adminModule(config: AppConfig) {
  return new Elysia({ prefix: `${API_PREFIX}/admin` })
    .get("/overview", async ({ request }) => {
      const { user } = await authFromRequest(request, config.SESSION_SECRET);
      requireAdmin(user);
      const db = getDb();
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);

      const [
        pendingWithdrawalStats,
        openDisputeStats,
        todayDepositStats,
        activeTaskStats,
        totalUserStats,
      ] = await Promise.all([
        db
          .select({
            count: count(),
            amountMicros: sql<number>`coalesce(sum(${withdrawals.amountMicros}), 0)::int`,
          })
          .from(withdrawals)
          .where(eq(withdrawals.status, WithdrawalStatus.pending)),
        db
          .select({ count: count() })
          .from(disputes)
          .where(eq(disputes.status, DisputeStatus.open)),
        db
          .select({
            count: count(),
            amountMicros: sql<number>`coalesce(sum(${deposits.amountMicros}), 0)::int`,
          })
          .from(deposits)
          .where(gte(deposits.createdAt, startOfToday)),
        db
          .select({ count: count() })
          .from(tasks)
          .where(
            or(
              eq(tasks.status, TaskStatus.recruiting),
              eq(tasks.status, TaskStatus.paused),
              eq(tasks.status, TaskStatus.full),
            ),
          ),
        db.select({ count: count() }).from(users),
      ]);

      return {
        pendingWithdrawals: pendingWithdrawalStats[0]?.count ?? 0,
        pendingWithdrawalAmountMicros:
          pendingWithdrawalStats[0]?.amountMicros ?? 0,
        openDisputes: openDisputeStats[0]?.count ?? 0,
        todayDeposits: todayDepositStats[0]?.count ?? 0,
        todayDepositAmountMicros: todayDepositStats[0]?.amountMicros ?? 0,
        activeTasks: activeTaskStats[0]?.count ?? 0,
        totalUsers: totalUserStats[0]?.count ?? 0,
        chainAdapter: getChainAdapter().name,
      };
    })
    .get("/users", async ({ request }) => {
      const { user } = await authFromRequest(request, config.SESSION_SECRET);
      requireAdmin(user);
      const db = getDb();
      const items = await db.query.users.findMany({
        orderBy: [desc(users.createdAt)],
        limit: 200,
      });
      return { items };
    })
    .post(
      "/users/:id/ban",
      async ({ request, params }) => {
        const { user } = await authFromRequest(request, config.SESSION_SECRET);
        requireAdmin(user);
        const db = getDb();
        await db
          .update(users)
          .set({ bannedAt: new Date(), updatedAt: new Date() })
          .where(eq(users.id, params.id));
        return { ok: true };
      },
      { params: t.Object({ id: t.String() }) },
    )
    .post(
      "/users/:id/unban",
      async ({ request, params }) => {
        const { user } = await authFromRequest(request, config.SESSION_SECRET);
        requireAdmin(user);
        const db = getDb();
        await db
          .update(users)
          .set({ bannedAt: null, updatedAt: new Date() })
          .where(eq(users.id, params.id));
        return { ok: true };
      },
      { params: t.Object({ id: t.String() }) },
    )
    .post(
      "/users/:id/referral",
      async ({ request, params, body }) => {
        const { user } = await authFromRequest(request, config.SESSION_SECRET);
        requireAdmin(user);
        const db = getDb();
        await db
          .update(users)
          .set({
            referralEnabled: body.enabled,
            updatedAt: new Date(),
          })
          .where(eq(users.id, params.id));
        return { ok: true };
      },
      {
        params: t.Object({ id: t.String() }),
        body: t.Object({ enabled: t.Boolean() }),
      },
    )
    .get("/tasks", async ({ request }) => {
      const { user } = await authFromRequest(request, config.SESSION_SECRET);
      requireAdmin(user);
      const db = getDb();
      const items = await db.query.tasks.findMany({
        orderBy: [desc(tasks.createdAt)],
        limit: 200,
      });
      return { items };
    })
    .post(
      "/tasks/:id/take-down",
      async ({ request, params }) => {
        const { user } = await authFromRequest(request, config.SESSION_SECRET);
        requireAdmin(user);
        const db = getDb();
        const task = await db.query.tasks.findFirst({
          where: eq(tasks.id, params.id),
        });
        if (!task) throw notFound("Task not found");
        await releaseTaskHoldRemaining(task.id);
        await db
          .update(tasks)
          .set({ status: TaskStatus.taken_down, updatedAt: new Date() })
          .where(eq(tasks.id, task.id));
        return { ok: true };
      },
      { params: t.Object({ id: t.String() }) },
    )
    .get("/deposits", async ({ request }) => {
      const { user } = await authFromRequest(request, config.SESSION_SECRET);
      requireAdmin(user);
      const db = getDb();
      const items = await db.query.deposits.findMany({
        orderBy: [desc(deposits.createdAt)],
        limit: 200,
      });
      const nameById = await userNameById([...new Set(items.map((item) => item.userId))]);
      return {
        items: items.map((item) => ({
          ...item,
          userName: nameById.get(item.userId) ?? null,
        })),
      };
    })
    .post(
      "/deposits/simulate",
      async ({ request, body }) => {
        const { user } = await authFromRequest(request, config.SESSION_SECRET);
        requireAdmin(user);
        if (getChainAdapter().name !== "mock") {
          throw validation("Simulate only available when CHAIN_ADAPTER=mock");
        }
        if (body.amountMicros <= 0) {
          throw validation("Amount must be positive");
        }
        const result = await simulateDeposit({
          userId: body.userId,
          amountMicros: body.amountMicros,
          confirmations: body.confirmations,
          txHash: body.txHash,
        });
        return result;
      },
      {
        body: t.Object({
          userId: t.String(),
          amountMicros: t.Number(),
          confirmations: t.Optional(t.Number()),
          txHash: t.Optional(t.String()),
        }),
      },
    )
    .get("/withdrawals", async ({ request }) => {
      const { user } = await authFromRequest(request, config.SESSION_SECRET);
      requireAdmin(user);
      const db = getDb();
      const items = await db.query.withdrawals.findMany({
        orderBy: [desc(withdrawals.createdAt)],
        limit: 200,
      });
      const nameById = await userNameById([...new Set(items.map((item) => item.userId))]);
      return {
        items: items.map((item) => ({
          ...item,
          userName: nameById.get(item.userId) ?? null,
        })),
      };
    })
    .post(
      "/withdrawals/:id/approve",
      async ({ request, params }) => {
        const { user } = await authFromRequest(request, config.SESSION_SECRET);
        const admin = requireAdmin(user);
        const updated = await approveWithdraw({
          withdrawalId: params.id,
          adminId: admin.id,
        });
        return { withdrawal: updated };
      },
      { params: t.Object({ id: t.String() }) },
    )
    .post(
      "/withdrawals/:id/paid",
      async ({ request, params, body }) => {
        const { user } = await authFromRequest(request, config.SESSION_SECRET);
        const admin = requireAdmin(user);
        const updated = await markWithdrawPaid({
          withdrawalId: params.id,
          adminId: admin.id,
          txHash: body.txHash,
        });
        return { withdrawal: updated };
      },
      {
        params: t.Object({ id: t.String() }),
        body: t.Object({ txHash: t.String({ minLength: 1 }) }),
      },
    )
    .post(
      "/withdrawals/:id/reject",
      async ({ request, params, body }) => {
        const { user } = await authFromRequest(request, config.SESSION_SECRET);
        const admin = requireAdmin(user);
        await rejectWithdraw({
          withdrawalId: params.id,
          adminId: admin.id,
          note: body.note,
        });
        return { ok: true };
      },
      {
        params: t.Object({ id: t.String() }),
        body: t.Object({ note: t.Optional(t.String()) }),
      },
    )
    .get("/disputes", async ({ request }) => {
      const { user } = await authFromRequest(request, config.SESSION_SECRET);
      requireAdmin(user);
      const db = getDb();
      const items = await db.query.disputes.findMany({
        orderBy: [desc(disputes.createdAt)],
        limit: 200,
      });
      const joinIds = [...new Set(items.map((item) => item.joinId))];
      const joinRows =
        joinIds.length > 0
          ? await db.query.joins.findMany({
              where: inArray(joins.id, joinIds),
            })
          : [];
      const joinById = new Map(joinRows.map((row) => [row.id, row]));
      const taskIds = [
        ...new Set(joinRows.map((row) => row.taskId).filter(Boolean)),
      ];
      const taskRows =
        taskIds.length > 0
          ? await db.query.tasks.findMany({
              where: inArray(tasks.id, taskIds),
            })
          : [];
      const taskById = new Map(taskRows.map((row) => [row.id, row]));
      const userIds = [
        ...new Set([
          ...items.map((item) => item.openedByUserId),
          ...joinRows.map((row) => row.earnerId),
          ...taskRows.map((row) => row.publisherId),
        ]),
      ];
      const userRows =
        userIds.length > 0
          ? await db.query.users.findMany({
              where: inArray(users.id, userIds),
            })
          : [];
      const nameById = new Map(
        userRows.map((row) => [row.id, row.displayName]),
      );

      return {
        items: items.map((item) => {
          const join = joinById.get(item.joinId);
          const task = join ? taskById.get(join.taskId) : undefined;
          return {
            ...item,
            taskId: task?.id ?? null,
            taskTitle: task?.title ?? null,
            earnerId: join?.earnerId ?? null,
            earnerName: join ? (nameById.get(join.earnerId) ?? null) : null,
            publisherId: task?.publisherId ?? null,
            publisherName: task
              ? (nameById.get(task.publisherId) ?? null)
              : null,
            openedByName: nameById.get(item.openedByUserId) ?? null,
            joinStatus: join?.status ?? null,
          };
        }),
      };
    })
    .post(
      "/disputes/:id/resolve",
      async ({ request, params, body }) => {
        const { user } = await authFromRequest(request, config.SESSION_SECRET);
        const admin = requireAdmin(user);
        const db = getDb();
        const dispute = await db.query.disputes.findFirst({
          where: eq(disputes.id, params.id),
        });
        if (!dispute || dispute.status !== DisputeStatus.open) {
          throw conflict("Dispute not open");
        }

        const join = await db.query.joins.findFirst({
          where: eq(joins.id, dispute.joinId),
        });
        if (!join) throw notFound("Join not found");
        const task = await db.query.tasks.findFirst({
          where: eq(tasks.id, join.taskId),
        });
        if (!task) throw notFound("Task not found");

        const note =
          body.note?.trim() ||
          (body.decision === "approve"
            ? "Approved by admin dispute resolution"
            : "Rejected by admin dispute resolution");

        if (body.decision === "approve") {
          await approveJoin({
            joinId: dispute.joinId,
            reviewerId: admin.id,
            isAdmin: true,
          });
          await db
            .update(disputes)
            .set({
              status: DisputeStatus.resolved_approve,
              resolutionNote: note,
              resolvedByUserId: admin.id,
              resolvedAt: new Date(),
            })
            .where(eq(disputes.id, dispute.id));
        } else {
          await rejectJoin({
            joinId: dispute.joinId,
            reviewerId: admin.id,
            reason: note,
            isAdmin: true,
          });
          await db
            .update(disputes)
            .set({
              status: DisputeStatus.resolved_reject,
              resolutionNote: note,
              resolvedByUserId: admin.id,
              resolvedAt: new Date(),
            })
            .where(eq(disputes.id, dispute.id));
        }

        const recipientIds = [...new Set([join.earnerId, task.publisherId])];
        for (const userId of recipientIds) {
          await notifyUser({
            userId,
            type: "dispute_resolved",
            title: "Dispute resolved",
            body:
              body.decision === "approve"
                ? `Dispute on "${task.title}" was resolved in favor of the earner.`
                : `Dispute on "${task.title}" was resolved; submission remains rejected.`,
            payload: {
              disputeId: dispute.id,
              joinId: join.id,
              taskId: task.id,
              decision: body.decision,
            },
          });
        }

        return { ok: true };
      },
      {
        params: t.Object({ id: t.String() }),
        body: t.Object({
          decision: t.Union([t.Literal("approve"), t.Literal("reject")]),
          note: t.Optional(t.String()),
        }),
      },
    )
    .get("/config", async ({ request }) => {
      const { user } = await authFromRequest(request, config.SESSION_SECRET);
      requireAdmin(user);
      const settings = await getPlatformSettings();
      return {
        ...settings,
        chainAdapter: getChainAdapter().name,
      };
    })
    .patch(
      "/config",
      async ({ request, body }) => {
        const { user } = await authFromRequest(request, config.SESSION_SECRET);
        requireAdmin(user);
        const settings = await updatePlatformSettings(body);
        return {
          ...settings,
          chainAdapter: getChainAdapter().name,
        };
      },
      {
        body: t.Object({
          platformFeeRateBps: t.Optional(t.Number()),
          referralEnabled: t.Optional(t.Boolean()),
          referralEarnRateBps: t.Optional(t.Number()),
          referralPublishRateBps: t.Optional(t.Number()),
          minDepositMicros: t.Optional(t.Number()),
          minWithdrawMicros: t.Optional(t.Number()),
          withdrawNetworkFeeMicros: t.Optional(t.Number()),
          trc20Confirmations: t.Optional(t.Number()),
        }),
      },
    );
}
