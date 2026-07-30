import { and, count, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { Elysia, t } from "elysia";
import { authIdentities, joins, tasks, users } from "@xs-share/db";
import {
  APP_NAME,
  API_PREFIX,
  AuthProvider,
  ErrorCode,
  JoinStatus,
  isXTaskType,
  proofSchemaForTaskType,
  TaskStatus,
  TaskType,
  type ProofSchema,
} from "@xs-share/shared";
import type { AppConfig } from "../config";
import { requireUser } from "../lib/auth";
import { authFromRequest } from "../lib/request-auth";
import { getDb } from "../lib/db";
import { AppError, conflict, notFound, validation } from "../lib/errors";
import { checkRateLimit } from "../lib/rate-limit";
import { addHours } from "../lib/crypto";
import { bpsAmount, getPlatformSettings } from "../services/config";
import {
  normalizeProofPayload,
  proofFingerprint,
  validateProofAgainstSchema,
} from "../services/proof";
import { freezeForTaskPublish, releaseTaskHoldRemaining } from "../services/wallet";
import { notifyUser } from "../services/notify";

const taskTypeValues = Object.values(TaskType);

function publicTask(task: typeof tasks.$inferSelect, publisherName?: string) {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    type: task.type,
    targetUrl: task.targetUrl,
    unitPriceMicros: task.unitPriceMicros,
    currency: task.currency,
    totalQuota: task.totalQuota,
    remainingQuota: task.remainingQuota,
    status: task.status,
    languageTag: task.languageTag,
    endsAt: task.endsAt,
    publisherId: task.publisherId,
    publisherName: publisherName ?? null,
    proofSchema: task.proofSchema,
    allowResubmit: task.allowResubmit,
    createdAt: task.createdAt,
  };
}

function assertTaskJoinable(task: typeof tasks.$inferSelect) {
  if (task.status !== TaskStatus.recruiting) {
    throw new AppError(ErrorCode.TASK_NOT_OPEN, "Task not open for joins", 409);
  }
  if (task.endsAt && task.endsAt.getTime() <= Date.now()) {
    throw new AppError(ErrorCode.TASK_EXPIRED, "Task deadline has passed", 409);
  }
  if (task.remainingQuota <= 0) {
    throw new AppError(ErrorCode.QUOTA_FULL, "Task quota full", 409);
  }
}

export function publicModule(_config: AppConfig) {
  return new Elysia({ prefix: `${API_PREFIX}/public` })
  .get("/meta", async () => {
    const settings = await getPlatformSettings();
    return {
      name: APP_NAME,
      version: "0.0.1",
      platformFeeRateBps: settings.platformFeeRateBps,
    };
  })
  .get(
    "/tasks",
    async ({ query }) => {
      const db = getDb();
      const statusFilter = [TaskStatus.recruiting, TaskStatus.full];
      const sort = query.sort ?? "newest";
      const limit = Math.min(Math.max(Number(query.limit ?? 20) || 20, 1), 100);
      const offset = Math.max(Number(query.offset ?? 0) || 0, 0);

      const conditions = [inArray(tasks.status, statusFilter)];

      if (query.type && taskTypeValues.includes(query.type as TaskType)) {
        conditions.push(eq(tasks.type, query.type));
      }

      if (query.minPrice !== undefined && query.minPrice !== "") {
        const minPriceMicros = Number(query.minPrice);
        if (Number.isFinite(minPriceMicros) && minPriceMicros >= 0) {
          conditions.push(gte(tasks.unitPriceMicros, Math.floor(minPriceMicros)));
        }
      }

      if (query.languageTag) {
        conditions.push(eq(tasks.languageTag, query.languageTag));
      }

      const whereClause = and(...conditions);
      const orderBy =
        sort === "price"
          ? [desc(tasks.unitPriceMicros)]
          : sort === "deadline"
            ? [sql`${tasks.endsAt} asc nulls last`]
            : [desc(tasks.createdAt)];

      const [totalRow] = await db
        .select({ value: count() })
        .from(tasks)
        .where(whereClause);

      const rows = await db.query.tasks.findMany({
        where: whereClause,
        orderBy,
        limit,
        offset,
      });

      const total = totalRow?.value ?? 0;
      if (rows.length === 0) {
        return { items: [], total, limit, offset };
      }

      const publishers = await db.query.users.findMany({
        where: inArray(
          users.id,
          [...new Set(rows.map((task) => task.publisherId))],
        ),
      });
      const nameById = new Map(
        publishers.map((user) => [user.id, user.displayName]),
      );

      return {
        items: rows.map((task) =>
          publicTask(task, nameById.get(task.publisherId)),
        ),
        total,
        limit,
        offset,
      };
    },
    {
      query: t.Object({
        type: t.Optional(t.String()),
        minPrice: t.Optional(t.String()),
        languageTag: t.Optional(t.String()),
        sort: t.Optional(t.String()),
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String()),
      }),
    },
  )
  .get(
    "/tasks/:id",
    async ({ params }) => {
      const db = getDb();
      const task = await db.query.tasks.findFirst({
        where: eq(tasks.id, params.id),
      });
      if (
        !task ||
        (task.status !== TaskStatus.recruiting &&
          task.status !== TaskStatus.full &&
          task.status !== TaskStatus.paused)
      ) {
        throw notFound("Task not found");
      }
      const publisher = await db.query.users.findFirst({
        where: eq(users.id, task.publisherId),
      });
      return {
        ...publicTask(task, publisher?.displayName),
        proofSchema: task.proofSchema,
        submitDeadlineHours: task.submitDeadlineHours,
        reviewDeadlineHours: task.reviewDeadlineHours,
        allowResubmit: task.allowResubmit,
      };
    },
    {
      params: t.Object({ id: t.String() }),
    },
  );

}

