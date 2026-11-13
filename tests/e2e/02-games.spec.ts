import { expect, test } from "@playwright/test";
import { addCatalogGames, card, createLeague, joinLeague, resetThrottles } from "./helpers";

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
  await expect(
    page
      .locator('[data-testid="catalog-list"] li', { hasText: "Noillirk" })
      .getByText("unverified"),
  ).toBeVisible();

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
  const order = await page
    .locator("[data-testid^=game-card-]")
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
