import type { Direction } from "./catalog-data";
import type { GameDayResult, ScoreRow } from "./scoring";

export interface MemberGameStats {
  memberId: string;
  plays: number;
  fails: number;
  wins: number;
  avg: number | null;
  best: number | null;
  worst: number | null;
  winRate: number | null; // wins / contested plays
  contested: number;
}

/** Per-member stats for one game over the given scores/results. */
export function memberGameStats(
  memberIds: string[],
  gameId: string,
  direction: Direction,
  scores: ScoreRow[],
  days: GameDayResult[],
): MemberGameStats[] {
  const better = (a: number, b: number) => (direction === "lower_is_better" ? a < b : a > b);
  return memberIds.map((memberId) => {
    const mine = scores.filter((s) => s.gameId === gameId && s.memberId === memberId);
    const vals = mine.filter((s) => !s.failed && s.value !== null).map((s) => s.value!);
    let best: number | null = null;
    let worst: number | null = null;
    for (const v of vals) {
      if (best === null || better(v, best)) best = v;
      if (worst === null || better(worst, v)) worst = v;
    }
    let wins = 0;
    let contested = 0;
    for (const d of days) {
      if (d.gameId !== gameId || d.status !== "scored") continue;
      const e = d.entries.find((x) => x.memberId === memberId);
      if (!e) continue;
      contested++;
      if (e.isWinner) wins++;
    }
    return {
      memberId,
      plays: mine.length,
      fails: mine.length - vals.length,
      wins,
      avg: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null,
      best,
      worst,
      contested,
      winRate: contested ? wins / contested : null,
    };
  });
}
