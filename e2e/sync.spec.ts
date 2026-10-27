import { expect, test, type Page } from "@playwright/test";

// BUG-02 regression coverage: the sync coordinator is the orchestration layer
// that actually pumps IndexedDB mutation queues to /api/sync/v1. These specs
// run under the shared authenticated storageState against the disposable
// e2e-test@example.com account in the isolated localhost test database
// (global-setup re-seeds it every run), so real sync writes are safe here.

const PHASE = "/curriculum/00-setup-and-tooling";
// Distinct lessons per test: each spec gets a fresh browser context (empty
// IndexedDB), but the cloud rows persist for the whole run under the one e2e
// user, so per-test lesson ids keep snapshot assertions unambiguous.
const LESSON_AUTO = `${PHASE}/08-editor-setup`;
const LESSON_RETRY = `${PHASE}/10-terminal-and-shell`;
const LESSON_MANUAL = `${PHASE}/04-apis-and-keys`;
const LESSON_LOGOUT = `${PHASE}/05-jupyter-notebooks`;

test.describe.configure({ timeout: 240_000 });

// These specs are about the sync wire, not the offline shell. The service
// worker passthrough alters request routing on some engines (page.route
// stubs went unintercepted on webkit once the SW claimed the tab), so the
// registration is blocked for this file.
test.use({ serviceWorkers: "block" });

async function openLesson(page: Page, url: string) {
  // Same hydration barrier as progress.spec: /api/auth/status is fetched by
  // the client controls only after React hydrates; clicks before that are
  // silently lost against the SSR markup.
  const hydrated = page.waitForResponse(
    (res) => res.url().includes("/api/auth/status"),
    { timeout: 30_000 },
  );
  await page.goto(url);
  await expect(
    page.getByRole("heading", { level: 1 }).first(),
  ).toBeVisible();
  await expect(page.getByRole("main").getByTestId("mark-reading-complete")).toBeVisible({
    timeout: 30_000,
  });
  await hydrated;
  // Positive interactivity signal from the controls component itself: the
  // global coordinator now also fetches /api/auth/status on mount, so the
  // response barrier above no longer proves THESE buttons have handlers.
  // Strict contract (mounted + auth + progress read settled); the budget matches
  // WebKit's real hydration cost for a lesson page, not a relaxed assertion.
  await expect(page.getByRole("main").locator("[data-progress-hydrated]")).toBeVisible({
    timeout: 90_000,
  });
}

async function gotoSettingsHydrated(page: Page) {
  const hydrated = page.waitForResponse(
    (res) => res.url().includes("/api/auth/status"),
    { timeout: 30_000 },
  );
  await page.goto("/settings");
  await hydrated;
}

/** Intercept only POST /api/sync/v1 with a server error; everything else
 * (including the snapshot GET) falls through to the real server. */
function stubSyncPosts(page: Page, status = 500) {
  return page.route("**/api/sync/v1", (route) =>
    route.request().method() === "POST"
      ? route.fulfill({
          status,
          contentType: "application/json",
          body: JSON.stringify({ error: "stubbed sync failure" }),
        })
      : route.continue(),
  );
}

const postPattern = "**/api/sync/v1";
// The settings surface structurally mounts the responsive nav twice (known
// BUG-08 tree duplication), so the header badge locator must be de-duplicated.
const syncBadge = (page: Page) => page.getByTestId("sync-status").first();
const okSyncPost = (res: import("@playwright/test").Response) =>
  res.url().includes("/api/sync/v1") &&
  res.request().method() === "POST" &&
  res.status() === 200;

