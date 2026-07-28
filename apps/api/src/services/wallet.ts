import { and, eq, sql } from "drizzle-orm";
import {
  joins,
  referralRewards,
  tasks,
  users,
  walletAccounts,
  walletHolds,
  walletLedgers,
} from "@xs-share/db";
import {
  ErrorCode,
  JoinStatus,
  LedgerType,
  ReferralTrigger,
  TaskStatus,
} from "@xs-share/shared";
import { getDb } from "../lib/db";
import { AppError, conflict, notFound, validation } from "../lib/errors";
import { bpsAmount, getPlatformSettings } from "./config";
import { notifyUser } from "./notify";

async function getWalletOrThrow(userId: string) {
  const db = getDb();
  const wallet = await db.query.walletAccounts.findFirst({
    where: eq(walletAccounts.userId, userId),
  });
  if (!wallet) {
    throw new AppError(ErrorCode.INTERNAL, "Wallet missing", 500);
  }
  return wallet;
}

async function creditAvailable(input: {
  userId: string;
  amountCents: number;
  type: string;
  taskId?: string;
  joinId?: string;
  relatedUserId?: string;
  note?: string;
}) {
  if (input.amountCents <= 0) return null;
  const db = getDb();
  const [wallet] = await db
    .update(walletAccounts)
    .set({
      availableCents: sql`${walletAccounts.availableCents} + ${input.amountCents}`,
      updatedAt: new Date(),
    })
    .where(eq(walletAccounts.userId, input.userId))
    .returning();

  const [ledger] = await db
    .insert(walletLedgers)
    .values({
      userId: input.userId,
      type: input.type,
      amountCents: input.amountCents,
      balanceAfterCents: wallet.availableCents,
      taskId: input.taskId,
      joinId: input.joinId,
      relatedUserId: input.relatedUserId,
      note: input.note,
    })
    .returning();

  return ledger;
}

export async function freezeForTaskPublish(input: {
  publisherId: string;
  taskId: string;
  amountCents: number;
}) {
  if (input.amountCents <= 0) throw validation("Freeze amount must be positive");
  const db = getDb();
  const wallet = await getWalletOrThrow(input.publisherId);
  if (wallet.availableCents < input.amountCents) {
    throw new AppError(
      ErrorCode.INSUFFICIENT_BALANCE,
      "Insufficient available balance",
      400,
    );
  }

  const [updated] = await db
    .update(walletAccounts)
    .set({
      availableCents: sql`${walletAccounts.availableCents} - ${input.amountCents}`,
      frozenCents: sql`${walletAccounts.frozenCents} + ${input.amountCents}`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(walletAccounts.userId, input.publisherId),
        sql`${walletAccounts.availableCents} >= ${input.amountCents}`,
      ),
    )
    .returning();

  if (!updated) {
    throw new AppError(
      ErrorCode.INSUFFICIENT_BALANCE,
      "Insufficient available balance",
      400,
    );
  }

  await db.insert(walletLedgers).values({
    userId: input.publisherId,
    type: LedgerType.freeze,
    amountCents: -input.amountCents,
    balanceAfterCents: updated.availableCents,
    taskId: input.taskId,
  });

  await db.insert(walletHolds).values({
    taskId: input.taskId,
    userId: input.publisherId,
    amountCents: input.amountCents,
    remainingCents: input.amountCents,
    status: "active",
  });

  await db
    .update(tasks)
    .set({
      frozenCents: input.amountCents,
      status: TaskStatus.recruiting,
      updatedAt: new Date(),
    })
    .where(eq(tasks.id, input.taskId));
}

export async function releaseTaskHoldRemaining(taskId: string) {
  const db = getDb();
  const hold = await db.query.walletHolds.findFirst({
    where: eq(walletHolds.taskId, taskId),
  });
  if (!hold || hold.status !== "active" || hold.remainingCents <= 0) return;

  const [updated] = await db
    .update(walletAccounts)
    .set({
      availableCents: sql`${walletAccounts.availableCents} + ${hold.remainingCents}`,
      frozenCents: sql`${walletAccounts.frozenCents} - ${hold.remainingCents}`,
      updatedAt: new Date(),
    })
    .where(eq(walletAccounts.userId, hold.userId))
    .returning();

  await db.insert(walletLedgers).values({
    userId: hold.userId,
    type: LedgerType.unfreeze,
    amountCents: hold.remainingCents,
    balanceAfterCents: updated.availableCents,
    taskId,
  });

  await db
    .update(walletHolds)
    .set({ remainingCents: 0, status: "released", updatedAt: new Date() })
    .where(eq(walletHolds.id, hold.id));
}

