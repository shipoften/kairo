import { eq } from "drizzle-orm";
import { users } from "@xs-share/db";
import { AuthProvider, UserRole } from "@xs-share/shared";
import { upsertOAuthUser } from "../src/lib/auth";
import { loadConfig } from "../src/config";

export const DEV_ADMIN_EXTERNAL_ID = "dev-admin";
export const DEV_ADMIN_DISPLAY_NAME = "Admin";

async function main() {
  loadConfig();

  const { user, isNew } = await upsertOAuthUser({
    provider: AuthProvider.dev,
    providerUserId: DEV_ADMIN_EXTERNAL_ID,
    displayName: DEV_ADMIN_DISPLAY_NAME,
    locale: "zh",
  });

  const db = (await import("../src/lib/db")).getDb();
  await db
    .update(users)
    .set({ role: UserRole.admin, updatedAt: new Date() })
    .where(eq(users.id, user.id));

  const webOrigin = process.env.WEB_ORIGIN ?? "http://localhost:5180";

  console.log("Admin account ready.");
  console.log(`  user id: ${user.id}`);
  console.log(`  display name: ${DEV_ADMIN_DISPLAY_NAME}`);
  console.log(`  dev external id: ${DEV_ADMIN_EXTERNAL_ID}`);
  console.log(`  created: ${isNew ? "yes" : "no (updated existing)"}`);
  console.log("");
  console.log("Sign in:");
  console.log(`  1. Open ${webOrigin}/zh/login`);
  console.log("  2. Expand Dev Login");
  console.log(`  3. external id = ${DEV_ADMIN_EXTERNAL_ID}`);
  console.log(`  4. display name = ${DEV_ADMIN_DISPLAY_NAME}`);
  console.log("  5. Visit /zh/admin");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
