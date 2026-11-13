import { expect, test } from "@playwright/test";
import {
  addCatalogGames,
  createLeague,
  insertScores,
  joinLeague,
  resetThrottles,
  setClock,
} from "./helpers";

test.beforeEach(resetThrottles);

const BASE = `http://localhost:${process.env.E2E_PORT ?? 3100}`;
// Freeze "now" at Thu Nov 12, 2026, 3pm ET
const NOW = "2026-11-12T20:00:00Z";

test("standings: day/week/month/all-time, game filter, per-game winners, weekly champion with tie-breaks", async ({
  page,
  browser,
  context,
}) => {
  await setClock(context, NOW, BASE);
  const slug = await createLeague(page, "Standings League", "A", "1234");
  await addCatalogGames(page, slug, ["Wordle", "Krillion"]);
  await page.goto(`/l/${slug}/league`);
  const code = (await page.getByTestId("join-code").textContent())!.trim();
  for (const n of ["B", "C", "D"]) (await joinLeague(browser, code, n, "1111")).ctx.close();

  // Week of Oct 26 - Nov 1 (crosses the DST change on Sun Nov 1):
  //  Mon Oct 26 Wordle: A1 B2 C3 D4 -> A5 B3 C2 D1
  //  Sun Nov  1 Wordle: D1 B2 C3 A4 -> D5 B3 C2 A1
  //  Totals: A 6 (1 win), B 6 (0 wins), D 6 (1 win), C 4  => co-champions A & D (B loses the tie-break)
  // This week (Nov 9-15): Krillion on Nov 10: C 700, A 600  -> C5 A3 ; Nov 12 Wordle: B 2, C 3 -> B5 C3
  await insertScores(slug, [
    { member: "A", game: "Wordle", date: "2026-10-26", value: 1 },
    { member: "B", game: "Wordle", date: "2026-10-26", value: 2 },
    { member: "C", game: "Wordle", date: "2026-10-26", value: 3 },
    { member: "D", game: "Wordle", date: "2026-10-26", value: 4 },
    { member: "D", game: "Wordle", date: "2026-11-01", value: 1 },
    { member: "B", game: "Wordle", date: "2026-11-01", value: 2 },
    { member: "C", game: "Wordle", date: "2026-11-01", value: 3 },
    { member: "A", game: "Wordle", date: "2026-11-01", value: 4 },
    { member: "C", game: "Krillion", date: "2026-11-10", value: 700 },
    { member: "A", game: "Krillion", date: "2026-11-10", value: 600 },
    { member: "B", game: "Wordle", date: "2026-11-12", value: 2 },
    { member: "C", game: "Wordle", date: "2026-11-12", value: 3 },
  ]);
  const pts = async (n: string) =>
    (await page.getByTestId(`standing-${n}`).locator("td").nth(2).textContent())!.trim();

  // Week (current): C 8, B 5, A 3, D 0 + current leader badge
  await page.goto(`/l/${slug}/standings`);
  await expect
    .poll(async () => [await pts("C"), await pts("B"), await pts("A"), await pts("D")])
    .toEqual(["8", "5", "3", "0"]);
  await expect(page.getByTestId("standing-C")).toContainText("Current leader");

  // Day (today = Nov 12): B 5, C 3
  await page.getByRole("link", { name: "Day", exact: true }).click();
  await expect(page).toHaveURL(/period=day/);
  await expect
    .poll(async () => [await pts("B"), await pts("C"), await pts("A")])
    .toEqual(["5", "3", "0"]);

  // Month (November): A 1+3=4, B 3+5=8, C 2+5+3=10, D 5
  await page.getByRole("link", { name: "Month", exact: true }).click();
  await expect
    .poll(async () => [await pts("A"), await pts("B"), await pts("C"), await pts("D")])
    .toEqual(["4", "8", "10", "5"]);

  // All-time: A 5+1+3=9, B 3+3+5=11, C 2+2+5+3=12, D 1+5=6
  await page.getByRole("link", { name: "All-time", exact: true }).click();
  await expect
    .poll(async () => [await pts("A"), await pts("B"), await pts("C"), await pts("D")])
    .toEqual(["9", "11", "12", "6"]);

  // Game filter: All-time Krillion only -> C 5, A 3
  await page.getByLabel("Filter by game").selectOption({ label: "Krillion" });
  await expect(page).toHaveURL(/game=/);
  await expect
    .poll(async () => [await pts("C"), await pts("A"), await pts("B")])
    .toEqual(["5", "3", "0"]);
  await expect(page.getByTestId("game-stats")).toContainText("700");
  await expect(page.getByTestId("daily-winners")).toContainText("C won Krillion");
  // Per-game, all-time Wordle winners per day
  await page.getByLabel("Filter by game").selectOption({ label: "Wordle" });
  await expect(page.getByTestId("daily-winners")).toContainText("B won Wordle");
  await expect(page.getByTestId("daily-winners")).toContainText("D won Wordle");
  await expect(page.getByTestId("daily-winners")).toContainText("A won Wordle");

  // Previous week (completed): co-champions A & D via tie-break; B has 6 points too but 0 wins
  await page.goto(`/l/${slug}/standings?period=week&date=2026-10-28`);
  await expect(page.getByTestId("week-champion")).toHaveText("A & D");
  await expect
    .poll(async () => [await pts("A"), await pts("B"), await pts("D")])
    .toEqual(["6", "6", "6"]);
  await expect(page.getByTestId("standing-B").locator("td").nth(3)).toHaveText("0");

  // Hall of Champions + recap
  await page.goto(`/l/${slug}/champions`);
  await expect(page.getByTestId("trophy-counts")).toContainText("A");
  await expect(page.getByRole("link", { name: /Oct 26 – Nov 1, 2026/ })).toContainText("A & D");
  await page.goto(`/l/${slug}/recap/2026-10-26`);
  await expect(page.getByTestId("recap-champion")).toHaveText("A & D");
  await expect(page.getByTestId("recap")).toContainText("Game of the week winners");
  await expect(page.getByTestId("recap")).toContainText("Biggest single day");
  await expect(page.getByTestId("recap")).toContainText("Weekly Champion");
});

