import { API_URL } from "./api";

export function oauthStartUrl(
  provider: "google" | "x",
  locale: string,
  options?: { invite?: string; returnTo?: string },
) {
  const params = new URLSearchParams({ locale });
  if (options?.invite) params.set("invite", options.invite);
  if (options?.returnTo) params.set("returnTo", options.returnTo);
  return `${API_URL}/v1/auth/${provider}/start?${params}`;
}

export async function fetchAuthProviders() {
  const response = await fetch(`${API_URL}/v1/auth/providers`, {
    cache: "no-store",
  });
  if (!response.ok) {
    return { google: false, x: false, telegram: false, devLogin: true };
  }
  return (await response.json()) as {
    google: boolean;
    x: boolean;
    telegram: boolean;
    devLogin: boolean;
  };
}
