import { addDays, weekStart, type PlainDate } from "../dates";
import { championsOf, computeStandings, type GameDayResult, type StandingRow } from "./index";

export interface WeekResult {
  weekStart: PlainDate;
  weekEnd: PlainDate;
  standings: StandingRow[];
  champions: string[];
  completed: boolean;
}

/**
 * One entry per week from the first week with a scored game-day to the current week.
 * A week is completed once its Sunday is before `today` (i.e. after midnight ET Sunday).
 */
export function computeWeeks(
  days: GameDayResult[],
  memberIds: string[],
  today: PlainDate,
): WeekResult[] {
  const scored = days.filter((d) => d.status === "scored" && d.date <= today);
  if (scored.length === 0) return [];
  const first = weekStart(scored[0].date);
  const last = weekStart(today);
  const byWeek = new Map<PlainDate, GameDayResult[]>();
  for (const d of scored) {
    const w = weekStart(d.date);
    const arr = byWeek.get(w);
    if (arr) arr.push(d);
    else byWeek.set(w, [d]);
  }
  const out: WeekResult[] = [];
  for (let w = first; w <= last; w = addDays(w, 7)) {
    const end = addDays(w, 6);
    const standings = computeStandings(byWeek.get(w) ?? [], memberIds);
    const completed = end < today;
    out.push({
      weekStart: w,
      weekEnd: end,
      standings,
      champions: completed ? championsOf(standings) : [],
      completed,
    });
  }
  return out;
}

/** Trophy count per member across completed weeks (co-champions each get one). */
export function trophyCounts(weeks: WeekResult[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const w of weeks) for (const id of w.champions) m.set(id, (m.get(id) ?? 0) + 1);
  return m;
}
