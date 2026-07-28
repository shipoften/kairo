export function sanitizeReturnPath(
  path: string | null | undefined,
): string | null {
  if (!path) return null;
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("://")) {
    return null;
  }
  return path;
}

export function buildLoginPath(returnPath?: string | null): string {
  const safe = sanitizeReturnPath(returnPath);
  if (!safe) return "/login";
  return `/login?returnTo=${encodeURIComponent(safe)}`;
}

export function buildLoginRedirect(
  locale: string,
  returnPath?: string | null,
): string {
  return `/${locale}${buildLoginPath(returnPath)}`;
}

export function resolvePostLoginPath(returnPath?: string | null): string {
  return sanitizeReturnPath(returnPath) ?? "/tasks";
}