export function tasksModule(config: AppConfig) {
  return new Elysia({ prefix: `${API_PREFIX}/tasks` })
  .get("/summary", async ({ request }) => {
    const { user } = await authFromRequest(request, config.SESSION_SECRET);
    const current = requireUser(user);
    const db = getDb();
    const rows = await db.query.tasks.findMany({
      where: eq(tasks.publisherId, current.id),
    });
    const taskIds = rows.map((row) => row.id);
    const submissionRows =
      taskIds.length > 0
        ? await db.query.joins.findMany({
            where: and(
              inArray(joins.taskId, taskIds),
              eq(joins.status, JoinStatus.submitted),
            ),
          })
        : [];
    return {
      activeTasks: rows.filter((row) =>
        ["recruiting", "full", "paused"].includes(row.status),
      ).length,
      pendingReviews: submissionRows.length,
      frozenMicros: rows.reduce((sum, row) => sum + row.frozenMicros, 0),
    };
  })
  .get("/", async ({ request, query }) => {
      const { user } = await authFromRequest(request, config.SESSION_SECRET);
    const current = requireUser(user);
    const db = getDb();
    const rows = await db.query.tasks.findMany({
      where: eq(tasks.publisherId, current.id),
      orderBy: [desc(tasks.createdAt)],
    });
    if (query.status) {
      return { items: rows.filter((row) => row.status === query.status) };
    }
    return { items: rows };
  })
  .post(
    "/",
    async ({ request, body }) => {
      const { user } = await authFromRequest(request, config.SESSION_SECRET);
      const current = requireUser(user);
      if (!taskTypeValues.includes(body.type as (typeof TaskType)[keyof typeof TaskType])) {
        throw validation("Invalid task type");
      }
      if (body.unitPriceMicros <= 0 || body.totalQuota <= 0) {
        throw validation("Price and quota must be positive");
      }

      const db = getDb();
      const [task] = await db
        .insert(tasks)
        .values({
          publisherId: current.id,
          title: body.title,
          description: body.description ?? "",
          type: body.type,
          targetUrl: body.targetUrl,
          unitPriceMicros: body.unitPriceMicros,
          totalQuota: body.totalQuota,
          remainingQuota: body.totalQuota,
          status: TaskStatus.draft,
          languageTag: body.languageTag ?? "en",
          submitDeadlineHours: body.submitDeadlineHours ?? 72,
          reviewDeadlineHours: body.reviewDeadlineHours ?? 72,
          allowResubmit: body.allowResubmit ?? true,
          proofSchema:
            (body.proofSchema as ProofSchema | undefined) ??
            proofSchemaForTaskType(body.type),
          endsAt: body.endsAt ? new Date(body.endsAt) : null,
        })
        .returning();

      if (body.publish) {
        const settings = await getPlatformSettings();
        const base = body.unitPriceMicros * body.totalQuota;
        const fee = bpsAmount(base, settings.platformFeeRateBps);
        await freezeForTaskPublish({
          publisherId: current.id,
          taskId: task.id,
          amountMicros: base + fee,
        });
        const updated = await db.query.tasks.findFirst({
          where: eq(tasks.id, task.id),
        });
        return { task: updated };
      }

      return { task };
    },
    {
      body: t.Object({
        title: t.String({ minLength: 1 }),
        description: t.Optional(t.String()),
        type: t.String(),
        targetUrl: t.Optional(t.String()),
        unitPriceMicros: t.Number(),
        totalQuota: t.Number(),
        languageTag: t.Optional(t.String()),
        submitDeadlineHours: t.Optional(t.Number()),
        reviewDeadlineHours: t.Optional(t.Number()),
        allowResubmit: t.Optional(t.Boolean()),
        proofSchema: t.Optional(t.Any()),
        endsAt: t.Optional(t.String()),
        publish: t.Optional(t.Boolean()),
      }),
    },
  )
  .post(
    "/:id/publish",
    async ({ request, params }) => {
      const { user } = await authFromRequest(request, config.SESSION_SECRET);
      const current = requireUser(user);
      const db = getDb();
      const task = await db.query.tasks.findFirst({
        where: eq(tasks.id, params.id),
      });
      if (!task || task.publisherId !== current.id) throw notFound("Task not found");
      if (task.status !== TaskStatus.draft) throw conflict("Task not draft");

      const settings = await getPlatformSettings();
      const base = task.unitPriceMicros * task.totalQuota;
      const fee = bpsAmount(base, settings.platformFeeRateBps);
      await freezeForTaskPublish({
        publisherId: current.id,
        taskId: task.id,
        amountMicros: base + fee,
      });
      const updated = await db.query.tasks.findFirst({
        where: eq(tasks.id, task.id),
      });
      return { task: updated };
    },
    { params: t.Object({ id: t.String() }) },
  )
  .patch(
    "/:id",
    async ({ request, params, body }) => {
      const { user } = await authFromRequest(request, config.SESSION_SECRET);
      const current = requireUser(user);
      const db = getDb();
      const task = await db.query.tasks.findFirst({
        where: eq(tasks.id, params.id),
      });
      if (!task || task.publisherId !== current.id) throw notFound("Task not found");
      if (task.status !== TaskStatus.draft && body.title) {
        // allow limited edits when draft only for core fields
      }
      if (task.status !== TaskStatus.draft) {
        if (body.status) {
          const allowedTargets = [
            TaskStatus.paused,
            TaskStatus.recruiting,
            TaskStatus.ended,
          ];
          if (!allowedTargets.includes(body.status as never)) {
            throw validation("Invalid status transition");
          }
          const canEndFrom = [
            TaskStatus.recruiting,
            TaskStatus.paused,
            TaskStatus.full,
          ];
          if (body.status === TaskStatus.ended) {
            if (!canEndFrom.includes(task.status as never)) {
              throw conflict("Task cannot be ended from current status");
            }
            await releaseTaskHoldRemaining(task.id);
          }
          if (
            body.status === TaskStatus.paused &&
            task.status !== TaskStatus.recruiting &&
            task.status !== TaskStatus.paused
          ) {
            throw conflict("Only recruiting tasks can be paused");
          }
          if (
            body.status === TaskStatus.recruiting &&
            task.status !== TaskStatus.paused &&
            task.status !== TaskStatus.recruiting
          ) {
            throw conflict("Only paused tasks can resume recruiting");
          }
          const [updated] = await db
            .update(tasks)
            .set({ status: body.status, updatedAt: new Date() })
            .where(eq(tasks.id, task.id))
            .returning();
          return { task: updated };
        }
        throw conflict("Only draft tasks can be fully edited");
      }

      const [updated] = await db
        .update(tasks)
        .set({
          title: body.title ?? task.title,
          description: body.description ?? task.description,
          targetUrl: body.targetUrl === undefined ? task.targetUrl : body.targetUrl,
          proofSchema:
            body.proofSchema === undefined
              ? task.proofSchema
              : body.proofSchema,
          updatedAt: new Date(),
        })
        .where(eq(tasks.id, task.id))
        .returning();
      return { task: updated };
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        title: t.Optional(t.String()),
        description: t.Optional(t.String()),
        targetUrl: t.Optional(t.Union([t.String(), t.Null()])),
        proofSchema: t.Optional(t.Any()),
        status: t.Optional(t.String()),
      }),
    },
  )
  .get(
    "/:id/submissions",
    async ({ request, params }) => {
      const { user } = await authFromRequest(request, config.SESSION_SECRET);
      const current = requireUser(user);
      const db = getDb();
      const task = await db.query.tasks.findFirst({
        where: eq(tasks.id, params.id),
      });
      if (!task || task.publisherId !== current.id) throw notFound("Task not found");
      const items = await db.query.joins.findMany({
        where: eq(joins.taskId, task.id),
        orderBy: [desc(joins.createdAt)],
      });
      const earnerIds = [...new Set(items.map((item) => item.earnerId))];
      const earners =
        earnerIds.length > 0
          ? await db.query.users.findMany({
              where: inArray(users.id, earnerIds),
            })
          : [];
      const nameById = new Map(
        earners.map((earner) => [earner.id, earner.displayName]),
      );
      return {
        items: items.map((item) => ({
          ...item,
          earnerName: nameById.get(item.earnerId) ?? null,
        })),
        allowResubmit: task.allowResubmit,
      };
    },
    { params: t.Object({ id: t.String() }) },
  );

}

