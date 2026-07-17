/**
 * Apply a SQL migration file using Supabase service role + pg meta if available.
 * Usage: node scripts/apply-sql-migration.mjs supabase/migrations/006_citations.sql
 */
import { readFileSync } from "fs";
import { resolve } from "path";

const file = process.argv[2] ?? "supabase/migrations/006_citations.sql";
const sql = readFileSync(resolve(process.cwd(), file), "utf8");

for (const line of readFileSync(resolve(process.cwd(), ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim();
}

const url = process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL;
if (!url) {
  console.error("Set SUPABASE_DB_URL or DATABASE_URL in .env.local to apply migrations.");
  console.error("Alternatively run the SQL in Supabase Dashboard → SQL Editor:");
  console.error(file);
  process.exit(1);
}

const { default: pg } = await import("pg");
const allowInsecureSsl = process.env.ALLOW_INSECURE_DB_SSL === "true";
const client = new pg.Client({
  connectionString: url,
  ssl: { rejectUnauthorized: !allowInsecureSsl },
});
await client.connect();
try {
  await client.query(sql);
  console.log("Migration applied:", file);
} finally {
  await client.end();
}
