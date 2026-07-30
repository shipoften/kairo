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
  CHAIN_ADAPTER: z.enum(["mock", "tron"]).optional().default("mock"),
  S3_ENDPOINT: z.string().url().optional(),
  S3_PRESIGN_ENDPOINT: z.string().url().optional(),
  S3_REGION: z.string().optional().default("us-east-1"),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_PUBLIC_BASE_URL: z.string().url().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional().default(1025),
  SMTP_SECURE: z
    .string()
    .optional()
    .transform((value) => value === "true"),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),
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
    CHAIN_ADAPTER: env.CHAIN_ADAPTER,
    S3_ENDPOINT: env.S3_ENDPOINT,
    S3_PRESIGN_ENDPOINT: env.S3_PRESIGN_ENDPOINT,
    S3_REGION: env.S3_REGION,
    S3_BUCKET: env.S3_BUCKET,
    S3_ACCESS_KEY_ID: env.S3_ACCESS_KEY_ID,
    S3_SECRET_ACCESS_KEY: env.S3_SECRET_ACCESS_KEY,
    S3_PUBLIC_BASE_URL: env.S3_PUBLIC_BASE_URL,
    SMTP_HOST: env.SMTP_HOST,
    SMTP_PORT: env.SMTP_PORT,
    SMTP_SECURE: env.SMTP_SECURE,
    SMTP_USER: env.SMTP_USER,
    SMTP_PASS: env.SMTP_PASS,
    SMTP_FROM: env.SMTP_FROM,
  });

  if (!parsed.success) {
    throw new Error(`Invalid env: ${parsed.error.message}`);
  }

  const data = parsed.data;
  const isProduction = data.NODE_ENV === "production";
  const apiPort = data.API_PORT;
  const oauthCallbackBase =
    data.OAUTH_CALLBACK_BASE_URL ?? `http://localhost:${apiPort}`;

  return {
    ...data,
    isProduction,
    allowDevLogin: !isProduction && data.AUTH_DEV_LOGIN !== false,
    OAUTH_CALLBACK_BASE_URL: oauthCallbackBase,
  };
}
