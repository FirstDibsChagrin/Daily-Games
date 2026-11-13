import { expect, test } from "@playwright/test";
import {
  addCatalogGames,
  card,
  createLeague,
  enterScore,
  resetThrottles,
  setClock,
} from "./helpers";

test.beforeEach(resetThrottles);
const BASE = `http://localhost:${process.env.E2E_PORT ?? 3100}`;

const cases: [string, string, string][] = [
  // [instant (UTC), expected game day label, description]
  ["2026-11-14T04:59:00Z", "Fri, Nov 13, 2026", "11:59pm EST stays on Friday"],
  ["2026-11-14T05:00:00Z", "Sat, Nov 14, 2026", "midnight EST rolls to Saturday"],
  ["2026-11-01T03:59:00Z", "Sat, Oct 31, 2026", "11:59pm EDT before fall-back"],
  ["2026-11-01T04:00:00Z", "Sun, Nov 1, 2026", "midnight EDT on fall-back day"],
  ["2026-11-02T04:30:00Z", "Sun, Nov 1, 2026", "11:30pm EST after fall-back is still Sunday"],
  ["2026-11-02T05:00:00Z", "Mon, Nov 2, 2026", "midnight EST after fall-back"],
  ["2026-03-08T04:59:00Z", "Sat, Mar 7, 2026", "11:59pm EST before spring-forward"],
  ["2026-03-08T05:00:00Z", "Sun, Mar 8, 2026", "midnight EST on spring-forward day"],
  ["2026-03-09T03:59:00Z", "Sun, Mar 8, 2026", "11:59pm EDT after spring-forward"],
  ["2026-03-09T04:00:00Z", "Mon, Mar 9, 2026", "midnight EDT"],
];

test("the game day rolls over at midnight Eastern, including DST weeks", async ({
  page,
  context,
}) => {
  const slug = await createLeague(page, "Clock League", "Jack", "1234");
  await addCatalogGames(page, slug, ["Wordle"]);
  for (const [iso, label, why] of cases) {
    await setClock(context, iso, BASE);
    await page.goto(`/l/${slug}/today`);
    await expect(page.getByText(label), why).toBeVisible();
  }

  // A score saved at 11:59pm ET lands on that day, not the next
  await setClock(context, "2026-11-01T03:59:00Z", BASE); // Sat Oct 31, 11:59pm EDT
  await page.goto(`/l/${slug}/today`);
  await enterScore(page, "Wordle", "3");
  await setClock(context, "2026-11-01T04:01:00Z", BASE); // Sun Nov 1, 12:01am EDT
  await page.goto(`/l/${slug}/today`);
  await expect(card(page, "Wordle").getByText("No scores yet")).toBeVisible();
  await page.goto(`/l/${slug}/today?date=2026-10-31`);
  await expect(card(page, "Wordle").getByText("Saved 3")).toBeVisible();
  // The future is still blocked relative to the mocked clock
  const max = await page.getByLabel("Pick a date").getAttribute("max");
  expect(max).toBe("2026-11-01");
});
