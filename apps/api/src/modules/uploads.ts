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
import {
  createUploadAccessUrl,
  verifyUploadAccessToken,
} from "../lib/upload-access";
import {
  assertObjectExists,
  createPresignedUpload,
  readObjectBytes,
} from "../services/upload/s3";

function uploadResponse(
  config: AppConfig,
  row: {
    id: string;
    objectKey: string;
    publicUrl: string;
    contentType: string;
    sizeBytes: number;
  },
) {
  return {
    id: row.id,
    objectKey: row.objectKey,
    publicUrl: createUploadAccessUrl(config, row.id),
    contentType: row.contentType,
    sizeBytes: row.sizeBytes,
  };
}

export function uploadsModule(config: AppConfig) {
  return new Elysia({ prefix: `${API_PREFIX}/uploads` })
    .get(
      "/:id/file",
      async ({ params, query, set }) => {
        const expiresAt = Number(query.expires);
        const token = query.token ?? "";
        if (
          !verifyUploadAccessToken({
            uploadId: params.id,
            expiresAt,
            token,
            secret: config.SESSION_SECRET,
          })
        ) {
          throw new AppError(
            ErrorCode.FORBIDDEN,
            "Invalid upload access token",
            403,
            "errors.forbidden",
          );
        }

        const db = getDb();
        const row = await db.query.uploads.findFirst({
          where: eq(uploads.id, params.id),
        });
        if (!row) {
          throw new AppError(
            ErrorCode.NOT_FOUND,
            "Upload not found",
            404,
            "errors.not_found",
          );
        }

        const file = await readObjectBytes({
          config,
          objectKey: row.objectKey,
        });
        set.headers["Content-Type"] = file.contentType;
        set.headers["Cache-Control"] = "private, max-age=3600";
        return file.body;
      },
      {
        params: t.Object({
          id: t.String({ format: "uuid" }),
        }),
        query: t.Object({
          expires: t.String(),
          token: t.String(),
        }),
      },
    )
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
          return uploadResponse(config, existing);
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

        return uploadResponse(config, row);
      },
      {
        body: t.Object({
          objectKey: t.String({ minLength: 1 }),
        }),
      },
    );
}
