import "server-only";
import { db } from "./db";

export interface LimitRule {
  /** failures allowed inside the window before locking */
  max: number;
  windowSeconds: number;
  lockSeconds: number;
}

export const RULES = {
  pin: { max: 5, windowSeconds: 15 * 60, lockSeconds: 15 * 60 },
  pinPerName: { max: 30, windowSeconds: 60 * 60, lockSeconds: 60 * 60 },
  joinCode: { max: 10, windowSeconds: 15 * 60, lockSeconds: 15 * 60 },
  createLeague: { max: 10, windowSeconds: 60 * 60, lockSeconds: 60 * 60 },
  newMember: { max: 30, windowSeconds: 60 * 60, lockSeconds: 60 * 60 },
} satisfies Record<string, LimitRule>;

/** Seconds remaining on a lock, or 0 if not locked. */
export async function lockedFor(key: string): Promise<number> {
  const rows = await db()<{ s: number }[]>`
    select greatest(0, ceil(extract(epoch from (locked_until - now()))))::int as s
    from rate_limits where key = ${key} and locked_until > now()`;
  return rows[0]?.s ?? 0;
}

/** Records one failure (or one use). Returns lock seconds if this tipped it over, else 0. */
export async function hit(key: string, rule: LimitRule): Promise<number> {
  const sql = db();
  const [{ attempts }] = await sql<{ attempts: number }[]>`
    insert into rate_limits (key, attempts, window_start) values (${key}, 1, now())
    on conflict (key) do update set
      attempts = case when rate_limits.window_start < now() - make_interval(secs => ${rule.windowSeconds})
                      then 1 else rate_limits.attempts + 1 end,
      window_start = case when rate_limits.window_start < now() - make_interval(secs => ${rule.windowSeconds})
                      then now() else rate_limits.window_start end
    returning attempts`;
  if (attempts >= rule.max) {
    await sql`
      update rate_limits set locked_until = now() + make_interval(secs => ${rule.lockSeconds}),
        attempts = 0, window_start = now()
      where key = ${key}`;
    return rule.lockSeconds;
  }
  return 0;
}

export async function clear(key: string): Promise<void> {
  await db()`delete from rate_limits where key = ${key}`;
}

export function lockMessage(seconds: number): string {
  const mins = Math.max(1, Math.ceil(seconds / 60));
  return `Too many attempts. Try again in ${mins} minute${mins === 1 ? "" : "s"}.`;
}
