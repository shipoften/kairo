import { eq } from "drizzle-orm";
import { Elysia, t } from "elysia";
import { authIdentities, users } from "@xs-share/db";
import { API_PREFIX } from "@xs-share/shared";
import type { AppConfig } from "../config";
import { requireUser } from "../lib/auth";
import { getDb } from "../lib/db";
import { authFromRequest } from "../lib/request-auth";

export function meModule(config: AppConfig) {
  return new Elysia({ prefix: `${API_PREFIX}/me` })
    .get("/", async ({ request }) => {
      const { user } = await authFromRequest(request, config.SESSION_SECRET);
      const current = requireUser(user);
      const db = getDb();
      const identities = await db.query.authIdentities.findMany({
        where: eq(authIdentities.userId, current.id),
      });
      return {
        id: current.id,
        displayName: current.displayName,
        avatarUrl: current.avatarUrl,
        preferredLocale: current.preferredLocale,
        preferredMode: current.preferredMode,
        role: current.role,
        inviteCode: current.inviteCode,
        invitedByUserId: current.invitedByUserId,
        referralEnabled: current.referralEnabled,
        identities: identities.map((row) => ({
          provider: row.provider,
          providerUserId: row.providerUserId,
        })),
      };
    })
    .patch(
      "/",
      async ({ request, body }) => {
        const { user } = await authFromRequest(request, config.SESSION_SECRET);
        const current = requireUser(user);
        const db = getDb();
        const [updated] = await db
          .update(users)
          .set({
            displayName: body.displayName ?? current.displayName,
            preferredLocale: body.preferredLocale ?? current.preferredLocale,
            preferredMode: body.preferredMode ?? current.preferredMode,
            avatarUrl:
              body.avatarUrl === undefined ? current.avatarUrl : body.avatarUrl,
            updatedAt: new Date(),
          })
          .where(eq(users.id, current.id))
          .returning();
        return {
          id: updated.id,
          displayName: updated.displayName,
          preferredLocale: updated.preferredLocale,
          preferredMode: updated.preferredMode,
          avatarUrl: updated.avatarUrl,
        };
      },
      {
        body: t.Object({
          displayName: t.Optional(t.String({ minLength: 1 })),
          preferredLocale: t.Optional(
            t.Union([t.Literal("en"), t.Literal("zh")]),
          ),
          preferredMode: t.Optional(
            t.Union([t.Literal("publish"), t.Literal("earn")]),
          ),
          avatarUrl: t.Optional(t.Union([t.String(), t.Null()])),
        }),
      },
    );
}
