import { Elysia } from "elysia";
import { APP_NAME, API_PREFIX, ErrorCode } from "@xs-share/shared";
import { loadConfig, type AppConfig } from "./config";
import { AppError } from "./lib/errors";
import { authModule } from "./modules/auth";
import { meModule } from "./modules/me";
import { joinsModule, publicModule, tasksModule } from "./modules/tasks";
import {
  adminModule,
  disputesModule,
  notificationsModule,
  referralModule,
  reviewsModule,
  walletModule,
} from "./modules/wallet";

export function createApp(config: AppConfig = loadConfig()) {
  const app = new Elysia()
    .onError(({ error, set }) => {
      if (error instanceof AppError) {
        set.status = error.status;
        return error.toBody();
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
    .get(`${API_PREFIX}/public/meta`, () => ({
      name: APP_NAME,
      version: "0.0.1",
    }))
    .use(authModule(config))
    .use(meModule(config))
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
