import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { buildLoginRedirect } from "@/lib/login-redirect";
import { getMe } from "@/lib/session";

export async function requireAdmin(locale: string) {
  const me = await getMe();
  if (!me) redirect(buildLoginRedirect(locale, "/admin"));
  if (me.role !== "admin") {
    const t = await getTranslations("admin");
    return { me: null, forbidden: <p className="text-red-700">{t("forbidden")}</p> };
  }
  return { me, forbidden: null };
}
