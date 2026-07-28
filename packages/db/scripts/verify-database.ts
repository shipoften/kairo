import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL is required");
}

const expectedTables = [
  "users",
  "auth_identities",
  "sessions",
  "platform_configs",
  "tasks",
  "joins",
  "wallet_accounts",
  "wallet_ledgers",
  "wallet_holds",
  "deposits",
  "withdrawals",
  "disputes",
  "notifications",
  "referral_rewards",
];

const client = postgres(url, { max: 1 });

try {
  const rows = await client<{ tablename: string }[]>`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  `;
  const existing = new Set(rows.map((row) => row.tablename));
  const missing = expectedTables.filter((name) => !existing.has(name));

  if (missing.length > 0) {
    console.error("Missing tables:", missing.join(", "));
    process.exit(1);
  }

  const migrationRows = await client<{ id: string }[]>`
    SELECT id FROM drizzle.__drizzle_migrations ORDER BY created_at
  `;
  if (migrationRows.length === 0) {
    console.error("No drizzle migrations applied. Run: bun run db:migrate");
    process.exit(1);
  }

  console.log(`database ok: ${existing.size} tables, ${migrationRows.length} migration(s)`);
} finally {
  await client.end();
}
