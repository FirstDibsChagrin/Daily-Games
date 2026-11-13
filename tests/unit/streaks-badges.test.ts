import { describe, expect, it } from "vitest";
import { addDays, dateRange } from "@/lib/dates";
import { computeGameDays, type ScoreRow } from "@/lib/scoring";
import { computeBadges, type EarnedBadge } from "@/lib/scoring/badges";
import { computeStreak } from "@/lib/scoring/streaks";
import { computeWeeks } from "@/lib/scoring/weeks";

describe("streaks", () => {
  it("current streak counts back from today", () => {
    expect(computeStreak(["2026-11-11", "2026-11-12", "2026-11-13"], "2026-11-13")).toMatchObject({
      current: 3,
      longest: 3,
    });
  });
  it("today doesn't break the streak until the day is over", () => {
    expect(computeStreak(["2026-11-11", "2026-11-12"], "2026-11-13").current).toBe(2);
  });
  it("a missed yesterday breaks it", () => {
    expect(computeStreak(["2026-11-10", "2026-11-11"], "2026-11-13").current).toBe(0);
  });
  it("tracks the longest run separately", () => {
    const s = computeStreak(
      ["2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04", "2026-11-10", "2026-11-11"],
      "2026-11-12",
    );
    expect(s).toEqual({ current: 2, longest: 4, longestEnd: "2026-11-04" });
  });
  it("streaks span DST and year boundaries", () => {
    expect(computeStreak(dateRange("2026-10-30", "2026-11-03"), "2026-11-03").current).toBe(5);
    expect(computeStreak(dateRange("2026-12-30", "2027-01-02"), "2027-01-02").current).toBe(4);
  });
  it("duplicate dates (several games a day) count once", () => {
    expect(computeStreak(["2026-11-12", "2026-11-12", "2026-11-13"], "2026-11-13").current).toBe(2);
  });
  it("empty", () => {
    expect(computeStreak([], "2026-11-13")).toEqual({ current: 0, longest: 0, longestEnd: null });
  });
});

const T = [5, 3, 2, 1];
const r = (memberId: string, gameId: string, date: string, value: number | null): ScoreRow => ({
  memberId,
  gameId,
  date,
  value,
  failed: value === null,
});
const games = ["g1", "g2", "g3", "g4"].map((id) => ({ id, direction: "lower_is_better" as const }));

function badges(scores: ScoreRow[], today: string, members = ["A", "B", "C"]): EarnedBadge[] {
  const days = computeGameDays(scores, games, T);
  return computeBadges({
    memberIds: members,
    scores,
    days,
    activeGameIds: games.map((g) => g.id),
    weeks: computeWeeks(days, members, today),
    today,
  });
}
const keys = (b: EarnedBadge[], m: string) =>
  b
    .filter((x) => x.memberId === m)
    .map((x) => (x.contextKey ? `${x.badgeKey}:${x.contextKey}` : x.badgeKey))
    .sort();

