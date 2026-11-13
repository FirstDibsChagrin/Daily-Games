import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { syncBadges } from "@/lib/server/badges";
import { today } from "@/lib/server/clock";
import { db } from "@/lib/server/db";

export const dynamic = "force-dynamic";

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

/**
 * Daily Vercel Cron. Runs a trivial query so the free Supabase project never pauses
 * for inactivity, prunes old rate-limit rows, and refreshes weekly-champion badges.
 */
export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sql = db();
  const [{ leagues }] = await sql<
    { leagues: number }[]
  >`select count(*)::int as leagues from leagues`;
  await sql`delete from rate_limits
    where (locked_until is null or locked_until < now()) and window_start < now() - interval '1 day'`;
  const d = await today();
  const ids = await sql<{ id: string }[]>`select id from leagues`;
  for (const { id } of ids) {
    try {
      await syncBadges(id, d);
    } catch (e) {
      console.error("cron badge sync", id, e);
    }
  }
  return NextResponse.json({ ok: true, leagues, at: new Date().toISOString() });
}
