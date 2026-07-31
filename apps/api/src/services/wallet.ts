import { and, count, eq, sql } from "drizzle-orm";
import {
  depositAddresses,
  deposits,
  joins,
  referralRewards,
  tasks,
  users,
  walletAccounts,
  walletHolds,
  walletLedgers,
  withdrawals,
} from "@xs-share/db";
import {
  Chain,
  DepositStatus,
  ErrorCode,
  JoinStatus,
  LedgerType,
  ReferralTrigger,
  TaskStatus,
  WithdrawalStatus,
  formatUsdt,
  isChain,
  parseChain,
} from "@xs-share/shared";
import { getDb } from "../lib/db";
import { AppError, conflict, notFound, validation } from "../lib/errors";
import {
  DEFAULT_CHAIN,
  getChainAdapter,
  isChainEnabled,
} from "./chain";
import { bpsAmount, getPlatformSettings } from "./config";
import { notifyUser } from "./notify";

function resolveChain(value?: string | null): Chain {
  const chain = parseChain(value);
  if (value && !isChain(value)) {
    throw validation("Unsupported chain");
  }
  if (!isChainEnabled(chain)) {
    throw validation(`Chain ${chain} is not enabled`);
  }
  return chain;
}

async function confirmationsForChain(chain: Chain) {
  const settings = await getPlatformSettings();
  if (chain === Chain.ERC20) {
    return settings.erc20Confirmations;
  }
  return settings.trc20Confirmations;
}

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
  amountMicros: number;
  type: string;
  taskId?: string;
  joinId?: string;
  relatedUserId?: string;
  depositId?: string;
  withdrawalId?: string;
  txHash?: string;
  note?: string;
}) {
  if (input.amountMicros <= 0) return null;
  const db = getDb();
  const [wallet] = await db
    .update(walletAccounts)
    .set({
      availableMicros: sql`${walletAccounts.availableMicros} + ${input.amountMicros}`,
      updatedAt: new Date(),
    })
    .where(eq(walletAccounts.userId, input.userId))
    .returning();

  const [ledger] = await db
    .insert(walletLedgers)
    .values({
      userId: input.userId,
      type: input.type,
      amountMicros: input.amountMicros,
      balanceAfterMicros: wallet.availableMicros,
      taskId: input.taskId,
      joinId: input.joinId,
      relatedUserId: input.relatedUserId,
      depositId: input.depositId,
      withdrawalId: input.withdrawalId,
      txHash: input.txHash,
      note: input.note,
    })
    .returning();

  return ledger;
}

export async function ensureDepositAddress(
  userId: string,
  chainInput?: string | null,
) {
  const chain = resolveChain(chainInput ?? DEFAULT_CHAIN);
  const db = getDb();
  const existing = await db.query.depositAddresses.findFirst({
    where: and(
      eq(depositAddresses.userId, userId),
      eq(depositAddresses.chain, chain),
    ),
  });
  if (existing) return existing;

  const adapter = getChainAdapter(chain);
  const [{ value: addressCount }] = await db
    .select({ value: count() })
    .from(depositAddresses)
    .where(eq(depositAddresses.chain, chain));
  const derivationIndex = Number(addressCount);
  const address = await adapter.allocateAddress(userId, derivationIndex);

  const [row] = await db
    .insert(depositAddresses)
    .values({
      userId,
      chain,
      address,
      derivationIndex,
    })
    .returning();

  return row;
}

