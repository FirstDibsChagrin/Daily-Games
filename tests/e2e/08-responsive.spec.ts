import { expect, test } from "@playwright/test";
import {
  addCatalogGames,
  createLeague,
  enterScore,
  insertScores,
  joinLeague,
  leagueIds,
  resetThrottles,
} from "./helpers";

test.beforeEach(resetThrottles);

test("looks right at 390px and 1440px in dark and light mode (no horizontal scroll)", async ({
  page,
  browser,
}) => {
  const slug = await createLeague(page, "Visual League", "Jack", "1234");
  await addCatalogGames(page, slug, ["Wordle", "Connections", "Krillion", "Minute Cryptic"]);
  await page.goto(`/l/${slug}/league`);
  const code = (await page.getByTestId("join-code").textContent())!.trim();
  (await joinLeague(browser, code, "TJ", "1111")).ctx.close();
  await page.goto(`/l/${slug}/today`);
  await enterScore(page, "Wordle", "3");
  await insertScores(slug, [
    {
      member: "TJ",
      game: "Wordle",
      date:
        new URL(page.url()).searchParams.get("date") ??
        (await page.getByLabel("Pick a date").getAttribute("max"))!,
      value: 4,
    },
  ]);
  const { member } = await leagueIds(slug);
  const cookies = await page.context().cookies();

  for (const scheme of ["dark", "light"] as const) {
    for (const width of [390, 1440]) {
      const ctx = await browser.newContext({
        viewport: { width, height: width === 390 ? 844 : 900 },
        colorScheme: scheme,
        deviceScaleFactor: 1,
      });
      await ctx.addCookies(cookies);
      const p = await ctx.newPage();
      for (const path of ["today", "standings", `p/${member.Jack}`, "league", "settings/games"]) {
        await p.goto(`/l/${slug}/${path}`);
        await p.waitForLoadState("networkidle");
        const overflow = await p.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth,
        );
        expect(
          overflow,
          `${path} @${width} ${scheme} overflows by ${overflow}px`,
        ).toBeLessThanOrEqual(0);
        const isDark = await p.evaluate(() => document.documentElement.classList.contains("dark"));
        expect(isDark).toBe(scheme === "dark");
        await p.screenshot({
          path: `test-results/screens/${path.replace(/\W+/g, "-")}-${width}-${scheme}.png`,
          fullPage: true,
        });
      }
      if (width === 390) {
        await expect(p.getByRole("navigation", { name: "League" }).last()).toBeVisible(); // bottom tabs
      }
      await ctx.close();
    }
  }
});

test("theme toggle switches between dark and light", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.getByRole("button", { name: "Toggle light/dark mode" }).click();
  await expect(page.locator("html")).toHaveClass(/light/);
});

test("keep-alive cron requires the secret", async ({ request }) => {
  expect((await request.get("/api/cron/keepalive")).status()).toBe(401);
  const ok = await request.get("/api/cron/keepalive", {
    headers: { authorization: "Bearer e2e-cron-secret" },
  });
  expect(ok.status()).toBe(200);
  expect((await ok.json()).ok).toBe(true);
});

test("PWA manifest is served", async ({ request }) => {
  const r = await request.get("/manifest.webmanifest");
  expect(r.status()).toBe(200);
  expect((await r.json()).name).toBe("Daily League");
});