async function applyReferralRewards(input: {
  inviteeId: string;
  commissionCents: number;
  platformFeeCents: number;
  taskId: string;
  joinId: string;
}) {
  const settings = await getPlatformSettings();
  if (!settings.referralEnabled) return;

  const db = getDb();
  const invitee = await db.query.users.findFirst({
    where: eq(users.id, input.inviteeId),
  });
  if (!invitee?.invitedByUserId) return;

  const inviter = await db.query.users.findFirst({
    where: eq(users.id, invitee.invitedByUserId),
  });
  if (!inviter || !inviter.referralEnabled || inviter.bannedAt) return;
  if (inviter.id === invitee.id) return;

  const earnReward = bpsAmount(
    input.commissionCents,
    settings.referralEarnRateBps,
  );
  if (earnReward > 0) {
    const ledger = await creditAvailable({
      userId: inviter.id,
      amountCents: earnReward,
      type: LedgerType.referral_reward,
      taskId: input.taskId,
      joinId: input.joinId,
      relatedUserId: invitee.id,
      note: ReferralTrigger.earn_settle,
    });
    await db.insert(referralRewards).values({
      inviterId: inviter.id,
      inviteeId: invitee.id,
      trigger: ReferralTrigger.earn_settle,
      amountCents: earnReward,
      joinId: input.joinId,
      taskId: input.taskId,
      ledgerId: ledger?.id,
    });
    await notifyUser({
      userId: inviter.id,
      type: "referral_reward",
      title: "Referral reward received",
      body: `You earned ${earnReward} cents from a referral settlement.`,
    });
  }

  const publishReward = bpsAmount(
    input.platformFeeCents,
    settings.referralPublishRateBps,
  );
  // publish fee referral is for when invitee is publisher; handled in settlePublishFeeReferral
}

export async function settlePublishFeeReferral(input: {
  publisherId: string;
  platformFeeCents: number;
  taskId: string;
  joinId: string;
}) {
  if (input.platformFeeCents <= 0) return;
  const settings = await getPlatformSettings();
  if (!settings.referralEnabled) return;

  const db = getDb();
  const publisher = await db.query.users.findFirst({
    where: eq(users.id, input.publisherId),
  });
  if (!publisher?.invitedByUserId) return;

  const inviter = await db.query.users.findFirst({
    where: eq(users.id, publisher.invitedByUserId),
  });
  if (!inviter || !inviter.referralEnabled || inviter.bannedAt) return;

  const reward = bpsAmount(
    input.platformFeeCents,
    settings.referralPublishRateBps,
  );
  if (reward <= 0) return;

  const ledger = await creditAvailable({
    userId: inviter.id,
    amountCents: reward,
    type: LedgerType.referral_reward,
    taskId: input.taskId,
    joinId: input.joinId,
    relatedUserId: publisher.id,
    note: ReferralTrigger.publish_fee,
  });

  await db.insert(referralRewards).values({
    inviterId: inviter.id,
    inviteeId: publisher.id,
    trigger: ReferralTrigger.publish_fee,
    amountCents: reward,
    joinId: input.joinId,
    taskId: input.taskId,
    ledgerId: ledger?.id,
  });

  await notifyUser({
    userId: inviter.id,
    type: "referral_reward",
    title: "Referral reward received",
    body: `You earned ${reward} cents from a referred publisher fee.`,
  });
}

