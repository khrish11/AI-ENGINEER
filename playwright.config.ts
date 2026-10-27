import { defineConfig, devices } from "@playwright/test";

// E2E runs against an ISOLATED environment: `npm run test:e2e` (scripts/run-e2e.cjs) provides a
// disposable AUTH_SECRET, dummy OAuth creds, the localhost test DB, and a dedicated port so a
// developer's own :3000/:3001 servers are never raced. Never run bare `playwright test` with a
// server that uses the real AUTH_SECRET — the forged storage state would not (and must not) verify.
const PORT = process.env.E2E_PORT || "3300";
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Next.js dev compiles routes on demand; a single worker keeps first-visit
  // compilation from starving parallel page loads.
  workers: 1,
  // Per-test budget. The default 30s is too tight for webkit document
  // hydration + the background sync coordinator flush on a constrained
  // single-worker host; 60s gives the slowest supported engine real headroom
  // without relaxing any assertion or enabling retries.
  timeout: 60_000,
  reporter: "html",
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: BASE_URL,
    // Session for the disposable e2e user, minted by globalSetup against the throwaway
    // secret. Stored under gitignored playwright/.auth/ — never commit it.
    storageState: "playwright/.auth/state.json",
    trace: "on-first-retry",
    navigationTimeout: 120_000,
    actionTimeout: 30_000,
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
    {
      // Mobile workflows under the auth gate: sidebar/drawer navigation, curriculum
      // click-through, and onboarding roadmap generation at a phone viewport.
      name: "chromium-mobile",
      use: { ...devices["Pixel 7"] },
      testMatch: /navigation\.spec\.ts|curriculum\.spec\.ts|roadmap-new-learner\.spec\.ts/,
    },
  ],

  webServer: {
    // Use the production server in CI so route compilation cannot race across
    // tests or reuse a partially-written .next development bundle. Locally, start
    // the dev server with the isolated e2e env (see scripts/start-e2e-server.cjs).
    command: process.env.CI
      ? "node scripts/start-playwright-server.cjs"
      : "node scripts/start-e2e-server.cjs",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
