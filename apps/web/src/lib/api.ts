const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5181";

export type ApiError = {
  code: string;
  message: string;
  messageKey: string;
};

async function parseResponse<T>(response: Response): Promise<T> {
  const data = await response.json();
  if (!response.ok) {
    throw data as ApiError;
  }
  return data as T;
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
    credentials: "include",
    cache: "no-store",
  });
  return parseResponse<T>(response);
}

export async function apiServerFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);
  try {
    const response = await fetch(`${API_URL}${path}`, {
      ...init,
      signal: controller.signal,
      cache: "no-store",
    });
    return parseResponse<T>(response);
  } finally {
    clearTimeout(timer);
  }
}

export { API_URL };
