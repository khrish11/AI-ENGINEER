import { test, expect, type Page } from "@playwright/test";

const LESSON_URL = "/curriculum/00-setup-and-tooling/01-dev-environment";

test.describe.configure({ timeout: 240_000 });

async function openLesson(page: Page, url: string = LESSON_URL) {
  // Register the hydration barrier before navigation. /api/auth/status is fetched
  // by the client progress controls only after React has hydrated; until then the
  // SSR-rendered action buttons have no handlers and a click is silently lost.
  const hydrated = page.waitForResponse(
    (res) => res.url().includes("/api/auth/status"),
    { timeout: 30_000 },
  );
  await page.goto(url);
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  await expect(page.getByRole("main").getByTestId("mark-reading-complete")).toBeVisible({
    timeout: 30_000,
  });
  await hydrated;
  // The global sync coordinator now also fetches /api/auth/status on mount, so
  // the response barrier alone no longer proves the controls have handlers.
  // Wait for the controls' own hydration marker before any click lands.
  // The marker is a strict contract: mounted + auth settled + the lesson's
  // progress read settled. Its duration is therefore the page's full client
  // hydration, which on WebKit (long markdown + KaTeX render, single-worker
  // host) measures 5-35s versus 1-2s on Chromium. Budget sized to the slowest
  // supported engine; the assertion itself is unchanged.
  await expect(page.getByRole("main").locator("[data-progress-hydrated]")).toBeVisible({
    timeout: 90_000,
  });
}

async function waitForAutosave(page: Page) {
  // The notes editor autosaves on an 800ms debounce.
  await page.waitForTimeout(1400);
}

async function gotoSettingsHydrated(page: Page) {
  // The settings client fetches /api/auth/status only AFTER React hydrates. Two of
  // this file's checks race that: auth-config-hint is visible until configured=true
  // resolves, and the export/reset handlers attach only post-hydration. Register the
  // barrier before navigation so we always assert the settled, hydrated state rather
  // than a transient pre-hydration frame (which flaked under full-suite contention).
  const hydrated = page.waitForResponse(
    (res) => res.url().includes("/api/auth/status"),
    { timeout: 30_000 },
  );
  await page.goto("/settings");
  await hydrated;
}

