import { notifications } from "@xs-share/db";
import { getDb } from "../lib/db";

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
}
