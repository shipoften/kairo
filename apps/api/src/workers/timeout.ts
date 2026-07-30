import { and, eq, inArray, isNotNull, lt, sql } from "drizzle-orm";
import { joins, tasks } from "@xs-share/db";
import { JoinStatus, TaskStatus } from "@xs-share/shared";
import { getDb } from "../lib/db";
import { approveJoin, releaseTaskHoldRemaining } from "../services/wallet";
import { notifyUser } from "../services/notify";

export async function runTimeoutSweep() {
  const db = getDb();
  const now = new Date();

  const expiredJoins = await db.query.joins.findMany({
    where: and(
      eq(joins.status, JoinStatus.joined),
      isNotNull(joins.submitDeadlineAt),
      lt(joins.submitDeadlineAt, now),
    ),
    limit: 100,
  });

  for (const join of expiredJoins) {
    const task = await db.query.tasks.findFirst({
      where: eq(tasks.id, join.taskId),
    });
    const [updatedJoin] = await db
      .update(joins)
      .set({ status: JoinStatus.expired, updatedAt: now })
      .where(
        and(eq(joins.id, join.id), eq(joins.status, JoinStatus.joined)),
      )
      .returning();
    if (!updatedJoin || !task) continue;

    await db
      .update(tasks)
      .set({
        remainingQuota: sql`${tasks.remainingQuota} + 1`,
        status:
          task.status === TaskStatus.full
            ? TaskStatus.recruiting
            : task.status,
        updatedAt: now,
      })
      .where(eq(tasks.id, task.id));
    await notifyUser({
      userId: join.earnerId,
      type: "join_expired",
      title: "Join expired",
      body: `Your join on "${task.title}" expired before submission.`,
    });
  }

  const overdueReviews = await db.query.joins.findMany({
    where: and(
      eq(joins.status, JoinStatus.submitted),
      isNotNull(joins.reviewDeadlineAt),
      lt(joins.reviewDeadlineAt, now),
    ),
    limit: 50,
  });

  for (const join of overdueReviews) {
    const task = await db.query.tasks.findFirst({
      where: eq(tasks.id, join.taskId),
    });
    if (!task) continue;
    try {
      await approveJoin({
        joinId: join.id,
        reviewerId: task.publisherId,
        isAdmin: true,
      });
      await notifyUser({
        userId: task.publisherId,
        type: "auto_approved",
        title: "Submission auto-approved",
        body: `A submission on "${task.title}" was auto-approved after review timeout.`,
      });
    } catch {
      // ignore individual failures in sweep
    }
  }

  const expiredTasks = await db.query.tasks.findMany({
    where: and(
      inArray(tasks.status, [
        TaskStatus.recruiting,
        TaskStatus.paused,
        TaskStatus.full,
      ]),
      isNotNull(tasks.endsAt),
      lt(tasks.endsAt, now),
    ),
    limit: 50,
  });

  for (const task of expiredTasks) {
    await releaseTaskHoldRemaining(task.id);
    await db
      .update(tasks)
      .set({ status: TaskStatus.ended, updatedAt: now })
      .where(
        and(
          eq(tasks.id, task.id),
          inArray(tasks.status, [
            TaskStatus.recruiting,
            TaskStatus.paused,
            TaskStatus.full,
          ]),
        ),
      );
    await notifyUser({
      userId: task.publisherId,
      type: "task_ended",
      title: "Task ended",
      body: `"${task.title}" reached its deadline and remaining budget was released.`,
      payload: { taskId: task.id },
    });
  }
}

export function startTimeoutWorker(intervalMs = 60_000) {
  const timer = setInterval(() => {
    void runTimeoutSweep();
  }, intervalMs);
  if (typeof timer === "object" && "unref" in timer) {
    timer.unref();
  }
  return timer;
}
