import { expect, test } from "@playwright/test";
import {
  addCatalogGames,
  card,
  createLeague,
  enterScore,
  insertScores,
  joinLeague,
  leagueIds,
  resetThrottles,
  setClock,
} from "./helpers";

test.beforeEach(resetThrottles);
const BASE = `http://localhost:${process.env.E2E_PORT ?? 3100}`;

test("profile shows streaks, per-game stats, charts and badges; deleting a score updates them", async ({
  page,
  browser,
  context,
}) => {
  await setClock(context, "2026-11-12T20:00:00Z", BASE); // Thu Nov 12, 3pm ET
  const slug = await createLeague(page, "Profile League", "Jack", "1234");
  await addCatalogGames(page, slug, ["Wordle", "Krillion", "Connections"]);
  await page.goto(`/l/${slug}/league`);
  const code = (await page.getByTestId("join-code").textContent())!.trim();
  (await joinLeague(browser, code, "TJ", "1111")).ctx.close();

  // Six days of history (Nov 6-11) + today via the UI = a 7-day streak
  const days = ["2026-11-06", "2026-11-07", "2026-11-08", "2026-11-09", "2026-11-10", "2026-11-11"];
  await insertScores(
    slug,
    days.flatMap((d, i) => [
      { member: "Jack", game: "Wordle", date: d, value: 3 + (i % 3) },
      { member: "TJ", game: "Wordle", date: d, value: 4 },
      { member: "Jack", game: "Krillion", date: d, value: 500 + i * 10 },
    ]),
  );
  await page.goto(`/l/${slug}/today`);
  await enterScore(page, "Wordle", "2");

  const { member } = await leagueIds(slug);
  await page.goto(`/l/${slug}/p/${member.Jack}`);
  await expect(page.getByTestId("streak-current")).toContainText("7");
  await expect(page.getByTestId("streak-current")).toContainText("Longest 7 days");
  await expect(page.getByTestId("badge-rookie")).toBeVisible();
  await expect(page.getByTestId("badge-streak_7")).toBeVisible();
  const stats = page.getByTestId("per-game-stats");
  await expect(stats.locator("tr", { hasText: "Wordle" })).toContainText("7"); // plays
  await expect(stats.locator("tr", { hasText: "Krillion" })).toContainText("550"); // best
  // Charts render (trend line + histogram + weekly points)
  await expect(page.locator(".recharts-surface").first()).toBeVisible();
  expect(await page.locator(".recharts-surface").count()).toBeGreaterThanOrEqual(3);

  const allTimePoints = async () =>
    Number((await page.locator("section[aria-label=Summary] p.num").first().textContent())!.trim());
  const before = await allTimePoints();

  // Delete a score in the middle of the streak (Nov 9) from the Today screen for that day
  await page.goto(`/l/${slug}/today?date=2026-11-09`);
  await card(page, "Wordle").getByText("Clear my score").click();
  await card(page, "Krillion").getByText("Clear my score").click();
  await expect(card(page, "Krillion").getByText("No scores yet")).toBeVisible();
  await page.waitForTimeout(1500); // badge sync runs right after the response

  await page.goto(`/l/${slug}/p/${member.Jack}`);
  await expect(page.getByTestId("streak-current")).toContainText("3"); // Nov 10, 11, 12
  await expect(page.getByTestId("streak-current")).toContainText("Longest 3 days");
  await expect(page.getByTestId("badge-streak_7")).toHaveCount(0); // revoked
  expect(await allTimePoints()).toBeLessThan(before); // lost that day's Wordle points
});
