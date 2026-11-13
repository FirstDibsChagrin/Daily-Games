import { describe, expect, it } from "vitest";
import {
  championsOf,
  computeGameDays,
  computeStandings,
  pointsForRank,
  rankGameDay,
  type ScoreRow,
} from "@/lib/scoring";
import { computeWeeks, trophyCounts } from "@/lib/scoring/weeks";

const T = [5, 3, 2, 1];
const pts = (r: ReturnType<typeof rankGameDay>) =>
  Object.fromEntries(r.entries.map((e) => [e.memberId, e.points]));
const e = (memberId: string, value: number | null) => ({ memberId, value, failed: value === null });

describe("rankGameDay", () => {
  it("worked example 1: Wordle, lower is better, with a tie and an X", () => {
    const r = rankGameDay(
      [e("A", 3), e("B", 3), e("C", 4), e("E", 5), e("D", null)],
      "lower_is_better",
      T,
    );
    expect(r.status).toBe("scored");
    expect(pts(r)).toEqual({ A: 5, B: 5, C: 2, E: 1, D: 1 });
    expect(Object.fromEntries(r.entries.map((x) => [x.memberId, x.rank]))).toEqual({
      A: 1,
      B: 1,
      C: 3,
      E: 4,
      D: null,
    });
    expect(r.winners.sort()).toEqual(["A", "B"]);
    expect(r.entries.map((x) => x.memberId)).toEqual(["A", "B", "C", "E", "D"]);
  });

  it("worked example 2: Krillion, higher is better, tie for first", () => {
    const r = rankGameDay([e("A", 520), e("B", 610), e("C", 610)], "higher_is_better", T);
    expect(pts(r)).toEqual({ A: 2, B: 5, C: 5 });
    expect(r.winners.sort()).toEqual(["B", "C"]);
  });

  it("uses the default table: 1st 5, 2nd 3, 3rd 2, 4th and below 1", () => {
    const r = rankGameDay(
      [e("a", 1), e("b", 2), e("c", 3), e("d", 4), e("f", 5), e("g", 6)],
      "lower_is_better",
      T,
    );
    expect(pts(r)).toEqual({ a: 5, b: 3, c: 2, d: 1, f: 1, g: 1 });
  });

  it("ties in the middle skip the next rank (1, 2, 2, 4)", () => {
    const r = rankGameDay([e("a", 10), e("b", 8), e("c", 8), e("d", 5)], "higher_is_better", T);
    expect(r.entries.map((x) => x.rank)).toEqual([1, 2, 2, 4]);
    expect(pts(r)).toEqual({ a: 5, b: 3, c: 3, d: 1 });
  });

  it("ties at the bottom share the rank", () => {
    const r = rankGameDay([e("a", 1), e("b", 2), e("c", 3), e("d", 3)], "lower_is_better", T);
    expect(r.entries.map((x) => x.rank)).toEqual([1, 2, 3, 3]);
    expect(pts(r)).toEqual({ a: 5, b: 3, c: 2, d: 2 });
  });

  it("everyone tied for first gets first-place points", () => {
    const r = rankGameDay([e("a", 4), e("b", 4), e("c", 4)], "lower_is_better", T);
    expect(pts(r)).toEqual({ a: 5, b: 5, c: 5 });
    expect(r.winners).toHaveLength(3);
  });

  it("all-fail day: everyone gets the minimum, no winner", () => {
    const r = rankGameDay([e("a", null), e("b", null)], "lower_is_better", T);
    expect(r.status).toBe("scored");
    expect(pts(r)).toEqual({ a: 1, b: 1 });
    expect(r.winners).toEqual([]);
  });

  it("a lone submitter gets no points and the game is waiting", () => {
    const r = rankGameDay([e("a", 3)], "lower_is_better", T);
    expect(r.status).toBe("waiting");
    expect(pts(r)).toEqual({ a: 0 });
    expect(r.winners).toEqual([]);
  });

  it("a lone failed entry is still waiting", () => {
    expect(rankGameDay([e("a", null)], "lower_is_better", T).status).toBe("waiting");
  });

  it("no entries is empty", () => {
    expect(rankGameDay([], "lower_is_better", T).status).toBe("empty");
  });

  it("one success plus one X: the X still counts as a second player", () => {
    const r = rankGameDay([e("a", 5), e("b", null)], "lower_is_better", T);
    expect(pts(r)).toEqual({ a: 5, b: 1 });
  });

  it("direction flip reverses the order", () => {
    const entries = [e("a", 3), e("b", 5)];
    expect(pts(rankGameDay(entries, "lower_is_better", T))).toEqual({ a: 5, b: 3 });
    expect(pts(rankGameDay(entries, "higher_is_better", T))).toEqual({ a: 3, b: 5 });
  });

  it("supports custom tables and failed entries take the last value", () => {
    const table = [10, 6, 4];
    const r = rankGameDay(
      [e("a", 1), e("b", 2), e("c", 3), e("d", 4), e("x", null)],
      "lower_is_better",
      table,
    );
    expect(pts(r)).toEqual({ a: 10, b: 6, c: 4, d: 4, x: 4 });
  });

  it("negative values (golf style) rank correctly", () => {
    const r = rankGameDay([e("a", -2), e("b", 0), e("c", 3)], "lower_is_better", T);
    expect(pts(r)).toEqual({ a: 5, b: 3, c: 2 });
  });

  it("decimal values compare exactly", () => {
    const r = rankGameDay([e("a", 9.4), e("b", 9.41)], "higher_is_better", T);
    expect(r.winners).toEqual(["b"]);
  });

  it("pointsForRank clamps to the last value", () => {
    expect(pointsForRank(1, T)).toBe(5);
    expect(pointsForRank(4, T)).toBe(1);
    expect(pointsForRank(40, T)).toBe(1);
  });
});

