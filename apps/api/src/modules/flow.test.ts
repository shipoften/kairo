import { beforeAll, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { users, walletLedgers } from "@xs-share/db";
import { LedgerType, TaskStatus } from "@xs-share/shared";
import { createApp } from "../app";
import { loadConfig } from "../config";
import { getDb } from "../lib/db";
import { resetChainAdapterForTests } from "../services/chain";

const hasDatabase = Boolean(process.env.DATABASE_URL);

function getCookie(response: Response) {
  const header = response.headers.get("set-cookie");
  if (!header) return "";
  return header.split(";")[0];
}

async function json<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

type AppHandle = ReturnType<typeof createApp>;

async function devLogin(
  app: AppHandle,
  input: { externalId: string; displayName: string; inviteCode?: string },
) {
  const response = await app.handle(
    new Request("http://localhost/v1/auth/dev-login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
  expect(response.status).toBe(200);
  const body = await json<{
    user: { id: string; inviteCode: string };
  }>(response);
  return { cookie: getCookie(response), user: body.user };
}

async function makeAdmin(userId: string) {
  const db = getDb();
  await db
    .update(users)
    .set({ role: "admin" })
    .where(eq(users.id, userId));
}

async function simulateDeposit(
  app: AppHandle,
  cookie: string,
  input: { userId: string; amountMicros: number; txHash?: string },
) {
  const response = await app.handle(
    new Request("http://localhost/v1/admin/deposits/simulate", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
      },
      body: JSON.stringify(input),
    }),
  );
  expect(response.status).toBe(200);
  return json<{ deposit: { txHash: string }; credited: boolean }>(response);
}

async function getWallet(app: AppHandle, cookie: string) {
  const response = await app.handle(
    new Request("http://localhost/v1/wallet", {
      headers: { cookie },
    }),
  );
  expect(response.status).toBe(200);
  return json<{ availableMicros: number; frozenMicros: number }>(response);
}

async function createPublishedTask(
  app: AppHandle,
  cookie: string,
  input: {
    title: string;
    unitPriceMicros?: number;
    totalQuota?: number;
  },
) {
  const response = await app.handle(
    new Request("http://localhost/v1/tasks", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
      },
      body: JSON.stringify({
        title: input.title,
        description: "Integration test task",
        type: "x_follow",
        targetUrl: "https://x.com/example",
        unitPriceMicros: input.unitPriceMicros ?? 1_000_000,
        totalQuota: input.totalQuota ?? 2,
        publish: true,
      }),
    }),
  );
  expect(response.status).toBe(200);
  return json<{ task: { id: string; status: string } }>(response);
}

