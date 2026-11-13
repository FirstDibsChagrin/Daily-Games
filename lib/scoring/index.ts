// The points engine. Points are never stored: everything here is computed live
// from raw scores, so any edit, backfill, game change or deletion corrects itself.
import type { Direction } from "../catalog-data";
import type { PlainDate } from "../dates";

export const DEFAULT_POINTS_TABLE = [5, 3, 2, 1];

export interface ScoreRow {
  memberId: string;
  gameId: string;
  date: PlainDate;
  value: number | null;
  failed: boolean;
}

export interface GameInfo {
  id: string;
  direction: Direction;
}

export interface RankedEntry {
  memberId: string;
  value: number | null;
  failed: boolean;
  /** Competition rank among non-failed entries; null for failed entries. */
  rank: number | null;
  /** Position used for sorting/display (failed entries come last). */
  place: number;
  points: number;
  isWinner: boolean;
}

export type GameDayStatus = "scored" | "waiting" | "empty";

export interface GameDayResult {
  gameId: string;
  date: PlainDate;
  status: GameDayStatus;
  entries: RankedEntry[]; // sorted best first
  winners: string[];
}

export function pointsForRank(rank: number, table: number[]): number {
  if (table.length === 0) return 0;
  return table[Math.min(rank, table.length) - 1];
}

export function minPoints(table: number[]): number {
  return table.length ? table[table.length - 1] : 0;
}

/** Ranks one game on one day. */
export function rankGameDay(
  entries: { memberId: string; value: number | null; failed: boolean }[],
  direction: Direction,
  table: number[],
  meta: { gameId: string; date: PlainDate } = { gameId: "", date: "" },
): GameDayResult {
  const ok = entries.filter((e) => !e.failed && e.value !== null);
  const failed = entries.filter((e) => e.failed || e.value === null);
  const better = (a: number, b: number) => (direction === "lower_is_better" ? a - b : b - a);
  ok.sort((a, b) => better(a.value!, b.value!) || a.memberId.localeCompare(b.memberId));

  const scored = entries.length >= 2;
  const ranked: RankedEntry[] = [];
  let prevValue: number | null = null;
  let prevRank = 0;
  ok.forEach((e, i) => {
    const rank = prevValue !== null && e.value === prevValue ? prevRank : i + 1;
    prevValue = e.value;
    prevRank = rank;
    ranked.push({
      memberId: e.memberId,
      value: e.value,
      failed: false,
      rank,
      place: rank,
      points: scored ? pointsForRank(rank, table) : 0,
      isWinner: scored && rank === 1,
    });
  });
  const failedPlace = ok.length + 1;
  [...failed]
    .sort((a, b) => a.memberId.localeCompare(b.memberId))
    .forEach((e) =>
      ranked.push({
        memberId: e.memberId,
        value: null,
        failed: true,
        rank: null,
        place: failedPlace,
        points: scored ? minPoints(table) : 0,
        isWinner: false,
      }),
    );

  return {
    gameId: meta.gameId,
    date: meta.date,
    status: entries.length === 0 ? "empty" : scored ? "scored" : "waiting",
    entries: ranked,
    winners: ranked.filter((r) => r.isWinner).map((r) => r.memberId),
  };
}

/** Groups scores by (date, game) and ranks each. Scores for unknown games are ignored. */
export function computeGameDays(
  scores: ScoreRow[],
  games: GameInfo[],
  table: number[],
): GameDayResult[] {
  const byGame = new Map(games.map((g) => [g.id, g]));
  const groups = new Map<string, ScoreRow[]>();
  for (const s of scores) {
    if (!byGame.has(s.gameId)) continue;
    const k = `${s.date}|${s.gameId}`;
    const arr = groups.get(k);
    if (arr) arr.push(s);
    else groups.set(k, [s]);
  }
  const out: GameDayResult[] = [];
  for (const [k, rows] of groups) {
    const [date, gameId] = k.split("|");
    out.push(rankGameDay(rows, byGame.get(gameId)!.direction, table, { gameId, date }));
  }
  out.sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : a.gameId.localeCompare(b.gameId),
  );
  return out;
}

export interface StandingRow {
  memberId: string;
  points: number;
  wins: number;
  /** Game-days played that were scored (at least 2 players). */
  played: number;
  /** Average points per scored game played. */
  avg: number;
  rank: number;
}

/**
 * Aggregates game-day results into standings. Ranking: points desc, then 1st-place
 * finishes desc; members equal on both share a rank. Every listed member appears.
 */
export function computeStandings(
  days: GameDayResult[],
  memberIds: string[],
  filter: { from?: PlainDate | null; to?: PlainDate | null; gameId?: string | null } = {},
): StandingRow[] {
  const acc = new Map<string, { points: number; wins: number; played: number }>();
  for (const id of memberIds) acc.set(id, { points: 0, wins: 0, played: 0 });
  for (const d of days) {
    if (d.status !== "scored") continue;
    if (filter.from && d.date < filter.from) continue;
    if (filter.to && d.date > filter.to) continue;
    if (filter.gameId && d.gameId !== filter.gameId) continue;
    for (const e of d.entries) {
      const a = acc.get(e.memberId);
      if (!a) continue;
      a.points += e.points;
      a.played += 1;
      if (e.isWinner) a.wins += 1;
    }
  }
  const rows = [...acc.entries()].map(([memberId, a]) => ({
    memberId,
    ...a,
    avg: a.played ? a.points / a.played : 0,
    rank: 0,
  }));
  rows.sort((a, b) => b.points - a.points || b.wins - a.wins || b.avg - a.avg);
  rows.forEach((r, i) => {
    const prev = rows[i - 1];
    r.rank = prev && prev.points === r.points && prev.wins === r.wins ? prev.rank : i + 1;
  });
  return rows;
}

/**
 * Weekly champion(s) from a week's standings: most points, ties broken by more
 * 1st-place finishes, remaining ties are co-champions. No points = no champion.
 */
export function championsOf(standings: StandingRow[]): string[] {
  const top = standings.filter((r) => r.points > 0);
  if (top.length === 0) return [];
  const best = top.reduce((m, r) =>
    r.points > m.points || (r.points === m.points && r.wins > m.wins) ? r : m,
  );
  return top.filter((r) => r.points === best.points && r.wins === best.wins).map((r) => r.memberId);
}
