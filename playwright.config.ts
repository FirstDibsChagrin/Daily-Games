import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);
export const TEST_DB =
  process.env.E2E_DATABASE_URL ??
  "postgres://daily_league_app:app_password@localhost:5432/daily_league_test";
export const TEST_ADMIN_DB =
  process.env.E2E_DATABASE_ADMIN_URL ??
  "postgres://postgres:postgres@localhost:5432/daily_league_test";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  globalSetup: "./tests/e2e/global-setup.ts",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "off",
    screenshot: "only-on-failure",
    colorScheme: "dark",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } },
    },
  ],
  webServer: {
    command: `npx next build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    timeout: 300_000,
    reuseExistingServer: !process.env.CI,
    env: {
      DATABASE_URL: TEST_DB,
      SESSION_SECRET: "e2e-session-secret-at-least-32-characters-long",
      CRON_SECRET: "e2e-cron-secret",
      ALLOW_TEST_CLOCK: "1",
      NEXT_DIST_DIR: ".next-e2e",
    },
  },
});
