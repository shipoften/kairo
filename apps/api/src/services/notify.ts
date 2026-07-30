import { eq } from "drizzle-orm";
import { notifications, users } from "@xs-share/db";
import { createTransport, type Transporter } from "nodemailer";
import { loadConfig, type AppConfig } from "../config";
import { getDb } from "../lib/db";

let mailTransport: Transporter | null = null;
let mailTransportKey = "";

function getMailTransport(config: AppConfig): Transporter | null {
  if (!config.SMTP_HOST || !config.SMTP_FROM) return null;
  const key = `${config.SMTP_HOST}:${config.SMTP_PORT}:${config.SMTP_USER ?? ""}`;
  if (mailTransport && mailTransportKey === key) return mailTransport;
  mailTransport = createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_SECURE,
    auth:
      config.SMTP_USER && config.SMTP_PASS
        ? {
            user: config.SMTP_USER,
            pass: config.SMTP_PASS,
          }
        : undefined,
  });
  mailTransportKey = key;
  return mailTransport;
}

export async function sendTelegramMessage(input: {
  botToken: string;
  chatId: string;
  text: string;
}) {
  const response = await fetch(
    `https://api.telegram.org/bot${input.botToken}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: input.chatId,
        text: input.text,
        disable_web_page_preview: true,
      }),
    },
  );
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Telegram send failed: ${response.status} ${body}`);
  }
}

export async function sendEmailMessage(input: {
  config: AppConfig;
  to: string;
  subject: string;
  text: string;
}) {
  const transport = getMailTransport(input.config);
  if (!transport || !input.config.SMTP_FROM) {
    throw new Error("SMTP is not configured");
  }
  await transport.sendMail({
    from: input.config.SMTP_FROM,
    to: input.to,
    subject: input.subject,
    text: input.text,
  });
}

export async function notifyUser(input: {
  userId: string;
  type: string;
  title: string;
  body?: string;
  payload?: Record<string, unknown>;
}) {
  const db = getDb();
  await db.insert(notifications).values({
    userId: input.userId,
    type: input.type,
    title: input.title,
    body: input.body ?? "",
    payload: input.payload ?? null,
  });

  void deliverExternalChannels({
    userId: input.userId,
    title: input.title,
    body: input.body ?? "",
  }).catch((error) => {
    console.error("[notify-external]", error);
  });
}

async function deliverExternalChannels(input: {
  userId: string;
  title: string;
  body: string;
}) {
  const config = loadConfig();
  const db = getDb();
  const user = await db.query.users.findFirst({
    where: eq(users.id, input.userId),
  });
  if (!user) return;

  const text = input.body
    ? `${input.title}\n\n${input.body}`
    : input.title;

  if (
    user.notifyTelegram &&
    user.telegramChatId &&
    config.TELEGRAM_BOT_TOKEN
  ) {
    try {
      await sendTelegramMessage({
        botToken: config.TELEGRAM_BOT_TOKEN,
        chatId: user.telegramChatId,
        text,
      });
    } catch (error) {
      console.error("[notify-telegram]", error);
    }
  }

  if (user.notifyEmailEnabled && user.notifyEmail) {
    try {
      await sendEmailMessage({
        config,
        to: user.notifyEmail,
        subject: input.title,
        text,
      });
    } catch (error) {
      console.error("[notify-email]", error);
    }
  }
}

export function resetMailTransportForTests() {
  mailTransport = null;
  mailTransportKey = "";
}