export async function creditOnChainDeposit(input: {
  userId: string;
  address: string;
  txHash: string;
  fromAddress?: string;
  amountMicros: number;
  confirmations: number;
  requiredConfirmations: number;
  chain?: string;
}) {
  if (input.amountMicros <= 0) {
    throw validation("Deposit amount must be positive");
  }

  const db = getDb();
  const chain = parseChain(input.chain);
  const existing = await db.query.deposits.findFirst({
    where: and(eq(deposits.chain, chain), eq(deposits.txHash, input.txHash)),
  });

  if (existing) {
    if (existing.status === DepositStatus.confirmed) {
      return { deposit: existing, credited: false };
    }

    const nextStatus =
      input.confirmations >= input.requiredConfirmations
        ? DepositStatus.confirmed
        : DepositStatus.confirming;

    if (
      nextStatus === DepositStatus.confirmed &&
      existing.status !== DepositStatus.confirmed
    ) {
      return db.transaction(async (tx) => {
        const [wallet] = await tx
          .update(walletAccounts)
          .set({
            availableMicros: sql`${walletAccounts.availableMicros} + ${existing.amountMicros}`,
            updatedAt: new Date(),
          })
          .where(eq(walletAccounts.userId, existing.userId))
          .returning();

        await tx.insert(walletLedgers).values({
          userId: existing.userId,
          type: LedgerType.deposit,
          amountMicros: existing.amountMicros,
          balanceAfterMicros: wallet.availableMicros,
          depositId: existing.id,
          txHash: existing.txHash,
          note: "on-chain deposit confirmed",
        });

        const [updated] = await tx
          .update(deposits)
          .set({
            confirmations: input.confirmations,
            status: DepositStatus.confirmed,
            creditedAt: new Date(),
          })
          .where(eq(deposits.id, existing.id))
          .returning();

        return { deposit: updated, credited: true };
      });
    }

    const [updated] = await db
      .update(deposits)
      .set({
        confirmations: input.confirmations,
        status: nextStatus,
      })
      .where(eq(deposits.id, existing.id))
      .returning();

    return { deposit: updated, credited: false };
  }

  const settings = await getPlatformSettings();
  if (input.amountMicros < settings.minDepositMicros) {
    const [ignored] = await db
      .insert(deposits)
      .values({
        userId: input.userId,
        chain: chain,
        address: input.address,
        txHash: input.txHash,
        fromAddress: input.fromAddress,
        amountMicros: input.amountMicros,
        confirmations: input.confirmations,
        requiredConfirmations: input.requiredConfirmations,
        status: DepositStatus.ignored,
        note: "below minimum deposit",
      })
      .returning();
    return { deposit: ignored, credited: false };
  }

  const confirmed = input.confirmations >= input.requiredConfirmations;
  const status = confirmed
    ? DepositStatus.confirmed
    : input.confirmations > 0
      ? DepositStatus.confirming
      : DepositStatus.detecting;

  if (!confirmed) {
    const [row] = await db
      .insert(deposits)
      .values({
        userId: input.userId,
        chain: chain,
        address: input.address,
        txHash: input.txHash,
        fromAddress: input.fromAddress,
        amountMicros: input.amountMicros,
        confirmations: input.confirmations,
        requiredConfirmations: input.requiredConfirmations,
        status,
      })
      .returning();
    return { deposit: row, credited: false };
  }

  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(deposits)
      .values({
        userId: input.userId,
        chain: chain,
        address: input.address,
        txHash: input.txHash,
        fromAddress: input.fromAddress,
        amountMicros: input.amountMicros,
        confirmations: input.confirmations,
        requiredConfirmations: input.requiredConfirmations,
        status: DepositStatus.confirmed,
        creditedAt: new Date(),
      })
      .returning();

    const [wallet] = await tx
      .update(walletAccounts)
      .set({
        availableMicros: sql`${walletAccounts.availableMicros} + ${input.amountMicros}`,
        updatedAt: new Date(),
      })
      .where(eq(walletAccounts.userId, input.userId))
      .returning();

    await tx.insert(walletLedgers).values({
      userId: input.userId,
      type: LedgerType.deposit,
      amountMicros: input.amountMicros,
      balanceAfterMicros: wallet.availableMicros,
      depositId: row.id,
      txHash: input.txHash,
      note: "on-chain deposit confirmed",
    });

    return { deposit: row, credited: true };
  });
}

