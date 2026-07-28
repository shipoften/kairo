import { createHash, randomBytes } from "node:crypto";

export function hashToken(token: string, secret: string) {
  return createHash("sha256").update(`${secret}:${token}`).digest("hex");
}

export function createSessionToken() {
  return randomBytes(32).toString("base64url");
}

export function createInviteCode() {
  return randomBytes(5).toString("hex");
}

export function addHours(date: Date, hours: number) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

export function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}
