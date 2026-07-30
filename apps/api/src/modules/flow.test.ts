import { beforeAll, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { users, walletLedgers } from "@xs-share/db";
import { LedgerType, TaskStatus } from "@xs-share/shared";
import { createApp } from "../app";
import { loadConfig } from "../config";
import { getDb } from "../lib/db";
import { resetChainAdapterForTests, getMockChainAdapter } from "../services/chain";
import { runTimeoutSweep } from "../workers/timeout";

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
    type?: string;
    unitPriceMicros?: number;
    totalQuota?: number;
    endsAt?: string;
    allowResubmit?: boolean;
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
        type: input.type ?? "x_follow",
        targetUrl: "https://x.com/example",
        unitPriceMicros: input.unitPriceMicros ?? 1_000_000,
        totalQuota: input.totalQuota ?? 2,
        endsAt: input.endsAt,
        allowResubmit: input.allowResubmit,
        publish: true,
      }),
    }),
  );
  expect(response.status).toBe(200);
  return json<{
    task: { id: string; status: string; proofSchema: Record<string, unknown> };
  }>(response);
}

async function bindX(app: AppHandle, cookie: string, providerUserId: string) {
  const response = await app.handle(
    new Request("http://localhost/v1/auth/bind", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
      },
      body: JSON.stringify({
        provider: "x",
        providerUserId,
      }),
    }),
  );
  expect(response.status).toBe(200);
}

