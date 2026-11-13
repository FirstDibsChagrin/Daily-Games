// Weekly recap, derived entirely from data.
import { addDays, dateRange, type PlainDate } from "../dates";
import type { GameDayResult, ScoreRow } from "./index";
import { runLengths } from "./streaks";
import type { WeekResult } from "./weeks";

export interface WeeklyRecap {
  weekStart: PlainDate;
  weekEnd: PlainDate;
  champions: string[];
  podium: { memberId: string; points: number; wins: number; rank: number }[];
  /** Per game: member(s) with the most wins that week. */
  gameWinners: { gameId: string; memberIds: string[]; wins: number }[];
  /** Biggest single-day points haul (ties listed). */
  bestDay: { memberIds: string[]; date: PlainDate; points: number } | null;
  /** Longest participation streak that was active during the week (as of week end). */
  longestStreak: { memberIds: string[]; days: number } | null;
  totalScores: number;
}

export function buildRecap(
  week: WeekResult,
  days: GameDayResult[],
  scores: ScoreRow[],
  memberIds: string[],
): WeeklyRecap {
  const { weekStart, weekEnd } = week;
  const inWeek = (d: PlainDate) => d >= weekStart && d <= weekEnd;
  const weekDays = days.filter((d) => inWeek(d.date) && d.status === "scored");

  const podium = week.standings
    .filter((r) => r.points > 0 && r.rank <= 3)
    .map((r) => ({ memberId: r.memberId, points: r.points, wins: r.wins, rank: r.rank }));

  // Game winners: most daily wins per game
  const winsByGame = new Map<string, Map<string, number>>();
  for (const d of weekDays) {
    const m = winsByGame.get(d.gameId) ?? new Map<string, number>();
    for (const w of d.winners) m.set(w, (m.get(w) ?? 0) + 1);
    winsByGame.set(d.gameId, m);
  }
  const gameWinners = [...winsByGame.entries()]
    .map(([gameId, m]) => {
      const max = Math.max(0, ...m.values());
      return {
        gameId,
        wins: max,
        memberIds: max ? [...m.entries()].filter(([, n]) => n === max).map(([id]) => id) : [],
      };
    })
    .filter((g) => g.wins > 0);

  // Best single day
  const dayPoints = new Map<string, number>(); // member|date
  for (const d of weekDays)
    for (const e of d.entries)
      dayPoints.set(
        `${e.memberId}|${d.date}`,
        (dayPoints.get(`${e.memberId}|${d.date}`) ?? 0) + e.points,
      );
  let bestDay: WeeklyRecap["bestDay"] = null;
  for (const [k, pts] of dayPoints) {
    const [memberId, date] = k.split("|");
    if (pts <= 0) continue;
    if (!bestDay || pts > bestDay.points) bestDay = { memberIds: [memberId], date, points: pts };
    else if (pts === bestDay.points) {
      if (!bestDay.memberIds.includes(memberId)) bestDay.memberIds.push(memberId);
      if (date < bestDay.date) bestDay.date = date;
    }
  }

  bestDay?.memberIds.sort();

  // Longest streak active during the week: max run length ending on any day of the week
  let longestStreak: WeeklyRecap["longestStreak"] = null;
  const weekDates = dateRange(weekStart, weekEnd);
  for (const memberId of memberIds) {
    const dates = scores
      .filter((s) => s.memberId === memberId && s.date <= weekEnd)
      .map((s) => s.date);
    const runs = runLengths(dates);
    const best = Math.max(0, ...weekDates.map((d) => runs.get(d) ?? 0));
    if (best <= 0) continue;
    if (!longestStreak || best > longestStreak.days)
      longestStreak = { memberIds: [memberId], days: best };
    else if (best === longestStreak.days) longestStreak.memberIds.push(memberId);
  }

  return {
    weekStart,
    weekEnd: addDays(weekStart, 6),
    champions: week.champions,
    podium,
    gameWinners,
    bestDay,
    longestStreak,
    totalScores: scores.filter((s) => inWeek(s.date)).length,
  };
}