test.describe("Guest learner persistence", () => {
  test("marks reading, keeps a note and a bookmark across reloads", async ({ page }) => {
    await openLesson(page);

    const main = page.getByRole("main");
    await expect(main.getByTestId("lesson-status")).toHaveText("Not Started");
    await main.getByTestId("mark-reading-complete").click();
    await expect(main.getByTestId("lesson-status")).not.toHaveText("Not Started");
    await expect(page.getByRole("button", { name: "Reading complete", exact: true }).first()).toBeVisible();

    // Notes autosave locally with a debounce.
    await page.getByRole("tab", { name: /Notes/i }).click();
    const editor = page.getByTestId("notes-editor");
    await editor.fill("Guest note that must survive a reload.");
    await waitForAutosave(page);
    await expect(page.getByText(/characters/)).toBeVisible();

    // Bookmark from the workspace header.
    await page.getByTestId("bookmark-lesson").first().click();
    await expect(page.getByRole("button", { name: "Bookmarked", exact: true }).first()).toBeVisible();

    await page.reload();
    await expect(page.getByRole("main").getByTestId("lesson-status")).not.toHaveText("Not Started");
    await expect(page.getByRole("button", { name: "Reading complete", exact: true }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Bookmarked", exact: true }).first()).toBeVisible();

    await page.getByRole("tab", { name: /Notes/i }).click();
    await expect(page.getByTestId("notes-editor")).toHaveValue(
      "Guest note that must survive a reload."
    );
  });

  test("persists resource progress manually", async ({ page }) => {
    // This lesson has a curated video, repository and documentation.
    await openLesson(page, "/curriculum/00-setup-and-tooling/07-docker-for-ai");
    await page.getByRole("tab", { name: /Resources/i }).click();

    const markWatched = page.getByTestId("mark-watched").first();
    await expect(markWatched).toBeVisible();
    await markWatched.click();
    await expect(page.getByText("Completed").first()).toBeVisible();

    await page.reload();
    await page.getByRole("tab", { name: /Resources/i }).click();
    await expect(page.getByText("Completed").first()).toBeVisible();
  });
});

test.describe("Saved items", () => {
  test("bookmark, filter, remove and keep the removal after reload", async ({ page }) => {
    await openLesson(page);
    await page.getByTestId("bookmark-lesson").first().click();
    await expect(page.getByRole("button", { name: "Bookmarked", exact: true }).first()).toBeVisible();

    await page.goto("/saved");
    await expect(page.getByTestId("saved-item")).toHaveCount(1);
    await page.getByRole("button", { name: /^Lessons/ }).click();
    await expect(page.getByTestId("saved-item")).toHaveCount(1);

    // The coordinator now flushes in the background, so removal also produces
    // a real delete mutation on the wire. Wait for the server to acknowledge
    // it before reloading: reloading mid-transaction (or mid-flush) races the
    // IndexedDB commit and can resurface the optimistic UI state.
    const removalSynced = page.waitForResponse((res) => {
      if (!res.url().includes("/api/sync/v1") || res.request().method() !== "POST") return false;
      if (res.status() !== 200) return false;
      try {
        return String(res.request().postData()).includes('"operation":"delete"');
      } catch {
        return false;
      }
    }, { timeout: 30_000 });

    await page.getByTestId("remove-bookmark").click();
    await expect(page.getByTestId("saved-item")).toHaveCount(0);
    await expect(page.getByText(/No saved items yet/)).toBeVisible();
    await removalSynced;

    await page.reload();
    await expect(page.getByText(/No saved items yet/)).toBeVisible();
  });
});

test.describe("Backup roundtrip", () => {
  test("exports JSON, resets local data and imports the backup", async ({ page }) => {
    await openLesson(page);
    await page.getByTestId("mark-reading-complete").click();
    await page.getByTestId("bookmark-lesson").first().click();
    await expect(page.getByRole("button", { name: "Bookmarked", exact: true }).first()).toBeVisible();

    await gotoSettingsHydrated(page);
    await expect(page.getByTestId("export-progress")).toBeEnabled();
    const downloadPromise = page.waitForEvent("download");
    await page.locator('[data-testid="export-progress"]:visible').first().click();
    const download = await downloadPromise;
    const backupPath = await download.path();
    expect(backupPath).toBeTruthy();

    page.on("dialog", (dialog) => dialog.accept());
    await page.getByTestId("reset-local-data").click();
    await expect(page.getByText(/Local learning data reset/)).toBeVisible();

    await page.setInputFiles('[data-testid="import-file-input"]', backupPath as string);
    await expect(page.getByText("Import Preview")).toBeVisible();
    await page.getByTestId("import-apply").click();
    await expect(page.getByText(/Import applied/)).toBeVisible();

    await openLesson(page);
    await expect(page.getByRole("button", { name: "Reading complete", exact: true }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Bookmarked", exact: true }).first()).toBeVisible();
  });
});

test.describe("Offline behavior", () => {
  test("shows offline state and keeps local activity until the network returns", async ({
    page,
    context,
  }) => {
    await openLesson(page);

    await context.setOffline(true);
    await expect(async () => {
      await page.getByRole("main").getByTestId("mark-reading-complete").click();
      await expect(page.getByTestId("sync-status")).toHaveText("Offline", { timeout: 3_000 });
    }).toPass({ timeout: 30_000 });
    await expect(page.getByRole("button", { name: "Reading complete", exact: true }).first()).toBeVisible();

    // Restore the network. The coordinator now flushes the queued mutation
    // for real (BUG-02 fix), so the badge may transiently read "Syncing" or
    // "Pending sync" before draining to "Synced". Poll to the settled state
    // with time for the round-trip instead of racing it.
    await context.setOffline(false);
    await expect(page.getByTestId("sync-status")).toHaveText(/Local only|Synced/, { timeout: 30_000 });
    await page.reload();
    await expect(page.getByRole("button", { name: "Reading complete", exact: true }).first()).toBeVisible();
  });
});

test.describe("Authentication", () => {
  test.skip(
    !process.env.AUTH_GITHUB_ID && !process.env.AUTH_GOOGLE_ID,
    "OAuth provider credentials are not configured"
  );

  test("shows configured providers on settings", async ({ page }) => {
    await gotoSettingsHydrated(page);
    await expect(page.getByTestId("auth-config-hint")).toBeHidden();
  });
});