describe.skipIf(!hasDatabase)("api integration", () => {
  process.env.CHAIN_ADAPTER = "mock";
  const config = loadConfig();
  const app = createApp(config);

  beforeAll(async () => {
    resetChainAdapterForTests();
    getDb();
  });

  test("health", async () => {
    const response = await app.handle(new Request("http://localhost/health"));
    expect(response.status).toBe(200);
    const body = await json<{ ok: boolean }>(response);
    expect(body.ok).toBe(true);
  });

  test("publish join submit approve referral withdraw flow", async () => {
    resetChainAdapterForTests();
    const stamp = Date.now();

    const publisher = await devLogin(app, {
      externalId: `pub-${stamp}`,
      displayName: "Publisher",
    });
    await makeAdmin(publisher.user.id);

    const simulate = await simulateDeposit(app, publisher.cookie, {
      userId: publisher.user.id,
      amountMicros: 50_000_000,
    });
    expect(simulate.credited).toBe(true);

    const simulateAgain = await simulateDeposit(app, publisher.cookie, {
      userId: publisher.user.id,
      amountMicros: 50_000_000,
      txHash: simulate.deposit.txHash,
    });
    expect(simulateAgain.credited).toBe(false);

    const walletAfterDeposit = await getWallet(app, publisher.cookie);
    expect(walletAfterDeposit.availableMicros).toBe(50_000_000);

    const taskBody = await createPublishedTask(app, publisher.cookie, {
      title: "Follow account",
    });

    const earner = await devLogin(app, {
      externalId: `earn-${stamp}`,
      displayName: "Earner",
      inviteCode: publisher.user.inviteCode,
    });
    expect(earner.user.id).not.toBe(publisher.user.id);

    const selfJoin = await app.handle(
      new Request("http://localhost/v1/joins", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: publisher.cookie,
        },
        body: JSON.stringify({ taskId: taskBody.task.id }),
      }),
    );
    expect(selfJoin.status).toBe(403);

    const join = await app.handle(
      new Request("http://localhost/v1/joins", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: earner.cookie,
        },
        body: JSON.stringify({ taskId: taskBody.task.id }),
      }),
    );
    expect(join.status).toBe(200);
    const joinBody = await json<{ join: { id: string } }>(join);

    const dup = await app.handle(
      new Request("http://localhost/v1/joins", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: earner.cookie,
        },
        body: JSON.stringify({ taskId: taskBody.task.id }),
      }),
    );
    expect(dup.status).toBe(409);

    const submit = await app.handle(
      new Request(`http://localhost/v1/joins/${joinBody.join.id}/submit`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: earner.cookie,
        },
        body: JSON.stringify({
          proofPayload: { proofUrl: "https://x.com/proof" },
        }),
      }),
    );
    expect(submit.status).toBe(200);

    await app.handle(
      new Request("http://localhost/v1/admin/config", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          cookie: publisher.cookie,
        },
        body: JSON.stringify({
          referralEnabled: true,
          referralEarnRateBps: 1000,
          platformFeeRateBps: 0,
        }),
      }),
    );

    const approve = await app.handle(
      new Request(
        `http://localhost/v1/reviews/${joinBody.join.id}/approve`,
        {
          method: "POST",
          headers: { cookie: publisher.cookie },
        },
      ),
    );
    expect(approve.status).toBe(200);

    const earnerWallet = await getWallet(app, earner.cookie);
    expect(earnerWallet.availableMicros).toBe(1_000_000);

    const referral = await app.handle(
      new Request("http://localhost/v1/referral", {
        headers: { cookie: publisher.cookie },
      }),
    );
    const referralBody = await json<{
      inviteeCount: number;
      totalRewardMicros: number;
    }>(referral);
    expect(referralBody.inviteeCount).toBeGreaterThanOrEqual(1);
    expect(referralBody.totalRewardMicros).toBe(100_000);

    await simulateDeposit(app, publisher.cookie, {
      userId: earner.user.id,
      amountMicros: 25_000_000,
    });

    const addressInfo = await app.handle(
      new Request("http://localhost/v1/wallet/deposit-address", {
        headers: { cookie: earner.cookie },
      }),
    );
    const addressBody = await json<{ address: string }>(addressInfo);

    const withdraw = await app.handle(
      new Request("http://localhost/v1/wallet/withdrawals", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: earner.cookie,
        },
        body: JSON.stringify({
          amountMicros: 20_000_000,
          toAddress: addressBody.address,
        }),
      }),
    );
    expect(withdraw.status).toBe(200);
    const withdrawBody = await json<{
      withdrawal: {
        id: string;
        netPayoutMicros: number;
        networkFeeMicros: number;
      };
    }>(withdraw);
    expect(withdrawBody.withdrawal.networkFeeMicros).toBe(1_000_000);
    expect(withdrawBody.withdrawal.netPayoutMicros).toBe(19_000_000);

    const approveWithdraw = await app.handle(
      new Request(
        `http://localhost/v1/admin/withdrawals/${withdrawBody.withdrawal.id}/approve`,
        {
          method: "POST",
          headers: { cookie: publisher.cookie },
        },
      ),
    );
    expect(approveWithdraw.status).toBe(200);

    const paid = await app.handle(
      new Request(
        `http://localhost/v1/admin/withdrawals/${withdrawBody.withdrawal.id}/paid`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: publisher.cookie,
          },
          body: JSON.stringify({ txHash: `paid_${stamp}` }),
        },
      ),
    );
    expect(paid.status).toBe(200);

    const db = getDb();
    const feeLedgers = await db.query.walletLedgers.findMany({
      where: eq(walletLedgers.userId, earner.user.id),
    });
    expect(
      feeLedgers.some((row) => row.type === LedgerType.withdraw_fee),
    ).toBe(true);
  });

  test("bind reject end-task take-down and ban", async () => {
    resetChainAdapterForTests();
    const stamp = Date.now() + 1;

    const publisher = await devLogin(app, {
      externalId: `pub2-${stamp}`,
      displayName: "Publisher Two",
    });
    await makeAdmin(publisher.user.id);

    const bind = await app.handle(
      new Request("http://localhost/v1/auth/bind", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: publisher.cookie,
        },
        body: JSON.stringify({
          provider: "google",
          providerUserId: `google-${stamp}`,
        }),
      }),
    );
    expect(bind.status).toBe(200);

    const me = await app.handle(
      new Request("http://localhost/v1/me", {
        headers: { cookie: publisher.cookie },
      }),
    );
    expect(me.status).toBe(200);
    const meBody = await json<{
      identities: Array<{ provider: string; providerUserId: string }>;
    }>(me);
    expect(meBody.identities.some((row) => row.provider === "dev")).toBe(true);
    expect(
      meBody.identities.some(
        (row) =>
          row.provider === "google" &&
          row.providerUserId === `google-${stamp}`,
      ),
    ).toBe(true);

    await simulateDeposit(app, publisher.cookie, {
      userId: publisher.user.id,
      amountMicros: 50_000_000,
    });

    const rejectTask = await createPublishedTask(app, publisher.cookie, {
      title: "Reject flow task",
      totalQuota: 1,
    });

    const earner = await devLogin(app, {
      externalId: `earn2-${stamp}`,
      displayName: "Earner Two",
    });

    const join = await app.handle(
      new Request("http://localhost/v1/joins", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: earner.cookie,
        },
        body: JSON.stringify({ taskId: rejectTask.task.id }),
      }),
    );
    expect(join.status).toBe(200);
    const joinBody = await json<{ join: { id: string } }>(join);

    const submit = await app.handle(
      new Request(`http://localhost/v1/joins/${joinBody.join.id}/submit`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: earner.cookie,
        },
        body: JSON.stringify({
          proofPayload: { proofUrl: "https://x.com/bad-proof" },
        }),
      }),
    );
    expect(submit.status).toBe(200);

    const rejectReason = "Screenshot does not show follow button";
    const reject = await app.handle(
      new Request(
        `http://localhost/v1/reviews/${joinBody.join.id}/reject`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: publisher.cookie,
          },
          body: JSON.stringify({ reason: rejectReason }),
        },
      ),
    );
    expect(reject.status).toBe(200);

    const joinsList = await app.handle(
      new Request("http://localhost/v1/joins", {
        headers: { cookie: earner.cookie },
      }),
    );
    expect(joinsList.status).toBe(200);
    const joinsBody = await json<{
      items: Array<{ id: string; status: string; rejectReason: string | null }>;
    }>(joinsList);
    const rejectedJoin = joinsBody.items.find(
      (item) => item.id === joinBody.join.id,
    );
    expect(rejectedJoin?.status).toBe("rejected");
    expect(rejectedJoin?.rejectReason).toBe(rejectReason);

    const endTask = await createPublishedTask(app, publisher.cookie, {
      title: "End task refund",
      unitPriceMicros: 2_000_000,
      totalQuota: 3,
    });
    const walletBeforeEnd = await getWallet(app, publisher.cookie);
    expect(walletBeforeEnd.frozenMicros).toBeGreaterThanOrEqual(6_000_000);

    const end = await app.handle(
      new Request(`http://localhost/v1/tasks/${endTask.task.id}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          cookie: publisher.cookie,
        },
        body: JSON.stringify({ status: TaskStatus.ended }),
      }),
    );
    expect(end.status).toBe(200);
    const endBody = await json<{ task: { status: string } }>(end);
    expect(endBody.task.status).toBe(TaskStatus.ended);

    const walletAfterEnd = await getWallet(app, publisher.cookie);
    expect(walletAfterEnd.availableMicros).toBe(
      walletBeforeEnd.availableMicros + 6_000_000,
    );
    expect(walletAfterEnd.frozenMicros).toBe(
      walletBeforeEnd.frozenMicros - 6_000_000,
    );

    const takeDownTask = await createPublishedTask(app, publisher.cookie, {
      title: "Take down task",
      unitPriceMicros: 1_000_000,
      totalQuota: 1,
    });
    const walletBeforeTakeDown = await getWallet(app, publisher.cookie);

    const takeDown = await app.handle(
      new Request(
        `http://localhost/v1/admin/tasks/${takeDownTask.task.id}/take-down`,
        {
          method: "POST",
          headers: { cookie: publisher.cookie },
        },
      ),
    );
    expect(takeDown.status).toBe(200);

    const adminTasks = await app.handle(
      new Request("http://localhost/v1/admin/tasks", {
        headers: { cookie: publisher.cookie },
      }),
    );
    expect(adminTasks.status).toBe(200);
    const adminTasksBody = await json<{
      items: Array<{ id: string; status: string }>;
    }>(adminTasks);
    expect(
      adminTasksBody.items.find((item) => item.id === takeDownTask.task.id)
        ?.status,
    ).toBe(TaskStatus.taken_down);

    const publicTakenDown = await app.handle(
      new Request(`http://localhost/v1/public/tasks/${takeDownTask.task.id}`),
    );
    expect(publicTakenDown.status).toBe(404);

    const walletAfterTakeDown = await getWallet(app, publisher.cookie);
    expect(walletAfterTakeDown.availableMicros).toBe(
      walletBeforeTakeDown.availableMicros + 1_000_000,
    );

    const victim = await devLogin(app, {
      externalId: `victim-${stamp}`,
      displayName: "Victim",
    });

    const ban = await app.handle(
      new Request(`http://localhost/v1/admin/users/${victim.user.id}/ban`, {
        method: "POST",
        headers: { cookie: publisher.cookie },
      }),
    );
    expect(ban.status).toBe(200);

    const bannedAction = await app.handle(
      new Request("http://localhost/v1/me", {
        headers: { cookie: victim.cookie },
      }),
    );
    expect(bannedAction.status).toBe(401);

    const bannedRelogin = await app.handle(
      new Request("http://localhost/v1/auth/dev-login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          externalId: `victim-${stamp}`,
          displayName: "Victim",
        }),
      }),
    );
    expect(bannedRelogin.status).toBe(403);
  });
});