export async function registerDepositTx(input: {
  userId: string;
  txHash: string;
  chain?: string | null;
}) {
  const txHash = input.txHash.trim();
  if (!txHash || txHash.length < 16) {
    throw validation("Invalid transaction hash");
  }

  const chain = resolveChain(input.chain);
  const db = getDb();
  const existing = await db.query.deposits.findFirst({
    where: and(eq(deposits.chain, chain), eq(deposits.txHash, txHash)),
  });
  if (existing) {
    if (existing.userId !== input.userId) {
      throw conflict("Transaction already registered to another user");
    }
    return {
      deposit: existing,
      credited: existing.status === DepositStatus.confirmed,
    };
  }

  const addressRow = await ensureDepositAddress(input.userId, chain);
  const adapter = getChainAdapter(chain);
  const requiredConfirmations = await confirmationsForChain(chain);
  const transfer = await adapter.getIncomingUsdtByTxHash(
    txHash,
    addressRow.address,
  );
  if (!transfer) {
    throw notFound("Transaction not found yet");
  }

  const transferTo =
    chain === Chain.ERC20
      ? transfer.toAddress.toLowerCase()
      : transfer.toAddress;
  const expectedTo =
    chain === Chain.ERC20
      ? addressRow.address.toLowerCase()
      : addressRow.address;
  if (transferTo !== expectedTo) {
    throw conflict("Transaction is not sent to your deposit address");
  }

  const result = await creditOnChainDeposit({
    userId: input.userId,
    address: addressRow.address,
    txHash: transfer.txHash,
    fromAddress: transfer.fromAddress,
    amountMicros: transfer.amountMicros,
    confirmations: transfer.confirmations,
    requiredConfirmations,
    chain,
  });

  if (result.credited) {
    await notifyUser({
      userId: input.userId,
      type: "deposit_confirmed",
      title: "Deposit confirmed",
      body: `Your deposit of ${formatUsdt(transfer.amountMicros)} USDT was confirmed.`,
    });
  }

  return result;
}