const row = (memberId: string, gameId: string, date: string, value: number | null): ScoreRow => ({
  memberId,
  gameId,
  date,
  value,
  failed: value === null,
});

describe("standings", () => {
  const games = [
    { id: "wordle", direction: "lower_is_better" as const },
    { id: "krillion", direction: "higher_is_better" as const },
  ];

  it("sums points, wins, played and averages across games", () => {
    const scores = [
      row("A", "wordle", "2026-11-09", 3),
      row("B", "wordle", "2026-11-09", 4),
      row("A", "krillion", "2026-11-09", 500),
      row("B", "krillion", "2026-11-09", 600),
      row("C", "krillion", "2026-11-09", 600),
      row("A", "wordle", "2026-11-10", 2), // lone submitter: not played, no points
    ];
    const days = computeGameDays(scores, games, T);
    const s = computeStandings(days, ["A", "B", "C"]);
    const by = Object.fromEntries(s.map((r) => [r.memberId, r]));
    expect(by.A).toMatchObject({ points: 5 + 2, wins: 1, played: 2 });
    expect(by.B).toMatchObject({ points: 3 + 5, wins: 1, played: 2 });
    expect(by.C).toMatchObject({ points: 5, wins: 1, played: 1, avg: 5 });
    expect(s.map((r) => r.memberId)).toEqual(["B", "A", "C"]);
    expect(s.map((r) => r.rank)).toEqual([1, 2, 3]);
  });

  it("filters by game and date range", () => {
    const scores = [
      row("A", "wordle", "2026-11-09", 3),
      row("B", "wordle", "2026-11-09", 4),
      row("A", "krillion", "2026-11-10", 100),
      row("B", "krillion", "2026-11-10", 600),
    ];
    const days = computeGameDays(scores, games, T);
    const onlyWordle = computeStandings(days, ["A", "B"], { gameId: "wordle" });
    expect(onlyWordle[0]).toMatchObject({ memberId: "A", points: 5 });
    const onlyTenth = computeStandings(days, ["A", "B"], { from: "2026-11-10", to: "2026-11-10" });
    expect(onlyTenth[0]).toMatchObject({ memberId: "B", points: 5 });
  });

  it("shares rank when points and wins are equal", () => {
    const scores = [row("A", "wordle", "2026-11-09", 3), row("B", "wordle", "2026-11-09", 3)];
    const s = computeStandings(computeGameDays(scores, games, T), ["A", "B", "C"]);
    expect(s.map((r) => r.rank)).toEqual([1, 1, 3]);
  });

  it("retroactive edits and deletions recompute everything", () => {
    const scores = [row("A", "wordle", "2026-11-09", 3), row("B", "wordle", "2026-11-09", 4)];
    let s = computeStandings(computeGameDays(scores, games, T), ["A", "B"]);
    expect(s[0].memberId).toBe("A");
    // B edits their score to a 2
    scores[1] = row("B", "wordle", "2026-11-09", 2);
    s = computeStandings(computeGameDays(scores, games, T), ["A", "B"]);
    expect(s[0]).toMatchObject({ memberId: "B", points: 5 });
    // A deletes theirs: B is now alone, so no points for anyone
    scores.splice(0, 1);
    s = computeStandings(computeGameDays(scores, games, T), ["A", "B"]);
    expect(s.every((r) => r.points === 0)).toBe(true);
  });

  it("changing a game's direction after the fact flips results", () => {
    const scores = [row("A", "wordle", "2026-11-09", 3), row("B", "wordle", "2026-11-09", 4)];
    const flipped = [{ id: "wordle", direction: "higher_is_better" as const }];
    const s = computeStandings(computeGameDays(scores, flipped, T), ["A", "B"]);
    expect(s[0].memberId).toBe("B");
  });

  it("ignores scores for games not in the list (archived)", () => {
    const scores = [row("A", "gone", "2026-11-09", 3), row("B", "gone", "2026-11-09", 4)];
    expect(computeGameDays(scores, games, T)).toEqual([]);
  });
});

