import { describe, expect, it } from "vitest";
import { computeGameDays, type ScoreRow } from "@/lib/scoring";
import { buildRecap } from "@/lib/scoring/recap";
import { computeWeeks } from "@/lib/scoring/weeks";

const r = (memberId: string, gameId: string, date: string, value: number | null): ScoreRow => ({
  memberId,
  gameId,
  date,
  value,
  failed: value === null,
});
const games = [
  { id: "w", direction: "lower_is_better" as const },
  { id: "k", direction: "higher_is_better" as const },
];

describe("weekly recap", () => {
  const scores = [
    r("A", "w", "2026-11-01", 3), // previous week (Sun) - part of A's streak
    r("A", "w", "2026-11-02", 3),
    r("B", "w", "2026-11-02", 4),
    r("A", "k", "2026-11-02", 100),
    r("B", "k", "2026-11-02", 600),
    r("A", "w", "2026-11-03", 5),
    r("B", "w", "2026-11-03", 2),
    r("A", "k", "2026-11-03", 700),
    r("B", "k", "2026-11-03", 100),
    r("C", "k", "2026-11-03", 50),
  ];
  const days = computeGameDays(scores, games, [5, 3, 2, 1]);
  const weeks = computeWeeks(days, ["A", "B", "C"], "2026-11-13");
  const week = weeks.find((w) => w.weekStart === "2026-11-02")!;
  const recap = buildRecap(week, days, scores, ["A", "B", "C"]);

  it("champion and podium", () => {
    // A: 5+3 + 3+5 = 16 ; B: 3+5 + 5+3 = 16 ; C: 2. Wins tie 2-2 -> co-champions
    expect(recap.champions.sort()).toEqual(["A", "B"]);
    expect(recap.podium.map((p) => [p.memberId, p.points, p.rank])).toEqual([
      ["A", 16, 1],
      ["B", 16, 1],
      ["C", 2, 3],
    ]);
  });
  it("game winners by most wins", () => {
    const byGame = Object.fromEntries(recap.gameWinners.map((g) => [g.gameId, g.memberIds.sort()]));
    expect(byGame).toEqual({ w: ["A", "B"], k: ["A", "B"] });
  });
  it("best single day", () => {
    expect(recap.bestDay).toEqual({ memberIds: ["A", "B"], date: "2026-11-02", points: 8 });
  });
  it("longest active streak includes days before the week", () => {
    expect(recap.longestStreak).toEqual({ memberIds: ["A"], days: 3 });
  });
});
