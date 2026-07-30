import { and, eq } from "drizzle-orm";
import { Elysia, t } from "elysia";
import { authIdentities, users } from "@xs-share/db";
import { API_PREFIX, AuthProvider } from "@xs-share/shared";
import type { AppConfig } from "../config";
import {
  clearSessionCookie,
  createSession,
  destroySession,
  findInviterByCode,
  requireUser,
  sessionCookieValue,
  upsertOAuthUser,
} from "../lib/auth";
import { authFromRequest } from "../lib/request-auth";
import { getDb } from "../lib/db";
import { validation } from "../lib/errors";
import { notifyUser } from "../services/notify";
import {
  buildGoogleAuthUrl,
  buildXAuthUrl,
  exchangeGoogleCode,
  exchangeXCode,
  providerConfigured,
  verifyTelegramAuth,
  webErrorRedirect,
  webRedirectUrl,
  type OAuthProfile,
} from "../lib/oauth";
import {
  createCodeChallenge,
  createCodeVerifier,
  decodeOAuthState,
  encodeOAuthState,
  sanitizeReturnTo,
} from "../lib/oauth-state";
import { AppError } from "../lib/errors";

const oauthProviders = ["google", "x"] as const;

function oauthErrorKey(error: unknown): string {
  if (error instanceof AppError) {
    if (error.message.includes("Identity already bound")) {
      return "identity_bound";
    }
    if (error.message.includes("banned")) {
      return "account_banned";
    }
  }
  return "oauth_failed";
}

async function bindProviderIdentity(input: {
  userId: string;
  provider: string;
  providerUserId: string;
}) {
  const db = getDb();
  const clash = await db.query.authIdentities.findFirst({
    where: and(
      eq(authIdentities.provider, input.provider),
      eq(authIdentities.providerUserId, input.providerUserId),
    ),
  });
  if (clash && clash.userId !== input.userId) {
    throw validation("Identity already bound to another account");
  }
  if (clash) return;
  await db.insert(authIdentities).values({
    userId: input.userId,
    provider: input.provider,
    providerUserId: input.providerUserId,
  });
}

async function loginWithProfile(input: {
  config: AppConfig;
  provider: string;
  profile: OAuthProfile;
  locale: string;
  inviteCode?: string;
  bindUserId?: string;
}) {
  const { config, provider, profile, locale, inviteCode, bindUserId } = input;

  if (bindUserId) {
    await bindProviderIdentity({
      userId: bindUserId,
      provider,
      providerUserId: profile.providerUserId,
    });
    const db = getDb();
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (provider === AuthProvider.telegram) {
      patch.telegramChatId = profile.providerUserId;
    }
    if (profile.email) {
      const existing = await db.query.users.findFirst({
        where: eq(users.id, bindUserId),
      });
      if (existing && !existing.notifyEmail) {
        patch.notifyEmail = profile.email;
      }
    }
    if (Object.keys(patch).length > 1) {
      await db.update(users).set(patch).where(eq(users.id, bindUserId));
    }
    return { userId: bindUserId, isNew: false };
  }

  const { user, isNew } = await upsertOAuthUser({
    provider: provider as (typeof AuthProvider)[keyof typeof AuthProvider],
    providerUserId: profile.providerUserId,
    displayName: profile.displayName,
    avatarUrl: profile.avatarUrl,
    inviteCode,
    locale,
    email: profile.email,
    telegramChatId:
      provider === AuthProvider.telegram ? profile.providerUserId : null,
  });

  if (isNew && user.invitedByUserId) {
    await notifyUser({
      userId: user.invitedByUserId,
      type: "referral_signup",
      title: "New referral signup",
      body: `${user.displayName} joined via your invite.`,
      payload: { inviteeId: user.id },
    });
  }

  return { userId: user.id, isNew };
}


