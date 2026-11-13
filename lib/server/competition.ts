import "server-only";
import type { PlainDate } from "@/lib/dates";
import { computeGameDays, type GameDayResult } from "@/lib/scoring";
import { getScores, type LeagueContext, type ScoreRecord } from "./league";

/** Scores (active games only, up to `today`) and their ranked game-days. */
export async function loadCompetition(
  ctx: LeagueContext,
  today: PlainDate,
  range: { from?: PlainDate | null; to?: PlainDate | null } = {},
): Promise<{ scores: ScoreRecord[]; days: GameDayResult[] }> {
  const to = range.to && range.to < today ? range.to : today;
  const all = await getScores(ctx.league.id, { from: range.from, to });
  const active = new Set(ctx.activeGames.map((g) => g.id));
  const scores = all.filter((s) => active.has(s.gameId));
  return { scores, days: computeGameDays(scores, ctx.activeGames, ctx.league.points_table) };
}
