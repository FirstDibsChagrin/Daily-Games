// Streaks never affect points. A streak = consecutive game days with at least one score.
import { addDays, type PlainDate } from "../dates";

export interface StreakInfo {
  current: number;
  longest: number;
  /** Last date of the longest run (most recent if tied). */
  longestEnd: PlainDate | null;
}

/** Run length ending on each date that has activity. */
export function runLengths(dates: Iterable<PlainDate>): Map<PlainDate, number> {
  const sorted = [...new Set(dates)].sort();
  const out = new Map<PlainDate, number>();
  for (const d of sorted) {
    out.set(d, (out.get(addDays(d, -1)) ?? 0) + 1);
  }
  return out;
}

/**
 * Current and longest streak. Today doesn't break a streak until the day is over:
 * if there's no score today yet, the current streak is the run ending yesterday.
 * Dates after `today` are ignored.
 */
export function computeStreak(dates: Iterable<PlainDate>, today: PlainDate): StreakInfo {
  const runs = runLengths([...dates].filter((d) => d <= today));
  let longest = 0;
  let longestEnd: PlainDate | null = null;
  for (const [d, n] of runs) {
    if (n >= longest) {
      longest = n;
      longestEnd = d;
    }
  }
  const current = runs.get(today) ?? runs.get(addDays(today, -1)) ?? 0;
  return { current, longest, longestEnd };
}

/** The first date on which a run reached `n` days, or null. */
export function firstDateReaching(dates: Iterable<PlainDate>, n: number): PlainDate | null {
  for (const [d, len] of runLengths(dates)) if (len >= n) return d;
  return null;
}
