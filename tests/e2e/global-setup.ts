import { execSync } from "node:child_process";
import postgres from "postgres";
import { TEST_ADMIN_DB } from "../../playwright.config";

/** Fresh test database: drop everything, run migrations, seed the catalog. */
export default async function globalSetup() {
  const sql = postgres(TEST_ADMIN_DB, { max: 1, onnotice: () => {} });
  await sql.unsafe(`
    drop schema if exists public cascade;
    drop schema if exists dl_meta cascade;
    create schema public;
    grant all on schema public to public;
  `);
  await sql.end();
  const env = {
    ...process.env,
    DATABASE_ADMIN_URL: TEST_ADMIN_DB,
    APP_ROLE_PASSWORD: "app_password",
  };
  execSync("npx tsx scripts/migrate.ts", { env, stdio: "inherit" });
  execSync("npx tsx scripts/seed.ts", { env, stdio: "inherit" });
}
