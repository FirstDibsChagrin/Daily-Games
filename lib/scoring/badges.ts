// Badge rules. Pure: given the league's data, returns every badge each member has
// earned and the game day it was earned. The server stores these idempotently and
// revokes any stored badge that is no longer earned (e.g. after a score is deleted).
import { addDays, type PlainDate } from "../dates";
import type { GameDayResult, ScoreRow } from "./index";
import { firstDateReaching } from "./streaks";
import type { WeekResult } from "./weeks";

export interface BadgeDef {
  key: string;
  name: string;
  description: string;
}

export const BADGES: BadgeDef[] = [
  { key: "rookie", name: "Rookie", description: "Logged a first score" },
  { key: "century", name: "Century", description: "Logged 100 scores" },
  { key: "streak_7", name: "Hot Streak 7", description: "7-day participation streak" },
  {
    key: "streak_30",
    name: "Hot Streak 30",
    description: "30-day participation streak",
  },
  {
    key: "streak_100",
    name: "Hot Streak 100",
    description: "100-day participation streak",
  },
  { key: "champ_1", name: "Weekly Champion", description: "Won a week" },
  { key: "champ_3", name: "Weekly Champion ×3", description: "Won 3 weeks" },
  { key: "champ_5", name: "Weekly Champion ×5", description: "Won 5 weeks" },
  { key: "champ_10", name: "Weekly Champion ×10", description: "Won 10 weeks" },
  {
    key: "day_sweep",
    name: "Day Sweep",
    description: "Won every game you played in a day (3+ games, each with 2+ players)",
  },
  {
    key: "completionist",
    name: "Completionist",
    description: "Played every active game in one day (4+ games)",
  },
  { key: "specialist", name: "Specialist", description: "10 wins in a single game" },
  { key: "podium_regular", name: "Podium Regular", description: "50 top-3 finishes" },
  {
    key: "comeback_kid",
    name: "Comeback Kid",
    description: "Last place one week, champion the next",
  },
];

export const BADGE_BY_KEY = new Map(BADGES.map((b) => [b.key, b]));

export interface EarnedBadge {
  memberId: string;
  badgeKey: string;
  /** Distinguishes repeatable badges (a date, a game id, a week). "" for one-off badges. */
  contextKey: string;
  earnedOn: PlainDate;
}

export interface BadgeInput {
  memberIds: string[];
  /** Scores for active (non-archived) games only, dated on or before today. */
  scores: ScoreRow[];
  /** Game-day results for the same scores. */
  days: GameDayResult[];
  activeGameIds: string[];
  weeks: WeekResult[];
  today: PlainDate;
}

export function computeBadges(input: BadgeInput): EarnedBadge[] {
  const out: EarnedBadge[] = [];
  const push = (memberId: string, badgeKey: string, earnedOn: PlainDate, contextKey = "") =>
    out.push({ memberId, badgeKey, contextKey, earnedOn });

  const scores = input.scores.filter((s) => s.date <= input.today);
  const days = input.days.filter((d) => d.date <= input.today);
  const members = new Set(input.memberIds);

  // Per-member score dates, sorted
  const byMember = new Map<string, ScoreRow[]>();
  for (const s of scores) {
    if (!members.has(s.memberId)) continue;
    const arr = byMember.get(s.memberId);
    if (arr) arr.push(s);
    else byMember.set(s.memberId, [s]);
  }

  for (const [memberId, rows] of byMember) {
    rows.sort((a, b) =>
      a.date < b.date ? -1 : a.date > b.date ? 1 : a.gameId.localeCompare(b.gameId),
    );
    push(memberId, "rookie", rows[0].date);
    if (rows.length >= 100) push(memberId, "century", rows[99].date);
    const dates = rows.map((r) => r.date);
    for (const n of [7, 30, 100]) {
      const d = firstDateReaching(dates, n);
      if (d) push(memberId, `streak_${n}`, d);
    }

    // Completionist: every active game in one day (at least 4 active games)
    if (input.activeGameIds.length >= 4) {
      const active = new Set(input.activeGameIds);
      const perDay = new Map<PlainDate, Set<string>>();
      for (const r of rows) {
        if (!active.has(r.gameId)) continue;
        const set = perDay.get(r.date) ?? new Set<string>();
        set.add(r.gameId);
        perDay.set(r.date, set);
      }
      for (const [d, set] of perDay)
        if (set.size === active.size) push(memberId, "completionist", d, d);
    }
  }

  // Results-based badges
  const winsByGame = new Map<string, PlainDate[]>(); // `${member}|${game}` -> dates
  const podiums = new Map<string, PlainDate[]>();
  const perMemberDay = new Map<string, { won: number; played: number }>(); // `${member}|${date}`
  for (const d of days) {
    if (d.status !== "scored") continue;
    for (const e of d.entries) {
      if (!members.has(e.memberId)) continue;
      const md = `${e.memberId}|${d.date}`;
      const stat = perMemberDay.get(md) ?? { won: 0, played: 0 };
      stat.played += 1;
      if (e.isWinner) stat.won += 1;
      perMemberDay.set(md, stat);
      if (e.isWinner) {
        const k = `${e.memberId}|${d.gameId}`;
        (winsByGame.get(k) ?? winsByGame.set(k, []).get(k)!).push(d.date);
      }
      if (e.rank !== null && e.rank <= 3) {
        (podiums.get(e.memberId) ?? podiums.set(e.memberId, []).get(e.memberId)!).push(d.date);
      }
    }
  }
  // Day Sweep: among games played that day that had 2+ players, at least 3, won them all.
  // Games where the member was the only player don't count either way.
  for (const [md, stat] of perMemberDay) {
    if (stat.played >= 3 && stat.won === stat.played) {
      const [memberId, date] = md.split("|");
      push(memberId, "day_sweep", date, date);
    }
  }
  for (const [k, dates] of winsByGame) {
    if (dates.length >= 10) {
      const [memberId, gameId] = k.split("|");
      dates.sort();
      push(memberId, "specialist", dates[9], gameId);
    }
  }
  for (const [memberId, dates] of podiums) {
    if (dates.length >= 50) {
      dates.sort();
      push(memberId, "podium_regular", dates[49]);
    }
  }

  // Weekly champion badges and Comeback Kid (completed weeks only)
  const completed = input.weeks.filter((w) => w.completed);
  const champCount = new Map<string, number>();
  for (let i = 0; i < completed.length; i++) {
    const w = completed[i];
    for (const id of w.champions) {
      if (!members.has(id)) continue;
      const n = (champCount.get(id) ?? 0) + 1;
      champCount.set(id, n);
      if ([1, 3, 5, 10].includes(n)) push(id, `champ_${n}`, w.weekEnd);
      const prev = completed[i - 1];
      if (prev && prev.weekStart === addDays(w.weekStart, -7) && lastPlace(prev).includes(id)) {
        push(id, "comeback_kid", w.weekEnd, w.weekStart);
      }
    }
  }

  return out;
}

/**
 * Last place in a week: among members who scored game-days that week (at least 2 of
 * them), the one(s) with the fewest points (ties broken the same way as rankings).
 */
export function lastPlace(week: WeekResult): string[] {
  const participants = week.standings.filter((r) => r.played > 0);
  if (participants.length < 2) return [];
  const worst = participants[participants.length - 1];
  if (worst.rank === 1) return []; // everyone tied: nobody is last
  return participants.filter((r) => r.rank === worst.rank).map((r) => r.memberId);
}