describe("weekly champions", () => {
  const std = (memberId: string, points: number, wins: number) => ({
    memberId,
    points,
    wins,
    played: 1,
    avg: 0,
    rank: 0,
  });

  it("most points wins", () => {
    expect(championsOf([std("A", 20, 1), std("B", 15, 3)])).toEqual(["A"]);
  });
  it("ties broken by more 1st-place finishes", () => {
    expect(championsOf([std("A", 20, 1), std("B", 20, 3)])).toEqual(["B"]);
  });
  it("remaining ties are co-champions", () => {
    expect(championsOf([std("A", 20, 2), std("B", 20, 2), std("C", 5, 0)]).sort()).toEqual([
      "A",
      "B",
    ]);
  });
  it("no points means no champion", () => {
    expect(championsOf([std("A", 0, 0), std("B", 0, 0)])).toEqual([]);
  });

  it("computeWeeks only crowns completed weeks (Mon–Sun ET)", () => {
    const games = [{ id: "w", direction: "lower_is_better" as const }];
    const scores = [
      row("A", "w", "2026-11-02", 3), // Mon, week of Nov 2
      row("B", "w", "2026-11-02", 4),
      row("A", "w", "2026-11-09", 5), // week of Nov 9 (current)
      row("B", "w", "2026-11-09", 2),
    ];
    const days = computeGameDays(scores, games, T);
    const weeks = computeWeeks(days, ["A", "B"], "2026-11-13");
    expect(weeks.map((w) => [w.weekStart, w.completed, w.champions])).toEqual([
      ["2026-11-02", true, ["A"]],
      ["2026-11-09", false, []],
    ]);
    // Sunday night is still the week; Monday it's final
    expect(computeWeeks(days, ["A", "B"], "2026-11-15")[1].completed).toBe(false);
    const monday = computeWeeks(days, ["A", "B"], "2026-11-16");
    expect(monday[1]).toMatchObject({ completed: true, champions: ["B"] });
    expect(Object.fromEntries(trophyCounts(monday))).toEqual({ A: 1, B: 1 });
  });

  it("weeks with no points have no champion", () => {
    const games = [{ id: "w", direction: "lower_is_better" as const }];
    const scores = [
      row("A", "w", "2026-10-26", 3),
      row("B", "w", "2026-10-26", 4),
      row("A", "w", "2026-11-09", 3), // lone entries in between weeks
    ];
    const weeks = computeWeeks(computeGameDays(scores, games, T), ["A", "B"], "2026-11-13");
    expect(weeks.map((w) => w.champions)).toEqual([["A"], [], []]);
  });
});
