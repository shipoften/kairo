import { eq, and, gt } from "drizzle-orm";
import {
  users,
  sessions,
  authIdentities,
  walletAccounts,
} from "@xs-share/db";
import {
  SESSION_COOKIE_NAME,
  UserRole,
  type AuthProvider,
} from "@xs-share/shared";
import { Elysia } from "elysia";
import { getDb } from "./db";
import {
  addDays,
  createInviteCode,
  createSessionToken,
  hashToken,
} from "./crypto";
import { forbidden, unauthorized } from "./errors";
import type { AppConfig } from "../config";

export type AuthUser = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  preferredLocale: string;
  preferredMode: string;
  role: string;
  inviteCode: string;
  invitedByUserId: string | null;
  referralEnabled: boolean;
  bannedAt: Date | null;
};

const SESSION_DAYS = 30;

export async function ensureWallet(userId: string) {
  const db = getDb();
  const existing = await db.query.walletAccounts.findFirst({
    where: eq(walletAccounts.userId, userId),
  });
  if (existing) return existing;

  const [created] = await db
    .insert(walletAccounts)
    .values({ userId })
    .returning();
  return created;
}

export async function findInviterByCode(inviteCode: string | undefined) {
  if (!inviteCode) return null;
  const db = getDb();
  return db.query.users.findFirst({
    where: eq(users.inviteCode, inviteCode),
  });
}

export async function upsertOAuthUser(input: {
  provider: AuthProvider;
  providerUserId: string;
  displayName: string;
  avatarUrl?: string | null;
  inviteCode?: string;
  locale?: string;
  email?: string | null;
  telegramChatId?: string | null;
}): Promise<{ user: AuthUser; isNew: boolean }> {
  const db = getDb();

  const identity = await db.query.authIdentities.findFirst({
    where: and(
      eq(authIdentities.provider, input.provider),
      eq(authIdentities.providerUserId, input.providerUserId),
    ),
  });

  if (identity) {
    const user = await db.query.users.findFirst({
      where: eq(users.id, identity.userId),
    });
    if (!user) throw unauthorized("User missing for identity");
    if (user.bannedAt) throw forbidden("Account banned");
    await ensureWallet(user.id);
    const patch: Partial<typeof users.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (input.email && !user.notifyEmail) {
      patch.notifyEmail = input.email;
    }
    if (input.telegramChatId) {
      patch.telegramChatId = input.telegramChatId;
    }
    if (Object.keys(patch).length > 1) {
      const [updated] = await db
        .update(users)
        .set(patch)
        .where(eq(users.id, user.id))
        .returning();
      return { user: updated, isNew: false };
    }
    return { user, isNew: false };
  }

  const inviter = await findInviterByCode(input.inviteCode);

  let inviteCode = createInviteCode();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const clash = await db.query.users.findFirst({
      where: eq(users.inviteCode, inviteCode),
    });
    if (!clash) break;
    inviteCode = createInviteCode();
  }

  const [user] = await db
    .insert(users)
    .values({
      displayName: input.displayName,
      avatarUrl: input.avatarUrl ?? null,
      preferredLocale: input.locale ?? "en",
      inviteCode,
      invitedByUserId:
        inviter && !inviter.bannedAt ? inviter.id : null,
      notifyEmail: input.email ?? null,
      telegramChatId: input.telegramChatId ?? null,
    })
    .returning();

  await db.insert(authIdentities).values({
    userId: user.id,
    provider: input.provider,
    providerUserId: input.providerUserId,
    profileJson: { displayName: input.displayName, email: input.email ?? null },
  });

  await ensureWallet(user.id);
  return { user, isNew: true };
}

export async function createSession(userId: string, secret: string) {
  const db = getDb();
  const token = createSessionToken();
  const tokenHash = hashToken(token, secret);
  const expiresAt = addDays(new Date(), SESSION_DAYS);

  await db.insert(sessions).values({
    userId,
    tokenHash,
    expiresAt,
  });

  return { token, expiresAt };
}

export async function destroySession(token: string, secret: string) {
  const db = getDb();
  const tokenHash = hashToken(token, secret);
  await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
}

export async function resolveSessionUser(
  token: string | undefined,
  secret: string,
): Promise<AuthUser | null> {
  if (!token) return null;
  const db = getDb();
  const tokenHash = hashToken(token, secret);
  const session = await db.query.sessions.findFirst({
    where: and(
      eq(sessions.tokenHash, tokenHash),
      gt(sessions.expiresAt, new Date()),
    ),
  });
  if (!session) return null;

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.userId),
  });
  if (!user || user.bannedAt) return null;
  return user;
}

export function readSessionCookie(cookieHeader: string | null) {
  if (!cookieHeader) return undefined;
  const parts = cookieHeader.split(";").map((part) => part.trim());
  for (const part of parts) {
    const [name, ...rest] = part.split("=");
    if (name === SESSION_COOKIE_NAME) {
      return decodeURIComponent(rest.join("="));
    }
  }
  return undefined;
}

export function sessionCookieValue(
  token: string,
  expiresAt: Date,
  config: AppConfig,
) {
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Expires=${expiresAt.toUTCString()}`,
  ];
  if (config.COOKIE_SECURE || config.isProduction) {
    parts.push("Secure");
  }
  return parts.join("; ");
}

export function clearSessionCookie(config: AppConfig) {
  const parts = [
    `${SESSION_COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
  ];
  if (config.COOKIE_SECURE || config.isProduction) {
    parts.push("Secure");
  }
  return parts.join("; ");
}

export function requireUser(user: AuthUser | null): AuthUser {
  if (!user) throw unauthorized();
  if (user.bannedAt) throw forbidden("Account banned");
  return user;
}

export function requireAdmin(user: AuthUser | null): AuthUser {
  const current = requireUser(user);
  if (current.role !== UserRole.admin) throw forbidden("Admin only");
  return current;
}

export function authPlugin(config: AppConfig) {
  return new Elysia({ name: "auth-context" }).derive(
    { as: "global" },
    async ({ request }) => {
      const token = readSessionCookie(request.headers.get("cookie"));
      const user = await resolveSessionUser(token, config.SESSION_SECRET);
      return { user, sessionToken: token };
    },
  );
}

