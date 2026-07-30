import type { AppConfig } from "../config";

export function assertProductionGuards(config: AppConfig) {
  if (!config.isProduction) return;

  const problems: string[] = [];

  if (config.CHAIN_ADAPTER === "mock") {
    problems.push("CHAIN_ADAPTER=mock is not allowed in production");
  }
  if (config.allowDevLogin || config.AUTH_DEV_LOGIN) {
    problems.push("AUTH_DEV_LOGIN must be disabled in production");
  }
  if (
    !config.S3_ENDPOINT ||
    !config.S3_BUCKET ||
    !config.S3_ACCESS_KEY_ID ||
    !config.S3_SECRET_ACCESS_KEY ||
    !config.S3_PUBLIC_BASE_URL
  ) {
    problems.push("S3 upload configuration is required in production");
  }
  if (!config.TELEGRAM_BOT_TOKEN) {
    problems.push("TELEGRAM_BOT_TOKEN is required in production");
  }
  if (
    !config.SMTP_HOST ||
    !config.SMTP_FROM ||
    config.SMTP_PORT === undefined
  ) {
    problems.push("SMTP configuration is required in production");
  }

  if (problems.length > 0) {
    throw new Error(
      `Production configuration invalid:\n- ${problems.join("\n- ")}`,
    );
  }
}
