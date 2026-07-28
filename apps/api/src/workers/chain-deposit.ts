import { and, eq, inArray } from "drizzle-orm";
import { depositAddresses, deposits } from "@xs-share/db";
import { DepositStatus, formatUsdt } from "@xs-share/shared";
import { getDb } from "../lib/db";
import { getChainAdapter } from "../services/chain";
import { getPlatformSettings } from "../services/config";
import { creditOnChainDeposit } from "../services/wallet";
import { notifyUser } from "../services/notify";

const POLL_MS = 15_000;

export function startChainDepositWorker() {
  const tick = async () => {
    try {
      await scanDepositAddresses();
      await advancePendingDeposits();
    } catch (error) {
      console.error("[chain-deposit-worker]", error);
    }
  };

  void tick();
  return setInterval(() => {
    void tick();
  }, POLL_MS);
}

async function scanDepositAddresses() {
  const db = getDb();
  const adapter = getChainAdapter();
  const settings = await getPlatformSettings();
  const addresses = await db.query.depositAddresses.findMany({ limit: 500 });

  for (const row of addresses) {
    const incoming = await adapter.listIncomingUsdt(row.address);
    for (const transfer of incoming) {
      const result = await creditOnChainDeposit({
        userId: row.userId,
        address: row.address,
        txHash: transfer.txHash,
        fromAddress: transfer.fromAddress,
        amountMicros: transfer.amountMicros,
        confirmations: transfer.confirmations,
        requiredConfirmations: settings.trc20Confirmations,
        chain: row.chain,
      });
      if (result.credited) {
        await notifyUser({
          userId: row.userId,
          type: "deposit_confirmed",
          title: "Deposit confirmed",
          body: `Your deposit of ${formatUsdt(transfer.amountMicros)} USDT was confirmed.`,
        });
      }
    }
  }
}

async function advancePendingDeposits() {
  const db = getDb();
  const adapter = getChainAdapter();
  const settings = await getPlatformSettings();
  const pending = await db.query.deposits.findMany({
    where: inArray(deposits.status, [
      DepositStatus.detecting,
      DepositStatus.confirming,
    ]),
    limit: 200,
  });

  for (const row of pending) {
    const confirmations = await adapter.getConfirmations(row.txHash);
    if (confirmations === row.confirmations && confirmations < settings.trc20Confirmations) {
      continue;
    }
    const addressRow = await db.query.depositAddresses.findFirst({
      where: and(
        eq(depositAddresses.userId, row.userId),
        eq(depositAddresses.address, row.address),
      ),
    });
    if (!addressRow) continue;

    const result = await creditOnChainDeposit({
      userId: row.userId,
      address: row.address,
      txHash: row.txHash,
      fromAddress: row.fromAddress ?? undefined,
      amountMicros: row.amountMicros,
      confirmations,
      requiredConfirmations: settings.trc20Confirmations,
      chain: row.chain,
    });
    if (result.credited) {
      await notifyUser({
        userId: row.userId,
        type: "deposit_confirmed",
        title: "Deposit confirmed",
        body: `Your deposit of ${formatUsdt(row.amountMicros)} USDT was confirmed.`,
      });
    }
  }

  // Keep ignored below-min deposits for audit; cleanup is out of scope.
}
