import type { AuthUser } from "./auth";
import { readSessionCookie, resolveSessionUser } from "./auth";

export async function authFromRequest(
  request: Request,
  sessionSecret: string,
): Promise<{ user: AuthUser | null; sessionToken: string | undefined }> {
  const sessionToken = readSessionCookie(request.headers.get("cookie"));
  const user = await resolveSessionUser(sessionToken, sessionSecret);
  return { user, sessionToken };
}