test.describe("Cloud sync coordinator", () => {
  test("automatically synchronizes a local lesson mutation and persists it server-side", async ({
    page,
  }) => {
    // Register before the click: the coordinator debounces ~700ms past
    // hydration, so the POST can land while assertions are still pending.
    const posted = page.waitForResponse(okSyncPost, { timeout: 30_000 });
    await openLesson(page, LESSON_AUTO);
    await page.getByRole("main").getByTestId("mark-reading-complete").click();

    const response = await posted;
    expect(response.ok()).toBeTruthy();
    // The server's acknowledgement names the exact entity ids it accepted.
    const ack = (await response.json()) as { accepted: string[] };
    expect(ack.accepted.length).toBeGreaterThan(0);

    // Queue drained on verified acknowledgement -> the badge tells the truth.
    await expect(syncBadge(page)).toHaveText("Synced", { timeout: 30_000 });

    // Actual database persistence evidence: the cloud snapshot (read straight
    // from the API the server builds from Postgres) carries a completed
    // lesson. Entity ids are client record uuids (`accepted` names the queue
    // item id), so the proof is the acked lesson state, not a slug match.
    const snapshot = await page.evaluate(async () => {
      const res = await fetch("/api/sync/v1");
      return res.json() as Promise<{ lessons: Array<{ lessonId?: string; readingComplete?: boolean }> }>;
    });
    expect((snapshot.lessons ?? []).length).toBeGreaterThan(0);
    const row = (snapshot.lessons ?? []).find((l) => l.readingComplete === true);
    expect(row, "marked lesson must appear readingComplete in the cloud snapshot").toBeTruthy();

    // Progress survives a reload from local storage, with nothing left queued.
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Reading complete", exact: true }).first(),
    ).toBeVisible();

    // Authenticated homepage navigation (BUG-01/BUG-07 evidence): the landing
    // page renders signed-in CTAs and never a poisoned cached document.
    await page.goto("/");
    await expect(page.getByTestId("landing-dashboard-cta")).toBeVisible();
    await expect(page.getByTestId("landing-dashboard-hero-cta")).toBeVisible();
  });

  test("a failed sync request keeps the mutation queued and retries automatically", async ({
    page,
  }) => {
    await stubSyncPosts(page);
    await openLesson(page, LESSON_RETRY);
    await page.getByRole("main").getByTestId("mark-reading-complete").click();

    // The stubbed 500 keeps the row pending (never ack-deleted) and the badge
    // reflects real state — no premature "Synced".
    await expect(syncBadge(page)).toHaveText(/Pending sync|Sync error/, {
      timeout: 20_000,
    });
    await expect(
      page.getByRole("button", { name: "Reading complete", exact: true }).first(),
    ).toBeVisible();

    // Reload: the queued mutation survives the page teardown.
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Reading complete", exact: true }).first(),
    ).toBeVisible({ timeout: 30_000 });

    // With the server healthy again the coordinator's retry loop drains the
    // queue with zero user interaction.
    await page.unroute(postPattern);
    await expect(syncBadge(page)).toHaveText("Synced", { timeout: 30_000 });
  });

  test("manual Sync now performs a genuine synchronization", async ({ page }) => {
    // A 401 stub keeps every automatic drain idle (the client treats 401 as
    // "skip", which neither increments retry backoff nor arms retry timers),
    // so any POST that happens after this point is attributable to the click.
    await stubSyncPosts(page, 401);
    await openLesson(page, LESSON_MANUAL);
    await page.getByRole("main").getByTestId("mark-reading-complete").click();
    await expect(syncBadge(page)).toHaveText(/Pending sync|Sync error/, {
      timeout: 20_000,
    });

    await gotoSettingsHydrated(page);
    // Let the settings-mount reconcile drain attempt settle against the stub.
    await page.waitForTimeout(1500);

    const anyPost = (res: import("@playwright/test").Response) =>
      res.url().includes("/api/sync/v1") && res.request().method() === "POST";

    // Click #1: the button must emit a real network request (the BUG-02
    // symptom was "Sync now" producing none even with queued mutations).
    const stubbedPost = page.waitForResponse(anyPost, { timeout: 30_000 });
    await page.getByTestId("sync-now").click();
    expect((await stubbedPost).status()).toBe(401);

    // Click #2 with the server healthy: a genuine sync runs and drains.
    await page.unroute(postPattern);
    const realPost = page.waitForResponse((res) => anyPost(res) && res.status() === 200, {
      timeout: 30_000,
    });
    await page.getByTestId("sync-now").click();
    const response = await realPost;
    expect(response.ok()).toBeTruthy();
    await expect(syncBadge(page)).toHaveText("Synced", { timeout: 30_000 });
  });

  test("a signed-out session bounces off protected routes and never posts sync", async ({
    page,
    context,
  }) => {
    await openLesson(page, LESSON_LOGOUT);
    await page.getByRole("main").getByTestId("mark-reading-complete").click();
    // Give the optimistic auto-sync a chance to exist before removal.
    await page.waitForTimeout(1200);

    await context.clearCookies();
    const syncPosts: string[] = [];
    page.on("request", (req) => {
      if (req.method() === "POST" && req.url().includes("/api/sync/v1")) {
        syncPosts.push(req.url());
      }
    });

    // Route protection: protected pages redirect signed-out visitors to the
    // sign-in surface with a callback url instead of rendering stale state.
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/settings\?callbackUrl=/);

    // Demotion: the coordinator sees the guest session, flips the local
    // profile, and the badge says "Local only" (BUG-03 semantics) while the
    // queued local mutation is preserved, never posted (guest gate).
    // Navigate to the homepage to trigger coordinator to re-read auth status
    await page.goto("/");
    await expect(async () => {
      await expect(syncBadge(page)).toHaveText("Local only");
    }).toPass({ timeout: 20_000 });
    // Wait for any in-flight sync to complete and ensure no new syncs start
    await page.waitForTimeout(6000);
    expect(syncPosts).toHaveLength(0);
  });
});
