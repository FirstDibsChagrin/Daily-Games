import "server-only";
import { computeGameDays } from "@/lib/scoring";
import { computeBadges } from "@/lib/scoring/badges";
import { computeWeeks } from "@/lib/scoring/weeks";
import type { PlainDate } from "@/lib/dates";
import { db } from "./db";
import { getScores } from "./league";

/**
 * Recomputes every badge in a league from raw data and stores the result idempotently:
 * new badges are inserted, existing ones kept (earned_on refreshed), and badges whose
 * underlying data is gone are revoked. Returns the number of changes.
 */
export async function syncBadges(leagueId: string, today: PlainDate): Promise<number> {
  const sql = db();
  const [league] = await sql<{ points_table: number[] }[]>`
    select points_table from leagues where id = ${leagueId}`;
  if (!league) return 0;
  const members = await sql<{ id: string }[]>`select id from members where league_id = ${leagueId}`;
  const games = await sql<{ id: string; direction: "lower_is_better" | "higher_is_better" }[]>`
    select id, direction from league_games where league_id = ${leagueId} and archived_at is null`;
  const activeIds = new Set(games.map((g) => g.id));
  const scores = (await getScores(leagueId, { to: today })).filter((s) => activeIds.has(s.gameId));
  const memberIds = members.map((m) => m.id);
  const days = computeGameDays(scores, games, league.points_table);
  const earned = computeBadges({
    memberIds,
    scores,
    days,
    activeGameIds: [...activeIds],
    weeks: computeWeeks(days, memberIds, today),
    today,
  });

  if (memberIds.length === 0) return 0;
  const existing = await sql<
    { id: string; member_id: string; badge_key: string; context_key: string; earned_on: string }[]
  >`
    select id, member_id, badge_key, context_key, earned_on from badge_awards
    where member_id in ${sql(memberIds)}`;
  const k = (m: string, b: string, c: string) => `${m}|${b}|${c}`;
  const want = new Map(earned.map((e) => [k(e.memberId, e.badgeKey, e.contextKey), e]));
  const have = new Map(existing.map((e) => [k(e.member_id, e.badge_key, e.context_key), e]));

  let changes = 0;
  const revoke = existing
    .filter((e) => !want.has(k(e.member_id, e.badge_key, e.context_key)))
    .map((e) => e.id);
  if (revoke.length) {
    await sql`delete from badge_awards where id in ${sql(revoke)}`;
    changes += revoke.length;
  }
  for (const [key, e] of want) {
    const cur = have.get(key);
    if (!cur) {
      await sql`
        insert into badge_awards (member_id, badge_key, context_key, earned_on)
        values (${e.memberId}, ${e.badgeKey}, ${e.contextKey}, ${e.earnedOn})
        on conflict (member_id, badge_key, context_key) do update set earned_on = excluded.earned_on`;
      changes++;
    } else if (cur.earned_on !== e.earnedOn) {
      await sql`update badge_awards set earned_on = ${e.earnedOn} where id = ${cur.id}`;
      changes++;
    }
  }
  return changes;
}
