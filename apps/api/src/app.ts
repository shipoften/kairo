import { Elysia } from "elysia";
import { APP_NAME, API_PREFIX, ErrorCode } from "@xs-share/shared";
import { loadConfig, type AppConfig } from "./config";
import { AppError } from "./lib/errors";
import { authModule } from "./modules/auth";
import { meModule } from "./modules/me";
import { joinsModule, publicModule, tasksModule } from "./modules/tasks";
import { uploadsModule } from "./modules/uploads";
import {
  adminModule,
  disputesModule,
  notificationsModule,
  referralModule,
  reviewsModule,
  walletModule,
} from "./modules/wallet";

function readAppError(error: unknown): {
  status: number;
  body: { code: string; message: string; messageKey: string };
} | null {
  if (error instanceof AppError) {
    return { status: error.status, body: error.toBody() };
  }
  if (
    typeof error === "object" &&
    error !== null &&
    (error as { name?: string }).name === "AppError" &&
    typeof (error as { status?: unknown }).status === "number" &&
    typeof (error as { code?: unknown }).code === "string" &&
    typeof (error as { message?: unknown }).message === "string" &&
    typeof (error as { messageKey?: unknown }).messageKey === "string"
  ) {
    const appError = error as AppError;
    return { status: appError.status, body: appError.toBody() };
  }
  return null;
}

export function createApp(config: AppConfig = loadConfig()) {
  const app = new Elysia()
    .onError(({ error, set, code }) => {
      const appError = readAppError(error);
      if (appError) {
        set.status = appError.status;
        return appError.body;
      }

      if (code === "NOT_FOUND") {
        set.status = 404;
        return {
          code: ErrorCode.NOT_FOUND,
          message: "Not found",
          messageKey: "errors.not_found",
        };
      }

      console.error(error);
      set.status = 500;
      return {
        code: ErrorCode.INTERNAL,
        message: "Internal server error",
        messageKey: "errors.internal",
      };
    })
    .onBeforeHandle(({ request, set }) => {
      const origin = request.headers.get("origin");
      if (origin === config.WEB_ORIGIN) {
        set.headers["Access-Control-Allow-Origin"] = origin;
        set.headers["Access-Control-Allow-Credentials"] = "true";
        set.headers["Access-Control-Allow-Headers"] =
          "Content-Type, Authorization";
        set.headers["Access-Control-Allow-Methods"] =
          "GET,POST,PUT,PATCH,DELETE,OPTIONS";
      }
    })
    .options("/*", ({ set }) => {
      set.status = 204;
      return null;
    })
    .get("/health", () => ({
      ok: true,
      service: "api",
      app: APP_NAME,
    }))
    .get(`${API_PREFIX}/public/meta`, async () => {
      const { getPlatformSettings } = await import("./services/config");
      const settings = await getPlatformSettings();
      return {
        name: APP_NAME,
        version: "0.0.1",
        platformFeeRateBps: settings.platformFeeRateBps,
      };
    })
    .use(authModule(config))
    .use(meModule(config))
    .use(uploadsModule(config))
    .use(publicModule(config))
    .use(tasksModule(config))
    .use(joinsModule(config))
    .use(walletModule(config))
    .use(reviewsModule(config))
    .use(notificationsModule(config))
    .use(referralModule(config))
    .use(disputesModule(config))
    .use(adminModule(config));

  return app;
}

export type App = ReturnType<typeof createApp>;
