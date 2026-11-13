import { expect, test } from "@playwright/test";
import {
  addCatalogGames,
  card,
  createLeague,
  enterScore,
  joinLeague,
  resetThrottles,
} from "./helpers";

test.beforeEach(resetThrottles);

test("the worked examples produce exactly the stated points in the UI", async ({
  page,
  browser,
}) => {
  const slug = await createLeague(page, "Points League", "A", "1234");
  await addCatalogGames(page, slug, ["Wordle", "Krillion"]);
  await page.goto(`/l/${slug}/league`);
  const code = (await page.getByTestId("join-code").textContent())!.trim();
  await page.goto(`/l/${slug}/today`);
  await enterScore(page, "Wordle", "3");
  await enterScore(page, "Krillion", "520");
  const others: [string, string, string | null][] = [
    ["B", "3", "610"],
    ["C", "4", "610"],
    ["E", "5", null],
    ["D", "X", null],
  ];
  for (const [name, wordle, krillion] of others) {
    const { ctx, page: p } = await joinLeague(browser, code, name, "1111");
    await enterScore(p, "Wordle", wordle);
    if (krillion) await enterScore(p, "Krillion", krillion);
    await ctx.close();
  }

  await page.goto(`/l/${slug}/day`);
  const pts = (game: string) =>
    page
      .getByTestId(`day-game-${game}`)
      .locator("li")
      .evaluateAll((lis) =>
        Object.fromEntries(
          lis.map((li) => {
            const kids = [...li.children];
            return [kids[1].textContent!.trim(), kids[kids.length - 1].textContent!.trim()];
          }),
        ),
      );
  // Wordle: A=3, B=3, C=4, E=5, D=X  ->  A=5, B=5, C=2, E=1, D=1
  expect(await pts("Wordle")).toEqual({ A: "+5", B: "+5", C: "+2", E: "+1", D: "+1" });
  // Krillion: A=520, B=610, C=610  ->  B=5, C=5, A=2
  expect(await pts("Krillion")).toEqual({ B: "+5", C: "+5", A: "+2" });

  // Same numbers on the Today board and in the day standings
  await page.goto(`/l/${slug}/today`);
  await expect(card(page, "Krillion").getByRole("list")).toContainText("+2");
  await page.goto(`/l/${slug}/standings?period=day`);
  const row = (n: string) => page.getByTestId(`standing-${n}`);
  await expect(row("B").locator("td").nth(2)).toHaveText("10"); // 5 + 5
  await expect(row("A").locator("td").nth(2)).toHaveText("7"); // 5 + 2
  await expect(row("C").locator("td").nth(2)).toHaveText("7"); // 2 + 5
  await expect(row("E").locator("td").nth(2)).toHaveText("1");
  await expect(row("D").locator("td").nth(2)).toHaveText("1");
  // A and C both have 7 points; C has more wins (Krillion) than A? both have 1 -> shared rank
  await expect(row("B").locator("td").nth(3)).toHaveText("2");
});
