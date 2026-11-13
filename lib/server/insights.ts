import "server-only";
import type { PlainDate } from "@/lib/dates";
import { computeWeeks } from "@/lib/scoring/weeks";
import { syncBadges } from "./badges";
import { loadCompetition } from "./competition";
import { db } from "./db";
import type { LeagueContext } from "./league";

export interface BadgeRow {
  member_id: string;
  badge_key: string;
  context_key: string;
  earned_on: PlainDate;
}

/** Everything needed for stats/profile/recap pages: all scores, game-days, weeks and badges. */
export async function loadInsights(ctx: LeagueContext, today: PlainDate) {
  // Weekly-champion badges depend on the calendar, not only on score edits, so refresh here.
  await syncBadges(ctx.league.id, today);
  const memberIds = ctx.members.map((m) => m.id);
  const [{ scores, days }, badges] = await Promise.all([
    loadCompetition(ctx, today),
    memberIds.length
      ? db()<BadgeRow[]>`
          select member_id, badge_key, context_key, earned_on from badge_awards
          where member_id in ${db()(memberIds)} order by earned_on desc, badge_key`
      : Promise.resolve([] as BadgeRow[]),
  ]);
  const weeks = computeWeeks(days, memberIds, today);
  return { scores, days, weeks, badges, memberIds };
}
