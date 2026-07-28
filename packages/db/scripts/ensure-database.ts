import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL is required");
}

const adminUrl = url.replace(/\/[^/]+$/, "/postgres");
const databaseName = url.split("/").pop()?.split("?")[0] ?? "xs_share";
const client = postgres(adminUrl, { max: 1 });

try {
  await client.unsafe(`CREATE DATABASE "${databaseName}"`);
  console.log(`created database ${databaseName}`);
} catch (error) {
  const code =
    typeof error === "object" && error && "code" in error
      ? String((error as { code: string }).code)
      : "";
  if (code === "42P04") {
    console.log(`database ${databaseName} already exists`);
  } else {
    throw error;
  }
} finally {
  await client.end();
}