export async function approveJoin(input: {
  joinId: string;
  reviewerId: string;
  isAdmin?: boolean;
}) {
  const db = getDb();
  const join = await db.query.joins.findFirst({
    where: eq(joins.id, input.joinId),
  });
  if (!join) throw notFound("Join not found");
  if (join.status !== JoinStatus.submitted && join.status !== JoinStatus.disputed) {
    throw conflict("Join is not awaiting review");
  }

  const task = await db.query.tasks.findFirst({
    where: eq(tasks.id, join.taskId),
  });
  if (!task) throw notFound("Task not found");
  if (!input.isAdmin && task.publisherId !== input.reviewerId) {
    throw new AppError(ErrorCode.FORBIDDEN, "Not task owner", 403);
  }

  const settings = await getPlatformSettings();
  const unitPrice = task.unitPriceCents;
  const platformFeeCents = bpsAmount(unitPrice, settings.platformFeeRateBps);
  const commissionCents = unitPrice - platformFeeCents;
  if (commissionCents < 0) throw validation("Invalid fee configuration");

  const hold = await db.query.walletHolds.findFirst({
    where: eq(walletHolds.taskId, task.id),
  });
  if (!hold || hold.remainingCents < unitPrice) {
    throw conflict("Insufficient task hold for settlement");
  }

  await db
    .update(walletHolds)
    .set({
      remainingCents: hold.remainingCents - unitPrice,
      updatedAt: new Date(),
      status: hold.remainingCents - unitPrice <= 0 ? "depleted" : "active",
    })
    .where(eq(walletHolds.id, hold.id));

  const [publisherWallet] = await db
    .update(walletAccounts)
    .set({
      frozenCents: sql`${walletAccounts.frozenCents} - ${unitPrice}`,
      updatedAt: new Date(),
    })
    .where(eq(walletAccounts.userId, task.publisherId))
    .returning();

  await db.insert(walletLedgers).values({
    userId: task.publisherId,
    type: LedgerType.unfreeze,
    amountCents: -unitPrice,
    balanceAfterCents: publisherWallet.availableCents,
    taskId: task.id,
    joinId: join.id,
    note: "settlement release from hold",
  });

  await creditAvailable({
    userId: join.earnerId,
    amountCents: commissionCents,
    type: LedgerType.commission,
    taskId: task.id,
    joinId: join.id,
  });

  if (platformFeeCents > 0) {
    await db.insert(walletLedgers).values({
      userId: task.publisherId,
      type: LedgerType.platform_fee,
      amountCents: -platformFeeCents,
      balanceAfterCents: publisherWallet.availableCents,
      taskId: task.id,
      joinId: join.id,
      note: "platform fee (from hold)",
    });
  }

  await db
    .update(joins)
    .set({
      status: JoinStatus.approved,
      reviewedAt: new Date(),
      updatedAt: new Date(),
      rejectReason: null,
    })
    .where(eq(joins.id, join.id));

  await db
    .update(tasks)
    .set({
      frozenCents: Math.max(0, task.frozenCents - unitPrice),
      updatedAt: new Date(),
    })
    .where(eq(tasks.id, task.id));

  await applyReferralRewards({
    inviteeId: join.earnerId,
    commissionCents,
    platformFeeCents,
    taskId: task.id,
    joinId: join.id,
  });

  await settlePublishFeeReferral({
    publisherId: task.publisherId,
    platformFeeCents,
    taskId: task.id,
    joinId: join.id,
  });

  await notifyUser({
    userId: join.earnerId,
    type: "join_approved",
    title: "Submission approved",
    body: `Your submission for "${task.title}" was approved.`,
    payload: { joinId: join.id, taskId: task.id },
  });

  return { joinId: join.id, commissionCents, platformFeeCents };
}

export async function rejectJoin(input: {
  joinId: string;
  reviewerId: string;
  reason: string;
  isAdmin?: boolean;
}) {
  if (!input.reason.trim()) throw validation("Reject reason required");
  const db = getDb();
  const join = await db.query.joins.findFirst({
    where: eq(joins.id, input.joinId),
  });
  if (!join) throw notFound("Join not found");
  if (join.status !== JoinStatus.submitted && join.status !== JoinStatus.disputed) {
    throw conflict("Join is not awaiting review");
  }

  const task = await db.query.tasks.findFirst({
    where: eq(tasks.id, join.taskId),
  });
  if (!task) throw notFound("Task not found");
  if (!input.isAdmin && task.publisherId !== input.reviewerId) {
    throw new AppError(ErrorCode.FORBIDDEN, "Not task owner", 403);
  }

  const nextStatus = task.allowResubmit
    ? JoinStatus.rejected
    : JoinStatus.expired;

  if (!task.allowResubmit) {
    await db
      .update(tasks)
      .set({
        remainingQuota: task.remainingQuota + 1,
        status:
          task.status === TaskStatus.full
            ? TaskStatus.recruiting
            : task.status,
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, task.id));
  }

  await db
    .update(joins)
    .set({
      status: nextStatus,
      rejectReason: input.reason,
      reviewedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(joins.id, join.id));

  await notifyUser({
    userId: join.earnerId,
    type: "join_rejected",
    title: "Submission rejected",
    body: input.reason,
    payload: { joinId: join.id, taskId: task.id },
  });
}

export async function creditDeposit(userId: string, amountCents: number) {
  return creditAvailable({
    userId,
    amountCents,
    type: LedgerType.deposit,
    note: "deposit confirmed",
  });
}

export async function debitForWithdraw(userId: string, amountCents: number) {
  const db = getDb();
  const [updated] = await db
    .update(walletAccounts)
    .set({
      availableCents: sql`${walletAccounts.availableCents} - ${amountCents}`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(walletAccounts.userId, userId),
        sql`${walletAccounts.availableCents} >= ${amountCents}`,
      ),
    )
    .returning();

  if (!updated) {
    throw new AppError(
      ErrorCode.INSUFFICIENT_BALANCE,
      "Insufficient available balance",
      400,
    );
  }

  await db.insert(walletLedgers).values({
    userId,
    type: LedgerType.withdraw,
    amountCents: -amountCents,
    balanceAfterCents: updated.availableCents,
  });

  return updated;
}
