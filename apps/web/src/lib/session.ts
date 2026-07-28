import { cookies } from "next/headers";
import { API_URL } from "./api";

export type MeResponse = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  preferredLocale: string;
  preferredMode: string;
  role: string;
  inviteCode: string;
  identities: Array<{ provider: string; providerUserId: string }>;
};

export async function getMe(): Promise<MeResponse | null> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((item) => `${item.name}=${item.value}`)
    .join("; ");

  try {
    const response = await fetch(`${API_URL}/v1/me`, {
      headers: cookieHeader ? { cookie: cookieHeader } : {},
      cache: "no-store",
    });
    if (!response.ok) return null;
    return (await response.json()) as MeResponse;
  } catch {
    return null;
  }
}

export async function apiServerWithSession<T>(
  path: string,
  init: RequestInit = {},
): Promise<T | null> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((item) => `${item.name}=${item.value}`)
    .join("; ");

  const headers = new Headers(init.headers);
  if (cookieHeader) headers.set("cookie", cookieHeader);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  try {
    const response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers,
      cache: "no-store",
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}
