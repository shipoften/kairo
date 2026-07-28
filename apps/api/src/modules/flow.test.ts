import { beforeAll, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { users } from "@xs-share/db";
import { createApp } from "../app";
import { loadConfig } from "../config";
import { getDb } from "../lib/db";

const hasDatabase = Boolean(process.env.DATABASE_URL);

function getCookie(response: Response) {
  const header = response.headers.get("set-cookie");
  if (!header) return "";
  return header.split(";")[0];
}

async function json<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

describe.skipIf(!hasDatabase)("api integration", () => {
  const config = loadConfig();
  const app = createApp(config);

  beforeAll(async () => {
    // ensure schema exists; migration should be applied outside
    getDb();
  });

  test("health", async () => {
    const response = await app.handle(new Request("http://localhost/health"));
    expect(response.status).toBe(200);
    const body = await json<{ ok: boolean }>(response);
    expect(body.ok).toBe(true);
  });

  test("publish join submit approve referral flow", async () => {
    const publisherLogin = await app.handle(
      new Request("http://localhost/v1/auth/dev-login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          externalId: `pub-${Date.now()}`,
          displayName: "Publisher",
        }),
      }),
    );
    expect(publisherLogin.status).toBe(200);
    const publisherCookie = getCookie(publisherLogin);
    const publisherBody = await json<{ user: { id: string; inviteCode: string } }>(
      publisherLogin,
    );

    const db = getDb();
    await db
      .update(users)
      .set({ role: "admin" })
      .where(eq(users.id, publisherBody.user.id));

    const depositRequest = await app.handle(
      new Request("http://localhost/v1/wallet/deposits", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: publisherCookie,
        },
        body: JSON.stringify({ amountCents: 50_000 }),
      }),
    );
    expect(depositRequest.status).toBe(200);
    const deposit = await json<{ deposit: { id: string } }>(depositRequest);

    const confirm = await app.handle(
      new Request(
        `http://localhost/v1/admin/deposits/${deposit.deposit.id}/confirm`,
        {
          method: "POST",
          headers: { cookie: publisherCookie },
        },
      ),
    );
    expect(confirm.status).toBe(200);

    const createTask = await app.handle(
      new Request("http://localhost/v1/tasks", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: publisherCookie,
        },
        body: JSON.stringify({
          title: "Follow account",
          description: "Follow and prove",
          type: "x_follow",
          targetUrl: "https://x.com/example",
          unitPriceCents: 1000,
          totalQuota: 2,
          publish: true,
        }),
      }),
    );
    expect(createTask.status).toBe(200);
    const taskBody = await json<{ task: { id: string } }>(createTask);

    const earnerLogin = await app.handle(
      new Request("http://localhost/v1/auth/dev-login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          externalId: `earn-${Date.now()}`,
          displayName: "Earner",
          inviteCode: publisherBody.user.inviteCode,
        }),
      }),
    );
    expect(earnerLogin.status).toBe(200);
    const earnerCookie = getCookie(earnerLogin);
    const earnerBody = await json<{ user: { id: string } }>(earnerLogin);
    expect(earnerBody.user.id).not.toBe(publisherBody.user.id);

    const selfJoin = await app.handle(
      new Request("http://localhost/v1/joins", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: publisherCookie,
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
          cookie: earnerCookie,
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
          cookie: earnerCookie,
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
          cookie: earnerCookie,
        },
        body: JSON.stringify({
          proofPayload: { proofUrl: "https://x.com/proof" },
        }),
      }),
    );
    expect(submit.status).toBe(200);

    // enable referral fee rates
    await app.handle(
      new Request("http://localhost/v1/admin/config", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          cookie: publisherCookie,
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
          headers: { cookie: publisherCookie },
        },
      ),
    );
    expect(approve.status).toBe(200);

    const earnerWallet = await app.handle(
      new Request("http://localhost/v1/wallet", {
        headers: { cookie: earnerCookie },
      }),
    );
    const earnerWalletBody = await json<{ availableCents: number }>(earnerWallet);
    expect(earnerWalletBody.availableCents).toBe(1000);

    const referral = await app.handle(
      new Request("http://localhost/v1/referral", {
        headers: { cookie: publisherCookie },
      }),
    );
    const referralBody = await json<{
      inviteeCount: number;
      totalRewardCents: number;
    }>(referral);
    expect(referralBody.inviteeCount).toBeGreaterThanOrEqual(1);
    expect(referralBody.totalRewardCents).toBe(100);
  });
});
