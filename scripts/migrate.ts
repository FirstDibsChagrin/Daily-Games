/* Applies supabase/migrations/*.sql in order to DATABASE_ADMIN_URL (or DATABASE_URL).
   Tracks applied files in dl_meta.migrations. Usage: npm run db:migrate */
import "dotenv/config";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";

async function main() {
  const url = process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL;
  if (!url) throw new Error("Set DATABASE_ADMIN_URL (or DATABASE_URL)");
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  await sql`create schema if not exists dl_meta`;
  await sql`create table if not exists dl_meta.migrations (name text primary key, applied_at timestamptz not null default now())`;
  const dir = join(process.cwd(), "supabase", "migrations");
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  const applied = new Set(
    (await sql`select name from dl_meta.migrations`).map((r) => r.name as string),
  );
  for (const f of files) {
    if (applied.has(f)) continue;
    const body = readFileSync(join(dir, f), "utf8");
    await sql.begin(async (tx) => {
      await tx.unsafe(body);
      await tx`insert into dl_meta.migrations (name) values (${f})`;
    });
    console.log(`applied ${f}`);
  }
  // Optionally set the app role password (local dev / CI only).
  if (process.env.APP_ROLE_PASSWORD) {
    await sql.unsafe(
      `alter role daily_league_app login password '${process.env.APP_ROLE_PASSWORD.replace(/'/g, "''")}'`,
    );
  }
  await sql.end();
  console.log("migrations up to date");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
