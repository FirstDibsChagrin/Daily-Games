import { expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import postgres from "postgres";
import { TEST_ADMIN_DB } from "../../playwright.config";

export const sql = postgres(TEST_ADMIN_DB, {
  max: 2,
  onnotice: () => {},
  types: { date: { to: 1082, from: [1082], serialize: (x: string) => x, parse: (x: string) => x } },
});

/** Lifts create/join throttles between tests (all tests come from one IP). */
export async function resetThrottles() {
  await sql`delete from rate_limits where key like 'create:%' or key like 'join:%' or key like 'code:%'`;
}

export async function setClock(ctx: BrowserContext, iso: string, baseURL: string) {
  await ctx.addCookies([{ name: "dl_test_now", value: encodeURIComponent(iso), url: baseURL }]);
}

export async function createLeague(
  page: Page,
  league: string,
  name: string,
  pin: string,
): Promise<string> {
  await page.goto("/create");
  await page.fill("#leagueName", league);
  await page.fill("#playerName", name);
  await page.fill("#pin", pin);
  await page.click('button:has-text("Create league")');
  await page.waitForURL(/\/l\/[A-Z2-9]{6}\/settings\/games/);
  return page.url().split("/l/")[1].split("/")[0];
}

export async function joinLeague(
  browser: Browser,
  code: string,
  name: string,
  pin: string,
  opts: { clock?: string } = {},
) {
  const ctx = await browser.newContext();
  const base = "http://localhost:" + (process.env.E2E_PORT ?? 3100);
  if (opts.clock) await setClock(ctx, opts.clock, base);
  const page = await ctx.newPage();
  await page.goto(`/join/${code}`);
  await page.fill("#name", name);
  await page.fill("#pin", pin);
  await page.click('button:has-text("Join league")');
  await page.waitForURL(/\/today/);
  return { ctx, page };
}

export async function addCatalogGames(page: Page, slug: string, names: string[]) {
  await page.goto(`/l/${slug}/settings/games`);
  for (const n of names) {
    await page
      .locator(`[data-testid="catalog-list"] li`, { hasText: n })
      .first()
      .getByRole("checkbox")
      .click();
  }
  await page.click('button:has-text("Add selected")');
  for (const n of names) await expect(page.locator(`[data-testid="game-row-${n}"]`)).toBeVisible();
}

/** The visible entry UI for a game (desktop score-sheet row or phone card). */
export function card(page: Page, game: string) {
  return page.locator(`[data-testid="game-card-${game}"]`).filter({ visible: true });
}

/** Enters one score on the Today screen (raw text or "X") and waits for the save. */
export async function enterScore(page: Page, game: string, raw: string) {
  const c = card(page, game);
  if (raw === "X") {
    await c.getByRole("button", { name: /^X/ }).click();
  } else {
    await c.locator("input").fill(raw);
    await c.getByRole("button", { name: "Save" }).click();
  }
  await expect(c.getByText("Saved")).toBeVisible();
}

export async function leagueIds(slug: string) {
  const [l] = await sql<{ id: string }[]>`select id from leagues where slug = ${slug}`;
  const members = await sql<
    { id: string; name: string }[]
  >`select id, name from members where league_id = ${l.id}`;
  const games = await sql<
    { id: string; name: string }[]
  >`select id, name from league_games where league_id = ${l.id}`;
  return {
    leagueId: l.id,
    member: Object.fromEntries(members.map((m) => [m.name, m.id])) as Record<string, string>,
    game: Object.fromEntries(games.map((g) => [g.name, g.id])) as Record<string, string>,
  };
}

/** Inserts scores directly (fast backfill for history-dependent tests). */
export async function insertScores(
  slug: string,
  rows: { member: string; game: string; date: string; value: number | null }[],
) {
  const ids = await leagueIds(slug);
  for (const r of rows) {
    await sql`
      insert into scores (league_id, member_id, game_id, play_date, value, failed)
      values (${ids.leagueId}, ${ids.member[r.member]}, ${ids.game[r.game]}, ${r.date}, ${r.value}, ${r.value === null})
      on conflict (member_id, game_id, play_date) do update set value = excluded.value, failed = excluded.failed`;
  }
}