test("weekly champion appears only once the week ends at midnight ET (Sunday -> Monday)", async ({
  page,
  browser,
  context,
}) => {
  // Sunday Nov 8, 11:30pm EST
  await setClock(context, "2026-11-09T04:30:00Z", BASE);
  const slug = await createLeague(page, "Rollover League", "A", "1234");
  await addCatalogGames(page, slug, ["Wordle"]);
  await page.goto(`/l/${slug}/league`);
  const code = (await page.getByTestId("join-code").textContent())!.trim();
  (await joinLeague(browser, code, "B", "1111")).ctx.close();
  await insertScores(slug, [
    { member: "A", game: "Wordle", date: "2026-11-04", value: 2 },
    { member: "B", game: "Wordle", date: "2026-11-04", value: 5 },
  ]);
  await page.goto(`/l/${slug}/standings`);
  await expect(page.getByTestId("standing-A")).toContainText("Current leader");
  await expect(page.getByTestId("week-champion")).toHaveCount(0);
  await page.goto(`/l/${slug}/champions`);
  await expect(page.getByText("No champions yet")).toBeVisible();

  // Monday Nov 9, 12:01am EST -> last week is final
  await setClock(context, "2026-11-09T05:01:00Z", BASE);
  await page.goto(`/l/${slug}/standings?period=week&date=2026-11-04`);
  await expect(page.getByTestId("week-champion")).toHaveText("A");
  await page.goto(`/l/${slug}/champions`);
  await expect(page.getByTestId("trophy-counts")).toContainText("1");
  await page.goto(`/l/${slug}/recap`);
  await expect(page.getByText("🏆 A")).toBeVisible();
});
