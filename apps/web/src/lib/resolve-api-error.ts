import type { ApiError } from "@/lib/api";

export function resolveLoginErrorMessage(
  error: unknown,
  translate: (key: string) => string,
  fallback: string,
): string {
  if (typeof error === "object" && error && "messageKey" in error) {
    const messageKey = String((error as ApiError).messageKey);
    const errorCode = messageKey.replace(/^errors\./, "");
    try {
      return translate(`errors.${errorCode}`);
    } catch {
      return (error as ApiError).message || fallback;
    }
  }

  if (typeof error === "object" && error && "message" in error) {
    return String((error as { message: string }).message);
  }

  return fallback;
}
