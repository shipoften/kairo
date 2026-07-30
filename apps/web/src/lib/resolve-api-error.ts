import type { ApiError } from "@/lib/api";

export function resolveApiErrorMessage(
  error: unknown,
  translate: (key: string) => string,
  fallback: string,
): string {
  if (typeof error === "object" && error && "messageKey" in error) {
    const messageKey = String((error as ApiError).messageKey);
    const errorCode = messageKey.replace(/^errors\./, "").toLowerCase();
    try {
      return translate(`errors.${errorCode}`);
    } catch {
      // continue
    }
    try {
      return translate(messageKey);
    } catch {
      return (error as ApiError).message || fallback;
    }
  }

  if (typeof error === "object" && error && "code" in error) {
    const code = String((error as ApiError).code).toLowerCase();
    try {
      return translate(`errors.${code}`);
    } catch {
      // continue
    }
  }

  if (typeof error === "object" && error && "message" in error) {
    return String((error as { message: string }).message);
  }

  return fallback;
}

/** @deprecated Use resolveApiErrorMessage with a shared errors namespace */
export function resolveLoginErrorMessage(
  error: unknown,
  translate: (key: string) => string,
  fallback: string,
): string {
  return resolveApiErrorMessage(error, translate, fallback);
}
