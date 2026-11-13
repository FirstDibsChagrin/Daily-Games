import "server-only";
import postgres from "postgres";

type Sql = postgres.Sql<Record<string, never>>;
const g = globalThis as unknown as { __dlSql?: Sql };

/** Lazily-created Postgres client (server only). Works with the Supabase transaction pooler. */
export function db(): Sql {
  if (g.__dlSql) return g.__dlSql;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  g.__dlSql = postgres(url, {
    prepare: false, // required for the Supabase transaction pooler (port 6543)
    max: process.env.NODE_ENV === "production" ? 3 : 5,
    idle_timeout: 20,
    connect_timeout: 15,
    onnotice: () => {},
    types: {
      // numeric -> JS number (scores are small); date -> plain "YYYY-MM-DD" string
      numeric: {
        to: 1700,
        from: [1700],
        serialize: (x: number) => String(x),
        parse: (x: string) => Number(x),
      },
      date: {
        to: 1082,
        from: [1082],
        serialize: (x: string) => x,
        parse: (x: string) => x,
      },
    },
  }) as unknown as Sql;
  return g.__dlSql;
}
