import { expect, test } from "@playwright/test";
import {
  addCatalogGames,
  card,
  createLeague,
  enterScore,
  joinLeague,
  resetThrottles,
} from "./helpers";
import { CATALOG } from "../../lib/catalog-data";

test.beforeEach(resetThrottles);

test("entry screen: exact instructions, validation, m:ss, X only where allowed, past days, own scores only", async ({
  page,
  browser,
}) => {
  const slug = await createLeague(page, "Entry League", "Jack", "1234");
  await addCatalogGames(page, slug, ["Wordle", "Krillion", "Minute Cryptic", "Noillirk"]);
  // a time game
  await page.click("text=Create custom game");
  await page.fill("#new-game-name", "Mini");
  await page.fill("#new-game-prompt", "Enter your solve time as m:ss.");
  await page.fill("#new-game-example", "e.g. 0:45");
  await page.selectOption("#new-game-type", "time");
  await page.selectOption("#new-game-dir", "lower_is_better");
  await page.click('button:has-text("Create game")');
  await expect(page.getByTestId("game-row-Mini")).toBeVisible();

  await page.goto(`/l/${slug}/today`);
  // Exact prompt + example for every catalog game
  for (const name of ["Wordle", "Krillion", "Minute Cryptic", "Noillirk"]) {
    const g = CATALOG.find((c) => c.name === name)!;
    await expect(card(page, name).getByText(g.entry_prompt, { exact: true })).toBeVisible();
    await expect(card(page, name).getByText(g.entry_example, { exact: true })).toBeVisible();
  }

  // Invalid values are rejected with friendly messages
  const w = card(page, "Wordle");
  await w.locator("input").fill("7");
  await w.getByRole("button", { name: "Save" }).click();
  await expect(w.locator("p[role=alert]")).toHaveText("Must be between 1 and 6.");
  await w.locator("input").fill("3.5");
  await w.getByRole("button", { name: "Save" }).click();
  await expect(w.locator("p[role=alert]")).toHaveText("Enter a whole number.");
  await card(page, "Noillirk").locator("input").fill("100001");
  await card(page, "Noillirk").getByRole("button", { name: "Save" }).click();
  await expect(card(page, "Noillirk").locator("p[role=alert]")).toContainText(
    "between 0 and 100000",
  );

  // X only where allowed
  await expect(card(page, "Wordle").getByRole("button", { name: /^X/ })).toHaveCount(1);
  await expect(card(page, "Krillion").getByRole("button", { name: /^X/ })).toHaveCount(0);
  await expect(card(page, "Noillirk").getByRole("button", { name: /^X/ })).toHaveCount(0);

  // Valid entries: golf-style +2, decimal, time typed as digits -> m:ss
  await enterScore(page, "Minute Cryptic", "+2");
  await expect(card(page, "Minute Cryptic").getByText("Saved +2")).toBeVisible();
  await enterScore(page, "Noillirk", "8200");
  const mini = card(page, "Mini");
  await mini.locator("input").pressSequentially("235");
  await expect(mini.locator("input")).toHaveValue("2:35");
  await mini.getByRole("button", { name: "Save" }).click();
  await expect(mini.getByText("Saved 2:35")).toBeVisible();
  await enterScore(page, "Wordle", "X");
  await expect(card(page, "Wordle").getByText("Saved X")).toBeVisible();
  // Re-saving updates (one score per game per day)
  await enterScore(page, "Wordle", "4");
  await expect(card(page, "Wordle").getByText("Saved 4")).toBeVisible();

  // Past day via the 7-day strip; the date picker never allows the future
  const dateInput = page.getByLabel("Pick a date");
  const today = await dateInput.getAttribute("max");
  expect(await dateInput.inputValue()).toBe(today);
  const buttons = page.getByRole("navigation", { name: "Choose a day" }).getByRole("button");
  await buttons.nth(5).click(); // yesterday
  await expect(page.getByRole("heading", { name: "Yesterday" })).toBeVisible();
  await expect(page.getByText(/not today/)).toBeVisible();
  await enterScore(page, "Krillion", "480");
  const yesterday = new URL(page.url()).searchParams.get("date")!;
  expect(yesterday < today!).toBe(true);
  // A future date in the URL falls back to today
  await page.goto(`/l/${slug}/today?date=2099-01-01`);
  await expect(page.getByRole("heading", { name: "Today", exact: true })).toBeVisible();

  // Another member sees my numbers but only has controls for their own score
  await page.goto(`/l/${slug}/league`);
  const code = (await page.getByTestId("join-code").textContent())!.trim();
  const { ctx, page: tj } = await joinLeague(browser, code, "TJ", "1111");
  await expect(card(tj, "Wordle").getByRole("list", { name: "Wordle results" })).toContainText(
    "Jack",
  );
  await expect(card(tj, "Wordle").getByRole("list", { name: "Wordle results" })).toContainText("4");
  await expect(card(tj, "Wordle").getByText("Clear my score")).toHaveCount(0);
  await expect(card(tj, "Wordle").locator("input")).toHaveValue("");
  await enterScore(tj, "Wordle", "3");
  await expect(card(tj, "Wordle").getByText("Clear my score")).toHaveCount(1);
  await ctx.close();

  // I can delete my own score
  await page.goto(`/l/${slug}/today`);
  await card(page, "Wordle").getByText("Clear my score").click();
  await expect(card(page, "Wordle").getByText("Saved")).toHaveCount(0);
  await expect(
    card(page, "Wordle").getByRole("list", { name: "Wordle results" }),
  ).not.toContainText("Jack");
  await expect(card(page, "Wordle").getByRole("list", { name: "Wordle results" })).toContainText(
    "TJ",
  );
});