export function authModule(config: AppConfig) {
  return new Elysia({ prefix: `${API_PREFIX}/auth` })
    .get(
      "/:provider/start",
      async ({ params, query, request, set }) => {
        const provider = params.provider;
        if (!oauthProviders.includes(provider as (typeof oauthProviders)[number])) {
          set.status = 404;
          return { code: "NOT_FOUND", message: "Unknown provider" };
        }
        if (!providerConfigured(config, provider)) {
          set.status = 503;
          return {
            code: "VALIDATION",
            message: `${provider} OAuth is not configured`,
            messageKey: "errors.oauthNotConfigured",
          };
        }

        const locale = query.locale ?? "en";
        const inviteCode = query.invite;
        const returnTo = sanitizeReturnTo(query.returnTo);
        const { user } = await authFromRequest(request, config.SESSION_SECRET);
        const codeVerifier = provider === "x" ? createCodeVerifier() : undefined;

        const state = encodeOAuthState(
          {
            provider,
            nonce: crypto.randomUUID(),
            locale,
            inviteCode,
            bindUserId: user?.id,
            codeVerifier,
            returnTo,
          },
          config.SESSION_SECRET,
        );

        const url =
          provider === "google"
            ? buildGoogleAuthUrl(config, state)
            : buildXAuthUrl(config, state, createCodeChallenge(codeVerifier!));

        set.status = 302;
        set.headers.Location = url;
        return null;
      },
      {
        params: t.Object({ provider: t.String() }),
        query: t.Object({
          locale: t.Optional(t.String()),
          invite: t.Optional(t.String()),
          returnTo: t.Optional(t.String()),
        }),
      },
    )
    .get(
      "/:provider/callback",
      async ({ params, query, set }) => {
        const provider = params.provider;
        if (!oauthProviders.includes(provider as (typeof oauthProviders)[number])) {
          set.status = 404;
          return { code: "NOT_FOUND", message: "Unknown provider" };
        }

        const error = query.error;
        const stateRaw = query.state;
        const code = query.code;
        if (error || !stateRaw || !code) {
          set.status = 302;
          set.headers.Location = webErrorRedirect(
            config,
            "en",
            error ?? "oauth_failed",
          );
          return null;
        }

        const state = decodeOAuthState(stateRaw, config.SESSION_SECRET);
        if (!state || state.provider !== provider) {
          set.status = 302;
          set.headers.Location = webErrorRedirect(config, "en", "invalid_state");
          return null;
        }

        try {
          const profile =
            provider === "google"
              ? await exchangeGoogleCode(config, code)
              : await exchangeXCode(config, code, state.codeVerifier ?? "");

          const result = await loginWithProfile({
            config,
            provider,
            profile,
            locale: state.locale,
            inviteCode: state.inviteCode,
            bindUserId: state.bindUserId,
          });

          const { token, expiresAt } = await createSession(
            result.userId,
            config.SESSION_SECRET,
          );
          const cookie = sessionCookieValue(token, expiresAt, config);
          const destination =
            sanitizeReturnTo(state.returnTo) ??
            (state.bindUserId ? "/settings" : "/tasks");
          set.status = 302;
          set.headers.Location = webRedirectUrl(config, state.locale, destination);
          set.headers["Set-Cookie"] = cookie;
          return null;
        } catch (error) {
          set.status = 302;
          set.headers.Location = webErrorRedirect(
            config,
            state.locale,
            oauthErrorKey(error),
          );
          return null;
        }
      },
      {
        params: t.Object({ provider: t.String() }),
        query: t.Object({
          code: t.Optional(t.String()),
          state: t.Optional(t.String()),
          error: t.Optional(t.String()),
        }),
      },
    )
    .post(
      "/telegram/complete",
      async ({ body, set, request }) => {
        if (!providerConfigured(config, "telegram")) {
          set.status = 503;
          return {
            code: "VALIDATION",
            message: "Telegram OAuth is not configured",
            messageKey: "errors.oauthNotConfigured",
          };
        }

        const profile = verifyTelegramAuth(config, body as Record<string, string>);
        if (!profile) {
          set.status = 400;
          return {
            code: "VALIDATION",
            message: "Invalid Telegram auth",
            messageKey: "errors.oauthFailed",
          };
        }

        const { user } = await authFromRequest(request, config.SESSION_SECRET);
        const result = await loginWithProfile({
          config,
          provider: AuthProvider.telegram,
          profile,
          locale: body.locale ?? "en",
          inviteCode: body.inviteCode,
          bindUserId: user?.id ?? body.bindUserId,
        });

        const { token, expiresAt } = await createSession(
          result.userId,
          config.SESSION_SECRET,
        );
        set.headers["Set-Cookie"] = sessionCookieValue(token, expiresAt, config);
        return {
          ok: true,
          redirectTo:
            sanitizeReturnTo(body.returnTo) ?? (user ? "/settings" : "/tasks"),
        };
      },
      {
        body: t.Object({
          id: t.String(),
          first_name: t.Optional(t.String()),
          last_name: t.Optional(t.String()),
          username: t.Optional(t.String()),
          photo_url: t.Optional(t.String()),
          auth_date: t.String(),
          hash: t.String(),
          locale: t.Optional(t.String()),
          inviteCode: t.Optional(t.String()),
          bindUserId: t.Optional(t.String()),
          returnTo: t.Optional(t.String()),
        }),
      },
    )
    .get("/providers", () => ({
      google: providerConfigured(config, "google"),
      x: providerConfigured(config, "x"),
      telegram: providerConfigured(config, "telegram"),
      devLogin: config.allowDevLogin,
    }))
    .get("/invite/:code/check", async ({ params }) => {
      const inviter = await findInviterByCode(params.code);
      return { valid: Boolean(inviter && !inviter.bannedAt) };
    })
    .post(
      "/dev-login",
      async ({ body, set, request }) => {
        if (!config.allowDevLogin) {
          set.status = 403;
          return {
            code: "FORBIDDEN",
            message: "Dev login disabled",
            messageKey: "errors.forbidden",
          };
        }

        const inviteFromQuery = new URL(request.url).searchParams.get("invite");
        const { user, isNew } = await upsertOAuthUser({
          provider: AuthProvider.dev,
          providerUserId: body.externalId,
          displayName: body.displayName,
          avatarUrl: body.avatarUrl,
          inviteCode: body.inviteCode ?? inviteFromQuery ?? undefined,
          locale: body.locale,
        });

        const { token, expiresAt } = await createSession(
          user.id,
          config.SESSION_SECRET,
        );
        set.headers["Set-Cookie"] = sessionCookieValue(token, expiresAt, config);

        if (isNew && user.invitedByUserId) {
          await notifyUser({
            userId: user.invitedByUserId,
            type: "referral_signup",
            title: "New referral signup",
            body: `${user.displayName} joined via your invite.`,
            payload: { inviteeId: user.id },
          });
        }

        return {
          user: {
            id: user.id,
            displayName: user.displayName,
            preferredLocale: user.preferredLocale,
            preferredMode: user.preferredMode,
            role: user.role,
            inviteCode: user.inviteCode,
          },
        };
      },
      {
        body: t.Object({
          externalId: t.String({ minLength: 1 }),
          displayName: t.String({ minLength: 1 }),
          avatarUrl: t.Optional(t.String()),
          inviteCode: t.Optional(t.String()),
          locale: t.Optional(t.String()),
        }),
      },
    )
    .post("/logout", async ({ request, set }) => {
      const { sessionToken } = await authFromRequest(
        request,
        config.SESSION_SECRET,
      );
      if (sessionToken) {
        await destroySession(sessionToken, config.SESSION_SECRET);
      }
      set.headers["Set-Cookie"] = clearSessionCookie(config);
      return { ok: true };
    })
    .post(
      "/bind",
      async ({ request, body }) => {
        const { user } = await authFromRequest(request, config.SESSION_SECRET);
        const current = requireUser(user);
        await bindProviderIdentity({
          userId: current.id,
          provider: body.provider,
          providerUserId: body.providerUserId,
        });
        if (body.provider === AuthProvider.telegram) {
          const db = getDb();
          await db
            .update(users)
            .set({
              telegramChatId: body.providerUserId,
              updatedAt: new Date(),
            })
            .where(eq(users.id, current.id));
        }
        return { ok: true };
      },
      {
        body: t.Object({
          provider: t.Union([
            t.Literal("x"),
            t.Literal("google"),
            t.Literal("telegram"),
            t.Literal("dev"),
          ]),
          providerUserId: t.String({ minLength: 1 }),
        }),
      },
    )
    .delete(
      "/bind/:provider",
      async ({ request, params }) => {
        const { user } = await authFromRequest(request, config.SESSION_SECRET);
        const current = requireUser(user);
        const db = getDb();
        const identities = await db.query.authIdentities.findMany({
          where: eq(authIdentities.userId, current.id),
        });
        if (identities.length <= 1) {
          throw validation("Keep at least one login method");
        }
        const target = identities.find((row) => row.provider === params.provider);
        if (!target) throw validation("Provider not bound");

        await db
          .delete(authIdentities)
          .where(
            and(
              eq(authIdentities.userId, current.id),
              eq(authIdentities.provider, params.provider),
            ),
          );
        return { ok: true };
      },
      {
        params: t.Object({
          provider: t.String(),
        }),
      },
    );
}
