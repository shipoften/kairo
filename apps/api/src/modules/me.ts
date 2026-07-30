import { eq } from "drizzle-orm";
import { Elysia, t } from "elysia";
import { authIdentities, users } from "@xs-share/db";
import { API_PREFIX } from "@xs-share/shared";
import type { AppConfig } from "../config";
import { requireUser } from "../lib/auth";
import { getDb } from "../lib/db";
import { validation } from "../lib/errors";
import { authFromRequest } from "../lib/request-auth";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function meModule(config: AppConfig) {
  return new Elysia({ prefix: `${API_PREFIX}/me` })
    .get("/", async ({ request }) => {
      const { user } = await authFromRequest(request, config.SESSION_SECRET);
      const current = requireUser(user);
      const db = getDb();
      const full = await db.query.users.findFirst({
        where: eq(users.id, current.id),
      });
      if (!full) {
        throw validation("User not found");
      }
      const identities = await db.query.authIdentities.findMany({
        where: eq(authIdentities.userId, current.id),
      });
      return {
        id: full.id,
        displayName: full.displayName,
        avatarUrl: full.avatarUrl,
        preferredLocale: full.preferredLocale,
        preferredMode: full.preferredMode,
        role: full.role,
        inviteCode: full.inviteCode,
        invitedByUserId: full.invitedByUserId,
        referralEnabled: full.referralEnabled,
        notifyEmail: full.notifyEmail,
        telegramChatId: full.telegramChatId,
        notifyTelegram: full.notifyTelegram,
        notifyEmailEnabled: full.notifyEmailEnabled,
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
        const full = await db.query.users.findFirst({
          where: eq(users.id, current.id),
        });
        if (!full) {
          throw validation("User not found");
        }

        let notifyEmail = full.notifyEmail;
        if (body.notifyEmail !== undefined) {
          if (body.notifyEmail === null || body.notifyEmail === "") {
            notifyEmail = null;
          } else if (!emailPattern.test(body.notifyEmail)) {
            throw validation("Invalid notification email");
          } else {
            notifyEmail = body.notifyEmail.trim();
          }
        }

        const [updated] = await db
          .update(users)
          .set({
            displayName: body.displayName ?? full.displayName,
            preferredLocale: body.preferredLocale ?? full.preferredLocale,
            preferredMode: body.preferredMode ?? full.preferredMode,
            avatarUrl:
              body.avatarUrl === undefined ? full.avatarUrl : body.avatarUrl,
            notifyEmail,
            notifyTelegram:
              body.notifyTelegram === undefined
                ? full.notifyTelegram
                : body.notifyTelegram,
            notifyEmailEnabled:
              body.notifyEmailEnabled === undefined
                ? full.notifyEmailEnabled
                : body.notifyEmailEnabled,
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
          notifyEmail: updated.notifyEmail,
          telegramChatId: updated.telegramChatId,
          notifyTelegram: updated.notifyTelegram,
          notifyEmailEnabled: updated.notifyEmailEnabled,
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
          notifyEmail: t.Optional(t.Union([t.String(), t.Null()])),
          notifyTelegram: t.Optional(t.Boolean()),
          notifyEmailEnabled: t.Optional(t.Boolean()),
        }),
      },
    );
}