export function joinsModule(config: AppConfig) {
  return new Elysia({ prefix: `${API_PREFIX}/joins` })
  .get("/summary", async ({ request }) => {
    const { user } = await authFromRequest(request, config.SESSION_SECRET);
    const current = requireUser(user);
    const db = getDb();
    const items = await db.query.joins.findMany({
      where: eq(joins.earnerId, current.id),
    });
    return {
      inProgress: items.filter((item) => item.status === JoinStatus.joined).length,
      pendingReview: items.filter((item) => item.status === JoinStatus.submitted).length,
      approved: items.filter((item) => item.status === JoinStatus.approved).length,
      rejected: items.filter((item) => item.status === JoinStatus.rejected).length,
    };
  })
  .get("/", async ({ request, query }) => {
    const { user } = await authFromRequest(request, config.SESSION_SECRET);
    const current = requireUser(user);
    const db = getDb();
    const items = await db.query.joins.findMany({
      where: eq(joins.earnerId, current.id),
      orderBy: [desc(joins.createdAt)],
    });
    const taskIds = [...new Set(items.map((item) => item.taskId))];
    const taskRows =
      taskIds.length > 0
        ? await db.query.tasks.findMany({
            where: inArray(tasks.id, taskIds),
          })
        : [];
    const titleById = new Map(taskRows.map((task) => [task.id, task.title]));
    const allowResubmitById = new Map(
      taskRows.map((task) => [task.id, task.allowResubmit]),
    );
    const enriched = items.map((item) => ({
      ...item,
      taskTitle: titleById.get(item.taskId) ?? null,
      allowResubmit: allowResubmitById.get(item.taskId) ?? true,
    }));
    if (query.status) {
      return {
        items: enriched.filter((row) => row.status === query.status),
      };
    }
    return { items: enriched };
  })
  .post(
    "/",
    async ({ request, body }) => {
      const { user } = await authFromRequest(request, config.SESSION_SECRET);
      const current = requireUser(user);
      const limited = checkRateLimit(`join:${current.id}`, 30, 60_000);
      if (!limited.ok) {
        throw new AppError(ErrorCode.RATE_LIMITED, "Too many join attempts", 429);
      }

      const db = getDb();
      const task = await db.query.tasks.findFirst({
        where: eq(tasks.id, body.taskId),
      });
      if (!task) throw notFound("Task not found");
      if (task.publisherId === current.id) {
        throw new AppError(
          ErrorCode.SELF_JOIN_FORBIDDEN,
          "Cannot join your own task",
          403,
        );
      }
      assertTaskJoinable(task);

      if (isXTaskType(task.type)) {
        const xIdentity = await db.query.authIdentities.findFirst({
          where: and(
            eq(authIdentities.userId, current.id),
            eq(authIdentities.provider, AuthProvider.x),
          ),
        });
        if (!xIdentity) {
          throw new AppError(
            ErrorCode.X_BIND_REQUIRED,
            "Bind an X account before joining this task",
            403,
            "errors.x_bind_required",
          );
        }
      }

      const existing = await db.query.joins.findFirst({
        where: and(eq(joins.taskId, task.id), eq(joins.earnerId, current.id)),
      });
      if (existing) {
        throw new AppError(ErrorCode.DUPLICATE_JOIN, "Already joined", 409);
      }

      const nextQuota = task.remainingQuota - 1;
      const [updatedTask] = await db
        .update(tasks)
        .set({
          remainingQuota: nextQuota,
          status: nextQuota <= 0 ? TaskStatus.full : task.status,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(tasks.id, task.id),
            eq(tasks.status, TaskStatus.recruiting),
            sql`${tasks.remainingQuota} > 0`,
          ),
        )
        .returning();

      if (!updatedTask) {
        throw new AppError(ErrorCode.QUOTA_FULL, "Task quota full", 409);
      }

      const now = new Date();
      const [join] = await db
        .insert(joins)
        .values({
          taskId: task.id,
          earnerId: current.id,
          status: JoinStatus.joined,
          submitDeadlineAt: addHours(now, task.submitDeadlineHours),
        })
        .returning();

      await notifyUser({
        userId: task.publisherId,
        type: "join_created",
        title: "New join",
        body: `${current.displayName} joined "${task.title}"`,
        payload: { joinId: join.id, taskId: task.id },
      });

      return { join };
    },
    {
      body: t.Object({
        taskId: t.String(),
      }),
    },
  )
  .post(
    "/:id/submit",
    async ({ request, params, body }) => {
      const { user } = await authFromRequest(request, config.SESSION_SECRET);
      const current = requireUser(user);
      const limited = checkRateLimit(`submit:${current.id}`, 60, 60_000);
      if (!limited.ok) {
        throw new AppError(ErrorCode.RATE_LIMITED, "Too many submissions", 429);
      }

      const db = getDb();
      const join = await db.query.joins.findFirst({
        where: eq(joins.id, params.id),
      });
      if (!join || join.earnerId !== current.id) throw notFound("Join not found");
      if (
        join.status !== JoinStatus.joined &&
        join.status !== JoinStatus.rejected
      ) {
        throw conflict("Join cannot submit in current status");
      }

      const task = await db.query.tasks.findFirst({
        where: eq(tasks.id, join.taskId),
      });
      if (!task) throw notFound("Task not found");
      if (
        task.status === TaskStatus.ended ||
        task.status === TaskStatus.taken_down ||
        (task.endsAt && task.endsAt.getTime() <= Date.now())
      ) {
        throw new AppError(ErrorCode.TASK_EXPIRED, "Task deadline has passed", 409);
      }
      if (join.status === JoinStatus.rejected && !task.allowResubmit) {
        throw new AppError(
          ErrorCode.RESUBMIT_FORBIDDEN,
          "Resubmit is not allowed for this task",
          409,
        );
      }
      if (
        join.status === JoinStatus.joined &&
        join.submitDeadlineAt &&
        join.submitDeadlineAt.getTime() < Date.now()
      ) {
        throw new AppError(
          ErrorCode.SUBMIT_DEADLINE_PASSED,
          "Submit deadline has passed",
          409,
        );
      }

      const proofPayload = normalizeProofPayload(
        body.proofPayload as Record<string, unknown>,
      );
      const schema =
        (task.proofSchema as ProofSchema) &&
        Object.keys(task.proofSchema as object).length > 0
          ? (task.proofSchema as ProofSchema)
          : proofSchemaForTaskType(task.type);
      validateProofAgainstSchema(schema, proofPayload);
      const fingerprint = proofFingerprint(proofPayload);
      if (fingerprint !== proofFingerprint({})) {
        const duplicate = await db.query.joins.findFirst({
          where: and(
            eq(joins.taskId, task.id),
            eq(joins.proofFingerprint, fingerprint),
            inArray(joins.status, [
              JoinStatus.submitted,
              JoinStatus.approved,
              JoinStatus.disputed,
            ]),
          ),
        });
        if (duplicate && duplicate.id !== join.id) {
          throw new AppError(
            ErrorCode.DUPLICATE_PROOF,
            "This proof was already submitted for this task",
            409,
            "errors.duplicate_proof",
          );
        }
      }

      const now = new Date();
      const [updated] = await db
        .update(joins)
        .set({
          status: JoinStatus.submitted,
          proofPayload,
          proofFingerprint: fingerprint,
          submittedAt: now,
          submitDeadlineAt:
            join.status === JoinStatus.rejected
              ? addHours(now, task.submitDeadlineHours)
              : join.submitDeadlineAt,
          reviewDeadlineAt: addHours(now, task.reviewDeadlineHours),
          updatedAt: now,
          rejectReason: null,
        })
        .where(eq(joins.id, join.id))
        .returning();

      await notifyUser({
        userId: task.publisherId,
        type: "join_submitted",
        title: "Submission pending review",
        body: `New submission on "${task.title}"`,
        payload: { joinId: join.id, taskId: task.id },
      });

      return { join: updated };
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        proofPayload: t.Any(),
      }),
    },
  );
}
