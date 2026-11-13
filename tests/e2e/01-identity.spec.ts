import { expect, test } from "@playwright/test";
import { createLeague, joinLeague, resetThrottles } from "./helpers";

test.beforeEach(resetThrottles);

test("create a league, share code + link, three friends join, reclaim on a new device, PIN lockout", async ({
  page,
  browser,
}) => {
  const slug = await createLeague(page, "Acceptance League", "Jack", "1234");
  await page.goto(`/l/${slug}/league`);
  const code = (await page.getByTestId("join-code").textContent())!.trim();
  expect(code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{6}$/);
  await expect(page.getByText(`/join/${code}`)).toBeVisible();

  // Three simulated friends join from their own devices
  for (const [name, pin] of [
    ["TJ", "1111"],
    ["Cara", "2222"],
    ["Dev", "3333"],
  ]) {
    const { ctx, page: p } = await joinLeague(browser, code, name, pin);
    await expect(p.getByText(`as ${name}`)).toBeVisible();
    await ctx.close();
  }
  await page.goto(`/l/${slug}/league`);
  for (const n of ["Jack", "TJ", "Cara", "Dev"])
    await expect(
      page.getByRole("link", { name: new RegExp(`^${n.slice(0, 1)}\\s*${n}`) }),
    ).toBeVisible();

  // Names are unique, case-insensitively
  const dup = await browser.newContext();
  const dp = await dup.newPage();
  await dp.goto(`/join/${code}`);
  await dp.fill("#name", "tj");
  await dp.fill("#pin", "9999");
  await dp.click('button:has-text("Join league")');
  await expect(dp.getByText(/already taken/)).toBeVisible();
  await dup.close();

  // New device (no cookies): reclaim TJ with the right PIN
  const fresh = await browser.newContext();
  const fp = await fresh.newPage();
  await fp.goto(`/join/${code}`);
  await fp.getByRole("tab", { name: "I've played before" }).click();
  await fp.selectOption("#member", { label: "TJ" });
  await fp.fill("#pin", "1111");
  await fp.click('button:has-text("Sign in")');
  await fp.waitForURL(/\/today/);
  await expect(fp.getByText("as TJ")).toBeVisible();
  await fresh.close();

  // Another new device: 5 wrong PINs locks Cara out for 15 minutes
  const evil = await browser.newContext();
  const ep = await evil.newPage();
  await ep.goto(`/join/${code}`);
  await ep.getByRole("tab", { name: "I've played before" }).click();
  await ep.selectOption("#member", { label: "Cara" });
  for (let i = 1; i <= 5; i++) {
    await ep.fill("#pin", "0000");
    await ep.click('button:has-text("Sign in")');
    await expect(ep.locator("p[role=alert]")).toContainText(
      i < 5 ? `${5 - i} ${5 - i === 1 ? "try" : "tries"} left` : "Try again in 15 minutes",
    );
  }
  // Even the correct PIN is refused while locked
  await ep.fill("#pin", "2222");
  await ep.click('button:has-text("Sign in")');
  await expect(ep.locator("p[role=alert]")).toContainText("Too many attempts");
  await expect(ep).toHaveURL(/\/join\//);
  await evil.close();
});

test("unknown join code is rejected", async ({ page }) => {
  await page.goto("/join");
  await page.fill("#code", "ZZZZZZ");
  await page.click('button:has-text("Continue")');
  await expect(page.locator("p[role=alert]")).toContainText("No league has that code");
});

test("a device can be in several leagues and lists them on the home page", async ({ page }) => {
  await createLeague(page, "League One", "Jack", "1234");
  await createLeague(page, "League Two", "Jack", "1234");
  await page.goto("/");
  await expect(page.getByText("League One")).toBeVisible();
  await expect(page.getByText("League Two")).toBeVisible();
});
