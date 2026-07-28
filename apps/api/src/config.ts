import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  API_PORT: z.coerce.number().default(5181),
  WEB_ORIGIN: z.string().url().default("http://localhost:5180"),
  SESSION_SECRET: z.string().min(16),
  AUTH_DEV_LOGIN: z
    .string()
    .optional()
    .transform((value) => value !== "false"),
  COOKIE_SECURE: z
    .string()
    .optional()
    .transform((value) => value === "true"),
  NODE_ENV: z.string().optional(),
  OAUTH_CALLBACK_BASE_URL: z.string().url().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  X_CLIENT_ID: z.string().optional(),
  X_CLIENT_SECRET: z.string().optional(),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
});

export type AppConfig = z.infer<typeof envSchema> & {
  isProduction: boolean;
  allowDevLogin: boolean;
  OAUTH_CALLBACK_BASE_URL: string;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse({
    DATABASE_URL: env.DATABASE_URL,
    API_PORT: env.API_PORT,
    WEB_ORIGIN: env.WEB_ORIGIN,
    SESSION_SECRET: env.SESSION_SECRET,
    AUTH_DEV_LOGIN: env.AUTH_DEV_LOGIN ?? "true",
    COOKIE_SECURE: env.COOKIE_SECURE,
    NODE_ENV: env.NODE_ENV,
    OAUTH_CALLBACK_BASE_URL: env.OAUTH_CALLBACK_BASE_URL,
    GOOGLE_CLIENT_ID: env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: env.GOOGLE_CLIENT_SECRET,
    X_CLIENT_ID: env.X_CLIENT_ID,
    X_CLIENT_SECRET: env.X_CLIENT_SECRET,
    TELEGRAM_BOT_TOKEN: env.TELEGRAM_BOT_TOKEN,
  });

  if (!parsed.success) {
    throw new Error(`Invalid env: ${parsed.error.message}`);
  }

  const data = parsed.data;
  const isProduction = data.NODE_ENV === "production";
  const apiPort = data.API_PORT;
  const oauthCallbackBase =
    data.OAUTH_CALLBACK_BASE_URL ??
    `http://localhost:${apiPort}`;

  return {
    ...data,
    isProduction,
    allowDevLogin: !isProduction && data.AUTH_DEV_LOGIN !== false,
    OAUTH_CALLBACK_BASE_URL: oauthCallbackBase,
  };
}
