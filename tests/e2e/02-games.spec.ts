import { expect, test } from "@playwright/test";
import { addCatalogGames, card, createLeague, joinLeague, resetThrottles, sql } from "./helpers";

test.beforeEach(resetThrottles);

test("creator manages games: checklist, custom, edit, reorder, archive/restore, suggestions; members can't", async ({
  page,
  browser,
}) => {
  const slug = await createLeague(page, "Games League", "Jack", "1234");

  // Several catalog games by checkbox, well under a minute
  const t0 = Date.now();
  await addCatalogGames(page, slug, ["Wordle", "Connections", "Krillion", "Waffle", "Chainle"]);
  expect(Date.now() - t0).toBeLessThan(60_000);
  // Confirmed games carry no tag; games with unconfirmed scoring are tagged
  const catalogItem = (n: string) =>
    page.locator('[data-testid="catalog-list"] li', { hasText: n }).first();
  await expect(catalogItem("Noillirk").getByText("unverified")).toHaveCount(0);
  await expect(catalogItem("Pyralinks").getByText("unverified")).toBeVisible();
  await expect(
    page.locator('[data-testid="catalog-list"] li', { hasText: "Daily Holes" }),
  ).toContainText("relative to par");

  // Custom game
  await page.click("text=Create custom game");
  await page.fill("#new-game-name", "Mini Crossword");
  await page.fill("#new-game-prompt", "Enter your solve time as m:ss.");
  await page.fill("#new-game-example", "e.g. 0:45");
  await page.selectOption("#new-game-type", "time");
  await page.selectOption("#new-game-dir", "lower_is_better");
  await page.click('button:has-text("Create game")');
  await expect(page.getByTestId("game-row-Mini Crossword")).toBeVisible();

  // Inline edit
  const row = page.getByTestId("game-row-Chainle");
  await row.getByRole("button", { name: "Edit Chainle" }).click();
  await row.locator("input[id$='-example']").fill("e.g. 4321");
  await row.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Chainle updated")).toBeVisible();

  // Reorder: move Chainle up one (keyboard-accessible buttons; drag handle also works)
  await row.getByRole("button", { name: "Move Chainle up" }).click();
  await page.waitForTimeout(800);
  await page.goto(`/l/${slug}/today`);
  await expect(card(page, "Wordle")).toBeVisible();
  const order = await page
    .locator("[data-testid^=game-card-]")
    .filter({ visible: true })
    .evaluateAll((els) => els.map((e) => e.getAttribute("data-testid")!.replace("game-card-", "")));
  expect(order).toEqual([
    "Wordle",
    "Connections",
    "Krillion",
    "Chainle",
    "Waffle",
    "Mini Crossword",
  ]);
  await expect(card(page, "Chainle").getByText("e.g. 4321")).toBeVisible();

  // Archive then restore
  await page.goto(`/l/${slug}/settings/games`);
  await page.getByRole("button", { name: "Archive Waffle" }).click();
  await expect(page.getByTestId("archived-games")).toContainText("Waffle");
  await page.goto(`/l/${slug}/today`);
  await expect(card(page, "Waffle")).toHaveCount(0);
  await page.goto(`/l/${slug}/settings/games`);
  await page.getByTestId("archived-games").getByRole("button", { name: "Restore" }).click();
  await expect(page.getByTestId("game-row-Waffle")).toBeVisible();

  // A member suggests two games; they cannot manage games
  await page.goto(`/l/${slug}/league`);
  const code = (await page.getByTestId("join-code").textContent())!.trim();
  const { ctx, page: tj } = await joinLeague(browser, code, "TJ", "1111");
  // Every member can see and share the join code
  await tj.goto(`/l/${slug}/league`);
  await expect(tj.getByTestId("join-code")).toHaveText(code);
  await tj.goto(`/l/${slug}/settings/games`);
  await expect(tj).toHaveURL(/\/league$/);
  await expect(tj.getByRole("link", { name: /Manage games/ })).toHaveCount(0);
  for (const [name, desc] of [
    ["Perceptle", "score out of 100"],
    ["Gridlock", "Points at the end, higher is better"],
  ]) {
    await tj.fill("#sg-name", name);
    await tj.fill("#sg-desc", desc);
    await tj.click('button:has-text("Send suggestion")');
    await expect(tj.getByText("Suggestion sent")).toBeVisible();
  }
  await ctx.close();

  // Creator approves: one via catalog match, one via the prefilled form
  await page.goto(`/l/${slug}/settings/games`);
  await page
    .getByTestId("suggestion")
    .filter({ hasText: "Perceptle" })
    .getByRole("button", { name: /Add Perceptle from catalog/ })
    .click();
  await expect(page.getByTestId("game-row-Perceptle")).toBeVisible();
  await page
    .getByTestId("suggestion")
    .filter({ hasText: "Gridlock" })
    .getByRole("button", { name: /Approve & set up/ })
    .click();
  await expect(page.locator("#new-game-name")).toHaveValue("Gridlock");
  await expect(page.locator("#new-game-prompt")).toHaveValue("Points at the end, higher is better");
  await page.click('button:has-text("Approve & add game")');
  await expect(page.getByTestId("game-row-Gridlock")).toBeVisible();
  await expect(page.getByTestId("suggestion")).toHaveCount(0);
});

test("catalog games added in code work even before the database catalog is reseeded", async ({
  page,
}) => {
  // Simulate a deploy that added a game to lib/catalog-data.ts without reseeding the database
  await sql`delete from catalog_games where key = 'globle'`;
  const slug = await createLeague(page, "New Games League", "Jack", "1234");
  await addCatalogGames(page, slug, ["Globle", "Spotle", "Farflung"]);
  await page.goto(`/l/${slug}/today`);
  await expect(
    card(page, "Globle").getByText("Enter how many guesses it took you to find the country.", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(card(page, "Globle").getByRole("link", { name: /Play Globle/ })).toHaveAttribute(
    "href",
    "https://globle-game.com/",
  );
  const [row] = await sql`select url from catalog_games where key = 'globle'`;
  expect(row.url).toBe("https://globle-game.com/");
});
