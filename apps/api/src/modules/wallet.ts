import { desc, eq } from "drizzle-orm";
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
  DepositStatus,
  DisputeStatus,
  JoinStatus,
  TaskStatus,
  WithdrawalStatus,
} from "@xs-share/shared";
import type { AppConfig } from "../config";
import { requireAdmin, requireUser } from "../lib/auth";
import { authFromRequest } from "../lib/request-auth";
import { getDb } from "../lib/db";
import { conflict, notFound, validation } from "../lib/errors";
import {
  approveJoin,
  creditDeposit,
  debitForWithdraw,
  rejectJoin,
  releaseTaskHoldRemaining,
} from "../services/wallet";
import {
  getPlatformSettings,
  updatePlatformSettings,
} from "../services/config";
import { notifyUser } from "../services/notify";

export function walletModule(config: AppConfig) {
  return new Elysia({ prefix: `${API_PREFIX}/wallet` })
  .get("/", async ({ request }) => {
      const { user } = await authFromRequest(request, config.SESSION_SECRET);
    const current = requireUser(user);
    const db = getDb();
    const wallet = await db.query.walletAccounts.findFirst({
      where: eq(walletAccounts.userId, current.id),
    });
    return {
      availableCents: wallet?.availableCents ?? 0,
      frozenCents: wallet?.frozenCents ?? 0,
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
  .post(
    "/deposits",
    async ({ request, body }) => {
      const { user } = await authFromRequest(request, config.SESSION_SECRET);
      const current = requireUser(user);
      if (body.amountCents <= 0) throw validation("Amount must be positive");
      const db = getDb();
      const [row] = await db
        .insert(deposits)
        .values({
          userId: current.id,
          amountCents: body.amountCents,
          note: body.note,
          status: DepositStatus.pending,
        })
        .returning();
      return { deposit: row };
    },
    {
      body: t.Object({
        amountCents: t.Number(),
        note: t.Optional(t.String()),
      }),
    },
  )
  .post(
    "/withdrawals",
    async ({ request, body }) => {
      const { user } = await authFromRequest(request, config.SESSION_SECRET);
      const current = requireUser(user);
      if (body.amountCents <= 0) throw validation("Amount must be positive");
      if (!body.payoutInfo.trim()) throw validation("Payout info required");
      await debitForWithdraw(current.id, body.amountCents);
      const db = getDb();
      const [row] = await db
        .insert(withdrawals)
        .values({
          userId: current.id,
          amountCents: body.amountCents,
          payoutInfo: body.payoutInfo,
          status: WithdrawalStatus.pending,
        })
        .returning();
      return { withdrawal: row };
    },
    {
      body: t.Object({
        amountCents: t.Number(),
        payoutInfo: t.String(),
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
  return new Elysia({ prefix: `${API_PREFIX}/referral` })
  .get("/", async ({ request }) => {
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
    const totalCents = rewards.reduce((sum, row) => sum + row.amountCents, 0);
    return {
      inviteCode: current.inviteCode,
      inviteUrl: `${appUrl}/${current.preferredLocale}/login?invite=${current.inviteCode}`,
      inviteeCount: invitees.length,
      totalRewardCents: totalCents,
      rewards,
      invitees: invitees.map((row) => ({
        id: row.id,
        displayName: row.displayName,
        createdAt: row.createdAt,
      })),
    };
  });

}

export function disputesModule(config: AppConfig) {
  return new Elysia({ prefix: `${API_PREFIX}/disputes` })
  .post(
    "/",
    async ({ request, body }) => {
      const { user } = await authFromRequest(request, config.SESSION_SECRET);
      const current = requireUser(user);
      const db = getDb();
      const join = await db.query.joins.findFirst({
        where: eq(joins.id, body.joinId),
      });
      if (!join) throw notFound("Join not found");
      if (
        join.earnerId !== current.id &&
        current.role !== "admin"
      ) {
        const task = await db.query.tasks.findFirst({
          where: eq(tasks.id, join.taskId),
        });
        if (!task || task.publisherId !== current.id) {
          throw notFound("Join not found");
        }
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

      await db
        .update(joins)
        .set({ status: JoinStatus.disputed, updatedAt: new Date() })
        .where(eq(joins.id, join.id));

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
    return { items };
  })
  .post(
    "/deposits/:id/confirm",
    async ({ request, params }) => {
      const { user } = await authFromRequest(request, config.SESSION_SECRET);
      const admin = requireAdmin(user);
      const db = getDb();
      const deposit = await db.query.deposits.findFirst({
        where: eq(deposits.id, params.id),
      });
      if (!deposit) throw notFound("Deposit not found");
      if (deposit.status !== DepositStatus.pending) {
        throw conflict("Deposit not pending");
      }
      await creditDeposit(deposit.userId, deposit.amountCents);
      await db
        .update(deposits)
        .set({
          status: DepositStatus.confirmed,
          reviewedByUserId: admin.id,
          reviewedAt: new Date(),
        })
        .where(eq(deposits.id, deposit.id));
      await notifyUser({
        userId: deposit.userId,
        type: "deposit_confirmed",
        title: "Deposit confirmed",
        body: `Your deposit of ${deposit.amountCents} cents was confirmed.`,
      });
      return { ok: true };
    },
    { params: t.Object({ id: t.String() }) },
  )
  .post(
    "/deposits/:id/reject",
    async ({ request, params, body }) => {
      const { user } = await authFromRequest(request, config.SESSION_SECRET);
      const admin = requireAdmin(user);
      const db = getDb();
      const deposit = await db.query.deposits.findFirst({
        where: eq(deposits.id, params.id),
      });
      if (!deposit) throw notFound("Deposit not found");
      if (deposit.status !== DepositStatus.pending) {
        throw conflict("Deposit not pending");
      }
      await db
        .update(deposits)
        .set({
          status: DepositStatus.rejected,
          note: body.note,
          reviewedByUserId: admin.id,
          reviewedAt: new Date(),
        })
        .where(eq(deposits.id, deposit.id));
      await notifyUser({
        userId: deposit.userId,
        type: "deposit_rejected",
        title: "Deposit rejected",
        body: body.note ?? "Your deposit request was rejected.",
      });
      return { ok: true };
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({ note: t.Optional(t.String()) }),
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
    return { items };
  })
  .post(
    "/withdrawals/:id/paid",
    async ({ request, params }) => {
      const { user } = await authFromRequest(request, config.SESSION_SECRET);
      const admin = requireAdmin(user);
      const db = getDb();
      const row = await db.query.withdrawals.findFirst({
        where: eq(withdrawals.id, params.id),
      });
      if (!row) throw notFound("Withdrawal not found");
      if (row.status !== WithdrawalStatus.pending) {
        throw conflict("Withdrawal not pending");
      }
      await db
        .update(withdrawals)
        .set({
          status: WithdrawalStatus.paid,
          reviewedByUserId: admin.id,
          reviewedAt: new Date(),
        })
        .where(eq(withdrawals.id, row.id));
      await notifyUser({
        userId: row.userId,
        type: "withdrawal_paid",
        title: "Withdrawal paid",
        body: `Your withdrawal of ${row.amountCents} cents was marked paid.`,
      });
      return { ok: true };
    },
    { params: t.Object({ id: t.String() }) },
  )
  .post(
    "/withdrawals/:id/reject",
    async ({ request, params, body }) => {
      const { user } = await authFromRequest(request, config.SESSION_SECRET);
      const admin = requireAdmin(user);
      const db = getDb();
      const row = await db.query.withdrawals.findFirst({
        where: eq(withdrawals.id, params.id),
      });
      if (!row) throw notFound("Withdrawal not found");
      if (row.status !== WithdrawalStatus.pending) {
        throw conflict("Withdrawal not pending");
      }
      await creditDeposit(row.userId, row.amountCents);
      await db
        .update(withdrawals)
        .set({
          status: WithdrawalStatus.rejected,
          note: body.note,
          reviewedByUserId: admin.id,
          reviewedAt: new Date(),
        })
        .where(eq(withdrawals.id, row.id));
      await notifyUser({
        userId: row.userId,
        type: "withdrawal_rejected",
        title: "Withdrawal rejected",
        body: body.note ?? "Your withdrawal was rejected and funds returned.",
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
    return { items };
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
            resolutionNote: body.note,
            resolvedByUserId: admin.id,
            resolvedAt: new Date(),
          })
          .where(eq(disputes.id, dispute.id));
      } else {
        await rejectJoin({
          joinId: dispute.joinId,
          reviewerId: admin.id,
          reason: body.note || "Rejected by admin dispute resolution",
          isAdmin: true,
        });
        await db
          .update(disputes)
          .set({
            status: DisputeStatus.resolved_reject,
            resolutionNote: body.note,
            resolvedByUserId: admin.id,
            resolvedAt: new Date(),
          })
          .where(eq(disputes.id, dispute.id));
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
    return getPlatformSettings();
  })
  .patch(
    "/config",
    async ({ request, body }) => {
      const { user } = await authFromRequest(request, config.SESSION_SECRET);
      requireAdmin(user);
      return updatePlatformSettings(body);
    },
    {
      body: t.Object({
        platformFeeRateBps: t.Optional(t.Number()),
        referralEnabled: t.Optional(t.Boolean()),
        referralEarnRateBps: t.Optional(t.Number()),
        referralPublishRateBps: t.Optional(t.Number()),
      }),
    },
  );
}
