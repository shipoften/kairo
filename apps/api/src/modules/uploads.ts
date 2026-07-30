import { eq } from "drizzle-orm";
import { Elysia, t } from "elysia";
import { uploads } from "@xs-share/db";
import { API_PREFIX, ErrorCode } from "@xs-share/shared";
import type { AppConfig } from "../config";
import { requireUser } from "../lib/auth";
import { getDb } from "../lib/db";
import { AppError } from "../lib/errors";
import { checkRateLimit } from "../lib/rate-limit";
import { authFromRequest } from "../lib/request-auth";
import { assertObjectExists, createPresignedUpload } from "../services/upload/s3";

export function uploadsModule(config: AppConfig) {
  return new Elysia({ prefix: `${API_PREFIX}/uploads` })
    .post(
      "/presign",
      async ({ request, body }) => {
        const { user } = await authFromRequest(request, config.SESSION_SECRET);
        const current = requireUser(user);
        const limited = checkRateLimit(`upload:${current.id}`, 20, 10 * 60_000);
        if (!limited.ok) {
          throw new AppError(
            ErrorCode.RATE_LIMITED,
            "Too many upload attempts",
            429,
          );
        }

        return createPresignedUpload({
          config,
          userId: current.id,
          contentType: body.contentType,
          sizeBytes: body.sizeBytes,
        });
      },
      {
        body: t.Object({
          contentType: t.String(),
          sizeBytes: t.Number(),
        }),
      },
    )
    .post(
      "/confirm",
      async ({ request, body }) => {
        const { user } = await authFromRequest(request, config.SESSION_SECRET);
        const current = requireUser(user);
        const limited = checkRateLimit(
          `upload-confirm:${current.id}`,
          20,
          10 * 60_000,
        );
        if (!limited.ok) {
          throw new AppError(
            ErrorCode.RATE_LIMITED,
            "Too many upload confirms",
            429,
          );
        }

        const meta = await assertObjectExists({
          config,
          objectKey: body.objectKey,
          expectedUserId: current.id,
        });

        const db = getDb();
        const existing = await db.query.uploads.findFirst({
          where: eq(uploads.objectKey, body.objectKey),
        });
        if (existing) {
          if (existing.userId !== current.id) {
            throw new AppError(
              ErrorCode.UPLOAD_INVALID,
              "Upload confirm failed",
              400,
              "errors.upload_invalid",
            );
          }
          return {
            id: existing.id,
            objectKey: existing.objectKey,
            publicUrl: existing.publicUrl,
            contentType: existing.contentType,
            sizeBytes: existing.sizeBytes,
          };
        }

        const [row] = await db
          .insert(uploads)
          .values({
            userId: current.id,
            objectKey: body.objectKey,
            contentType: meta.contentType,
            sizeBytes: meta.sizeBytes,
            publicUrl: meta.publicUrl,
          })
          .returning();

        return {
          id: row.id,
          objectKey: row.objectKey,
          publicUrl: row.publicUrl,
          contentType: row.contentType,
          sizeBytes: row.sizeBytes,
        };
      },
      {
        body: t.Object({
          objectKey: t.String({ minLength: 1 }),
        }),
      },
    );
}