function proofPayload(suffix: string) {
  return {
    proofUrl: `https://x.com/proof/${suffix}`,
    screenshot: `https://example.com/shots/${suffix}.png`,
    note: `note-${suffix}`,
  };
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
    expect(taskBody.task.proofSchema).toHaveProperty("proofUrl");
    expect(taskBody.task.proofSchema).toHaveProperty("screenshot");

    const earner = await devLogin(app, {
      externalId: `earn-${stamp}`,
      displayName: "Earner",
      inviteCode: publisher.user.inviteCode,
    });
    expect(earner.user.id).not.toBe(publisher.user.id);
    await bindX(app, earner.cookie, `x-earn-${stamp}`);

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
          proofPayload: proofPayload(`main-${stamp}`),
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
    await bindX(app, earner.cookie, `x-earn2-${stamp}`);

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
          proofPayload: proofPayload(`bad-${stamp}`),
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

  test("task deadline join block, auto-end, full end, and resubmit", async () => {
    resetChainAdapterForTests();
    const stamp = Date.now() + 2;

    const publisher = await devLogin(app, {
      externalId: `pub3-${stamp}`,
      displayName: "Publisher Three",
    });
    await makeAdmin(publisher.user.id);
    await simulateDeposit(app, publisher.cookie, {
      userId: publisher.user.id,
      amountMicros: 40_000_000,
    });

    const expiredTask = await createPublishedTask(app, publisher.cookie, {
      title: "Already ended by deadline",
      totalQuota: 1,
      endsAt: new Date(Date.now() - 60_000).toISOString(),
    });

    const earner = await devLogin(app, {
      externalId: `earn3-${stamp}`,
      displayName: "Earner Three",
    });
    await bindX(app, earner.cookie, `x-earn3-${stamp}`);

    const joinExpired = await app.handle(
      new Request("http://localhost/v1/joins", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: earner.cookie,
        },
        body: JSON.stringify({ taskId: expiredTask.task.id }),
      }),
    );
    expect(joinExpired.status).toBe(409);

    await runTimeoutSweep();
    const endedDetail = await app.handle(
      new Request(`http://localhost/v1/public/tasks/${expiredTask.task.id}`),
    );
    expect(endedDetail.status).toBe(404);

    const fullTask = await createPublishedTask(app, publisher.cookie, {
      title: "Full then end",
      totalQuota: 1,
      unitPriceMicros: 1_000_000,
    });
    const joinFull = await app.handle(
      new Request("http://localhost/v1/joins", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: earner.cookie,
        },
        body: JSON.stringify({ taskId: fullTask.task.id }),
      }),
    );
    expect(joinFull.status).toBe(200);

    const walletBeforeFullEnd = await getWallet(app, publisher.cookie);
    const endFull = await app.handle(
      new Request(`http://localhost/v1/tasks/${fullTask.task.id}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          cookie: publisher.cookie,
        },
        body: JSON.stringify({ status: TaskStatus.ended }),
      }),
    );
    expect(endFull.status).toBe(200);
    const walletAfterFullEnd = await getWallet(app, publisher.cookie);
    expect(walletAfterFullEnd.availableMicros).toBe(
      walletBeforeFullEnd.availableMicros + 1_000_000,
    );

    const resubmitTask = await createPublishedTask(app, publisher.cookie, {
      title: "Resubmit allowed",
      totalQuota: 1,
      allowResubmit: true,
    });
    const joinResubmit = await app.handle(
      new Request("http://localhost/v1/joins", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: earner.cookie,
        },
        body: JSON.stringify({ taskId: resubmitTask.task.id }),
      }),
    );
    const joinResubmitBody = await json<{ join: { id: string } }>(joinResubmit);
    expect(joinResubmit.status).toBe(200);

    await app.handle(
      new Request(
        `http://localhost/v1/joins/${joinResubmitBody.join.id}/submit`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: earner.cookie,
          },
          body: JSON.stringify({
            proofPayload: proofPayload(`first-${stamp}`),
          }),
        },
      ),
    );
    await app.handle(
      new Request(
        `http://localhost/v1/reviews/${joinResubmitBody.join.id}/reject`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: publisher.cookie,
          },
          body: JSON.stringify({ reason: "Try again" }),
        },
      ),
    );

    const resubmit = await app.handle(
      new Request(
        `http://localhost/v1/joins/${joinResubmitBody.join.id}/submit`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: earner.cookie,
          },
          body: JSON.stringify({
            proofPayload: proofPayload(`second-${stamp}`),
          }),
        },
      ),
    );
    expect(resubmit.status).toBe(200);
  });

  test("dispute open, duplicate block, and admin resolve approve", async () => {
    resetChainAdapterForTests();
    const stamp = Date.now() + 3;

    const publisher = await devLogin(app, {
      externalId: `pub-dispute-${stamp}`,
      displayName: "Publisher Dispute",
    });
    await makeAdmin(publisher.user.id);
    await simulateDeposit(app, publisher.cookie, {
      userId: publisher.user.id,
      amountMicros: 30_000_000,
    });

    const task = await createPublishedTask(app, publisher.cookie, {
      title: "Dispute flow task",
      totalQuota: 1,
      unitPriceMicros: 2_000_000,
    });

    const earner = await devLogin(app, {
      externalId: `earn-dispute-${stamp}`,
      displayName: "Earner Dispute",
    });
    await bindX(app, earner.cookie, `x-dispute-${stamp}`);

    const joinResponse = await app.handle(
      new Request("http://localhost/v1/joins", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: earner.cookie,
        },
        body: JSON.stringify({ taskId: task.task.id }),
      }),
    );
    expect(joinResponse.status).toBe(200);
    const joinBody = await json<{ join: { id: string } }>(joinResponse);

    const submit = await app.handle(
      new Request(`http://localhost/v1/joins/${joinBody.join.id}/submit`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: earner.cookie,
        },
        body: JSON.stringify({
          proofPayload: proofPayload(`dispute-${stamp}`),
        }),
      }),
    );
    expect(submit.status).toBe(200);

    const openDispute = await app.handle(
      new Request("http://localhost/v1/disputes", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: earner.cookie,
        },
        body: JSON.stringify({
          joinId: joinBody.join.id,
          reason: "Publisher ignored my valid proof",
        }),
      }),
    );
    expect(openDispute.status).toBe(200);
    const disputeBody = await json<{ dispute: { id: string } }>(openDispute);

    const duplicate = await app.handle(
      new Request("http://localhost/v1/disputes", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: publisher.cookie,
        },
        body: JSON.stringify({
          joinId: joinBody.join.id,
          reason: "Duplicate should fail",
        }),
      }),
    );
    expect(duplicate.status).toBe(409);
    const duplicateBody = await json<{ code: string }>(duplicate);
    expect(duplicateBody.code).toBe("DISPUTE_ALREADY_OPEN");

    const walletBefore = await getWallet(app, earner.cookie);
    const resolve = await app.handle(
      new Request(
        `http://localhost/v1/admin/disputes/${disputeBody.dispute.id}/resolve`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: publisher.cookie,
          },
          body: JSON.stringify({
            decision: "approve",
            note: "Proof looks valid",
          }),
        },
      ),
    );
    expect(resolve.status).toBe(200);

    const walletAfter = await getWallet(app, earner.cookie);
    expect(walletAfter.availableMicros).toBe(
      walletBefore.availableMicros + 2_000_000,
    );

    const list = await app.handle(
      new Request("http://localhost/v1/admin/disputes", {
        headers: { cookie: publisher.cookie },
      }),
    );
    expect(list.status).toBe(200);
    const listBody = await json<{
      items: Array<{
        id: string;
        status: string;
        taskTitle: string | null;
        resolutionNote: string | null;
      }>;
    }>(list);
    const resolved = listBody.items.find(
      (item) => item.id === disputeBody.dispute.id,
    );
    expect(resolved?.status).toBe("resolved_approve");
    expect(resolved?.taskTitle).toBe("Dispute flow task");
    expect(resolved?.resolutionNote).toBe("Proof looks valid");
  });

  test("register deposit tx via wallet connect path", async () => {
    resetChainAdapterForTests();
    const mock = getMockChainAdapter();
    const stamp = Date.now();

    const depositor = await devLogin(app, {
      externalId: `dep-${stamp}`,
      displayName: "Depositor",
    });
    const other = await devLogin(app, {
      externalId: `other-${stamp}`,
      displayName: "Other",
    });

    const addressResponse = await app.handle(
      new Request("http://localhost/v1/wallet/deposit-address", {
        headers: { cookie: depositor.cookie },
      }),
    );
    expect(addressResponse.status).toBe(200);
    const addressBody = await json<{ address: string }>(addressResponse);

    const txHash = `mock_register_${stamp}_${"x".repeat(8)}`;
    mock.injectIncoming({
      txHash,
      fromAddress: "TMockSender000000000000000000000001",
      toAddress: addressBody.address,
      amountMicros: 15_000_000,
      confirmations: 20,
      blockTimestamp: new Date(),
    });

    const registerResponse = await app.handle(
      new Request("http://localhost/v1/wallet/deposits/register", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: depositor.cookie,
        },
        body: JSON.stringify({ txHash }),
      }),
    );
    expect(registerResponse.status).toBe(200);
    const registerBody = await json<{ credited: boolean; deposit: { status: string } }>(
      registerResponse,
    );
    expect(registerBody.credited).toBe(true);
    expect(registerBody.deposit.status).toBe("confirmed");

    const walletAfter = await getWallet(app, depositor.cookie);
    expect(walletAfter.availableMicros).toBe(15_000_000);

    const registerAgain = await app.handle(
      new Request("http://localhost/v1/wallet/deposits/register", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: depositor.cookie,
        },
        body: JSON.stringify({ txHash }),
      }),
    );
    expect(registerAgain.status).toBe(200);
    const againBody = await json<{ credited: boolean }>(registerAgain);
    expect(againBody.credited).toBe(true);

    const otherRegister = await app.handle(
      new Request("http://localhost/v1/wallet/deposits/register", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: other.cookie,
        },
        body: JSON.stringify({ txHash }),
      }),
    );
    expect(otherRegister.status).toBe(409);

    const wrongTxHash = `mock_wrong_addr_${stamp}_${"y".repeat(8)}`;
    const otherAddressResponse = await app.handle(
      new Request("http://localhost/v1/wallet/deposit-address", {
        headers: { cookie: other.cookie },
      }),
    );
    const otherAddressBody = await json<{ address: string }>(otherAddressResponse);
    mock.injectIncoming({
      txHash: wrongTxHash,
      fromAddress: "TMockSender000000000000000000000001",
      toAddress: otherAddressBody.address,
      amountMicros: 15_000_000,
      confirmations: 20,
      blockTimestamp: new Date(),
    });

    const wrongRegister = await app.handle(
      new Request("http://localhost/v1/wallet/deposits/register", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: depositor.cookie,
        },
        body: JSON.stringify({ txHash: wrongTxHash }),
      }),
    );
    expect(wrongRegister.status).toBe(404);

    const getDeposit = await app.handle(
      new Request(`http://localhost/v1/wallet/deposits/${txHash}`, {
        headers: { cookie: depositor.cookie },
      }),
    );
    expect(getDeposit.status).toBe(200);
    const getBody = await json<{ deposit: { txHash: string } }>(getDeposit);
    expect(getBody.deposit.txHash).toBe(txHash);
  });

  test("x bind required and withdraw must approve before paid", async () => {
    resetChainAdapterForTests();
    const stamp = Date.now() + 9;

    const publisher = await devLogin(app, {
      externalId: `pub-p0-${stamp}`,
      displayName: "Publisher P0",
    });
    await makeAdmin(publisher.user.id);
    await simulateDeposit(app, publisher.cookie, {
      userId: publisher.user.id,
      amountMicros: 40_000_000,
    });

    const task = await createPublishedTask(app, publisher.cookie, {
      title: "X bind required",
      totalQuota: 1,
    });

    const earner = await devLogin(app, {
      externalId: `earn-p0-${stamp}`,
      displayName: "Earner P0",
    });

    const joinWithoutX = await app.handle(
      new Request("http://localhost/v1/joins", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: earner.cookie,
        },
        body: JSON.stringify({ taskId: task.task.id }),
      }),
    );
    expect(joinWithoutX.status).toBe(403);
    const joinError = await json<{ code: string }>(joinWithoutX);
    expect(joinError.code).toBe("X_BIND_REQUIRED");

    await bindX(app, earner.cookie, `x-p0-${stamp}`);
    const join = await app.handle(
      new Request("http://localhost/v1/joins", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: earner.cookie,
        },
        body: JSON.stringify({ taskId: task.task.id }),
      }),
    );
    expect(join.status).toBe(200);
    const joinBody = await json<{ join: { id: string } }>(join);

    const incomplete = await app.handle(
      new Request(`http://localhost/v1/joins/${joinBody.join.id}/submit`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: earner.cookie,
        },
        body: JSON.stringify({
          proofPayload: { proofUrl: "https://x.com/only-url" },
        }),
      }),
    );
    expect(incomplete.status).toBe(400);

    const submit = await app.handle(
      new Request(`http://localhost/v1/joins/${joinBody.join.id}/submit`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: earner.cookie,
        },
        body: JSON.stringify({
          proofPayload: proofPayload(`p0-${stamp}`),
        }),
      }),
    );
    expect(submit.status).toBe(200);

    await app.handle(
      new Request(`http://localhost/v1/reviews/${joinBody.join.id}/approve`, {
        method: "POST",
        headers: { cookie: publisher.cookie },
      }),
    );

    await simulateDeposit(app, publisher.cookie, {
      userId: earner.user.id,
      amountMicros: 30_000_000,
    });

    const withdraw = await app.handle(
      new Request("http://localhost/v1/wallet/withdrawals", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: earner.cookie,
        },
        body: JSON.stringify({
          amountMicros: 20_000_000,
          toAddress: "TXYZopYRdj2D9XRtbG411XZZ3kM1VnEaMx",
        }),
      }),
    );
    expect(withdraw.status).toBe(200);
    const withdrawBody = await json<{ withdrawal: { id: string } }>(withdraw);

    const directPaid = await app.handle(
      new Request(
        `http://localhost/v1/admin/withdrawals/${withdrawBody.withdrawal.id}/paid`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: publisher.cookie,
          },
          body: JSON.stringify({ txHash: `directpaid${stamp}` }),
        },
      ),
    );
    expect(directPaid.status).toBe(409);
  });

});