export async function simulateDeposit(input: {
  userId: string;
  amountMicros: number;
  confirmations?: number;
  txHash?: string;
  chain?: string | null;
}) {
  const chain = resolveChain(input.chain);
  const addressRow = await ensureDepositAddress(input.userId, chain);
  const adapter = getChainAdapter(chain);
  if (!adapter.injectIncoming) {
    throw conflict("Deposit simulate only available with mock chain adapter");
  }

  const required = await confirmationsForChain(chain);
  const confirmations = input.confirmations ?? required;
  const txHash =
    input.txHash ??
    `mocktx_${chain}_${input.userId.slice(0, 8)}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;

  const fromAddress =
    chain === Chain.ERC20
      ? "0x0000000000000000000000000000000000000001"
      : "TMockSender000000000000000000000001";

  adapter.injectIncoming({
    txHash,
    fromAddress,
    toAddress: addressRow.address,
    amountMicros: input.amountMicros,
    confirmations,
    blockTimestamp: new Date(),
  });

  const result = await creditOnChainDeposit({
    userId: input.userId,
    address: addressRow.address,
    txHash,
    fromAddress,
    amountMicros: input.amountMicros,
    confirmations,
    requiredConfirmations: required,
    chain,
  });

  if (result.credited) {
    await notifyUser({
      userId: input.userId,
      type: "deposit_confirmed",
      title: "Deposit confirmed",
      body: `Your deposit of ${formatUsdt(input.amountMicros)} USDT was confirmed.`,
    });
  }

  return result;
}

export async function requestWithdraw(input: {
  userId: string;
  amountMicros: number;
  toAddress: string;
  chain?: string | null;
}) {
  const settings = await getPlatformSettings();
  const chain = resolveChain(input.chain);
  const adapter = getChainAdapter(chain);

  if (input.amountMicros < settings.minWithdrawMicros) {
    throw validation(
      `Minimum withdraw is ${formatUsdt(settings.minWithdrawMicros)} USDT`,
    );
  }
  if (input.amountMicros <= settings.withdrawNetworkFeeMicros) {
    throw validation("Withdraw amount must exceed network fee");
  }
  if (!adapter.isValidAddress(input.toAddress.trim())) {
    throw validation(
      chain === Chain.ERC20
        ? "Invalid ERC20 address"
        : "Invalid TRC20 address",
    );
  }

  const networkFeeMicros = settings.withdrawNetworkFeeMicros;
  const netPayoutMicros = input.amountMicros - networkFeeMicros;
  const db = getDb();

  const row = await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(walletAccounts)
      .set({
        availableMicros: sql`${walletAccounts.availableMicros} - ${input.amountMicros}`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(walletAccounts.userId, input.userId),
          sql`${walletAccounts.availableMicros} >= ${input.amountMicros}`,
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

    const [created] = await tx
      .insert(withdrawals)
      .values({
        userId: input.userId,
        chain,
        toAddress: input.toAddress.trim(),
        amountMicros: input.amountMicros,
        networkFeeMicros,
        netPayoutMicros,
        status: WithdrawalStatus.pending,
      })
      .returning();

    await tx.insert(walletLedgers).values({
      userId: input.userId,
      type: LedgerType.withdraw,
      amountMicros: -input.amountMicros,
      balanceAfterMicros: updated.availableMicros,
      withdrawalId: created.id,
      note: `withdraw request ${chain}`,
    });

    return created;
  });

  await notifyUser({
    userId: input.userId,
    type: "withdrawal_requested",
    title: "Withdrawal requested",
    body: `Your withdrawal of ${formatUsdt(row.netPayoutMicros)} USDT is pending review.`,
    payload: { withdrawalId: row.id },
  });

  return row;
}

export async function approveWithdraw(input: {
  withdrawalId: string;
  adminId: string;
}) {
  const db = getDb();
  const row = await db.query.withdrawals.findFirst({
    where: eq(withdrawals.id, input.withdrawalId),
  });
  if (!row) throw notFound("Withdrawal not found");
  if (row.status !== WithdrawalStatus.pending) {
    throw conflict("Withdrawal not pending");
  }

  const [updated] = await db
    .update(withdrawals)
    .set({
      status: WithdrawalStatus.approved,
      reviewedByUserId: input.adminId,
      reviewedAt: new Date(),
    })
    .where(eq(withdrawals.id, row.id))
    .returning();

  await notifyUser({
    userId: row.userId,
    type: "withdrawal_approved",
    title: "Withdrawal approved",
    body: `Your withdrawal of ${formatUsdt(row.netPayoutMicros)} USDT was approved and is awaiting on-chain payout.`,
    payload: { withdrawalId: row.id },
  });

  return updated;
}

export async function markWithdrawPaid(input: {
  withdrawalId: string;
  adminId: string;
  txHash: string;
}) {
  const txHash = input.txHash.trim();
  if (!txHash) throw validation("txHash required");
  if (!/^[a-zA-Z0-9]{8,128}$/.test(txHash)) {
    throw validation("txHash format is invalid");
  }

  const db = getDb();
  const row = await db.query.withdrawals.findFirst({
    where: eq(withdrawals.id, input.withdrawalId),
  });
  if (!row) throw notFound("Withdrawal not found");
  if (row.status !== WithdrawalStatus.approved) {
    throw conflict("Withdrawal must be approved before marking paid");
  }

  const [updated] = await db
    .update(withdrawals)
    .set({
      status: WithdrawalStatus.paid,
      txHash,
      reviewedByUserId: input.adminId,
      reviewedAt: new Date(),
    })
    .where(eq(withdrawals.id, row.id))
    .returning();

  const wallet = await getWalletOrThrow(row.userId);
  await db.insert(walletLedgers).values({
    userId: row.userId,
    type: LedgerType.withdraw_fee,
    amountMicros: -row.networkFeeMicros,
    balanceAfterMicros: wallet.availableMicros,
    withdrawalId: row.id,
    txHash,
    note: "network fee from withdraw",
  });

  await notifyUser({
    userId: row.userId,
    type: "withdrawal_paid",
    title: "Withdrawal paid",
    body: `Your withdrawal of ${formatUsdt(row.netPayoutMicros)} USDT was paid.`,
  });

  return updated;
}

export async function rejectWithdraw(input: {
  withdrawalId: string;
  adminId: string;
  note?: string;
}) {
  const db = getDb();
  const row = await db.query.withdrawals.findFirst({
    where: eq(withdrawals.id, input.withdrawalId),
  });
  if (!row) throw notFound("Withdrawal not found");
  if (
    row.status !== WithdrawalStatus.pending &&
    row.status !== WithdrawalStatus.approved
  ) {
    throw conflict("Withdrawal not rejectable");
  }

  await db.transaction(async (tx) => {
    const [wallet] = await tx
      .update(walletAccounts)
      .set({
        availableMicros: sql`${walletAccounts.availableMicros} + ${row.amountMicros}`,
        updatedAt: new Date(),
      })
      .where(eq(walletAccounts.userId, row.userId))
      .returning();

    await tx.insert(walletLedgers).values({
      userId: row.userId,
      type: LedgerType.withdraw_refund,
      amountMicros: row.amountMicros,
      balanceAfterMicros: wallet.availableMicros,
      withdrawalId: row.id,
      note: input.note ?? "withdraw rejected refund",
    });

    await tx
      .update(withdrawals)
      .set({
        status: WithdrawalStatus.rejected,
        note: input.note,
        reviewedByUserId: input.adminId,
        reviewedAt: new Date(),
      })
      .where(eq(withdrawals.id, row.id));
  });

  await notifyUser({
    userId: row.userId,
    type: "withdrawal_rejected",
    title: "Withdrawal rejected",
    body: input.note ?? "Your withdrawal was rejected and funds returned.",
  });
}

export async function freezeForTaskPublish(input: {
  publisherId: string;
  taskId: string;
  amountMicros: number;
}) {
  if (input.amountMicros <= 0) throw validation("Freeze amount must be positive");
  const db = getDb();

  await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(walletAccounts)
      .set({
        availableMicros: sql`${walletAccounts.availableMicros} - ${input.amountMicros}`,
        frozenMicros: sql`${walletAccounts.frozenMicros} + ${input.amountMicros}`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(walletAccounts.userId, input.publisherId),
          sql`${walletAccounts.availableMicros} >= ${input.amountMicros}`,
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

    await tx.insert(walletLedgers).values({
      userId: input.publisherId,
      type: LedgerType.freeze,
      amountMicros: -input.amountMicros,
      balanceAfterMicros: updated.availableMicros,
      taskId: input.taskId,
    });

    await tx.insert(walletHolds).values({
      taskId: input.taskId,
      userId: input.publisherId,
      amountMicros: input.amountMicros,
      remainingMicros: input.amountMicros,
      status: "active",
    });

    await tx
      .update(tasks)
      .set({
        frozenMicros: input.amountMicros,
        status: TaskStatus.recruiting,
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, input.taskId));
  });
}

export async function releaseTaskHoldRemaining(taskId: string) {
  const db = getDb();
  const hold = await db.query.walletHolds.findFirst({
    where: eq(walletHolds.taskId, taskId),
  });
  if (!hold || hold.status !== "active" || hold.remainingMicros <= 0) return;

  await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(walletAccounts)
      .set({
        availableMicros: sql`${walletAccounts.availableMicros} + ${hold.remainingMicros}`,
        frozenMicros: sql`${walletAccounts.frozenMicros} - ${hold.remainingMicros}`,
        updatedAt: new Date(),
      })
      .where(eq(walletAccounts.userId, hold.userId))
      .returning();

    await tx.insert(walletLedgers).values({
      userId: hold.userId,
      type: LedgerType.unfreeze,
      amountMicros: hold.remainingMicros,
      balanceAfterMicros: updated.availableMicros,
      taskId,
    });

    await tx
      .update(walletHolds)
      .set({ remainingMicros: 0, status: "released", updatedAt: new Date() })
      .where(eq(walletHolds.id, hold.id));
  });
}

async function applyReferralRewards(input: {
  inviteeId: string;
  commissionMicros: number;
  platformFeeMicros: number;
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
    input.commissionMicros,
    settings.referralEarnRateBps,
  );
  if (earnReward > 0) {
    const ledger = await creditAvailable({
      userId: inviter.id,
      amountMicros: earnReward,
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
      amountMicros: earnReward,
      joinId: input.joinId,
      taskId: input.taskId,
      ledgerId: ledger?.id,
    });
    await notifyUser({
      userId: inviter.id,
      type: "referral_reward",
      title: "Referral reward received",
      body: `You earned ${formatUsdt(earnReward)} USDT from a referral settlement.`,
    });
  }
}

export async function settlePublishFeeReferral(input: {
  publisherId: string;
  platformFeeMicros: number;
  taskId: string;
  joinId: string;
}) {
  if (input.platformFeeMicros <= 0) return;
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
    input.platformFeeMicros,
    settings.referralPublishRateBps,
  );
  if (reward <= 0) return;

  const ledger = await creditAvailable({
    userId: inviter.id,
    amountMicros: reward,
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
    amountMicros: reward,
    joinId: input.joinId,
    taskId: input.taskId,
    ledgerId: ledger?.id,
  });

  await notifyUser({
    userId: inviter.id,
    type: "referral_reward",
    title: "Referral reward received",
    body: `You earned ${formatUsdt(reward)} USDT from a referred publisher fee.`,
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
  const unitPrice = task.unitPriceMicros;
  const platformFeeMicros = bpsAmount(unitPrice, settings.platformFeeRateBps);
  const commissionMicros = unitPrice - platformFeeMicros;
  if (commissionMicros < 0) throw validation("Invalid fee configuration");

  const hold = await db.query.walletHolds.findFirst({
    where: eq(walletHolds.taskId, task.id),
  });
  if (!hold || hold.remainingMicros < unitPrice) {
    throw conflict("Insufficient task hold for settlement");
  }

  await db.transaction(async (tx) => {
    await tx
      .update(walletHolds)
      .set({
        remainingMicros: hold.remainingMicros - unitPrice,
        updatedAt: new Date(),
        status: hold.remainingMicros - unitPrice <= 0 ? "depleted" : "active",
      })
      .where(eq(walletHolds.id, hold.id));

    const [publisherWallet] = await tx
      .update(walletAccounts)
      .set({
        frozenMicros: sql`${walletAccounts.frozenMicros} - ${unitPrice}`,
        updatedAt: new Date(),
      })
      .where(eq(walletAccounts.userId, task.publisherId))
      .returning();

    await tx.insert(walletLedgers).values({
      userId: task.publisherId,
      type: LedgerType.unfreeze,
      amountMicros: -unitPrice,
      balanceAfterMicros: publisherWallet.availableMicros,
      taskId: task.id,
      joinId: join.id,
      note: "settlement release from hold",
    });

    const [earnerWallet] = await tx
      .update(walletAccounts)
      .set({
        availableMicros: sql`${walletAccounts.availableMicros} + ${commissionMicros}`,
        updatedAt: new Date(),
      })
      .where(eq(walletAccounts.userId, join.earnerId))
      .returning();

    await tx.insert(walletLedgers).values({
      userId: join.earnerId,
      type: LedgerType.commission,
      amountMicros: commissionMicros,
      balanceAfterMicros: earnerWallet.availableMicros,
      taskId: task.id,
      joinId: join.id,
    });

    if (platformFeeMicros > 0) {
      await tx.insert(walletLedgers).values({
        userId: task.publisherId,
        type: LedgerType.platform_fee,
        amountMicros: -platformFeeMicros,
        balanceAfterMicros: publisherWallet.availableMicros,
        taskId: task.id,
        joinId: join.id,
        note: "platform fee (from hold)",
      });
    }

    await tx
      .update(joins)
      .set({
        status: JoinStatus.approved,
        reviewedAt: new Date(),
        updatedAt: new Date(),
        rejectReason: null,
      })
      .where(eq(joins.id, join.id));

    await tx
      .update(tasks)
      .set({
        frozenMicros: Math.max(0, task.frozenMicros - unitPrice),
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, task.id));
  });

  await applyReferralRewards({
    inviteeId: join.earnerId,
    commissionMicros,
    platformFeeMicros,
    taskId: task.id,
    joinId: join.id,
  });

  await settlePublishFeeReferral({
    publisherId: task.publisherId,
    platformFeeMicros,
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

  return { joinId: join.id, commissionMicros, platformFeeMicros };
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