describe("badges", () => {
  it("rookie on first score; nothing without scores", () => {
    const b = badges([r("A", "g1", "2026-11-10", 3)], "2026-11-13");
    expect(keys(b, "A")).toEqual(["rookie"]);
    expect(b.find((x) => x.badgeKey === "rookie")!.earnedOn).toBe("2026-11-10");
    expect(keys(b, "B")).toEqual([]);
  });

  it("century at the 100th score", () => {
    const scores = dateRange("2026-08-01", "2026-08-25").flatMap((d) =>
      games.map((g) => r("A", g.id, d, 3)),
    );
    expect(scores).toHaveLength(100);
    const b = badges(scores, "2026-11-13");
    expect(b.find((x) => x.badgeKey === "century")?.earnedOn).toBe("2026-08-25");
    expect(keys(b, "A")).toContain("streak_7");
    expect(keys(b, "A")).not.toContain("streak_30");
  });

  it("hot streak thresholds", () => {
    const scores = dateRange("2026-01-01", "2026-04-10").map((d) => r("A", "g1", d, 3));
    const b = keys(badges(scores, "2026-11-13"), "A");
    expect(b).toEqual(expect.arrayContaining(["streak_7", "streak_30", "streak_100"]));
  });

  it("day sweep needs 3+ contested games all won", () => {
    const d = "2026-11-10";
    const base = [
      r("A", "g1", d, 1),
      r("B", "g1", d, 2),
      r("A", "g2", d, 1),
      r("B", "g2", d, 2),
      r("A", "g3", d, 1),
      r("C", "g3", d, 2),
    ];
    expect(keys(badges(base, "2026-11-13"), "A")).toContain(`day_sweep:${d}`);
    // a solo game doesn't count either way
    expect(keys(badges([...base, r("A", "g4", d, 9)], "2026-11-13"), "A")).toContain(
      `day_sweep:${d}`,
    );
    // losing one contested game removes it
    expect(
      keys(badges([...base, r("A", "g4", d, 9), r("B", "g4", d, 1)], "2026-11-13"), "A"),
    ).not.toContain(`day_sweep:${d}`);
    // only two contested games: no sweep
    expect(keys(badges(base.slice(0, 4), "2026-11-13"), "A")).not.toContain(`day_sweep:${d}`);
  });

  it("completionist: all active games in one day (4+)", () => {
    const d = "2026-11-10";
    const all = games.map((g) => r("A", g.id, d, 3));
    expect(keys(badges(all, "2026-11-13"), "A")).toContain(`completionist:${d}`);
    expect(keys(badges(all.slice(0, 3), "2026-11-13"), "A")).not.toContain(`completionist:${d}`);
  });

  it("specialist: 10 wins in one game", () => {
    const dates = dateRange("2026-10-01", "2026-10-10");
    const scores = dates.flatMap((d) => [r("A", "g2", d, 1), r("B", "g2", d, 2)]);
    const b = badges(scores, "2026-11-13");
    expect(keys(b, "A")).toContain("specialist:g2");
    expect(b.find((x) => x.badgeKey === "specialist")!.earnedOn).toBe("2026-10-10");
    expect(keys(badges(scores.slice(2), "2026-11-13"), "A")).not.toContain("specialist:g2");
  });

  it("podium regular: 50 top-3 finishes", () => {
    const dates = dateRange("2026-06-01", "2026-06-25"); // 25 days x 2 games = 50
    const scores = dates.flatMap((d) =>
      ["g1", "g2"].flatMap((g) => [r("A", g, d, 3), r("B", g, d, 1), r("C", g, d, 2)]),
    );
    const b = badges(scores, "2026-11-13");
    expect(keys(b, "A")).toContain("podium_regular");
    expect(b.find((x) => x.memberId === "A" && x.badgeKey === "podium_regular")!.earnedOn).toBe(
      "2026-06-25",
    );
  });

  it("weekly champion counts and comeback kid", () => {
    // Week of Oct 26: A wins, C last. Week of Nov 2: C wins.
    const scores = [
      r("A", "g1", "2026-10-26", 1),
      r("B", "g1", "2026-10-26", 2),
      r("C", "g1", "2026-10-26", 3),
      r("C", "g1", "2026-11-02", 1),
      r("A", "g1", "2026-11-02", 2),
      r("B", "g1", "2026-11-02", 3),
    ];
    const b = badges(scores, "2026-11-13");
    expect(keys(b, "A")).toContain("champ_1");
    expect(keys(b, "C")).toEqual(expect.arrayContaining(["champ_1", "comeback_kid:2026-11-02"]));
    expect(keys(b, "B")).not.toContain("comeback_kid:2026-11-02");
    // The current (unfinished) week can't give a championship
    const now = badges(scores, "2026-11-05");
    expect(keys(now, "C")).not.toContain("champ_1");
  });

  it("champion milestones at 3 weeks", () => {
    const scores = [0, 1, 2].flatMap((i) => {
      const d = addDays("2026-10-12", i * 7);
      return [r("A", "g1", d, 1), r("B", "g1", d, 2)];
    });
    const b = badges(scores, "2026-11-13");
    expect(keys(b, "A")).toEqual(expect.arrayContaining(["champ_1", "champ_3"]));
    expect(b.find((x) => x.badgeKey === "champ_3")!.earnedOn).toBe("2026-11-01");
  });

  it("deleting data revokes badges", () => {
    const d = "2026-11-10";
    const base = [
      r("A", "g1", d, 1),
      r("B", "g1", d, 2),
      r("A", "g2", d, 1),
      r("B", "g2", d, 2),
      r("A", "g3", d, 1),
      r("B", "g3", d, 2),
    ];
    expect(keys(badges(base, "2026-11-13"), "A")).toContain(`day_sweep:${d}`);
    expect(keys(badges(base.slice(1), "2026-11-13"), "A")).not.toContain(`day_sweep:${d}`);
    expect(keys(badges([], "2026-11-13"), "A")).toEqual([]);
  });
});
